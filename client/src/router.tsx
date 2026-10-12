import { createBrowserRouter, Navigate } from 'react-router';
import { useCurrentUser } from './auth/AuthProvider';
import { RequireAuth, RequireRole } from './auth/guards';
import { AppLayout } from './components/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProfilePage } from './pages/ProfilePage';
import { VoucherDetailPage } from './pages/VoucherDetailPage';
import { VoucherFormPage } from './pages/VoucherFormPage';
import { VoucherListPage } from './pages/VoucherListPage';

/** Employees see "My Vouchers"; the Director and Accounts see every submitted voucher. */
function VouchersIndex() {
  const user = useCurrentUser();
  return <VoucherListPage key={user.role} mode={user.role === 'EMPLOYEE' ? 'mine' : 'all'} />;
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'vouchers', element: <VouchersIndex /> },
          { path: 'vouchers/:id', element: <VoucherDetailPage /> },
          { path: 'profile', element: <ProfilePage /> },
          {
            element: <RequireRole roles={['EMPLOYEE']} />,
            children: [
              { path: 'vouchers/new', element: <VoucherFormPage /> },
              { path: 'vouchers/:id/edit', element: <VoucherFormPage /> },
            ],
          },
          {
            element: <RequireRole roles={['DIRECTOR']} />,
            children: [{ path: 'vouchers/pending', element: <VoucherListPage key="pending" mode="pending" /> }],
          },
          { path: 'dashboard', element: <Navigate to="/" replace /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
