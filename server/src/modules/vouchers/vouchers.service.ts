import { pool, withTransaction, type Db } from '../../db/pool.js';
import type { AuthUser, VoucherStatus } from '../../domain.js';
import { todayIso } from '../../lib/dates.js';
import { HttpError } from '../../lib/http-error.js';
import { copySignature, deleteSignature, saveSignature } from '../../lib/signature-files.js';
import { getSignaturePath } from '../users/users.repository.js';
import { toCsv } from './vouchers.csv.js';
import { toEventDto, toVoucherDto } from './vouchers.mapper.js';
import { canView } from './vouchers.policy.js';
import * as repo from './vouchers.repository.js';
import type { ListScope, VoucherRow } from './vouchers.repository.js';
import {
  EDITABLE_KEYS,
  approveSchema,
  listQuerySchema,
  rejectSchema,
  voucherFieldsSchema,
  type VoucherFields,
} from './vouchers.schemas.js';

type UploadedFile = { buffer: Buffer } | undefined;

const STATUS_LABEL: Record<VoucherStatus, string> = {
  DRAFT: 'a draft',
  PENDING_APPROVAL: 'awaiting approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

const EXPORT_ROW_LIMIT = 5000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scopeFor(user: AuthUser): ListScope {
  return user.role === 'EMPLOYEE' ? { kind: 'own', employeeId: user.id } : { kind: 'organisation' };
}

/** Load a voucher the user is allowed to see. Anything else is a 404, so ids of other people's vouchers don't leak. */
async function loadVisible(db: Db, user: AuthUser, id: number, opts: { forUpdate?: boolean } = {}) {
  const row = await repo.findVoucherById(db, id, opts);
  if (!row || !canView(user, row)) {
    throw HttpError.notFound('Voucher not found.');
  }
  return row;
}

function assertOwnDraft(row: VoucherRow, user: AuthUser, action: string) {
  if (row.employee_id !== user.id) throw HttpError.forbidden('Only the employee who created this voucher can change it.');
  if (row.status !== 'DRAFT') {
    throw HttpError.conflict(`Voucher ${row.voucher_number} is ${STATUS_LABEL[row.status]} and can no longer be ${action}.`);
  }
}

function assertPending(row: VoucherRow, action: string) {
  if (row.status !== 'PENDING_APPROVAL') {
    throw HttpError.conflict(`Voucher ${row.voucher_number} is ${STATUS_LABEL[row.status]} and cannot be ${action}.`);
  }
}

/** Only keep keys an employee is allowed to set; ignore anything else in the body. */
function pickVoucherInput(raw: unknown): Record<string, unknown> {
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const picked: Record<string, unknown> = {};
  for (const key of [...EDITABLE_KEYS, 'useSavedSignature'] as const) {
    if (body[key] !== undefined) picked[key] = body[key];
  }
  return picked;
}

function rowToInput(row: VoucherRow): Record<string, unknown> {
  return {
    voucherDate: row.voucher_date,
    expenseDate: row.expense_date,
    departmentId: row.department_id,
    categoryId: row.category_id,
    title: row.title,
    description: row.description,
    amount: row.amount,
  };
}

async function assertLookupsExist(f: Pick<VoucherFields, 'departmentId' | 'categoryId'>) {
  const { rows } = await pool.query<{ dep: boolean; cat: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM departments WHERE id = $1) AS dep,
            EXISTS (SELECT 1 FROM expense_categories WHERE id = $2) AS cat`,
    [f.departmentId, f.categoryId],
  );
  const details: Record<string, string[]> = {};
  if (!rows[0]?.dep) details.departmentId = ['Choose a valid department.'];
  if (!rows[0]?.cat) details.categoryId = ['Choose a valid expense category.'];
  const first = Object.values(details)[0]?.[0];
  if (first) throw HttpError.validation(first, details);
}

/**
 * Turn the incoming signature (an uploaded file, or "use my saved signature") into a stored file
 * owned by this voucher. Returns null when no signature was supplied.
 */
async function storeIncomingSignature(user: AuthUser, file: UploadedFile, useSaved: boolean | undefined) {
  if (file) return saveSignature(file.buffer);
  if (useSaved) {
    const saved = await getSignaturePath(user.id);
    if (!saved) {
      const message = 'You have no saved signature. Upload a signature image instead.';
      throw HttpError.validation(message, { signature: [message] });
    }
    return copySignature(saved);
  }
  return null;
}

/** Run `fn`; if it fails, remove the signature file we just stored so no orphans are left behind. */
async function cleanupOnFailure<T>(newFile: string | null | undefined, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    await deleteSignature(newFile);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listVouchers(user: AuthUser, rawQuery: unknown) {
  const query = listQuerySchema.parse(rawQuery ?? {});
  const { rows, total } = await repo.listVouchers(pool, scopeFor(user), query);
  return {
    data: rows.map((row) => toVoucherDto(row, user)),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
    sort: { sortBy: query.sortBy, sortOrder: query.sortOrder },
  };
}

export async function getVoucher(user: AuthUser, id: number) {
  const row = await loadVisible(pool, user, id);
  const events = await repo.listEvents(pool, id);
  return { ...toVoucherDto(row, user), history: events.map(toEventDto) };
}

export async function getSignatureFile(user: AuthUser, id: number, kind: 'employee' | 'director') {
  const row = await loadVisible(pool, user, id);
  const relPath = kind === 'employee' ? row.employee_signature_path : row.director_signature_path;
  if (!relPath) throw HttpError.notFound(`This voucher has no ${kind} signature.`);
  return relPath;
}

export async function exportVouchersCsv(user: AuthUser, rawQuery: unknown) {
  const query = listQuerySchema.parse(rawQuery ?? {});
  const { rows, total } = await repo.listVouchers(pool, scopeFor(user), query, { limit: EXPORT_ROW_LIMIT, offset: 0 });
  return { csv: toCsv(rows), total, truncated: total > rows.length };
}

// ---------------------------------------------------------------------------
// Employee actions
// ---------------------------------------------------------------------------

/** Business rule 3: every new voucher starts as a Draft. */
export async function createVoucher(user: AuthUser, raw: unknown, file: UploadedFile) {
  const input = voucherFieldsSchema.parse(pickVoucherInput(raw));
  await assertLookupsExist(input);
  const signature = await storeIncomingSignature(user, file, input.useSavedSignature);

  const id = await cleanupOnFailure(signature, () =>
    withTransaction(async (tx) => {
      const newId = await repo.insertVoucher(tx, user.id, input, signature);
      await repo.insertEvent(tx, { voucherId: newId, actorId: user.id, type: 'CREATED', from: null, to: 'DRAFT' });
      return newId;
    }),
  );
  return getVoucher(user, id);
}

/** Business rule 4: only drafts can be edited, and only by their author. Accepts partial updates. */
export async function updateVoucher(user: AuthUser, id: number, raw: unknown, file: UploadedFile) {
  const existing = await loadVisible(pool, user, id);
  assertOwnDraft(existing, user, 'edited');

  const input = voucherFieldsSchema.parse({ ...rowToInput(existing), ...pickVoucherInput(raw) });
  await assertLookupsExist(input);
  const signature = (await storeIncomingSignature(user, file, input.useSavedSignature)) ?? undefined;

  const replaced = await cleanupOnFailure(signature, () =>
    withTransaction(async (tx) => {
      const current = await loadVisible(tx, user, id, { forUpdate: true });
      assertOwnDraft(current, user, 'edited');
      await repo.updateDraft(tx, id, input, signature);
      await repo.insertEvent(tx, { voucherId: id, actorId: user.id, type: 'UPDATED', from: 'DRAFT', to: 'DRAFT' });
      return signature ? current.employee_signature_path : null;
    }),
  );
  await deleteSignature(replaced);
  return getVoucher(user, id);
}

export async function deleteVoucher(user: AuthUser, id: number) {
  const signature = await withTransaction(async (tx) => {
    const current = await loadVisible(tx, user, id, { forUpdate: true });
    assertOwnDraft(current, user, 'deleted');
    await repo.deleteDraft(tx, id);
    return current.employee_signature_path;
  });
  await deleteSignature(signature);
}

/** Draft -> Submitted -> Pending Approval. Business rules 5 & 12. */
export async function submitVoucher(user: AuthUser, id: number) {
  await withTransaction(async (tx) => {
    const current = await loadVisible(tx, user, id, { forUpdate: true });
    assertOwnDraft(current, user, 'submitted');
    if (!current.employee_signature_path) {
      const message = 'Employee signature is required before submission.';
      throw HttpError.validation(message, { signature: [message] });
    }
    if (current.expense_date > todayIso()) {
      const message = 'Expense date cannot be in the future.';
      throw HttpError.validation(message, { expenseDate: [message] });
    }
    await repo.markSubmitted(tx, id);
    await repo.insertEvent(tx, { voucherId: id, actorId: user.id, type: 'SUBMITTED', from: 'DRAFT', to: 'PENDING_APPROVAL' });
  });
  return getVoucher(user, id);
}

/** Start a new draft from one of your earlier vouchers (handy after a rejection). The original is untouched. */
export async function duplicateVoucher(user: AuthUser, id: number) {
  const source = await loadVisible(pool, user, id);
  if (source.employee_id !== user.id) throw HttpError.forbidden('You can only copy your own vouchers.');

  const today = todayIso();
  const newId = await withTransaction(async (tx) => {
    const created = await repo.insertVoucher(
      tx,
      user.id,
      {
        voucherDate: today,
        expenseDate: source.expense_date <= today ? source.expense_date : today,
        departmentId: source.department_id,
        categoryId: source.category_id,
        title: source.title,
        description: source.description,
        amount: source.amount,
      },
      null,
    );
    await repo.insertEvent(tx, {
      voucherId: created,
      actorId: user.id,
      type: 'CREATED',
      from: null,
      to: 'DRAFT',
      note: `Copied from ${source.voucher_number}`,
    });
    return created;
  });
  return getVoucher(user, newId);
}

// ---------------------------------------------------------------------------
// Director actions
// ---------------------------------------------------------------------------

/** Pending Approval -> Approved. Business rules 6, 7 & 13. */
export async function approveVoucher(user: AuthUser, id: number, raw: unknown, file: UploadedFile) {
  const input = approveSchema.parse(raw ?? {});
  // Check state before storing anything, so a doomed request leaves no file behind.
  assertPending(await loadVisible(pool, user, id), 'approved');

  const signature = await storeIncomingSignature(user, file, input.useSavedSignature);
  if (!signature) {
    throw HttpError.validation('Director signature is required before approval.', {
      signature: ['Upload your signature or use your saved signature.'],
    });
  }

  await cleanupOnFailure(signature, () =>
    withTransaction(async (tx) => {
      const current = await loadVisible(tx, user, id, { forUpdate: true });
      assertPending(current, 'approved');
      await repo.markApproved(tx, id, user.id, signature);
      await repo.insertEvent(tx, { voucherId: id, actorId: user.id, type: 'APPROVED', from: 'PENDING_APPROVAL', to: 'APPROVED' });
    }),
  );
  return getVoucher(user, id);
}

/** Pending Approval -> Rejected. Business rule 8: a reason is mandatory. */
export async function rejectVoucher(user: AuthUser, id: number, raw: unknown) {
  const { reason } = rejectSchema.parse(raw ?? {});
  await withTransaction(async (tx) => {
    const current = await loadVisible(tx, user, id, { forUpdate: true });
    assertPending(current, 'rejected');
    await repo.markRejected(tx, id, user.id, reason);
    await repo.insertEvent(tx, {
      voucherId: id,
      actorId: user.id,
      type: 'REJECTED',
      from: 'PENDING_APPROVAL',
      to: 'REJECTED',
      note: reason,
    });
  });
  return getVoucher(user, id);
}
