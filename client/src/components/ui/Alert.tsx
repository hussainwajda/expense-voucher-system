import type { ReactNode } from 'react';
import { AlertTriangle, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

const TONES = {
  info: { box: 'border-brand-200 bg-brand-50 text-brand-900', icon: Info, iconClass: 'text-brand-600' },
  warning: { box: 'border-amber-200 bg-amber-50 text-amber-900', icon: AlertTriangle, iconClass: 'text-amber-600' },
  error: { box: 'border-rose-200 bg-rose-50 text-rose-900', icon: XCircle, iconClass: 'text-rose-600' },
};

export function Alert({ tone = 'info', title, children, className }: { tone?: keyof typeof TONES; title?: string; children?: ReactNode; className?: string }) {
  const t = TONES[tone];
  const Icon = t.icon;
  return (
    <div role={tone === 'error' ? 'alert' : undefined} className={cn('flex gap-3 rounded-xl border px-4 py-3 text-sm', t.box, className)}>
      <Icon className={cn('mt-0.5 size-5 shrink-0', t.iconClass)} aria-hidden="true" />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5', 'break-words')}>{children}</div>}
      </div>
    </div>
  );
}
