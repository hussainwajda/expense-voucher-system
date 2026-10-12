import type { VoucherStatus } from '@/api/types';
import { cn } from '@/lib/cn';
import { STATUS_META } from '@/lib/voucher-status';

export function StatusBadge({ status, size = 'sm' }: { status: VoucherStatus; size?: 'sm' | 'md' }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap ring-1 ring-inset',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        meta.badge,
      )}
    >
      <span className={cn('size-1.5 rounded-full', meta.dot)} aria-hidden="true" />
      {meta.label}
    </span>
  );
}
