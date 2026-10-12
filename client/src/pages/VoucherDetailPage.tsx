import { useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { ArrowLeft, Check, Copy, Pencil, Printer, Send, Trash2, X } from 'lucide-react';
import { vouchersApi } from '@/api/endpoints';
import type { User, VoucherDetail } from '@/api/types';
import { useCurrentUser } from '@/auth/AuthProvider';
import { SignatureField, SignatureImage, type SignatureValue } from '@/components/SignatureField';
import { StatusBadge } from '@/components/StatusBadge';
import { VoucherHistory, WorkflowProgress } from '@/components/VoucherTimeline';
import { PrintableVoucher } from '@/components/PrintableVoucher';
import { Alert } from '@/components/ui/Alert';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Textarea } from '@/components/ui/Field';
import { PageLoader } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useRefreshVoucherData, useVoucher } from '@/hooks/queries';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';

export function VoucherDetailPage() {
  const { id } = useParams();
  const user = useCurrentUser();
  const { data: voucher, isPending, error } = useVoucher(Number(id));

  if (isPending) return <PageLoader />;
  if (error || !voucher) {
    const notFound = (error as { status?: number } | null)?.status === 404;
    return (
      <div className="mx-auto max-w-xl py-10">
        <Alert tone="error" title={notFound ? 'Voucher not found' : "Couldn't load this voucher"}>
          {notFound ? "It doesn't exist, or you don't have access to it." : error?.message}
          <div className="mt-3">
            <ButtonLink to="/vouchers" variant="secondary" size="sm">
              Back to vouchers
            </ButtonLink>
          </div>
        </Alert>
      </div>
    );
  }

  return (
    <>
      <div className="print:hidden">
        <DetailScreen voucher={voucher} user={user} />
      </div>
      <PrintableVoucher voucher={voucher} printedBy={user.fullName} />
    </>
  );
}

function DetailScreen({ voucher, user }: { voucher: VoucherDetail; user: User }) {
  const location = useLocation();
  const backTo = user.role === 'DIRECTOR' && voucher.status === 'PENDING_APPROVAL' ? '/vouchers/pending' : '/vouchers';
  const backLabel = backTo === '/vouchers/pending' ? 'Pending approvals' : user.role === 'EMPLOYEE' ? 'My vouchers' : 'All vouchers';

  return (
    <>
      <Link
        to={(location.state as { from?: string } | null)?.from ?? backTo}
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" /> {backLabel}
      </Link>

      <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="tabular text-sm font-medium text-slate-500">{voucher.voucherNumber}</span>
            <StatusBadge status={voucher.status} size="md" />
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight break-words text-slate-900">{voucher.title}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {voucher.employee.name}
            {voucher.employee.employeeCode && ` (${voucher.employee.employeeCode})`} · {voucher.department.name} · {voucher.category.name}
          </p>
        </div>
        <VoucherActions voucher={voucher} user={user} />
      </header>

      <StatusNotice voucher={voucher} user={user} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Voucher details" />
            <div className="p-5">
              <div className="rounded-xl bg-slate-50 px-5 py-4">
                <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Amount</p>
                <p className="tabular mt-1 text-3xl font-semibold tracking-tight text-slate-900">{formatCurrency(voucher.amount)}</p>
              </div>
              <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <Detail label="Voucher number" value={<span className="tabular">{voucher.voucherNumber}</span>} />
                <Detail label="Voucher date" value={formatDate(voucher.voucherDate)} />
                <Detail label="Expense date" value={formatDate(voucher.expenseDate)} />
                <Detail label="Expense category" value={voucher.category.name} />
                <Detail label="Department" value={voucher.department.name} />
                <Detail label="Employee" value={`${voucher.employee.name}${voucher.employee.employeeCode ? ` · ${voucher.employee.employeeCode}` : ''}`} />
              </dl>
              <div className="mt-5 border-t border-slate-100 pt-5">
                <p className="text-sm font-medium text-slate-500">Description</p>
                <p className="mt-1 text-sm whitespace-pre-wrap text-slate-900">{voucher.description || <span className="text-slate-400">No description provided.</span>}</p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Signatures" />
            <div className="grid gap-6 p-5 sm:grid-cols-2">
              <SignatureBlock
                title="Employee signature"
                url={voucher.employeeSignatureUrl}
                caption={voucher.submittedAt ? `${voucher.employee.name} · submitted ${formatDateTime(voucher.submittedAt)}` : voucher.employee.name}
                missing={voucher.status === 'DRAFT' ? 'Not signed yet. Required before submission.' : 'No signature.'}
              />
              <SignatureBlock
                title="Director signature"
                url={voucher.directorSignatureUrl}
                caption={voucher.decidedBy && voucher.decidedAt ? `${voucher.decidedBy.name} · approved ${formatDateTime(voucher.decidedAt)}` : ''}
                missing={
                  voucher.status === 'REJECTED' ? 'Not signed: the voucher was rejected.' : voucher.status === 'APPROVED' ? 'No signature.' : 'Added when the Director approves.'
                }
              />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Progress" />
            <div className="p-5">
              <WorkflowProgress voucher={voucher} />
            </div>
          </Card>
          <Card>
            <CardHeader title="History" />
            <div className="p-5">
              <VoucherHistory events={voucher.history} />
            </div>
            <dl className="grid grid-cols-2 gap-4 border-t border-slate-100 px-5 py-4 text-xs">
              <div>
                <dt className="text-slate-500">Created</dt>
                <dd className="mt-0.5 font-medium text-slate-700">{formatDateTime(voucher.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Last updated</dt>
                <dd className="mt-0.5 font-medium text-slate-700">{formatDateTime(voucher.updatedAt)}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function SignatureBlock({ title, url, caption, missing }: { title: string; url: string | null; caption: string; missing: string }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-slate-700">{title}</p>
      {url ? (
        <>
          <SignatureImage src={url} alt={title} />
          {caption && <p className="mt-2 text-xs text-slate-500">{caption}</p>}
        </>
      ) : (
        <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-xs text-slate-500">{missing}</div>
      )}
    </div>
  );
}

function StatusNotice({ voucher, user }: { voucher: VoucherDetail; user: User }) {
  const isOwner = user.id === voucher.employee.id;
  let notice: ReactNode = null;

  if (voucher.status === 'REJECTED') {
    notice = (
      <Alert tone="error" title={`Rejected by ${voucher.decidedBy?.name ?? 'the Director'} on ${formatDate(voucher.decidedAt)}`}>
        <span className="font-medium">Reason:</span> {voucher.rejectionReason}
        {isOwner && <p className="mt-1 text-rose-800/80">Rejected vouchers can't be changed. Use "Copy as new draft" to fix and resubmit it.</p>}
      </Alert>
    );
  } else if (voucher.status === 'DRAFT' && isOwner) {
    notice = (
      <Alert tone="warning" title="This voucher is a draft">
        {voucher.employeeSignatureUrl ? 'Review it and submit it for approval when you are ready.' : 'Add your signature, then submit it for approval.'}
      </Alert>
    );
  } else if (voucher.status === 'PENDING_APPROVAL') {
    notice =
      user.role === 'DIRECTOR' ? (
        <Alert tone="info" title="Waiting for your decision">
          Check the details and the employee's signature, then approve or reject the voucher.
        </Alert>
      ) : (
        <Alert tone="info" title="Waiting for the Director's approval">
          Submitted {formatDateTime(voucher.submittedAt)}. The voucher is read-only while it is reviewed.
        </Alert>
      );
  } else if (voucher.status === 'APPROVED' && user.role === 'ACCOUNTS') {
    notice = (
      <Alert tone="info" title="Approved and ready for reimbursement">
        Approved by {voucher.decidedBy?.name} on {formatDate(voucher.decidedAt)}.
      </Alert>
    );
  }

  return notice ? <div className="mb-6">{notice}</div> : null;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type DialogKind = 'submit' | 'delete' | 'approve' | 'reject' | null;

function VoucherActions({ voucher, user }: { voucher: VoucherDetail; user: User }) {
  const p = voucher.permissions;
  const toast = useToast();
  const navigate = useNavigate();
  const refresh = useRefreshVoucherData();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string>();

  const [signature, setSignature] = useState<SignatureValue>(user.signatureUrl ? { kind: 'saved' } : { kind: 'none' });
  const [reason, setReason] = useState('');

  const open = (kind: DialogKind) => {
    setDialogError(undefined);
    setDialog(kind);
  };

  const run = async (action: () => Promise<unknown>, success: () => void) => {
    setBusy(true);
    setDialogError(undefined);
    try {
      await action();
      await refresh();
      setDialog(null);
      success();
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const duplicate = async () => {
    setBusy(true);
    try {
      const { voucher: copy } = await vouchersApi.duplicate(voucher.id);
      await refresh();
      toast.success('Draft created', `${copy.voucherNumber} is a copy of ${voucher.voucherNumber}. Review it and submit when ready.`);
      navigate(`/vouchers/${copy.id}/edit`);
    } catch (err) {
      toast.error("Couldn't copy the voucher", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" onClick={() => window.print()} icon={<Printer className="size-4" />}>
        Print
      </Button>
      {p.canDuplicate && (
        <Button variant="secondary" onClick={duplicate} disabled={busy} icon={<Copy className="size-4" />}>
          Copy as new draft
        </Button>
      )}
      {p.canDelete && (
        <Button variant="secondary" onClick={() => open('delete')} icon={<Trash2 className="size-4 text-rose-600" />}>
          Delete
        </Button>
      )}
      {p.canEdit && (
        <ButtonLink to={`/vouchers/${voucher.id}/edit`} variant="secondary" icon={<Pencil className="size-4" />}>
          Edit
        </ButtonLink>
      )}
      {p.canSubmit && (
        <Button onClick={() => open('submit')} icon={<Send className="size-4" />}>
          Submit for approval
        </Button>
      )}
      {p.canReject && (
        <Button variant="danger" onClick={() => open('reject')} icon={<X className="size-4" />}>
          Reject
        </Button>
      )}
      {p.canApprove && (
        <Button variant="success" onClick={() => open('approve')} icon={<Check className="size-4" />}>
          Approve
        </Button>
      )}

      {/* Submit */}
      <Dialog
        open={dialog === 'submit'}
        onClose={() => setDialog(null)}
        busy={busy}
        title="Submit for approval?"
        description={
          voucher.employeeSignatureUrl
            ? `${voucher.voucherNumber} (${formatCurrency(voucher.amount)}) will be sent to the Director. You won't be able to edit or delete it afterwards.`
            : 'Your signature is required before submission. Edit the voucher to add it.'
        }
        footer={
          voucher.employeeSignatureUrl ? (
            <>
              <Button variant="secondary" onClick={() => setDialog(null)} disabled={busy}>
                Cancel
              </Button>
              <Button
                loading={busy}
                icon={<Send className="size-4" />}
                onClick={() => run(() => vouchersApi.submit(voucher.id), () => toast.success('Voucher submitted', `${voucher.voucherNumber} is waiting for approval.`))}
              >
                Submit
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setDialog(null)}>
                Close
              </Button>
              <ButtonLink to={`/vouchers/${voucher.id}/edit`} icon={<Pencil className="size-4" />}>
                Add signature
              </ButtonLink>
            </>
          )
        }
      >
        {dialogError && <Alert tone="error">{dialogError}</Alert>}
      </Dialog>

      {/* Delete */}
      <Dialog
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        busy={busy}
        title={`Delete ${voucher.voucherNumber}?`}
        description="This draft will be removed permanently. This can't be undone."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy}
              icon={<Trash2 className="size-4" />}
              onClick={() =>
                run(
                  () => vouchersApi.remove(voucher.id),
                  () => {
                    toast.success('Draft deleted', `${voucher.voucherNumber} was deleted.`);
                    navigate('/vouchers', { replace: true });
                  },
                )
              }
            >
              Delete draft
            </Button>
          </>
        }
      >
        {dialogError && <Alert tone="error">{dialogError}</Alert>}
      </Dialog>

      {/* Approve */}
      <Dialog
        open={dialog === 'approve'}
        onClose={() => setDialog(null)}
        busy={busy}
        title={`Approve ${voucher.voucherNumber}`}
        description={
          <>
            {voucher.employee.name} · {voucher.title} · <strong className="tabular font-semibold text-slate-900">{formatCurrency(voucher.amount)}</strong>
          </>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="success"
              loading={busy}
              icon={<Check className="size-4" />}
              onClick={() => {
                if (signature.kind === 'none' || signature.kind === 'existing') {
                  setDialogError('Your signature is required to approve this voucher.');
                  return;
                }
                const file = signature.kind === 'file' ? signature.file : null;
                run(
                  () => vouchersApi.approve(voucher.id, file, signature.kind === 'saved'),
                  () => toast.success('Voucher approved', `${voucher.voucherNumber} is now with the Accounts team.`),
                );
              }}
            >
              Approve voucher
            </Button>
          </>
        }
      >
        <p className="mb-2 text-sm font-medium text-slate-700">Your signature</p>
        <SignatureField
          value={signature}
          onChange={(v) => {
            setSignature(v);
            setDialogError(undefined);
          }}
          savedUrl={user.signatureUrl}
          error={dialogError}
        />
      </Dialog>

      {/* Reject */}
      <Dialog
        open={dialog === 'reject'}
        onClose={() => setDialog(null)}
        busy={busy}
        title={`Reject ${voucher.voucherNumber}`}
        description="The employee will see your reason. Rejected vouchers are final; the employee can raise a corrected copy."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy}
              icon={<X className="size-4" />}
              onClick={() => {
                if (reason.trim().length < 5) {
                  setDialogError('Please give a reason (at least 5 characters).');
                  return;
                }
                run(
                  () => vouchersApi.reject(voucher.id, reason.trim()),
                  () => toast.success('Voucher rejected', `${voucher.employee.name} can now see your reason.`),
                );
              }}
            >
              Reject voucher
            </Button>
          </>
        }
      >
        <Field label="Reason for rejection" required error={dialogError} hint={<span className="tabular">{reason.length}/1000</span>}>
          {(a11y) => (
            <Textarea
              {...a11y}
              rows={4}
              maxLength={1000}
              value={reason}
              placeholder="e.g. The receipt is missing. Please attach it and raise the voucher again."
              onChange={(e) => {
                setReason(e.target.value);
                setDialogError(undefined);
              }}
            />
          )}
        </Field>
      </Dialog>
    </div>
  );
}
