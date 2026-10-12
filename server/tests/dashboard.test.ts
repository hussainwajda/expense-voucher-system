import { beforeAll, describe, expect, it } from 'vitest';
import { EMAILS, approve, createDraft, createSubmitted, loginAs, reject, resetDatabase, type Agent } from './helpers.js';

let employee: Agent;
let director: Agent;
let accounts: Agent;

beforeAll(async () => {
  const fx = await resetDatabase();
  employee = await loginAs(EMAILS.employee);
  const other = await loginAs(EMAILS.otherEmployee);
  director = await loginAs(EMAILS.director);
  accounts = await loginAs(EMAILS.accounts);

  await createDraft(employee, fx, { amount: 50 });
  const a = await createSubmitted(employee, fx, { amount: 1000 });
  const b = await createSubmitted(employee, fx, { amount: 2000 });
  await createSubmitted(employee, fx, { amount: 300 });
  const c = await createSubmitted(other, fx, { amount: 700 });
  await approve(director, a.id);
  await reject(director, b.id);
  await approve(director, c.id);
});

describe('dashboards', () => {
  it('shows an employee only their own numbers', async () => {
    const res = await employee.get('/api/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('EMPLOYEE');
    expect(res.body.stats).toEqual({
      totalVouchers: 4,
      draftVouchers: 1,
      pendingApproval: 1,
      approvedVouchers: 1,
      rejectedVouchers: 1,
      totalAmountClaimed: 3300, // drafts are not claimed yet
      approvedAmount: 1000,
    });
    expect(res.body.recentVouchers).toHaveLength(4);
  });

  it('shows the director pending work and today\'s decisions', async () => {
    const res = await director.get('/api/dashboard');
    expect(res.body.role).toBe('DIRECTOR');
    expect(res.body.stats).toEqual({ pendingApproval: 1, approvedToday: 2, rejectedToday: 1, totalPendingAmount: 300 });
    expect(res.body.awaitingApproval.map((v: { amount: number }) => v.amount)).toEqual([300]);
    const types = res.body.recentActivity.map((a: { type: string }) => a.type);
    expect(types).not.toContain('CREATED');
    expect(types.filter((t: string) => t === 'SUBMITTED')).toHaveLength(4);
    expect(types[0]).toBe('APPROVED');
  });

  it('shows accounts organisation-wide totals without drafts', async () => {
    const res = await accounts.get('/api/dashboard');
    expect(res.body.role).toBe('ACCOUNTS');
    expect(res.body.stats).toEqual({
      totalVouchers: 4,
      pendingApproval: 1,
      approvedVouchers: 2,
      rejectedVouchers: 1,
      totalApprovedAmount: 1700,
    });
    expect(res.body.recentApproved.map((v: { status: string }) => v.status)).toEqual(['APPROVED', 'APPROVED']);
  });
});
