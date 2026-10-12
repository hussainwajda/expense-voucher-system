import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** Block closing (Esc / backdrop) while a request is in flight. */
  busy?: boolean;
}

/** Thin wrapper over the native <dialog>, which gives us focus trapping and Esc handling for free. */
export function Dialog({ open, onClose, title, description, children, footer, busy }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !busy) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl bg-white p-0 text-slate-900 shadow-2xl open:animate-slide-in"
    >
      <div className="flex items-start justify-between gap-4 px-6 pt-5">
        <div>
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
          {description && <div className="mt-1 text-sm text-slate-600">{description}</div>}
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="-mr-2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          aria-label="Close"
        >
          <X className="size-5" />
        </button>
      </div>
      {children && <div className="px-6 pt-4">{children}</div>}
      {footer && <div className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-4 sm:flex-row sm:justify-end">{footer}</div>}
    </dialog>
  );
}
