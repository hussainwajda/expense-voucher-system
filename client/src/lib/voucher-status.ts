import { CheckCircle2, CircleDashed, Clock3, XCircle, type LucideIcon } from 'lucide-react';
import type { Role, VoucherStatus } from '@/api/types';

export const STATUS_META: Record<VoucherStatus, { label: string; icon: LucideIcon; badge: string; dot: string }> = {
  DRAFT: { label: 'Draft', icon: CircleDashed, badge: 'bg-slate-100 text-slate-700 ring-slate-500/20', dot: 'bg-slate-400' },
  PENDING_APPROVAL: { label: 'Pending Approval', icon: Clock3, badge: 'bg-amber-50 text-amber-800 ring-amber-600/25', dot: 'bg-amber-500' },
  APPROVED: { label: 'Approved', icon: CheckCircle2, badge: 'bg-emerald-50 text-emerald-800 ring-emerald-600/25', dot: 'bg-emerald-500' },
  REJECTED: { label: 'Rejected', icon: XCircle, badge: 'bg-rose-50 text-rose-800 ring-rose-600/25', dot: 'bg-rose-500' },
};

export const ROLE_LABEL: Record<Role, string> = {
  EMPLOYEE: 'Employee',
  DIRECTOR: 'Director',
  ACCOUNTS: 'Accounts Team',
};
