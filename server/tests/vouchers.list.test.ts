import { beforeAll, describe, expect, it } from 'vitest';
import {
  EMAILS,
  approve,
  createDraft,
  createSubmitted,
  daysAgo,
  loginAs,
  reject,
  resetDatabase,
  type Agent,
  type Fixture,
} from './helpers.js';

let fx: Fixture;
let director: Agent;
const ids: Record<string, number> = {};

// One dataset for the whole file: list queries don't modify anything.
beforeAll(async () => {
  fx = await resetDatabase();
  const employee = await loginAs(EMAILS.employee);
  const other = await loginAs(EMAILS.otherEmployee);
  director = await loginAs(EMAILS.director);

  ids.taxi = (await createSubmitted(employee, fx, { title: 'Taxi 100%', amount: 300, voucherDate: daysAgo(10), expenseDate: daysAgo(11) })).id;
  ids.flight = (await createSubmitted(employee, fx, { title: 'Flight', amount: 9000, categoryId: fx.travel, voucherDate: daysAgo(5), expenseDate: daysAgo(6) })).id;
  ids.lunch = (await createSubmitted(other, fx, { title: 'Team lunch', amount: 1500, departmentId: fx.finance, categoryId: fx.meals, voucherDate: daysAgo(2), expenseDate: daysAgo(2) })).id;
  ids.hotel = (await createSubmitted(other, fx, { title: 'Hotel', amount: 4000, departmentId: fx.finance, voucherDate: daysAgo(1), expenseDate: daysAgo(1) })).id;
  await createDraft(employee, fx, { title: 'Draft only' });

  await approve(director, ids.flight);
  await reject(director, ids.hotel);
});

async function list(query: Record<string, string | number>) {
  const res = await director.get('/api/vouchers').query(query);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body as { data: Array<{ id: number; title: string; amount: number }>; pagination: { total: number; totalPages: number } };
}

const titles = (body: { data: Array<{ title: string }> }) => body.data.map((v) => v.title);

describe('search, filter and sort', () => {
  it('returns newest first by default and excludes drafts for the director', async () => {
    const body = await list({});
    expect(body.pagination.total).toBe(4);
    expect(titles(body)).toEqual(['Hotel', 'Team lunch', 'Flight', 'Taxi 100%']);
  });

  it('filters by status', async () => {
    expect(titles(await list({ status: 'APPROVED' }))).toEqual(['Flight']);
    expect(titles(await list({ status: 'REJECTED' }))).toEqual(['Hotel']);
    expect(titles(await list({ status: 'PENDING_APPROVAL', sortBy: 'amount', sortOrder: 'asc' }))).toEqual(['Taxi 100%', 'Team lunch']);
  });

  it('filters by department and category', async () => {
    expect(titles(await list({ departmentId: fx.finance, sortBy: 'title', sortOrder: 'asc' }))).toEqual(['Hotel', 'Team lunch']);
    expect(titles(await list({ categoryId: fx.meals }))).toEqual(['Team lunch']);
  });

  it('searches by voucher number, employee name and title', async () => {
    const all = await list({});
    const flight = all.data.find((v) => v.title === 'Flight') as unknown as { voucherNumber: string };
    expect(titles(await list({ q: flight.voucherNumber }))).toEqual(['Flight']);
    expect(titles(await list({ voucherNumber: flight.voucherNumber.slice(-3) }))).toEqual(['Flight']);
    expect(titles(await list({ employeeName: 'bala', sortBy: 'title', sortOrder: 'asc' }))).toEqual(['Hotel', 'Team lunch']);
    expect(titles(await list({ q: 'lunch' }))).toEqual(['Team lunch']);
  });

  it('treats % and _ in searches literally', async () => {
    expect(titles(await list({ q: '100%' }))).toEqual(['Taxi 100%']);
    expect((await list({ q: '%' })).data).toHaveLength(1);
  });

  it('filters by voucher date range and amount range', async () => {
    expect(titles(await list({ dateFrom: daysAgo(5), dateTo: daysAgo(2), sortBy: 'voucherDate', sortOrder: 'asc' }))).toEqual(['Flight', 'Team lunch']);
    expect(titles(await list({ amountMin: 1000, amountMax: 5000, sortBy: 'amount', sortOrder: 'desc' }))).toEqual(['Hotel', 'Team lunch']);
  });

  it('sorts by amount both ways', async () => {
    expect((await list({ sortBy: 'amount', sortOrder: 'asc' })).data.map((v) => v.amount)).toEqual([300, 1500, 4000, 9000]);
    expect((await list({ sortBy: 'amount', sortOrder: 'desc' })).data.map((v) => v.amount)).toEqual([9000, 4000, 1500, 300]);
  });

  it('paginates', async () => {
    const page1 = await list({ pageSize: 3, page: 1, sortBy: 'amount', sortOrder: 'asc' });
    const page2 = await list({ pageSize: 3, page: 2, sortBy: 'amount', sortOrder: 'asc' });
    expect(page1.pagination).toMatchObject({ total: 4, totalPages: 2 });
    expect(page1.data).toHaveLength(3);
    expect(page2.data.map((v) => v.amount)).toEqual([9000]);
  });

  it('validates query parameters', async () => {
    const badSort = await director.get('/api/vouchers').query({ sortBy: 'password_hash' });
    const badRange = await director.get('/api/vouchers').query({ dateFrom: daysAgo(1), dateTo: daysAgo(5) });
    const badAmount = await director.get('/api/vouchers').query({ amountMin: 500, amountMax: 100 });
    expect(badSort.status).toBe(400);
    expect(badRange.status).toBe(400);
    expect(badAmount.status).toBe(400);
    expect(badAmount.body.error.details).toHaveProperty('amountMax');
  });
});
