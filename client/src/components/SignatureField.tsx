import { useEffect, useId, useRef, useState } from 'react';
import { ImageUp, PenLine, RotateCcw, Signature, UserCheck } from 'lucide-react';
import { cn } from '@/lib/cn';
import { SignaturePad } from './SignaturePad';
import { Button } from './ui/Button';

export const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export type SignatureValue =
  | { kind: 'none' }
  | { kind: 'existing'; url: string } // already attached to the voucher
  | { kind: 'saved' } // use the signature saved on the user's profile
  | { kind: 'file'; file: File; previewUrl: string; source: 'upload' | 'draw' };

type Tab = 'saved' | 'upload' | 'draw';

interface SignatureFieldProps {
  value: SignatureValue;
  onChange: (value: SignatureValue) => void;
  /** URL of the user's saved signature, if they have one. */
  savedUrl: string | null;
  /** A signature already on the voucher, so the user can go back to it after starting to replace it. */
  existingUrl?: string | null;
  error?: string;
}

export function SignatureImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <div className={cn('flex h-28 items-center justify-center rounded-lg border border-slate-200 bg-[repeating-linear-gradient(45deg,#f8fafc,#f8fafc_8px,#fff_8px,#fff_16px)] p-2', className)}>
      <img src={src} alt={alt} className="max-h-full max-w-full object-contain" />
    </div>
  );
}

export function SignatureField({ value, onChange, savedUrl, existingUrl, error }: SignatureFieldProps) {
  const errorId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(value.kind === 'saved' ? 'saved' : value.kind === 'file' && value.source === 'draw' ? 'draw' : savedUrl ? 'saved' : 'upload');

  // Release object URLs we created for previews.
  const previewUrl = value.kind === 'file' ? value.previewUrl : null;
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const setFile = (file: File | null, source: 'upload' | 'draw') => {
    setFileError(null);
    if (!file) return onChange({ kind: 'none' });
    if (!ACCEPTED_TYPES.includes(file.type)) return setFileError('Choose a PNG, JPEG or WebP image.');
    if (file.size > MAX_SIGNATURE_BYTES) return setFileError('The image must be 2 MB or smaller.');
    onChange({ kind: 'file', file, previewUrl: URL.createObjectURL(file), source });
  };

  const selectTab = (next: Tab) => {
    setTab(next);
    setFileError(null);
    if (next === 'saved') onChange({ kind: 'saved' });
    else if (value.kind === 'saved' || (value.kind === 'file' && value.source !== next)) onChange({ kind: 'none' });
  };

  const shownError = fileError ?? error;

  // The voucher already carries a signature: show it, with the option to replace it.
  if (value.kind === 'existing') {
    return (
      <div>
        <SignatureImage src={value.url} alt="Your signature on this voucher" />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">This signature is attached to the voucher.</p>
          <Button variant="secondary" size="sm" onClick={() => onChange(savedUrl ? { kind: 'saved' } : { kind: 'none' })} icon={<Signature className="size-3.5" />}>
            Replace
          </Button>
        </div>
      </div>
    );
  }

  const tabs: Array<{ id: Tab; label: string; icon: typeof ImageUp }> = [
    ...(savedUrl ? [{ id: 'saved' as const, label: 'Saved', icon: UserCheck }] : []),
    { id: 'upload', label: 'Upload', icon: ImageUp },
    { id: 'draw', label: 'Draw', icon: PenLine },
  ];

  return (
    <div aria-describedby={shownError ? errorId : undefined}>
      <div role="tablist" aria-label="How to sign" className="grid grid-flow-col gap-1 rounded-lg bg-slate-100 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => selectTab(t.id)}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition',
              tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
            )}
          >
            <t.icon className="size-3.5" aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-3" role="tabpanel">
        {tab === 'saved' && savedUrl && (
          <>
            <SignatureImage src={savedUrl} alt="Your saved signature" />
            <p className="mt-2 text-xs text-slate-500">A copy of your saved signature will be attached.</p>
          </>
        )}

        {tab === 'upload' && (
          <>
            {value.kind === 'file' && value.source === 'upload' ? (
              <>
                <SignatureImage src={value.previewUrl} alt="Selected signature image" />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="truncate text-xs text-slate-500">{value.file.name}</p>
                  <Button variant="ghost" size="sm" onClick={() => fileInput.current?.click()}>
                    Choose another
                  </Button>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  setFile(e.dataTransfer.files[0] ?? null, 'upload');
                }}
                className={cn(
                  'flex h-28 w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed bg-white text-sm transition hover:border-brand-400 hover:bg-brand-50/40',
                  shownError ? 'border-rose-300' : 'border-slate-300',
                )}
              >
                <ImageUp className="size-5 text-slate-400" aria-hidden="true" />
                <span className="font-medium text-brand-700">Choose an image</span>
                <span className="text-xs text-slate-500">PNG, JPEG or WebP, up to 2 MB</span>
              </button>
            )}
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPTED_TYPES.join(',')}
              className="sr-only"
              tabIndex={-1}
              aria-label="Signature image file"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null, 'upload');
                e.target.value = '';
              }}
            />
          </>
        )}

        {tab === 'draw' && <SignaturePad onChange={(file) => setFile(file, 'draw')} />}
      </div>

      {existingUrl && (
        <button type="button" onClick={() => onChange({ kind: 'existing', url: existingUrl })} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900">
          <RotateCcw className="size-3" aria-hidden="true" /> Keep the current signature
        </button>
      )}

      {shownError && (
        <p id={errorId} className="mt-2 text-xs font-medium text-rose-600" role="alert">
          {shownError}
        </p>
      )}
    </div>
  );
}
