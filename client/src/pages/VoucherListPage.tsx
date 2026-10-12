import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ArrowDown, ArrowUp, ArrowUpDown, Download, FilePlus2, Filter, Search, SearchX, X } from 'lucide-react';
import { vouchersApi } from '@/api/endpoints';
import type { Voucher, VoucherQuery, VoucherStatus } from '@/api/types';
import { useCurrentUser } from '@/auth/AuthProvider';
import { PageHeader } from '@/components/AppLayout';
import { Pagination } from '@/components/Pagination';
import { StatusBadge } from '@/components/StatusBadge';
import { Alert } from '@/components/ui/Alert';
import { Button, ButtonLink, buttonClasses } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field, Input, Select } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/Spinner';
import { useMeta, useVoucherList } from '@/hooks/queries';
import { cn } from '@/lib/cn';
import { formatCurrency, formatDate, formatRelative } from '@/lib/format';

type Mode = 'mine' | 'all' | 'pending';

const FILTER_KEYS = ['status', 'departmentId', 'categoryId', 'dateFrom', 'dateTo', 'amountMin', 'amountMax'] as const;

const MODE_COPY: Record<Mode, { title: string; description: string }> = {
  mine: { title: 'My Vouchers', description: 'Every voucher you have created, with its current status.' },
  all: { title: 'All Vouchers', description: 'Submitted vouchers across the organisation. Drafts stay private until submitted.' },
  pending: { title: 'Pending Approvals', description: 'Submitted vouchers waiting for your decision, oldest first.' },
};

/** Keeps list state in the URL so filtered views can be bookmarked, shared and survive a refresh. */
function useListQuery(mode: Mode) {
  const [params, setParams] = useSearchParams();
  const query: VoucherQuery = {
    q: params.get('q') ?? '',
    status: mode === 'pending' ? 'PENDING_APPROVAL' : ((params.get('status') ?? '') as VoucherStatus | ''),
    departmentId: params.get('departmentId') ?? '',
    categoryId: params.get('categoryId') ?? '',
    dateFrom: params.get('dateFrom') ?? '',
    dateTo: params.get('dateTo') ?? '',
    amountMin: params.get('amountMin') ?? '',
    amountMax: params.get('amountMax') ?? '',
    sortBy: params.get('sortBy') ?? (mode === 'pending' ? 'submittedAt' : 'createdAt'),
    sortOrder: (params.get('sortOrder') as 'asc' | 'desc' | null) ?? (mode === 'pending' ? 'asc' : 'desc'),
    page: Number(params.get('page') ?? 1) || 1,
    pageSize: Number(params.get('pageSize') ?? 10) || 10,
  };

  const update = (changes: Partial<Record<keyof VoucherQuery, string | number | undefined>>, resetPage = true) => {
    // Functional update: a debounced search must not undo a filter picked in the meantime.
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          if (value === undefined || value === '') next.delete(key);
          else next.set(key, String(value));
        }
        if (resetPage && !('page' in changes)) next.delete('page');
        return next;
      },
      { replace: true },
    );
  };

  return { query, update, params, setParams };
}

export function VoucherListPage({ mode }: { mode: Mode }) {
  const user = useCurrentUser();
  const { query, update, params, setParams } = useListQuery(mode);
  const { data, isPending, isFetching, error } = useVoucherList(query);
  const meta = useMeta();
  const navigate = useNavigate();

  const activeFilters = FILTER_KEYS.filter((k) => k !== 'status' || mode !== 'pending').filter((k) => params.get(k));
  const [filtersOpen, setFiltersOpen] = useState(activeFilters.length > 0);
  const [search, setSearch] = useState(query.q ?? '');

  // Debounce the search box so we don't fire a request on every keystroke.
  useEffect(() => {
    const handle = setTimeout(() => {
      if ((search.trim() || '') !== (query.q ?? '')) update({ q: search.trim() });
    }, 300);
    return () => clearTimeout(handle);
  }, [search]); // only the typed text should restart the timer

  const showEmployee = mode !== 'mine';
  const canExport = user.role === 'DIRECTOR' || user.role === 'ACCOUNTS';
  const hasCriteria = activeFilters.length > 0 || Boolean(query.q);

  const clearAll = () => {
    setSearch('');
    const next = new URLSearchParams();
    for (const key of ['sortBy', 'sortOrder', 'pageSize']) {
      const value = params.get(key);
      if (value) next.set(key, value);
    }
    setParams(next, { replace: true });
  };

  const toggleSort = (field: string) => {
    if (query.sortBy === field) update({ sortOrder: query.sortOrder === 'asc' ? 'desc' : 'asc' });
    else update({ sortBy: field, sortOrder: ['title', 'employeeName', 'department', 'category', 'voucherNumber'].includes(field) ? 'asc' : 'desc' });
  };

  const copy = MODE_COPY[mode];

  return (
    <>
      <PageHeader
        title={copy.title}
        description={copy.description}
        actions={
          <>
            {canExport && (
              <a href={vouchersApi.exportUrl(query)} download className={buttonClasses({ variant: 'secondary' })}>
                <Download className="size-4" aria-hidden="true" />
                Export CSV
              </a>
            )}
            {user.role === 'EMPLOYEE' && (
              <ButtonLink to="/vouchers/new" icon={<FilePlus2 className="size-4" />}>
                New voucher
              </ButtonLink>
            )}
          </>
        }
      />

      <Card>
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:px-5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={showEmployee ? 'Search voucher no., employee or title' : 'Search voucher no. or title'}
              className="pl-9"
              aria-label="Search vouchers"
            />
          </div>
          <div className="flex items-center gap-2">
            {isFetching && !isPending && <Spinner className="size-4 text-slate-400" />}
            <Button
              variant={filtersOpen || activeFilters.length ? 'secondary' : 'ghost'}
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              aria-controls="voucher-filters"
              icon={<Filter className="size-4" />}
            >
              Filters
              {activeFilters.length > 0 && (
                <span className="tabular rounded-full bg-brand-700 px-1.5 text-xs font-semibold text-white">{activeFilters.length}</span>
              )}
            </Button>
            {hasCriteria && (
              <Button variant="ghost" onClick={clearAll} icon={<X className="size-4" />}>
                Clear
              </Button>
            )}
          </div>
        </div>

        {filtersOpen && (
          <div id="voucher-filters" className="grid animate-fade-in gap-4 border-b border-slate-100 bg-slate-50/60 p-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-3">
            {mode !== 'pending' && (
              <Field label="Status">
                {(a11y) => (
                  <Select {...a11y} value={query.status ?? ''} onChange={(e) => update({ status: e.target.value })}>
                    <option value="">All statuses</option>
                    {meta.data?.statuses
                      .filter((s) => mode === 'mine' || s.value !== 'DRAFT')
                      .map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                  </Select>
                )}
              </Field>
            )}
            <Field label="Department">
              {(a11y) => (
                <Select {...a11y} value={query.departmentId} onChange={(e) => update({ departmentId: e.target.value })}>
                  <option value="">All departments</option>
                  {meta.data?.departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Expense category">
              {(a11y) => (
                <Select {...a11y} value={query.categoryId} onChange={(e) => update({ categoryId: e.target.value })}>
                  <option value="">All categories</option>
                  {meta.data?.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Voucher date from">
                {(a11y) => <Input {...a11y} type="date" value={query.dateFrom} max={query.dateTo || undefined} onChange={(e) => update({ dateFrom: e.target.value })} />}
              </Field>
              <Field label="Voucher date to">
                {(a11y) => <Input {...a11y} type="date" value={query.dateTo} min={query.dateFrom || undefined} onChange={(e) => update({ dateTo: e.target.value })} />}
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Min amount ₹">
                {(a11y) => (
                  <Input {...a11y} type="number" inputMode="decimal" min={0} step="0.01" value={query.amountMin} placeholder="0" onChange={(e) => update({ amountMin: e.target.value })} />
                )}
              </Field>
              <Field label="Max amount ₹">
                {(a11y) => (
                  <Input {...a11y} type="number" inputMode="decimal" min={0} step="0.01" value={query.amountMax} placeholder="Any" onChange={(e) => update({ amountMax: e.target.value })} />
                )}
              </Field>
            </div>
          </div>
        )}

        {error ? (
          <div className="p-5">
            <Alert tone="error" title="Couldn't load vouchers">
              {error.message}
            </Alert>
          </div>
        ) : isPending ? (
          <div className="flex justify-center py-16">
            <Spinner className="size-6 text-brand-600" />
          </div>
        ) : data.data.length === 0 ? (
          hasCriteria ? (
            <EmptyState
              icon={SearchX}
              title="No vouchers match"
              description="Try a different search or remove some filters."
              action={
                <Button variant="secondary" onClick={clearAll}>
                  Clear search and filters
                </Button>
              }
            />
          ) : mode === 'pending' ? (
            <EmptyState icon={FilePlus2} title="Nothing waiting for approval" description="New submissions will show up here." />
          ) : mode === 'mine' ? (
            <EmptyState
              icon={FilePlus2}
              title="You haven't created any vouchers"
              description="Create a voucher for an expense you'd like reimbursed."
              action={<ButtonLink to="/vouchers/new">New voucher</ButtonLink>}
            />
          ) : (
            <EmptyState icon={FilePlus2} title="No vouchers yet" description="Vouchers appear here once employees submit them." />
          )
        ) : (
          <div className={cn('transition-opacity', isFetching && 'opacity-60')}>
            <VoucherTable
              vouchers={data.data}
              showEmployee={showEmployee}
              showSubmitted={mode === 'pending'}
              sortBy={query.sortBy ?? ''}
              sortOrder={query.sortOrder ?? 'desc'}
              onSort={toggleSort}
              onOpen={(id) => navigate(`/vouchers/${id}`)}
            />
            <VoucherCards vouchers={data.data} showEmployee={showEmployee} />
            <Pagination
              pagination={data.pagination}
              onPageChange={(page) => update({ page }, false)}
              onPageSizeChange={(pageSize) => update({ pageSize })}
            />
          </div>
        )}
      </Card>
    </>
  );
}

interface TableProps {
  vouchers: Voucher[];
  showEmployee: boolean;
  showSubmitted: boolean;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSort: (field: string) => void;
  onOpen: (id: number) => void;
}

function VoucherTable({ vouchers, showEmployee, showSubmitted, sortBy, sortOrder, onSort, onOpen }: TableProps) {
  const columns = useMemo(
    () =>
      [
        { key: 'voucherNumber', label: 'Voucher', sortable: true },
        showEmployee && { key: 'employeeName', label: 'Employee', sortable: true },
        { key: 'department', label: 'Department', sortable: true, className: 'hidden xl:table-cell' },
        showSubmitted
          ? { key: 'submittedAt', label: 'Submitted', sortable: true, className: 'hidden xl:table-cell' }
          : { key: 'voucherDate', label: 'Voucher date', sortable: true, className: 'hidden xl:table-cell' },
        { key: 'amount', label: 'Amount', sortable: true, align: 'right' as const },
        { key: 'status', label: 'Status', sortable: true },
      ].filter(Boolean) as Array<{ key: string; label: string; sortable: boolean; align?: 'right'; className?: string }>,
    [showEmployee, showSubmitted],
  );

  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-100 bg-slate-50/60 text-xs font-medium text-slate-500">
          <tr>
            {columns.map((col) => {
              const active = sortBy === col.key;
              const Icon = !active ? ArrowUpDown : sortOrder === 'asc' ? ArrowUp : ArrowDown;
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={active ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined}
                  className={cn('px-4 py-3 font-medium whitespace-nowrap', col.align === 'right' && 'text-right', col.className)}
                >
                  <button
                    type="button"
                    onClick={() => onSort(col.key)}
                    className={cn('inline-flex items-center gap-1 rounded hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-600', active && 'text-slate-900')}
                  >
                    {col.label}
                    <Icon className={cn('size-3.5', !active && 'opacity-40')} aria-hidden="true" />
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {vouchers.map((v) => (
            <tr key={v.id} onClick={() => onOpen(v.id)} className="cursor-pointer hover:bg-slate-50">
              <td className="max-w-[18rem] px-4 py-3.5">
                <Link to={`/vouchers/${v.id}`} onClick={(e) => e.stopPropagation()} className="tabular text-xs font-medium text-brand-700 hover:underline">
                  {v.voucherNumber}
                </Link>
                <p className="truncate font-medium text-slate-900">{v.title}</p>
                <p className="truncate text-xs text-slate-500">{v.category.name}</p>
              </td>
              {showEmployee && (
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <p className="text-slate-900">{v.employee.name}</p>
                  {v.employee.employeeCode && <p className="text-xs text-slate-500">{v.employee.employeeCode}</p>}
                </td>
              )}
              <td className="hidden px-4 py-3.5 whitespace-nowrap text-slate-600 xl:table-cell">{v.department.name}</td>
              <td className="tabular hidden px-4 py-3.5 whitespace-nowrap text-slate-600 xl:table-cell">
                {showSubmitted && v.submittedAt ? <span title={formatDate(v.submittedAt)}>{formatRelative(v.submittedAt)}</span> : formatDate(v.voucherDate)}
              </td>
              <td className="tabular px-4 py-3.5 text-right font-semibold whitespace-nowrap text-slate-900">{formatCurrency(v.amount)}</td>
              <td className="px-4 py-3.5">
                <StatusBadge status={v.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VoucherCards({ vouchers, showEmployee }: { vouchers: Voucher[]; showEmployee: boolean }) {
  return (
    <ul className="divide-y divide-slate-100 md:hidden">
      {vouchers.map((v) => (
        <li key={v.id}>
          <Link to={`/vouchers/${v.id}`} className="block px-4 py-4 hover:bg-slate-50">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="tabular text-xs font-medium text-slate-500">{v.voucherNumber}</p>
                <p className="mt-0.5 truncate font-medium text-slate-900">{v.title}</p>
              </div>
              <p className="tabular shrink-0 font-semibold text-slate-900">{formatCurrency(v.amount)}</p>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
              <StatusBadge status={v.status} />
              {showEmployee && <span>{v.employee.name}</span>}
              <span>{v.category.name}</span>
              <span className="tabular">{formatDate(v.voucherDate)}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
