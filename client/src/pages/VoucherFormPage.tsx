import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, Save, Send } from 'lucide-react';
import { z } from 'zod';
import { ApiError } from '@/api/client';
import { vouchersApi } from '@/api/endpoints';
import type { VoucherDetail } from '@/api/types';
import { useCurrentUser } from '@/auth/AuthProvider';
import { PageHeader } from '@/components/AppLayout';
import { SignatureField, type SignatureValue } from '@/components/SignatureField';
import { StatusBadge } from '@/components/StatusBadge';
import { Alert } from '@/components/ui/Alert';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { PageLoader } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useMeta, useRefreshVoucherData, useVoucher } from '@/hooks/queries';
import { formatCurrency, todayIso } from '@/lib/format';

const MAX_AMOUNT = 10_000_000;

// Mirrors the server rules so people get instant feedback; the API still has the final say.
const schema = z
  .object({
    title: z.string().trim().min(1, 'Expense title is required.').max(150, 'Keep the title to 150 characters or fewer.'),
    categoryId: z.string().min(1, 'Choose an expense category.'),
    departmentId: z.string().min(1, 'Department is required.'),
    amount: z
      .string()
      .trim()
      .min(1, 'Amount is required.')
      .refine((v) => Number.isFinite(Number(v)), 'Amount must be a number.')
      .refine((v) => Number(v) > 0, 'Amount must be greater than zero.')
      .refine((v) => Number(v) <= MAX_AMOUNT, `Amount cannot exceed ${formatCurrency(MAX_AMOUNT)}.`)
      .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), 'Use at most 2 decimal places.'),
    expenseDate: z
      .string()
      .min(1, 'Expense date is required.')
      .refine((v) => v <= todayIso(), 'Expense date cannot be in the future.'),
    voucherDate: z
      .string()
      .min(1, 'Voucher date is required.')
      .refine((v) => v <= todayIso(), 'Voucher date cannot be in the future.'),
    description: z.string().max(2000, 'Keep the description to 2000 characters or fewer.'),
  })
  .refine((v) => !v.expenseDate || !v.voucherDate || v.expenseDate <= v.voucherDate, {
    path: ['expenseDate'],
    message: 'Expense date cannot be after the voucher date.',
  });

type FormValues = z.infer<typeof schema>;
type Intent = 'draft' | 'submit';

export function VoucherFormPage() {
  const { id } = useParams();
  const voucherId = id ? Number(id) : null;
  const voucher = useVoucher(voucherId ?? 0);
  const meta = useMeta();

  // Wait for the department/category lists so the selects can show their initial values.
  if (meta.isPending) return <PageLoader />;
  if (meta.error) return <Alert tone="error" title="Couldn't load the form">{meta.error.message}</Alert>;
  if (voucherId === null) return <VoucherForm />;
  if (voucher.isPending) return <PageLoader />;
  if (voucher.error) {
    return (
      <Alert tone="error" title="Couldn't open this voucher">
        {voucher.error.message} <Link to="/vouchers" className="font-medium underline">Back to vouchers</Link>
      </Alert>
    );
  }
  if (!voucher.data.permissions.canEdit) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <Alert tone="warning" title={`${voucher.data.voucherNumber} can no longer be edited`}>
          Only drafts can be changed. This voucher is <StatusBadge status={voucher.data.status} />.
          <div className="mt-3">
            <ButtonLink to={`/vouchers/${voucher.data.id}`} variant="secondary" size="sm">
              View voucher
            </ButtonLink>
          </div>
        </Alert>
      </div>
    );
  }
  return <VoucherForm voucher={voucher.data} />;
}

function VoucherForm({ voucher }: { voucher?: VoucherDetail }) {
  const user = useCurrentUser();
  const meta = useMeta();
  const toast = useToast();
  const navigate = useNavigate();
  const refresh = useRefreshVoucherData();

  const [signature, setSignature] = useState<SignatureValue>(
    voucher?.employeeSignatureUrl ? { kind: 'existing', url: voucher.employeeSignatureUrl } : user.signatureUrl ? { kind: 'saved' } : { kind: 'none' },
  );
  const [signatureError, setSignatureError] = useState<string>();
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState<FormValues | null>(null);
  const [busy, setBusy] = useState<Intent | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: voucher?.title ?? '',
      categoryId: voucher ? String(voucher.category.id) : '',
      departmentId: voucher ? String(voucher.department.id) : user.department ? String(user.department.id) : '',
      amount: voucher ? String(voucher.amount) : '',
      expenseDate: voucher?.expenseDate ?? '',
      voucherDate: voucher?.voucherDate ?? todayIso(),
      description: voucher?.description ?? '',
    },
  });

  const description = watch('description');

  const changeSignature = (value: SignatureValue) => {
    setSignature(value);
    setSignatureError(undefined);
  };

  const save = async (values: FormValues, intent: Intent) => {
    setBusy(intent);
    setFormError(null);
    const fields = {
      title: values.title,
      categoryId: values.categoryId,
      departmentId: values.departmentId,
      amount: values.amount,
      expenseDate: values.expenseDate,
      voucherDate: values.voucherDate,
      description: values.description,
      ...(signature.kind === 'saved' ? { useSavedSignature: true } : {}),
    };
    const file = signature.kind === 'file' ? signature.file : null;

    try {
      let result = voucher ? (await vouchersApi.update(voucher.id, fields, file)).voucher : (await vouchersApi.create(fields, file)).voucher;

      if (intent === 'submit') {
        try {
          result = (await vouchersApi.submit(result.id)).voucher;
          toast.success('Voucher submitted', `${result.voucherNumber} is now waiting for the Director's approval.`);
        } catch (err) {
          // The draft itself was saved; keep the user on the edit page to fix whatever blocked submission.
          await refresh();
          toast.error('Saved as a draft, but not submitted', err instanceof Error ? err.message : undefined);
          navigate(`/vouchers/${result.id}/edit`, { replace: true });
          return;
        }
      } else {
        toast.success('Draft saved', `${result.voucherNumber} is saved. You can edit it until you submit it.`);
      }
      await refresh();
      navigate(`/vouchers/${result.id}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.details) {
        for (const [field, messages] of Object.entries(err.details)) {
          if (field === 'signature') setSignatureError(messages[0]);
          else if (field in schema.shape) setError(field as keyof FormValues, { message: messages[0] });
        }
      }
      setFormError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };

  const onSaveDraft = handleSubmit((values) => save(values, 'draft'));
  const onSubmitForApproval = handleSubmit((values) => {
    if (signature.kind === 'none') {
      setSignatureError('Your signature is required before submitting.');
      return;
    }
    setConfirmSubmit(values);
  });

  return (
    <>
      <Link to={voucher ? `/vouchers/${voucher.id}` : '/vouchers'} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900">
        <ArrowLeft className="size-4" /> {voucher ? 'Back to voucher' : 'My vouchers'}
      </Link>
      <PageHeader
        title={voucher ? `Edit ${voucher.voucherNumber}` : 'New expense voucher'}
        description={voucher ? 'This voucher is a draft. Changes are saved when you click Save.' : 'Fill in the expense details, sign, and save it as a draft or submit it for approval.'}
      />

      <form noValidate onSubmit={onSubmitForApproval} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          {formError && (
            <Alert tone="error" title="Please check the form">
              {formError}
            </Alert>
          )}
          <Card>
            <CardHeader title="Expense details" description="Fields marked * are required." />
            <div className="grid gap-5 p-5 sm:grid-cols-2">
              <Field label="Expense title" required error={errors.title?.message} className="sm:col-span-2">
                {(a11y) => <Input {...a11y} placeholder="e.g. Taxi to client office" maxLength={150} {...register('title')} />}
              </Field>
              <Field label="Expense category" required error={errors.categoryId?.message}>
                {(a11y) => (
                  <Select {...a11y} {...register('categoryId')}>
                    <option value="">Select a category</option>
                    {meta.data?.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Department" required error={errors.departmentId?.message}>
                {(a11y) => (
                  <Select {...a11y} {...register('departmentId')}>
                    <option value="">Select a department</option>
                    {meta.data?.departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Amount" required error={errors.amount?.message}>
                {(a11y) => (
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-slate-500">₹</span>
                    <Input {...a11y} type="text" inputMode="decimal" placeholder="0.00" className="tabular pl-7" {...register('amount')} />
                  </div>
                )}
              </Field>
              <Field label="Expense date" required error={errors.expenseDate?.message} hint="When the money was spent">
                {(a11y) => <Input {...a11y} type="date" max={todayIso()} {...register('expenseDate')} />}
              </Field>
              <Field label="Voucher date" required error={errors.voucherDate?.message} hint="Defaults to today">
                {(a11y) => <Input {...a11y} type="date" max={todayIso()} {...register('voucherDate')} />}
              </Field>
              <Field
                label="Description"
                error={errors.description?.message}
                hint={<span className="tabular">{description.length}/2000 · Purpose, people involved, anything the approver should know</span>}
                className="sm:col-span-2"
              >
                {(a11y) => <Textarea {...a11y} rows={4} maxLength={2000} {...register('description')} />}
              </Field>
            </div>
          </Card>
        </div>

        <div className="grid content-start items-start gap-6 md:grid-cols-2 xl:grid-cols-1">
          <Card>
            <CardHeader title="Employee" />
            <dl className="space-y-3 p-5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Name</dt>
                <dd className="font-medium text-slate-900">{user.fullName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Employee ID</dt>
                <dd className="tabular font-medium text-slate-900">{user.employeeCode ?? '—'}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Your signature" description="Required before you submit" />
            <div className="p-5">
              <SignatureField
                value={signature}
                onChange={changeSignature}
                savedUrl={user.signatureUrl}
                existingUrl={voucher?.employeeSignatureUrl}
                error={signatureError}
              />
              {!user.signatureUrl && (
                <p className="mt-3 text-xs text-slate-500">
                  Tip: save a signature on <Link to="/profile" className="font-medium text-brand-700 hover:underline">My Signature</Link> to reuse it.
                </p>
              )}
            </div>
          </Card>

          <Alert tone="info">Drafts can be edited or deleted at any time. Once submitted, the voucher becomes read-only.</Alert>

          <div className="flex flex-col gap-2 md:col-start-2 xl:col-start-auto">
            <Button type="submit" size="lg" loading={busy === 'submit'} disabled={busy !== null} icon={<Send className="size-4" />}>
              Save & submit for approval
            </Button>
            <Button variant="secondary" size="lg" onClick={onSaveDraft} loading={busy === 'draft'} disabled={busy !== null} icon={<Save className="size-4" />}>
              Save as draft
            </Button>
          </div>
        </div>
      </form>

      <Dialog
        open={confirmSubmit !== null}
        onClose={() => setConfirmSubmit(null)}
        busy={busy !== null}
        title="Submit for approval?"
        description={
          confirmSubmit && (
            <>
              <strong className="font-semibold text-slate-900">{confirmSubmit.title}</strong> for{' '}
              <strong className="tabular font-semibold text-slate-900">{formatCurrency(Number(confirmSubmit.amount))}</strong> will be sent to the Director.
              You won't be able to edit or delete it afterwards.
            </>
          )
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmSubmit(null)} disabled={busy !== null}>
              Keep editing
            </Button>
            <Button
              loading={busy === 'submit'}
              icon={<Send className="size-4" />}
              onClick={async () => {
                const values = confirmSubmit!;
                await save(values, 'submit');
                setConfirmSubmit(null);
              }}
            >
              Submit
            </Button>
          </>
        }
      />
    </>
  );
}
