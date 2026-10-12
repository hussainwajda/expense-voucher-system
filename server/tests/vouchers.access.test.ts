import { beforeEach, describe, expect, it } from 'vitest';
import {
  EMAILS,
  approve,
  createDraft,
  createSubmitted,
  loginAs,
  resetDatabase,
  signaturePng,
  voucherInput,
  type Agent,
  type Fixture,
} from './helpers.js';

let fx: Fixture;
let employee: Agent;
let other: Agent;
let director: Agent;
let accounts: Agent;

beforeEach(async () => {
  fx = await resetDatabase();
  [employee, other, director, accounts] = await Promise.all([
    loginAs(EMAILS.employee),
    loginAs(EMAILS.otherEmployee),
    loginAs(EMAILS.director),
    loginAs(EMAILS.accounts),
  ]);
});

describe('employees only see their own vouchers', () => {
  it('hides other employees vouchers from lists and direct access', async () => {
    const mine = await createSubmitted(employee, fx);
    await createDraft(other, fx, { title: 'Other draft' });

    const list = await employee.get('/api/vouchers');
    expect(list.body.data.map((v: { id: number }) => v.id)).toEqual([mine.id]);

    const theirs = await other.get('/api/vouchers');
    expect(theirs.body.data).toHaveLength(1);
    expect(theirs.body.data[0].title).toBe('Other draft');

    // Not 403: we don't confirm that someone else's voucher exists.
    expect((await other.get(`/api/vouchers/${mine.id}`)).status).toBe(404);
    expect((await other.get(`/api/vouchers/${mine.id}/signatures/employee`)).status).toBe(404);
    expect((await other.patch(`/api/vouchers/${mine.id}`).send({ amount: 1 })).status).toBe(404);
    expect((await other.post(`/api/vouchers/${mine.id}/duplicate`)).status).toBe(404);
  });

  it('cannot approve or reject', async () => {
    const v = await createSubmitted(employee, fx);
    expect((await employee.post(`/api/vouchers/${v.id}/approve`).send({ useSavedSignature: true })).status).toBe(403);
    expect((await employee.post(`/api/vouchers/${v.id}/reject`).send({ reason: 'Self-rejecting' })).status).toBe(403);
  });

  it('cannot export the organisation-wide CSV', async () => {
    expect((await employee.get('/api/vouchers/export')).status).toBe(403);
  });
});

describe('director', () => {
  it('sees every submitted voucher but not other people\'s drafts', async () => {
    const draft = await createDraft(employee, fx, {}, true);
    const pending = await createSubmitted(other, fx);
    const list = await director.get('/api/vouchers');
    expect(list.body.data.map((v: { id: number }) => v.id)).toEqual([pending.id]);
    expect((await director.get(`/api/vouchers/${draft.id}`)).status).toBe(404);
    expect((await director.get(`/api/vouchers/${pending.id}`)).body.voucher.permissions).toMatchObject({
      canApprove: true,
      canReject: true,
      canEdit: false,
    });
  });

  it('cannot create, edit or delete vouchers', async () => {
    const v = await createSubmitted(employee, fx);
    expect((await director.post('/api/vouchers').send(voucherInput(fx))).status).toBe(403);
    expect((await director.patch(`/api/vouchers/${v.id}`).send({ amount: 1 })).status).toBe(403);
    expect((await director.delete(`/api/vouchers/${v.id}`)).status).toBe(403);
  });
});

describe('accounts team', () => {
  it('sees all submitted vouchers with both signatures', async () => {
    const v = await createSubmitted(employee, fx);
    await approve(director, v.id);
    await createSubmitted(other, fx);
    await createDraft(other, fx);

    const list = await accounts.get('/api/vouchers');
    expect(list.body.pagination.total).toBe(2);

    const detail = await accounts.get(`/api/vouchers/${v.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.voucher.permissions).toEqual({
      canEdit: false,
      canDelete: false,
      canSubmit: false,
      canDuplicate: false,
      canApprove: false,
      canReject: false,
    });
    expect((await accounts.get(detail.body.voucher.employeeSignatureUrl)).status).toBe(200);
    expect((await accounts.get(detail.body.voucher.directorSignatureUrl)).status).toBe(200);
  });

  it('cannot create, edit, delete, approve or reject', async () => {
    const v = await createSubmitted(employee, fx);
    const attempts = await Promise.all([
      accounts.post('/api/vouchers').send(voucherInput(fx)),
      accounts.patch(`/api/vouchers/${v.id}`).send({ amount: 1 }),
      accounts.delete(`/api/vouchers/${v.id}`),
      accounts.post(`/api/vouchers/${v.id}/approve`).attach('signature', signaturePng, { filename: 'a.png', contentType: 'image/png' }),
      accounts.post(`/api/vouchers/${v.id}/reject`).send({ reason: 'Not allowed to do this' }),
      accounts.put('/api/users/me/signature').attach('signature', signaturePng, { filename: 'a.png', contentType: 'image/png' }),
    ]);
    for (const res of attempts) expect(res.status).toBe(403);
  });

  it('exports vouchers as CSV', async () => {
    await createSubmitted(employee, fx, { title: '=HYPERLINK("http://evil")', description: 'Line one, "quoted"' });
    const res = await accounts.get('/api/vouchers/export');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="vouchers-/);
    const lines = res.text.replace(/^﻿/, '').trim().split('\r\n');
    expect(lines[0]).toMatch(/^Voucher Number,Voucher Date,Expense Date,Employee Name/);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain(`"'=HYPERLINK(""http://evil"")"`); // formula neutralised and quoted
    expect(lines[1]).toContain('"Line one, ""quoted"""');
  });
});
