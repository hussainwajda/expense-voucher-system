import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '@/lib/cn';

const TONES = {
  brand: 'bg-brand-50 text-brand-700',
  slate: 'bg-slate-100 text-slate-600',
  amber: 'bg-amber-50 text-amber-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  rose: 'bg-rose-50 text-rose-700',
};

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  hint?: string;
  to?: string;
  emphasis?: boolean;
}

export function StatCard({ label, value, icon: Icon, tone = 'slate', hint, to, emphasis }: StatCardProps) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <span className={cn('flex size-9 items-center justify-center rounded-lg', TONES[tone])}>
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>
      </div>
      <p className={cn('tabular mt-3 font-semibold tracking-tight text-slate-900', emphasis ? 'text-2xl sm:text-[1.7rem]' : 'text-2xl')}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </>
  );
  const classes = 'block rounded-xl border border-slate-200 bg-white p-5 shadow-sm';
  return to ? (
    <Link to={to} className={cn(classes, 'transition hover:border-brand-200 hover:shadow-md focus-visible:outline-2 focus-visible:outline-brand-600')}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}
