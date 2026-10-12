import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate, type Location } from 'react-router';
import { ArrowRight, BadgeCheck, Eye, EyeOff, FileSignature, Landmark, ReceiptText } from 'lucide-react';
import { z } from 'zod';
import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';

const schema = z.object({
  email: z.string().trim().min(1, 'Email is required.').pipe(z.email('Enter a valid email address.')),
  password: z.string().min(1, 'Password is required.'),
});
type FormValues = z.infer<typeof schema>;

// Seeded demo accounts (see server/scripts/lib/seed-data.ts). Hide with VITE_SHOW_DEMO_ACCOUNTS=false.
const DEMO_PASSWORD = 'Password@123';
const DEMO_ACCOUNTS = [
  { role: 'Employee', name: 'Arjun Sharma', email: 'employee@abc.example' },
  { role: 'Director', name: 'Vikram Rao', email: 'director@abc.example' },
  { role: 'Accounts', name: 'Priya Nair', email: 'accounts@abc.example' },
];
const showDemoAccounts = import.meta.env.VITE_SHOW_DEMO_ACCOUNTS !== 'false';

const STEPS = [
  { icon: FileSignature, title: 'Employee raises a voucher', text: 'Fill in the expense, sign it and submit for approval.' },
  { icon: BadgeCheck, title: 'Director reviews it', text: 'Approve with a signature, or reject with a reason.' },
  { icon: Landmark, title: 'Accounts reimburses', text: 'Approved vouchers are ready for payment processing.' },
];

export function LoginPage() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  const from = (location.state as { from?: Location } | null)?.from;
  const redirectTo = from && from.pathname !== '/login' ? `${from.pathname}${from.search}` : '/';

  if (status === 'authenticated') return <Navigate to={redirectTo} replace />;

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setServerError(null);
    try {
      await login(email, password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  });

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-slate-950 px-12 py-12 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -top-40 -left-32 size-[34rem] rounded-full bg-brand-600/30 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-40 bottom-0 size-[28rem] rounded-full bg-indigo-400/10 blur-3xl" aria-hidden="true" />

        <div className="relative flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand-500/20 ring-1 ring-brand-400/30">
            <ReceiptText className="size-5 text-brand-200" aria-hidden="true" />
          </span>
          <div className="leading-tight">
            <p className="font-semibold">Expense Vouchers</p>
            <p className="text-sm text-slate-400">ABC Company</p>
          </div>
        </div>

        <div className="relative my-auto max-w-md py-12">
          <h1 className="text-4xl leading-tight font-semibold tracking-tight">From receipt to reimbursement, without the paperwork.</h1>
          <p className="mt-4 text-slate-300">Raise, approve and track expense vouchers in one place, with a clear record at every step.</p>

          <ol className="mt-10 space-y-5">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/15">
                  <step.icon className="size-5 text-brand-200" aria-hidden="true" />
                  <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-brand-500 text-[11px] font-semibold">{i + 1}</span>
                </span>
                <div>
                  <p className="font-medium">{step.title}</p>
                  <p className="text-sm text-slate-400">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <p className="relative text-xs text-slate-500">Internal tool · Access is limited to ABC Company staff.</p>
      </aside>

      {/* Form */}
      <main className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand-700 text-white">
              <ReceiptText className="size-5" aria-hidden="true" />
            </span>
            <div className="leading-tight">
              <p className="font-semibold">Expense Vouchers</p>
              <p className="text-sm text-slate-500">ABC Company</p>
            </div>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1 text-sm text-slate-600">Use your company email and password.</p>

          {from && from.pathname !== '/' && status === 'anonymous' && !serverError && (
            <Alert tone="info" className="mt-6">
              Please sign in to continue.
            </Alert>
          )}
          {serverError && (
            <Alert tone="error" className="mt-6">
              {serverError}
            </Alert>
          )}

          <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
            <Field label="Email" error={errors.email?.message}>
              {(a11y) => <Input {...a11y} type="email" autoComplete="username" placeholder="you@company.com" autoFocus {...register('email')} />}
            </Field>
            <Field label="Password" error={errors.password?.message}>
              {(a11y) => (
                <div className="relative">
                  <Input {...a11y} type={showPassword ? 'text' : 'password'} autoComplete="current-password" className="pr-10" {...register('password')} />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              )}
            </Field>
            <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
              Sign in
              {!isSubmitting && <ArrowRight className="size-4" />}
            </Button>
          </form>

          {showDemoAccounts && (
            <div className="mt-10 rounded-xl border border-dashed border-slate-300 bg-white p-4">
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Demo accounts</p>
              <p className="mt-1 text-xs text-slate-500">
                Password for all: <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-slate-700">{DEMO_PASSWORD}</code>
              </p>
              <ul className="mt-3 space-y-1">
                {DEMO_ACCOUNTS.map((account) => (
                  <li key={account.email}>
                    <button
                      type="button"
                      onClick={() => {
                        setValue('email', account.email, { shouldValidate: true });
                        setValue('password', DEMO_PASSWORD, { shouldValidate: true });
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand-600"
                    >
                      <span className="min-w-0">
                        <span className="block font-medium text-slate-900">{account.role}</span>
                        <span className="block truncate text-xs text-slate-500">{account.email}</span>
                      </span>
                      <span className="text-xs font-medium text-brand-700">Use</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
