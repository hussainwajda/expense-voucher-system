import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import {
  ClipboardCheck,
  FilePlus2,
  Files,
  LayoutDashboard,
  LogOut,
  Menu,
  PenLine,
  ReceiptText,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/api/types';
import { useAuth, useCurrentUser } from '@/auth/AuthProvider';
import { useVoucherList } from '@/hooks/queries';
import { cn } from '@/lib/cn';
import { initials } from '@/lib/format';
import { ROLE_LABEL } from '@/lib/voucher-status';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: 'pending';
}

const NAV: Record<Role, NavItem[]> = {
  EMPLOYEE: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/vouchers', label: 'My Vouchers', icon: Files, end: true },
    { to: '/vouchers/new', label: 'New Voucher', icon: FilePlus2 },
    { to: '/profile', label: 'My Signature', icon: PenLine },
  ],
  DIRECTOR: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/vouchers/pending', label: 'Pending Approvals', icon: ClipboardCheck, badge: 'pending' },
    { to: '/vouchers', label: 'All Vouchers', icon: Files, end: true },
    { to: '/profile', label: 'My Signature', icon: PenLine },
  ],
  ACCOUNTS: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/vouchers', label: 'All Vouchers', icon: Files, end: true },
  ],
};

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-9 items-center justify-center rounded-lg bg-brand-500/20 text-brand-200 ring-1 ring-brand-400/30">
        <ReceiptText className="size-5" aria-hidden="true" />
      </span>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-white">Expense Vouchers</p>
        <p className="text-xs text-slate-400">ABC Company</p>
      </div>
    </div>
  );
}

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const user = useCurrentUser();
  const pending = useVoucherList({ status: 'PENDING_APPROVAL', pageSize: 1 }, { enabled: user.role === 'DIRECTOR' });
  const pendingCount = pending.data?.pagination.total ?? 0;

  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV[user.role].map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white',
            )
          }
        >
          {({ isActive }) => (
            <>
              <item.icon className={cn('size-[18px]', isActive ? 'text-brand-300' : 'text-slate-400 group-hover:text-slate-300')} aria-hidden="true" />
              <span className="flex-1">{item.label}</span>
              {item.badge === 'pending' && pendingCount > 0 && (
                <span className="tabular rounded-full bg-amber-400 px-2 py-0.5 text-xs font-semibold text-amber-950" aria-label={`${pendingCount} pending`}>
                  {pendingCount}
                </span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function UserCard() {
  const user = useCurrentUser();
  const { logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white" aria-hidden="true">
        {initials(user.fullName)}
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-medium text-white">{user.fullName}</p>
        <p className="truncate text-xs text-slate-400">{ROLE_LABEL[user.role]}</p>
      </div>
      <button
        type="button"
        onClick={async () => {
          await logout();
          navigate('/login', { replace: true });
        }}
        className="rounded-md p-2 text-slate-400 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-brand-400"
        aria-label="Log out"
        title="Log out"
      >
        <LogOut className="size-4" />
      </button>
    </div>
  );
}

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setMobileOpen(false), [location.pathname]);

  return (
    <div className="min-h-screen lg:pl-64">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col gap-8 bg-slate-950 px-4 py-6 lg:flex print:hidden">
        <div className="px-2">
          <Brand />
        </div>
        <div className="flex-1">
          <Navigation />
        </div>
        <UserCard />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-slate-950 px-4 py-3 lg:hidden print:hidden">
        <Brand />
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-md p-2 text-slate-300 hover:bg-white/10"
          aria-label="Open menu"
          aria-expanded={mobileOpen}
        >
          <Menu className="size-5" />
        </button>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden print:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 animate-fade-in bg-slate-950/60" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] animate-fade-in flex-col gap-8 bg-slate-950 px-4 py-5">
            <div className="flex items-center justify-between px-2">
              <Brand />
              <button type="button" onClick={() => setMobileOpen(false)} className="rounded-md p-2 text-slate-400 hover:bg-white/10" aria-label="Close menu">
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1">
              <Navigation onNavigate={() => setMobileOpen(false)} />
            </div>
            <UserCard />
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:max-w-none print:p-0">
        <Outlet />
      </main>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between print:hidden">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
