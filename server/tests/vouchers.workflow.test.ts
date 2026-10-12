import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool.js';
import {
  EMAILS,
  approve,
  createDraft,
  createSubmitted,
  daysAgo,
  loginAs,
  reject,
  resetDatabase,
  signaturePng,
  voucherInput,
  type Agent,
  type Fixture,
} from './helpers.js';

let fx: Fixture;
let employee: Agent;
let director: Agent;

beforeEach(async () => {
  fx = await resetDatabase();
  employee = await loginAs(EMAILS.employee);
  director = await loginAs(EMAILS.director);
});

describe('creating vouchers', () => {
  it('saves a new voucher as a Draft with a generated voucher number', async () => {
    const res = await employee.post('/api/vouchers').send(voucherInput(fx));
    expect(res.status).toBe(201);
    const v = res.body.voucher;
    expect(v.status).toBe('DRAFT');
    expect(v.voucherNumber).toMatch(/^EV-\d{4}-\d{5}$/);
    expect(v.employee).toMatchObject({ name: 'Asha Employee', employeeCode: 'EMP-1' });
    expect(v.department.name).toBe('Engineering');
    expect(v.amount).toBe(450.5);
    expect(v.employeeSignatureUrl).toBeNull();
    expect(v.permissions).toMatchObject({ canEdit: true, canDelete: true, canSubmit: true, canApprove: false });
    expect(v.history.map((h: { type: string }) => h.type)).toEqual(['CREATED']);
  });

  it('gives every voucher a unique, increasing number', async () => {
    const a = await createDraft(employee, fx);
    const b = await createDraft(employee, fx);
    expect(a.voucherNumber).not.toBe(b.voucherNumber);
    expect(b.voucherNumber > a.voucherNumber).toBe(true);
  });

  it('ignores fields an employee must not set (status, owner, number)', async () => {
    const res = await employee
      .post('/api/vouchers')
      .send({ ...voucherInput(fx), status: 'APPROVED', employeeId: fx.users.otherEmployee, voucherNumber: 'HACK-1' });
    expect(res.status).toBe(201);
    expect(res.body.voucher.status).toBe('DRAFT');
    expect(res.body.voucher.employee.id).toBe(fx.users.employee);
    expect(res.body.voucher.voucherNumber).not.toBe('HACK-1');
  });

  it('requires department, title, expense date and amount', async () => {
    const res = await employee.post('/api/vouchers').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.details).toMatchObject({
      departmentId: ['Department is required.'],
      title: ['Expense title is required.'],
      expenseDate: ['Expense date is required.'],
      amount: ['Amount is required.'],
    });
  });

  it.each([
    [{ amount: 0 }, 'amount', 'Amount must be greater than zero.'],
    [{ amount: -10 }, 'amount', 'Amount must be greater than zero.'],
    [{ amount: 10.123 }, 'amount', 'Amount can have at most 2 decimal places.'],
    [{ amount: 'abc' }, 'amount', 'Amount must be a number.'],
    [{ title: '   ' }, 'title', 'Expense title is required.'],
    [{ expenseDate: daysAgo(-1) }, 'expenseDate', 'Expense date cannot be in the future.'],
    [{ expenseDate: daysAgo(3), voucherDate: daysAgo(5) }, 'expenseDate', 'Expense date cannot be after the voucher date.'],
    [{ expenseDate: '2026-02-30' }, 'expenseDate', 'Expense date must be a valid date (YYYY-MM-DD).'],
  ])('rejects invalid input %o', async (overrides, field, message) => {
    const res = await employee.post('/api/vouchers').send(voucherInput(fx, overrides));
    expect(res.status).toBe(400);
    expect(res.body.error.details[field]).toContain(message);
  });

  it('rejects an unknown department or category', async () => {
    const res = await employee.post('/api/vouchers').send(voucherInput(fx, { departmentId: 999, categoryId: 999 }));
    expect(res.status).toBe(400);
    expect(res.body.error.details).toHaveProperty('departmentId');
    expect(res.body.error.details).toHaveProperty('categoryId');
  });

  it('accepts multipart form data with a signature image', async () => {
    const v = await createDraft(employee, fx, {}, true);
    const detail = await employee.get(`/api/vouchers/${v.id}`);
    expect(detail.body.voucher.employeeSignatureUrl).toMatch(new RegExp(`^/api/vouchers/${v.id}/signatures/employee`));

    const image = await employee.get(detail.body.voucher.employeeSignatureUrl);
    expect(image.status).toBe(200);
    expect(image.headers['content-type']).toBe('image/png');
    expect(Buffer.compare(image.body as Buffer, signaturePng)).toBe(0);
  });

  it('rejects files that are not really images, whatever their declared type', async () => {
    let req = employee.post('/api/vouchers');
    for (const [key, value] of Object.entries(voucherInput(fx))) req = req.field(key, String(value));
    const res = await req.attach('signature', Buffer.from('<svg onload="alert(1)"></svg>'), {
      filename: 'evil.png',
      contentType: 'image/png',
    });
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
    expect((await employee.get('/api/vouchers')).body.pagination.total).toBe(0);
  });

  it('rejects signature images over the size limit', async () => {
    const big = Buffer.concat([signaturePng, Buffer.alloc(1.2 * 1024 * 1024)]);
    const res = await employee.post('/api/vouchers').attach('signature', big, { filename: 'big.png', contentType: 'image/png' });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('FILE_TOO_LARGE');
  });
});

describe('editing and deleting drafts', () => {
  it('applies partial updates and keeps other fields', async () => {
    const v = await createDraft(employee, fx);
    const res = await employee.patch(`/api/vouchers/${v.id}`).send({ title: 'Airport taxi', amount: '999.99' });
    expect(res.status).toBe(200);
    expect(res.body.voucher).toMatchObject({ title: 'Airport taxi', amount: 999.99, description: 'Return trip for the quarterly review' });
    expect(res.body.voucher.history.map((h: { type: string }) => h.type)).toEqual(['CREATED', 'UPDATED']);
  });

  it('deletes a draft', async () => {
    const v = await createDraft(employee, fx);
    expect((await employee.delete(`/api/vouchers/${v.id}`)).status).toBe(204);
    expect((await employee.get(`/api/vouchers/${v.id}`)).status).toBe(404);
  });
});

describe('submitting', () => {
  it('requires the employee signature before submission', async () => {
    const v = await createDraft(employee, fx);
    const res = await employee.post(`/api/vouchers/${v.id}/submit`);
    expect(res.status).toBe(400);
    expect(res.body.error.details.signature[0]).toMatch(/signature is required/i);
    expect((await employee.get(`/api/vouchers/${v.id}`)).body.voucher.status).toBe('DRAFT');
  });

  it('moves a signed draft to Pending Approval', async () => {
    const v = await createDraft(employee, fx);
    await employee.patch(`/api/vouchers/${v.id}`).attach('signature', signaturePng, { filename: 's.png', contentType: 'image/png' });
    const res = await employee.post(`/api/vouchers/${v.id}/submit`);
    expect(res.status).toBe(200);
    expect(res.body.voucher.status).toBe('PENDING_APPROVAL');
    expect(res.body.voucher.submittedAt).toEqual(expect.any(String));
    expect(res.body.voucher.permissions).toMatchObject({ canEdit: false, canDelete: false, canSubmit: false });
    expect(res.body.voucher.history.map((h: { type: string }) => h.type)).toEqual(['CREATED', 'UPDATED', 'SUBMITTED']);
  });

  it('makes the voucher read-only for the employee once submitted', async () => {
    const v = await createSubmitted(employee, fx);
    const edit = await employee.patch(`/api/vouchers/${v.id}`).send({ amount: 1 });
    const del = await employee.delete(`/api/vouchers/${v.id}`);
    const again = await employee.post(`/api/vouchers/${v.id}/submit`);
    for (const res of [edit, del, again]) {
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_STATE');
    }
    expect((await employee.get(`/api/vouchers/${v.id}`)).body.voucher.amount).toBe(450.5);
  });

  it('can sign with the saved profile signature, and later profile changes do not alter the voucher', async () => {
    const saved = await employee.put('/api/users/me/signature').attach('signature', signaturePng, { filename: 's.png', contentType: 'image/png' });
    expect(saved.status).toBe(200);
    expect(saved.body.user.hasSignature).toBe(true);

    const res = await employee.post('/api/vouchers').send(voucherInput(fx, { useSavedSignature: true }));
    expect(res.status).toBe(201);
    const before = (await pool.query('SELECT employee_signature_path FROM vouchers WHERE id = $1', [res.body.voucher.id])).rows[0];
    expect(before.employee_signature_path).toBeTruthy();

    await employee.delete('/api/users/me/signature');
    const image = await employee.get(res.body.voucher.employeeSignatureUrl);
    expect(image.status).toBe(200);
  });

  it('explains when there is no saved signature to use', async () => {
    const res = await employee.post('/api/vouchers').send(voucherInput(fx, { useSavedSignature: 'true' }));
    expect(res.status).toBe(400);
    expect(res.body.error.details.signature[0]).toMatch(/no saved signature/i);
  });
});

describe('director decisions', () => {
  it('requires the director signature before approval', async () => {
    const v = await createSubmitted(employee, fx);
    const res = await director.post(`/api/vouchers/${v.id}/approve`).send({});
    expect(res.status).toBe(400);
    expect(res.body.error.details).toHaveProperty('signature');
    expect((await director.get(`/api/vouchers/${v.id}`)).body.voucher.status).toBe('PENDING_APPROVAL');
  });

  it('approves with a signature and records who approved it and when', async () => {
    const v = await createSubmitted(employee, fx);
    const approved = await approve(director, v.id);
    expect(approved.status).toBe('APPROVED');
    expect(approved.decidedBy).toMatchObject({ id: fx.users.director, name: 'Dev Director' });
    expect(approved.decidedAt).toEqual(expect.any(String));
    expect(approved.directorSignatureUrl).toMatch(/signatures\/director/);
    expect(approved.permissions).toMatchObject({ canApprove: false, canReject: false });
  });

  it('can approve using the saved signature', async () => {
    const v = await createSubmitted(employee, fx);
    await director.put('/api/users/me/signature').attach('signature', signaturePng, { filename: 'd.png', contentType: 'image/png' });
    const res = await director.post(`/api/vouchers/${v.id}/approve`).send({ useSavedSignature: true });
    expect(res.status).toBe(200);
    expect(res.body.voucher.status).toBe('APPROVED');
  });

  it('makes approved vouchers final', async () => {
    const v = await createSubmitted(employee, fx);
    await approve(director, v.id);
    const again = await director.post(`/api/vouchers/${v.id}/approve`).attach('signature', signaturePng, { filename: 'd.png', contentType: 'image/png' });
    const rejectAfter = await director.post(`/api/vouchers/${v.id}/reject`).send({ reason: 'Changed my mind' });
    expect(again.status).toBe(409);
    expect(rejectAfter.status).toBe(409);
  });

  it('requires a rejection reason', async () => {
    const v = await createSubmitted(employee, fx);
    const missing = await director.post(`/api/vouchers/${v.id}/reject`).send({});
    const blank = await director.post(`/api/vouchers/${v.id}/reject`).send({ reason: '    ' });
    expect(missing.status).toBe(400);
    expect(blank.status).toBe(400);
    expect(blank.body.error.details).toHaveProperty('reason');
  });

  it('rejects with a reason that the employee can read', async () => {
    const v = await createSubmitted(employee, fx);
    await reject(director, v.id, 'Receipt is missing; please attach it and resubmit.');
    const seen = await employee.get(`/api/vouchers/${v.id}`);
    expect(seen.body.voucher).toMatchObject({ status: 'REJECTED', rejectionReason: 'Receipt is missing; please attach it and resubmit.' });
    expect(seen.body.voucher.permissions).toMatchObject({ canEdit: false, canDuplicate: true });
    expect(seen.body.voucher.history.at(-1)).toMatchObject({ type: 'REJECTED', note: 'Receipt is missing; please attach it and resubmit.' });
  });

  it('cannot decide on a draft', async () => {
    const v = await createDraft(employee, fx, {}, true);
    const res = await director.post(`/api/vouchers/${v.id}/reject`).send({ reason: 'Not yet submitted' });
    expect(res.status).toBe(404); // drafts are invisible to the Director
  });
});

describe('duplicating', () => {
  it('starts a fresh draft from a rejected voucher without touching the original', async () => {
    const v = await createSubmitted(employee, fx, { title: 'Conference ticket', amount: 2500 });
    await reject(director, v.id);
    const res = await employee.post(`/api/vouchers/${v.id}/duplicate`);
    expect(res.status).toBe(201);
    expect(res.body.voucher).toMatchObject({ status: 'DRAFT', title: 'Conference ticket', amount: 2500, employeeSignatureUrl: null });
    expect(res.body.voucher.voucherNumber).not.toBe(v.voucherNumber);
    expect(res.body.voucher.history[0].note).toBe(`Copied from ${v.voucherNumber}`);
    expect((await employee.get(`/api/vouchers/${v.id}`)).body.voucher.status).toBe('REJECTED');
  });
});

describe('database safeguards', () => {
  it('refuses to change an approved voucher even with direct SQL', async () => {
    const v = await createSubmitted(employee, fx);
    await approve(director, v.id);
    await expect(pool.query('UPDATE vouchers SET amount = 1 WHERE id = $1', [v.id])).rejects.toThrow(/Invalid voucher status change|cannot change/i);
    await expect(pool.query('DELETE FROM vouchers WHERE id = $1', [v.id])).rejects.toThrow(/Only draft vouchers can be deleted/);
  });

  it('refuses to approve without a director signature even with direct SQL', async () => {
    const v = await createSubmitted(employee, fx);
    await expect(
      pool.query(`UPDATE vouchers SET status = 'APPROVED', decided_by = $2, decided_at = now() WHERE id = $1`, [v.id, fx.users.director]),
    ).rejects.toThrow(/vouchers_approved_has_director_signature/);
  });
});
