import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '@/lib/cn';

export interface Segment {
  label: string;
  value: number;
  /** Tailwind background class for the bar and legend dot. */
  color: string;
  to?: string;
}

interface SummaryHeroProps {
  eyebrow: string;
  value: string;
  caption?: ReactNode;
  /** Small secondary figures shown under the headline amount. */
  facts?: Array<{ label: string; value: ReactNode }>;
  breakdown?: { title: string; segments: Segment[] };
  action?: ReactNode;
}

/**
 * Headline figure for a dashboard, with an optional status breakdown.
 * The breakdown is a 100% stacked bar with a labelled legend (count + share),
 * so the meaning never depends on colour alone.
 */
export function SummaryHero({ eyebrow, value, caption, facts, breakdown, action }: SummaryHeroProps) {
  const total = breakdown?.segments.reduce((sum, s) => sum + s.value, 0) ?? 0;

  return (
    <section className="relative overflow-hidden rounded-2xl bg-slate-950 p-6 text-white shadow-sm sm:p-7">
      <div className="pointer-events-none absolute -top-24 -left-20 size-80 rounded-full bg-brand-600/35 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-24 -bottom-28 size-80 rounded-full bg-emerald-500/10 blur-3xl" aria-hidden="true" />

      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
        <div className="min-w-0">
          <p className="text-sm font-medium text-brand-200">{eyebrow}</p>
          <p className="tabular mt-2 text-4xl font-semibold tracking-tight sm:text-[2.75rem]">{value}</p>
          {caption && <p className="mt-2 text-sm text-slate-300">{caption}</p>}
          {facts && facts.length > 0 && (
            <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dt className="text-xs text-slate-400">{fact.label}</dt>
                  <dd className="tabular mt-0.5 text-base font-semibold">{fact.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {action && <div className="mt-6">{action}</div>}
        </div>

        {breakdown && (
          <div className="min-w-0 rounded-xl bg-white/[0.04] p-5 ring-1 ring-white/10">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium text-slate-200">{breakdown.title}</p>
              <p className="tabular shrink-0 text-xs text-slate-400">{total} total</p>
            </div>
            <div
              className="mt-4 flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-white/10"
              role="img"
              aria-label={breakdown.segments.map((s) => `${s.label}: ${s.value}`).join(', ')}
            >
              {total > 0 &&
                breakdown.segments
                  .filter((s) => s.value > 0)
                  .map((s) => (
                    <span
                      key={s.label}
                      className={cn('h-full transition-[flex-grow] duration-500 first:rounded-l-full last:rounded-r-full', s.color)}
                      style={{ flexGrow: s.value, flexBasis: 0 }}
                    />
                  ))}
            </div>
            <ul className="mt-4 grid gap-x-5 gap-y-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {breakdown.segments.map((s) => {
                const share = total ? Math.round((s.value / total) * 100) : 0;
                const body = (
                  <>
                    <span className={cn('size-2.5 shrink-0 rounded-full', s.color)} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-slate-300">{s.label}</span>
                    <span className="tabular font-semibold text-white">{s.value}</span>
                    <span className="tabular w-9 text-right text-xs text-slate-400">{share}%</span>
                  </>
                );
                return (
                  <li key={s.label}>
                    {s.to ? (
                      <Link
                        to={s.to}
                        className="-mx-2 flex items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-brand-300"
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-2 py-1 text-sm">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
