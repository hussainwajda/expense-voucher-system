import { Check, CircleDashed, Clock3, FilePen, Landmark, MessageSquareWarning, Pencil, Send, X, type LucideIcon } from 'lucide-react';
import type { VoucherDetail, VoucherEvent } from '@/api/types';
import { cn } from '@/lib/cn';
import { formatDateTime, formatRelative } from '@/lib/format';
import { ROLE_LABEL } from '@/lib/voucher-status';

type StepState = 'done' | 'current' | 'upcoming' | 'failed';

interface Step {
  label: string;
  detail?: string;
  state: StepState;
  icon: LucideIcon;
}

/** The workflow from the requirements: Draft → Submitted → Pending Approval → Approved/Rejected → Accounts / employee. */
function stepsFor(v: VoucherDetail): Step[] {
  const submitted = v.submittedAt !== null;
  const decided = v.status === 'APPROVED' || v.status === 'REJECTED';
  const rejected = v.status === 'REJECTED';

  return [
    { label: 'Draft', detail: `Created ${formatDateTime(v.createdAt)}`, state: 'done', icon: FilePen },
    {
      label: 'Submitted',
      detail: submitted ? formatDateTime(v.submittedAt) : 'Employee signs and submits',
      state: submitted ? 'done' : 'current',
      icon: Send,
    },
    {
      label: 'Pending approval',
      detail: decided ? 'Reviewed by the Director' : submitted ? 'Waiting for the Director' : undefined,
      state: decided ? 'done' : submitted ? 'current' : 'upcoming',
      icon: Clock3,
    },
    rejected
      ? { label: 'Rejected', detail: `${v.decidedBy?.name ?? 'Director'} · ${formatDateTime(v.decidedAt)}`, state: 'failed', icon: X }
      : {
          label: 'Approved',
          detail: v.status === 'APPROVED' ? `${v.decidedBy?.name ?? 'Director'} · ${formatDateTime(v.decidedAt)}` : 'Director signs and approves',
          state: v.status === 'APPROVED' ? 'done' : 'upcoming',
          icon: Check,
        },
    rejected
      ? { label: 'Employee notified', detail: 'The rejection reason is shown on the voucher', state: 'done', icon: MessageSquareWarning }
      : {
          label: 'With Accounts',
          detail: 'Visible to the Accounts team for reimbursement',
          state: v.status === 'APPROVED' ? 'done' : 'upcoming',
          icon: Landmark,
        },
  ];
}

const STATE_STYLE: Record<StepState, { circle: string; label: string }> = {
  done: { circle: 'bg-emerald-600 text-white', label: 'text-slate-900' },
  current: { circle: 'bg-amber-100 text-amber-700 ring-2 ring-amber-400', label: 'text-slate-900' },
  upcoming: { circle: 'bg-slate-100 text-slate-400', label: 'text-slate-500' },
  failed: { circle: 'bg-rose-600 text-white', label: 'text-rose-700' },
};

export function WorkflowProgress({ voucher }: { voucher: VoucherDetail }) {
  const steps = stepsFor(voucher);
  return (
    <ol className="space-y-0">
      {steps.map((step, i) => {
        const style = STATE_STYLE[step.state];
        const last = i === steps.length - 1;
        return (
          <li key={step.label} className="relative flex gap-3 pb-5 last:pb-0">
            {!last && (
              <span
                className={cn('absolute top-8 bottom-0 left-[15px] w-0.5', step.state === 'done' ? 'bg-emerald-200' : 'bg-slate-200')}
                aria-hidden="true"
              />
            )}
            <span className={cn('relative flex size-8 shrink-0 items-center justify-center rounded-full', style.circle)}>
              <step.icon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 pt-1">
              <p className={cn('text-sm font-medium', style.label)}>
                {step.label}
                <span className="sr-only"> ({step.state})</span>
              </p>
              {step.detail && <p className="mt-0.5 text-xs text-slate-500">{step.detail}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const EVENT_STYLE: Record<VoucherEvent['type'], { icon: LucideIcon; verb: string; tone: string }> = {
  CREATED: { icon: CircleDashed, verb: 'created the voucher', tone: 'bg-slate-100 text-slate-600' },
  UPDATED: { icon: Pencil, verb: 'edited the draft', tone: 'bg-slate-100 text-slate-600' },
  SUBMITTED: { icon: Send, verb: 'submitted it for approval', tone: 'bg-amber-50 text-amber-700' },
  APPROVED: { icon: Check, verb: 'approved it', tone: 'bg-emerald-50 text-emerald-700' },
  REJECTED: { icon: X, verb: 'rejected it', tone: 'bg-rose-50 text-rose-700' },
};

export function VoucherHistory({ events }: { events: VoucherEvent[] }) {
  return (
    <ul className="space-y-4">
      {[...events].reverse().map((event) => {
        const style = EVENT_STYLE[event.type];
        return (
          <li key={event.id} className="flex gap-3">
            <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full', style.tone)}>
              <style.icon className="size-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0 text-sm">
              <p className="text-slate-700">
                <span className="font-medium text-slate-900">{event.actor.name}</span>{' '}
                <span className="text-xs text-slate-400">({ROLE_LABEL[event.actor.role]})</span> {style.verb}
              </p>
              {event.note && <p className="mt-1 rounded-md bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">{event.note}</p>}
              <time dateTime={event.createdAt} title={formatDateTime(event.createdAt)} className="mt-0.5 block text-xs text-slate-400">
                {formatRelative(event.createdAt)}
              </time>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
