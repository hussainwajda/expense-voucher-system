export const ROLES = ['EMPLOYEE', 'DIRECTOR', 'ACCOUNTS'] as const;
export type Role = (typeof ROLES)[number];

export const VOUCHER_STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'] as const;
export type VoucherStatus = (typeof VOUCHER_STATUSES)[number];

export type VoucherEventType = 'CREATED' | 'UPDATED' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

/** The authenticated user attached to each request. */
export interface AuthUser {
  id: number;
  fullName: string;
  email: string;
  role: Role;
  employeeCode: string | null;
  department: { id: number; name: string } | null;
  hasSignature: boolean;
}
