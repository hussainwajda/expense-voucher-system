import type { AuthUser } from '../../domain.js';
import type { VoucherRow } from './vouchers.repository.js';

type VoucherRef = Pick<VoucherRow, 'employee_id' | 'status'>;

/**
 * Visibility rules:
 *  - Employees see only their own vouchers (business rule 9).
 *  - The Director and Accounts see every voucher in the organisation (rules 10 & 11),
 *    except drafts, which stay private to their author until submitted.
 */
export function canView(user: AuthUser, v: VoucherRef): boolean {
  if (user.role === 'EMPLOYEE') return v.employee_id === user.id;
  return v.status !== 'DRAFT';
}

/** What the current user may do with a voucher. The UI uses this to decide which actions to show. */
export function permissionsFor(user: AuthUser, v: VoucherRef) {
  const isOwner = user.role === 'EMPLOYEE' && v.employee_id === user.id;
  const isDraft = v.status === 'DRAFT';
  const isPending = v.status === 'PENDING_APPROVAL';
  const isDirector = user.role === 'DIRECTOR';
  return {
    canEdit: isOwner && isDraft,
    canDelete: isOwner && isDraft,
    canSubmit: isOwner && isDraft,
    canDuplicate: isOwner && !isDraft,
    canApprove: isDirector && isPending,
    canReject: isDirector && isPending,
  };
}

export type VoucherPermissions = ReturnType<typeof permissionsFor>;
