import bcrypt from 'bcryptjs';
import request from 'supertest';
import { expect } from 'vitest';
import { renderSignaturePng } from '../scripts/lib/signature-png.js';
import { createApp } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { todayIso } from '../src/lib/dates.js';

export const app = createApp();
export const PASSWORD = 'Secret@123';
export const signaturePng = renderSignaturePng('Test Signer');

export type Agent = ReturnType<typeof request.agent>;

export interface Fixture {
  engineering: number;
  finance: number;
  travel: number;
  meals: number;
  users: { employee: number; otherEmployee: number; director: number; accounts: number };
}

export const EMAILS = {
  employee: 'employee@test.example',
  otherEmployee: 'other@test.example',
  director: 'director@test.example',
  accounts: 'accounts@test.example',
};

export function daysAgo(n: number) {
  const d = new Date(`${todayIso()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Empty every table and insert a small, known set of lookups and users. */
export async function resetDatabase(): Promise<Fixture> {
  await pool.query(`
    TRUNCATE voucher_events, vouchers, users, departments, expense_categories RESTART IDENTITY CASCADE;
    ALTER SEQUENCE voucher_number_seq RESTART WITH 1;`);

  const insertName = async (table: string, name: string) =>
    (await pool.query<{ id: number }>(`INSERT INTO ${table} (name) VALUES ($1) RETURNING id`, [name])).rows[0]!.id;

  const engineering = await insertName('departments', 'Engineering');
  const finance = await insertName('departments', 'Finance');
  const travel = await insertName('expense_categories', 'Travel');
  const meals = await insertName('expense_categories', 'Food & Meals');

  const hash = await bcrypt.hash(PASSWORD, 4);
  const insertUser = async (name: string, email: string, role: string, code: string | null, dept: number) =>
    (
      await pool.query<{ id: number }>(
        `INSERT INTO users (full_name, email, password_hash, role, employee_code, department_id)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [name, email, hash, role, code, dept],
      )
    ).rows[0]!.id;

  return {
    engineering,
    finance,
    travel,
    meals,
    users: {
      employee: await insertUser('Asha Employee', EMAILS.employee, 'EMPLOYEE', 'EMP-1', engineering),
      otherEmployee: await insertUser('Bala Other', EMAILS.otherEmployee, 'EMPLOYEE', 'EMP-2', finance),
      director: await insertUser('Dev Director', EMAILS.director, 'DIRECTOR', null, finance),
      accounts: await insertUser('Anu Accounts', EMAILS.accounts, 'ACCOUNTS', null, finance),
    },
  };
}

export async function loginAs(email: string): Promise<Agent> {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password: PASSWORD });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return agent;
}

export function voucherInput(fx: Fixture, overrides: Record<string, unknown> = {}) {
  return {
    expenseDate: daysAgo(1),
    departmentId: fx.engineering,
    categoryId: fx.travel,
    title: 'Taxi to client office',
    description: 'Return trip for the quarterly review',
    amount: 450.5,
    ...overrides,
  };
}

/** Create a draft through the API; with `signed`, attach a signature via multipart. */
export async function createDraft(agent: Agent, fx: Fixture, overrides: Record<string, unknown> = {}, signed = false) {
  const input = voucherInput(fx, overrides);
  let req = agent.post('/api/vouchers');
  if (signed) {
    for (const [key, value] of Object.entries(input)) req = req.field(key, String(value));
    req = req.attach('signature', signaturePng, { filename: 'sig.png', contentType: 'image/png' });
  } else {
    req = req.send(input);
  }
  const res = await req;
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.voucher as { id: number; voucherNumber: string; status: string; amount: number };
}

export async function createSubmitted(agent: Agent, fx: Fixture, overrides: Record<string, unknown> = {}) {
  const draft = await createDraft(agent, fx, overrides, true);
  const res = await agent.post(`/api/vouchers/${draft.id}/submit`);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body.voucher as typeof draft;
}

export async function approve(director: Agent, id: number) {
  const res = await director
    .post(`/api/vouchers/${id}/approve`)
    .attach('signature', signaturePng, { filename: 'director.png', contentType: 'image/png' });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body.voucher;
}

export async function reject(director: Agent, id: number, reason = 'Missing the original receipt.') {
  const res = await director.post(`/api/vouchers/${id}/reject`).send({ reason });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body.voucher;
}
