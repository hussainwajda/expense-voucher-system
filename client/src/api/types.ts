export type Role = 'EMPLOYEE' | 'DIRECTOR' | 'ACCOUNTS';
export type VoucherStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
export type VoucherEventType = 'CREATED' | 'UPDATED' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export interface Named {
  id: number;
  name: string;
}

export interface User {
  id: number;
  fullName: string;
  email: string;
  role: Role;
  employeeCode: string | null;
  department: Named | null;
  hasSignature: boolean;
  signatureUrl: string | null;
}

export interface VoucherPermissions {
  canEdit: boolean;
  canDelete: boolean;
  canSubmit: boolean;
  canDuplicate: boolean;
  canApprove: boolean;
  canReject: boolean;
}

export interface Voucher {
  id: number;
  voucherNumber: string;
  voucherDate: string;
  expenseDate: string;
  department: Named;
  category: Named;
  title: string;
  description: string | null;
  amount: number;
  status: VoucherStatus;
  employee: { id: number; name: string; employeeCode: string | null };
  employeeSignatureUrl: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  decidedBy: Named | null;
  directorSignatureUrl: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  permissions: VoucherPermissions;
}

export interface VoucherEvent {
  id: number;
  type: VoucherEventType;
  fromStatus: VoucherStatus | null;
  toStatus: VoucherStatus;
  note: string | null;
  actor: { id: number; name: string; role: Role };
  createdAt: string;
}

export interface VoucherDetail extends Voucher {
  history: VoucherEvent[];
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface VoucherList {
  data: Voucher[];
  pagination: Pagination;
  sort: { sortBy: string; sortOrder: 'asc' | 'desc' };
}

export interface Meta {
  departments: Named[];
  categories: Named[];
  statuses: Array<{ value: VoucherStatus; label: string }>;
}

export interface EmployeeDashboard {
  role: 'EMPLOYEE';
  stats: {
    totalVouchers: number;
    draftVouchers: number;
    pendingApproval: number;
    approvedVouchers: number;
    rejectedVouchers: number;
    totalAmountClaimed: number;
    approvedAmount: number;
  };
  recentVouchers: Voucher[];
}

export interface ActivityItem {
  id: number;
  type: VoucherEventType;
  toStatus: VoucherStatus;
  note: string | null;
  createdAt: string;
  actorName: string;
  voucher: { id: number; voucherNumber: string; title: string; amount: number; employeeName: string };
}

export interface DirectorDashboard {
  role: 'DIRECTOR';
  stats: { pendingApproval: number; approvedToday: number; rejectedToday: number; totalPendingAmount: number };
  awaitingApproval: Voucher[];
  recentActivity: ActivityItem[];
}

export interface AccountsDashboard {
  role: 'ACCOUNTS';
  stats: {
    totalVouchers: number;
    pendingApproval: number;
    approvedVouchers: number;
    rejectedVouchers: number;
    totalApprovedAmount: number;
  };
  recentApproved: Voucher[];
}

export type Dashboard = EmployeeDashboard | DirectorDashboard | AccountsDashboard;

/** Filters, sorting and paging for the voucher list (all optional; mirrors the API query string). */
export interface VoucherQuery {
  q?: string;
  departmentId?: string;
  categoryId?: string;
  status?: VoucherStatus | '';
  dateFrom?: string;
  dateTo?: string;
  amountMin?: string;
  amountMax?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}
