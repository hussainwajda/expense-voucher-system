import type { Db } from '../../db/pool.js';
import type { Role, VoucherEventType, VoucherStatus } from '../../domain.js';
import type { ListQuery, SortField, VoucherFields } from './vouchers.schemas.js';

export interface VoucherRow {
  id: number;
  voucher_number: string;
  voucher_date: string;
  expense_date: string;
  department_id: number;
  department_name: string;
  category_id: number;
  category_name: string;
  title: string;
  description: string | null;
  amount: number;
  employee_id: number;
  employee_name: string;
  employee_code: string | null;
  employee_signature_path: string | null;
  status: VoucherStatus;
  submitted_at: Date | null;
  decided_by: number | null;
  decided_by_name: string | null;
  decided_at: Date | null;
  director_signature_path: string | null;
  rejection_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface VoucherEventRow {
  id: number;
  event_type: VoucherEventType;
  from_status: VoucherStatus | null;
  to_status: VoucherStatus;
  note: string | null;
  created_at: Date;
  actor_id: number;
  actor_name: string;
  actor_role: Role;
}

const SELECT_VOUCHER = `
  SELECT v.id, v.voucher_number, v.voucher_date, v.expense_date,
         v.department_id, d.name AS department_name,
         v.category_id, c.name AS category_name,
         v.title, v.description, v.amount,
         v.employee_id, e.full_name AS employee_name, e.employee_code, v.employee_signature_path,
         v.status, v.submitted_at,
         v.decided_by, dir.full_name AS decided_by_name, v.decided_at,
         v.director_signature_path, v.rejection_reason,
         v.created_at, v.updated_at
  FROM vouchers v
  JOIN departments d ON d.id = v.department_id
  JOIN expense_categories c ON c.id = v.category_id
  JOIN users e ON e.id = v.employee_id
  LEFT JOIN users dir ON dir.id = v.decided_by`;

export async function findVoucherById(db: Db, id: number, opts: { forUpdate?: boolean } = {}) {
  const { rows } = await db.query<VoucherRow>(
    `${SELECT_VOUCHER} WHERE v.id = $1 ${opts.forUpdate ? 'FOR UPDATE OF v' : ''}`,
    [id],
  );
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Listing, search, filter, sort
// ---------------------------------------------------------------------------

/** Who is asking decides the base scope: employees see their own vouchers, everyone else sees submitted ones. */
export type ListScope = { kind: 'own'; employeeId: number } | { kind: 'organisation' };

// Whitelisted ORDER BY expressions: user input never reaches the SQL text.
const SORT_SQL: Record<SortField, string> = {
  voucherNumber: 'v.voucher_number',
  voucherDate: 'v.voucher_date',
  expenseDate: 'v.expense_date',
  title: 'lower(v.title)',
  amount: 'v.amount',
  status: 'v.status',
  employeeName: 'lower(e.full_name)',
  department: 'd.name',
  category: 'c.name',
  createdAt: 'v.created_at',
  updatedAt: 'v.updated_at',
  submittedAt: 'v.submitted_at',
  decidedAt: 'v.decided_at',
};

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function buildWhere(scope: ListScope, f: Omit<ListQuery, 'sortBy' | 'sortOrder' | 'page' | 'pageSize'>) {
  const clauses: string[] = [];
  const params: unknown[] = [];
  const add = (sql: (n: string) => string, value: unknown) => {
    params.push(value);
    clauses.push(sql(`$${params.length}`));
  };

  if (scope.kind === 'own') {
    add((p) => `v.employee_id = ${p}`, scope.employeeId);
  } else {
    // Drafts stay private to their author until submitted.
    clauses.push(`v.status <> 'DRAFT'`);
  }

  if (f.q) {
    add(
      (p) => `(v.voucher_number ILIKE ${p} OR v.title ILIKE ${p} OR e.full_name ILIKE ${p} OR e.employee_code ILIKE ${p})`,
      `%${escapeLike(f.q)}%`,
    );
  }
  if (f.voucherNumber) add((p) => `v.voucher_number ILIKE ${p}`, `%${escapeLike(f.voucherNumber)}%`);
  if (f.employeeName) add((p) => `e.full_name ILIKE ${p}`, `%${escapeLike(f.employeeName)}%`);
  if (f.departmentId) add((p) => `v.department_id = ${p}`, f.departmentId);
  if (f.categoryId) add((p) => `v.category_id = ${p}`, f.categoryId);
  if (f.status) add((p) => `v.status = ${p}`, f.status);
  if (f.dateFrom) add((p) => `v.voucher_date >= ${p}`, f.dateFrom);
  if (f.dateTo) add((p) => `v.voucher_date <= ${p}`, f.dateTo);
  if (f.amountMin !== undefined) add((p) => `v.amount >= ${p}`, f.amountMin);
  if (f.amountMax !== undefined) add((p) => `v.amount <= ${p}`, f.amountMax);

  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

const BASE_FROM = `
  FROM vouchers v
  JOIN departments d ON d.id = v.department_id
  JOIN expense_categories c ON c.id = v.category_id
  JOIN users e ON e.id = v.employee_id`;

export async function listVouchers(db: Db, scope: ListScope, query: ListQuery, opts: { limit?: number; offset?: number } = {}) {
  const { sortBy, sortOrder, page, pageSize, ...filters } = query;
  const { where, params } = buildWhere(scope, filters);
  const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';
  const limit = opts.limit ?? pageSize;
  const offset = opts.offset ?? (page - 1) * pageSize;

  const [countResult, pageResult] = await Promise.all([
    db.query<{ total: number }>(`SELECT count(*) AS total ${BASE_FROM} ${where}`, params),
    db.query<VoucherRow>(
      `${SELECT_VOUCHER} ${where}
       ORDER BY ${SORT_SQL[sortBy]} ${direction} NULLS LAST, v.id ${direction}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    ),
  ]);

  return { rows: pageResult.rows, total: countResult.rows[0]?.total ?? 0 };
}

// ---------------------------------------------------------------------------
// Writes. Status guards live in the WHERE clauses, so two people acting on the
// same voucher at once can't both succeed.
// ---------------------------------------------------------------------------

type FieldValues = Omit<VoucherFields, 'useSavedSignature'>;

export async function insertVoucher(db: Db, employeeId: number, f: FieldValues, signaturePath: string | null) {
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO vouchers
       (voucher_date, expense_date, department_id, category_id, title, description, amount, employee_id, employee_signature_path)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [f.voucherDate, f.expenseDate, f.departmentId, f.categoryId, f.title, f.description, f.amount, employeeId, signaturePath],
  );
  return rows[0]!.id;
}

/** Updates a draft's fields; pass `signaturePath: undefined` to keep the current signature. */
export async function updateDraft(db: Db, id: number, f: FieldValues, signaturePath: string | undefined) {
  const { rowCount } = await db.query(
    `UPDATE vouchers SET
       voucher_date = $2, expense_date = $3, department_id = $4, category_id = $5,
       title = $6, description = $7, amount = $8,
       employee_signature_path = CASE WHEN $9::boolean THEN $10 ELSE employee_signature_path END
     WHERE id = $1 AND status = 'DRAFT'`,
    [id, f.voucherDate, f.expenseDate, f.departmentId, f.categoryId, f.title, f.description, f.amount,
      signaturePath !== undefined, signaturePath ?? null],
  );
  return rowCount === 1;
}

export async function deleteDraft(db: Db, id: number) {
  const { rowCount } = await db.query(`DELETE FROM vouchers WHERE id = $1 AND status = 'DRAFT'`, [id]);
  return rowCount === 1;
}

export async function markSubmitted(db: Db, id: number) {
  const { rowCount } = await db.query(
    `UPDATE vouchers SET status = 'PENDING_APPROVAL', submitted_at = now()
     WHERE id = $1 AND status = 'DRAFT' AND employee_signature_path IS NOT NULL`,
    [id],
  );
  return rowCount === 1;
}

export async function markApproved(db: Db, id: number, directorId: number, signaturePath: string) {
  const { rowCount } = await db.query(
    `UPDATE vouchers SET status = 'APPROVED', decided_by = $2, decided_at = now(), director_signature_path = $3
     WHERE id = $1 AND status = 'PENDING_APPROVAL'`,
    [id, directorId, signaturePath],
  );
  return rowCount === 1;
}

export async function markRejected(db: Db, id: number, directorId: number, reason: string) {
  const { rowCount } = await db.query(
    `UPDATE vouchers SET status = 'REJECTED', decided_by = $2, decided_at = now(), rejection_reason = $3
     WHERE id = $1 AND status = 'PENDING_APPROVAL'`,
    [id, directorId, reason],
  );
  return rowCount === 1;
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export async function insertEvent(
  db: Db,
  e: { voucherId: number; actorId: number; type: VoucherEventType; from: VoucherStatus | null; to: VoucherStatus; note?: string | null },
) {
  await db.query(
    `INSERT INTO voucher_events (voucher_id, actor_id, event_type, from_status, to_status, note)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [e.voucherId, e.actorId, e.type, e.from, e.to, e.note ?? null],
  );
}

export async function listEvents(db: Db, voucherId: number) {
  const { rows } = await db.query<VoucherEventRow>(
    `SELECT ev.id, ev.event_type, ev.from_status, ev.to_status, ev.note, ev.created_at,
            ev.actor_id, u.full_name AS actor_name, u.role AS actor_role
     FROM voucher_events ev
     JOIN users u ON u.id = ev.actor_id
     WHERE ev.voucher_id = $1
     ORDER BY ev.created_at, ev.id`,
    [voucherId],
  );
  return rows;
}
