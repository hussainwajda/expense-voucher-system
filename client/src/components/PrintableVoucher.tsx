import type { VoucherDetail } from '@/api/types';
import { amountInWords } from '@/lib/amount-in-words';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import { STATUS_META } from '@/lib/voucher-status';

/** A formal, paper-style voucher that replaces the screen layout when printing (or saving as PDF). */
export function PrintableVoucher({ voucher: v, printedBy }: { voucher: VoucherDetail; printedBy: string }) {
  const rows: Array<[string, string]> = [
    ['Voucher date', formatDate(v.voucherDate)],
    ['Expense date', formatDate(v.expenseDate)],
    ['Employee name', v.employee.name],
    ['Employee ID', v.employee.employeeCode ?? '—'],
    ['Department', v.department.name],
    ['Expense category', v.category.name],
  ];

  return (
    <article className="hidden text-[13px] text-black print:block">
      <header className="flex items-end justify-between border-b-2 border-black pb-3">
        <div>
          <p className="text-lg font-bold">ABC Company</p>
          <p className="text-xs">Employee expense reimbursement</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold tracking-wide uppercase">Expense Voucher</p>
          <p className="tabular font-semibold">No. {v.voucherNumber}</p>
        </div>
      </header>

      <p className="mt-3 text-xs">
        Status: <strong>{STATUS_META[v.status].label}</strong>
      </p>

      <table className="mt-3 w-full border-collapse">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th className="w-44 border border-black/60 bg-black/[0.04] px-3 py-1.5 text-left font-semibold">{label}</th>
              <td className="border border-black/60 px-3 py-1.5">{value}</td>
            </tr>
          ))}
          <tr>
            <th className="border border-black/60 bg-black/[0.04] px-3 py-1.5 text-left align-top font-semibold">Expense title</th>
            <td className="border border-black/60 px-3 py-1.5">{v.title}</td>
          </tr>
          <tr>
            <th className="border border-black/60 bg-black/[0.04] px-3 py-1.5 text-left align-top font-semibold">Description</th>
            <td className="border border-black/60 px-3 py-1.5 whitespace-pre-wrap">{v.description || '—'}</td>
          </tr>
          <tr>
            <th className="border border-black/60 bg-black/[0.04] px-3 py-2 text-left font-semibold">Amount</th>
            <td className="border border-black/60 px-3 py-2">
              <span className="tabular text-base font-bold">{formatCurrency(v.amount)}</span>
              <span className="ml-2 italic">({amountInWords(v.amount)})</span>
            </td>
          </tr>
          {v.status === 'REJECTED' && (
            <tr>
              <th className="border border-black/60 bg-black/[0.04] px-3 py-1.5 text-left align-top font-semibold">Rejection reason</th>
              <td className="border border-black/60 px-3 py-1.5">{v.rejectionReason}</td>
            </tr>
          )}
        </tbody>
      </table>

      <section className="mt-10 grid grid-cols-2 gap-10">
        <div>
          <div className="flex h-24 items-end justify-center border-b border-black">
            {v.employeeSignatureUrl && <img src={v.employeeSignatureUrl} alt="Employee signature" className="max-h-24 object-contain" />}
          </div>
          <p className="mt-1 font-semibold">Employee signature</p>
          <p className="text-xs">{v.employee.name}</p>
          <p className="text-xs">Submitted: {formatDateTime(v.submittedAt)}</p>
        </div>
        <div>
          <div className="flex h-24 items-end justify-center border-b border-black">
            {v.directorSignatureUrl && <img src={v.directorSignatureUrl} alt="Director signature" className="max-h-24 object-contain" />}
          </div>
          <p className="mt-1 font-semibold">Director signature</p>
          <p className="text-xs">{v.decidedBy?.name ?? '—'}</p>
          <p className="text-xs">
            {v.status === 'REJECTED' ? 'Rejected' : 'Approved'}: {v.decidedAt ? formatDateTime(v.decidedAt) : '—'}
          </p>
        </div>
      </section>

      <footer className="mt-12 border-t border-black/40 pt-2 text-[11px]">
        System-generated voucher · Created {formatDateTime(v.createdAt)} · Last updated {formatDateTime(v.updatedAt)} · Printed{' '}
        {formatDateTime(new Date().toISOString())} by {printedBy}
      </footer>
    </article>
  );
}
