import { Link } from 'react-router';
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Clock3,
  FilePlus2,
  Files,
  IndianRupee,
  Inbox,
  Send,
  Wallet,
  XCircle,
} from 'lucide-react';
import type { AccountsDashboard, ActivityItem, DirectorDashboard, EmployeeDashboard, Voucher } from '@/api/types';
import { useCurrentUser } from '@/auth/AuthProvider';
import { PageHeader } from '@/components/AppLayout';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { Alert } from '@/components/ui/Alert';
import { ButtonLink } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageLoader } from '@/components/ui/Spinner';
import { useDashboard } from '@/hooks/queries';
import { cn } from '@/lib/cn';
import { formatCurrency, formatDate, formatRelative } from '@/lib/format';

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

export function DashboardPage() {
  const user = useCurrentUser();
  const { data, isPending, error } = useDashboard();
  const firstName = user.fullName.split(' ')[0];

  const description = {
    EMPLOYEE: 'Here is where your expense claims stand.',
    DIRECTOR: 'Vouchers waiting for your decision and what happened recently.',
    ACCOUNTS: 'Organisation-wide voucher status for reimbursement processing.',
  }[user.role];

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        description={description}
        actions={
          user.role === 'EMPLOYEE' ? (
            <ButtonLink to="/vouchers/new" icon={<FilePlus2 className="size-4" />}>
              New voucher
            </ButtonLink>
          ) : user.role === 'DIRECTOR' ? (
            <ButtonLink to="/vouchers/pending" icon={<Inbox className="size-4" />}>
              Review pending
            </ButtonLink>
          ) : (
            <ButtonLink to="/vouchers?status=APPROVED" variant="secondary" icon={<Files className="size-4" />}>
              Approved vouchers
            </ButtonLink>
          )
        }
      />
      {isPending ? (
        <PageLoader />
      ) : error ? (
        <Alert tone="error" title="Couldn't load the dashboard">
          {error.message}
        </Alert>
      ) : data.role === 'EMPLOYEE' ? (
        <EmployeeView data={data} />
      ) : data.role === 'DIRECTOR' ? (
        <DirectorView data={data} />
      ) : (
        <AccountsView data={data} />
      )}
    </>
  );
}

function EmployeeView({ data }: { data: EmployeeDashboard }) {
  const s = data.stats;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total amount claimed" value={formatCurrency(s.totalAmountClaimed)} icon={Wallet} tone="brand" emphasis hint={`${formatCurrency(s.approvedAmount)} approved so far`} />
        <StatCard label="Total vouchers" value={s.totalVouchers} icon={Files} to="/vouchers" />
        <StatCard label="Drafts" value={s.draftVouchers} icon={CircleDashed} to="/vouchers?status=DRAFT" hint="Not yet submitted" />
        <StatCard label="Pending approval" value={s.pendingApproval} icon={Clock3} tone="amber" to="/vouchers?status=PENDING_APPROVAL" />
        <StatCard label="Approved" value={s.approvedVouchers} icon={CheckCircle2} tone="emerald" to="/vouchers?status=APPROVED" />
        <StatCard label="Rejected" value={s.rejectedVouchers} icon={XCircle} tone="rose" to="/vouchers?status=REJECTED" />
      </div>
      <Card>
        <CardHeader title="Recently updated" description="Your latest vouchers" action={<ViewAll to="/vouchers" />} />
        {data.recentVouchers.length ? (
          <VoucherRows vouchers={data.recentVouchers} />
        ) : (
          <EmptyState
            icon={FilePlus2}
            title="No vouchers yet"
            description="Create your first expense voucher. It's saved as a draft until you submit it."
            action={<ButtonLink to="/vouchers/new">New voucher</ButtonLink>}
          />
        )}
      </Card>
    </div>
  );
}

function DirectorView({ data }: { data: DirectorDashboard }) {
  const s = data.stats;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pending approval" value={s.pendingApproval} icon={Clock3} tone="amber" to="/vouchers/pending" hint="Waiting for your decision" />
        <StatCard label="Total pending amount" value={formatCurrency(s.totalPendingAmount)} icon={IndianRupee} tone="brand" />
        <StatCard label="Approved today" value={s.approvedToday} icon={CheckCircle2} tone="emerald" />
        <StatCard label="Rejected today" value={s.rejectedToday} icon={XCircle} tone="rose" />
      </div>
      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader title="Waiting longest" description="Oldest submissions first" action={<ViewAll to="/vouchers/pending" />} />
          {data.awaitingApproval.length ? (
            <VoucherRows vouchers={data.awaitingApproval} showEmployee dateOf="submitted" />
          ) : (
            <EmptyState icon={CheckCircle2} title="You're all caught up" description="There are no vouchers waiting for approval." />
          )}
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title="Recent activity" description="Submissions and decisions" />
          {data.recentActivity.length ? (
            <ActivityFeed items={data.recentActivity} />
          ) : (
            <EmptyState icon={Inbox} title="No activity yet" />
          )}
        </Card>
      </div>
    </div>
  );
}

function AccountsView({ data }: { data: AccountsDashboard }) {
  const s = data.stats;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="sm:col-span-2 xl:col-span-1">
          <StatCard label="Total approved amount" value={formatCurrency(s.totalApprovedAmount)} icon={Wallet} tone="brand" emphasis hint="Ready for reimbursement" />
        </div>
        <StatCard label="Total vouchers" value={s.totalVouchers} icon={Files} to="/vouchers" hint="Submitted across the organisation" />
        <StatCard label="Pending approval" value={s.pendingApproval} icon={Clock3} tone="amber" to="/vouchers?status=PENDING_APPROVAL" />
        <StatCard label="Approved" value={s.approvedVouchers} icon={CheckCircle2} tone="emerald" to="/vouchers?status=APPROVED" />
        <StatCard label="Rejected" value={s.rejectedVouchers} icon={XCircle} tone="rose" to="/vouchers?status=REJECTED" />
      </div>
      <Card>
        <CardHeader title="Recently approved" description="Latest vouchers cleared for reimbursement" action={<ViewAll to="/vouchers?status=APPROVED&sortBy=decidedAt" />} />
        {data.recentApproved.length ? (
          <VoucherRows vouchers={data.recentApproved} showEmployee dateOf="decided" />
        ) : (
          <EmptyState icon={Wallet} title="Nothing approved yet" description="Approved vouchers will appear here." />
        )}
      </Card>
    </div>
  );
}

function ViewAll({ to }: { to: string }) {
  return (
    <Link to={to} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800">
      View all <ArrowRight className="size-3.5" />
    </Link>
  );
}

function VoucherRows({ vouchers, showEmployee, dateOf = 'updated' }: { vouchers: Voucher[]; showEmployee?: boolean; dateOf?: 'updated' | 'submitted' | 'decided' }) {
  const dateFor = (v: Voucher) => (dateOf === 'submitted' ? v.submittedAt : dateOf === 'decided' ? v.decidedAt : v.updatedAt) ?? v.updatedAt;
  const dateLabel = { updated: 'Updated', submitted: 'Submitted', decided: 'Approved' }[dateOf];
  return (
    <ul className="divide-y divide-slate-100">
      {vouchers.map((v) => (
        <li key={v.id}>
          <Link to={`/vouchers/${v.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="tabular text-xs font-medium text-slate-500">{v.voucherNumber}</span>
                <StatusBadge status={v.status} />
              </div>
              <p className="mt-1 truncate text-sm font-medium text-slate-900">{v.title}</p>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {showEmployee && `${v.employee.name} · `}
                {v.category.name} · {dateLabel} {formatRelative(dateFor(v))}
              </p>
            </div>
            <span className="tabular shrink-0 text-sm font-semibold text-slate-900">{formatCurrency(v.amount)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

const ACTIVITY_STYLE = {
  SUBMITTED: { icon: Send, ring: 'bg-amber-50 text-amber-700', verb: 'submitted' },
  APPROVED: { icon: CheckCircle2, ring: 'bg-emerald-50 text-emerald-700', verb: 'approved' },
  REJECTED: { icon: XCircle, ring: 'bg-rose-50 text-rose-700', verb: 'rejected' },
  CREATED: { icon: CircleDashed, ring: 'bg-slate-100 text-slate-600', verb: 'created' },
  UPDATED: { icon: CircleDashed, ring: 'bg-slate-100 text-slate-600', verb: 'updated' },
} as const;

function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((item) => {
        const style = ACTIVITY_STYLE[item.type];
        return (
          <li key={item.id}>
            <Link to={`/vouchers/${item.voucher.id}`} className="flex gap-3 px-5 py-3 hover:bg-slate-50">
              <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full', style.ring)}>
                <style.icon className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1 text-sm">
                <p className="text-slate-700">
                  <span className="font-medium text-slate-900">{item.actorName}</span> {style.verb}{' '}
                  <span className="tabular font-medium text-slate-900">{item.voucher.voucherNumber}</span>
                </p>
                <p className="truncate text-xs text-slate-500">
                  {item.voucher.title} · {formatCurrency(item.voucher.amount)}
                </p>
              </div>
              <time dateTime={item.createdAt} title={formatDate(item.createdAt)} className="shrink-0 text-xs text-slate-400">
                {formatRelative(item.createdAt)}
              </time>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
