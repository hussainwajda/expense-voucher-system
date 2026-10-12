import { Navigate, Outlet, useLocation } from 'react-router';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import type { Role } from '@/api/types';
import { Button, ButtonLink } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/Spinner';
import { useAuth } from './AuthProvider';

/** Only signed-in users get past this point; everyone else goes to /login and comes back afterwards. */
export function RequireAuth() {
  const { status, retry } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <PageLoader label="Checking your session…" />;
  if (status === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-slate-600">We couldn't reach the server.</p>
        <Button variant="secondary" icon={<RefreshCw className="size-4" />} onClick={retry}>
          Try again
        </Button>
      </div>
    );
  }
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

/** Restrict a group of routes to certain roles. The API enforces the same rules; this just keeps the UI honest. */
export function RequireRole({ roles }: { roles: Role[] }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return <Forbidden />;
  return <Outlet />;
}

export function Forbidden() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
        <ShieldAlert className="size-6" aria-hidden="true" />
      </div>
      <h1 className="mt-4 text-lg font-semibold text-slate-900">You don't have access to this page</h1>
      <p className="mt-1 text-sm text-slate-600">This area is available to a different role. If you think this is a mistake, contact your administrator.</p>
      <ButtonLink to="/" variant="secondary" className="mt-6">
        Back to dashboard
      </ButtonLink>
    </div>
  );
}
