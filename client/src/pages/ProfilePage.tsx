import { useState } from 'react';
import { Save, Trash2 } from 'lucide-react';
import { usersApi } from '@/api/endpoints';
import { useAuth, useCurrentUser } from '@/auth/AuthProvider';
import { PageHeader } from '@/components/AppLayout';
import { SignatureField, SignatureImage, type SignatureValue } from '@/components/SignatureField';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';
import { ROLE_LABEL } from '@/lib/voucher-status';

export function ProfilePage() {
  const user = useCurrentUser();
  const { setUser } = useAuth();
  const toast = useToast();
  const canSign = user.role !== 'ACCOUNTS';

  const [value, setValue] = useState<SignatureValue>({ kind: 'none' });
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const save = async () => {
    if (value.kind !== 'file') {
      setError('Upload or draw a signature first.');
      return;
    }
    setBusy(true);
    try {
      const { user: updated } = await usersApi.uploadSignature(value.file);
      setUser(updated);
      setValue({ kind: 'none' });
      toast.success('Signature saved', 'You can now use it when signing vouchers.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const { user: updated } = await usersApi.removeSignature();
      setUser(updated);
      setConfirmRemove(false);
      toast.success('Saved signature removed', 'Vouchers you already signed keep their signature.');
    } catch (err) {
      toast.error("Couldn't remove the signature", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title={canSign ? 'My Signature' : 'My Profile'}
        description={canSign ? 'Save your signature once and reuse it whenever you sign a voucher.' : 'Your account details.'}
      />
      <div className="grid items-start gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader title="Account" />
          <dl className="divide-y divide-slate-100 text-sm">
            {[
              ['Name', user.fullName],
              ['Email', user.email],
              ['Role', ROLE_LABEL[user.role]],
              ['Employee ID', user.employeeCode ?? '—'],
              ['Department', user.department?.name ?? '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 px-5 py-3">
                <dt className="text-slate-500">{label}</dt>
                <dd className="truncate text-right font-medium text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        {canSign && (
          <Card className="xl:col-span-2">
            <CardHeader
              title="Saved signature"
              description="Each voucher keeps its own copy, so changing this later never alters a signed voucher."
            />
            <div className="grid gap-6 p-5 md:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Current</p>
                {user.signatureUrl ? (
                  <>
                    <SignatureImage src={user.signatureUrl} alt="Your saved signature" />
                    <Button variant="ghost" size="sm" className="mt-2 text-rose-700" onClick={() => setConfirmRemove(true)} icon={<Trash2 className="size-3.5" />}>
                      Remove
                    </Button>
                  </>
                ) : (
                  <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-xs text-slate-500">
                    No saved signature yet.
                  </div>
                )}
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">{user.signatureUrl ? 'Replace with a new one' : 'Add a signature'}</p>
                <SignatureField
                  value={value}
                  onChange={(v) => {
                    setValue(v);
                    setError(undefined);
                  }}
                  savedUrl={null}
                  error={error}
                />
                <Button className="mt-4" onClick={save} loading={busy} disabled={value.kind !== 'file'} icon={<Save className="size-4" />}>
                  Save signature
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>

      <Dialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        busy={busy}
        title="Remove saved signature?"
        description="Vouchers you have already signed keep their signature. You can save a new one at any time."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmRemove(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={remove} loading={busy}>
              Remove
            </Button>
          </>
        }
      />
    </>
  );
}
