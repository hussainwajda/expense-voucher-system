import type { VoucherRow } from './vouchers.repository.js';

const STATUS_TEXT: Record<VoucherRow['status'], string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

const COLUMNS: Array<[header: string, value: (v: VoucherRow) => string | number | null]> = [
  ['Voucher Number', (v) => v.voucher_number],
  ['Voucher Date', (v) => v.voucher_date],
  ['Expense Date', (v) => v.expense_date],
  ['Employee Name', (v) => v.employee_name],
  ['Employee ID', (v) => v.employee_code],
  ['Department', (v) => v.department_name],
  ['Category', (v) => v.category_name],
  ['Expense Title', (v) => v.title],
  ['Description', (v) => v.description],
  ['Amount (INR)', (v) => v.amount.toFixed(2)],
  ['Status', (v) => STATUS_TEXT[v.status]],
  ['Submitted At', (v) => v.submitted_at?.toISOString() ?? null],
  ['Decided By', (v) => v.decided_by_name],
  ['Decision Date', (v) => v.decided_at?.toISOString() ?? null],
  ['Rejection Reason', (v) => v.rejection_reason],
];

function cell(value: string | number | null): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  // Stop spreadsheet apps from treating user-entered text as a formula (CSV injection).
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: VoucherRow[]): string {
  const lines = [COLUMNS.map(([header]) => cell(header)).join(',')];
  for (const row of rows) lines.push(COLUMNS.map(([, value]) => cell(value(row))).join(','));
  // Leading BOM so Excel opens UTF-8 (e.g. the ₹ sign in descriptions) correctly.
  return `﻿${lines.join('\r\n')}\r\n`;
}
