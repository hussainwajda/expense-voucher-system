import path from 'node:path';
import type { AuthUser } from '../../domain.js';
import { permissionsFor } from './vouchers.policy.js';
import type { VoucherEventRow, VoucherRow } from './vouchers.repository.js';

function signatureUrl(voucherId: number, kind: 'employee' | 'director', relPath: string | null) {
  if (!relPath) return null;
  // Each upload gets a new random file name, so it doubles as a cache-buster.
  const version = path.basename(relPath, path.extname(relPath)).slice(0, 8);
  return `/api/vouchers/${voucherId}/signatures/${kind}?v=${version}`;
}

export function toVoucherDto(row: VoucherRow, user: AuthUser) {
  return {
    id: row.id,
    voucherNumber: row.voucher_number,
    voucherDate: row.voucher_date,
    expenseDate: row.expense_date,
    department: { id: row.department_id, name: row.department_name },
    category: { id: row.category_id, name: row.category_name },
    title: row.title,
    description: row.description,
    amount: row.amount,
    status: row.status,
    employee: { id: row.employee_id, name: row.employee_name, employeeCode: row.employee_code },
    employeeSignatureUrl: signatureUrl(row.id, 'employee', row.employee_signature_path),
    submittedAt: row.submitted_at,
    decidedAt: row.decided_at,
    decidedBy: row.decided_by ? { id: row.decided_by, name: row.decided_by_name ?? '' } : null,
    directorSignatureUrl: signatureUrl(row.id, 'director', row.director_signature_path),
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    permissions: permissionsFor(user, row),
  };
}

export type VoucherDto = ReturnType<typeof toVoucherDto>;

export function toEventDto(row: VoucherEventRow) {
  return {
    id: row.id,
    type: row.event_type,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    note: row.note,
    actor: { id: row.actor_id, name: row.actor_name, role: row.actor_role },
    createdAt: row.created_at,
  };
}
