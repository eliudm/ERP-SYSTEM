import dayjs from 'dayjs';
import { formatCurrency } from './format';
import { PAYMENT_METHOD_LABELS } from '../types';
import type { PaymentMethod } from '../types';

export interface InvoiceDocumentItem {
  name: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  amount: number;
}

export interface InvoiceDocumentData {
  invoiceNo: string;
  invoiceDate: string;
  dueDate?: string | null;
  status: string;
  customerName: string;
  customerAddress?: string | null;
  customerPin?: string | null;
  paymentMethod?: PaymentMethod | string | null;
  subtotal: number;
  taxAmount: number;
  total: number;
  items: InvoiceDocumentItem[];
  notes?: string | null;
  companyName: string;
  companyLogo?: string | null;
  companyAddress?: string | null;
  companyPin?: string | null;
  companySlogan?: string | null;
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  );

// Full-page A4 invoice document — distinct from the small thermal-style
// receipt used at the POS terminal (utils/receiptHtml.ts). This is the
// formal document a customer would be emailed or handed: company letterhead,
// bill-to block, itemised table, and a boxed tax breakdown.
export const buildInvoiceDocumentHtml = (data: InvoiceDocumentData): string => {
  const rows = data.items
    .map(
      (item) => `<tr>
        <td>${escapeHtml(item.name)}</td>
        <td class="num">${item.quantity}</td>
        <td class="num">${formatCurrency(item.unitPrice)}</td>
        <td class="num muted">${item.taxRate}%</td>
        <td class="num strong">${formatCurrency(item.amount)}</td>
      </tr>`,
    )
    .join('');

  const paymentLabel = data.paymentMethod
    ? PAYMENT_METHOD_LABELS[data.paymentMethod as PaymentMethod] ?? data.paymentMethod
    : null;

  const paymentTermDays =
    data.dueDate && dayjs(data.dueDate).isAfter(dayjs(data.invoiceDate))
      ? dayjs(data.dueDate).diff(dayjs(data.invoiceDate), 'day')
      : null;

  const uniqueRates = Array.from(new Set(data.items.map((i) => i.taxRate)));
  const vatLabel =
    uniqueRates.length === 1 && uniqueRates[0] > 0
      ? `VAT ${uniqueRates[0]}% on ${formatCurrency(data.subtotal)}`
      : 'VAT';

  const metaRows = [
    { label: 'Invoice Date', value: dayjs(data.invoiceDate).format('DD MMM YYYY') },
    data.dueDate ? { label: 'Due Date', value: dayjs(data.dueDate).format('DD MMM YYYY') } : null,
    paymentTermDays !== null ? { label: 'Payment Terms', value: `${paymentTermDays} Days` } : null,
    paymentLabel ? { label: 'Payment Method', value: paymentLabel } : null,
  ].filter((r): r is { label: string; value: string } => r !== null);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice ${data.invoiceNo}</title>
  <style>
    @page { size: A4; margin: 16mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
      color: #1f2430;
      font-size: 13px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header { display: flex; justify-content: space-between; align-items: flex-start; }
    .logo-wrap { max-width: 55%; }
    .logo-wrap img { max-height: 60px; max-width: 220px; object-fit: contain; }
    .company-name-fallback { font-size: 20px; font-weight: 700; }
    .slogan { margin-top: 6px; font-size: 11.5px; color: #6b7280; }
    .company-block { text-align: right; font-size: 12px; color: #4b5260; line-height: 1.5; }
    .company-block .name { font-size: 14px; font-weight: 700; color: #1f2430; }
    .accent-bar { height: 3px; background: #1677ff; border-radius: 2px; margin: 18px 0 22px; }
    .billto-row { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 22px; }
    .billto .label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; color: #8a8f99; margin-bottom: 4px; }
    .billto .name { font-size: 15px; font-weight: 700; }
    .billto .addr { font-size: 12px; color: #6b7280; margin-top: 2px; }
    .status-pill {
      display: inline-block; padding: 4px 12px; border-radius: 999px;
      font-size: 11px; font-weight: 700; letter-spacing: 0.03em;
      background: #e6f0ff; color: #1677ff;
    }
    h1 { font-size: 24px; margin: 0 0 14px; font-weight: 700; }
    .meta-grid { display: flex; gap: 32px; flex-wrap: wrap; margin-bottom: 26px; }
    .meta-item .label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; color: #8a8f99; margin-bottom: 3px; }
    .meta-item .value { font-size: 13px; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    thead th {
      text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em;
      color: #8a8f99; padding: 8px 10px; border-bottom: 2px solid #1f2430;
    }
    thead th.num { text-align: right; }
    tbody td { padding: 10px; font-size: 12.5px; border-bottom: 1px solid #edeef1; font-variant-numeric: tabular-nums; }
    tbody tr:nth-child(even) { background: #f8f9fb; }
    td.num { text-align: right; }
    td.muted { color: #8a8f99; }
    td.strong { font-weight: 700; }
    .totals-wrap { display: flex; justify-content: flex-end; }
    .totals { width: 280px; }
    .totals .row { display: flex; justify-content: space-between; padding: 6px 10px; font-size: 12.5px; }
    .totals .row.grand {
      background: #1677ff; color: #ffffff; border-radius: 6px;
      font-size: 15px; font-weight: 700; margin-top: 4px; padding: 10px;
    }
    .totals .row .label { color: #6b7280; }
    .totals .row.grand .label { color: #ffffff; }
    .footer { margin-top: 40px; padding-top: 14px; border-top: 1px solid #edeef1; display: flex; justify-content: space-between; font-size: 11px; color: #8a8f99; }
    .notes { margin-top: 20px; font-size: 12px; color: #4b5260; background: #f8f9fb; border-radius: 8px; padding: 12px 14px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-wrap">
      ${data.companyLogo ? `<img src="${data.companyLogo}" alt="${escapeHtml(data.companyName)}" />` : `<div class="company-name-fallback">${escapeHtml(data.companyName)}</div>`}
      ${data.companySlogan ? `<div class="slogan">${escapeHtml(data.companySlogan)}</div>` : ''}
    </div>
    <div class="company-block">
      ${data.companyLogo ? `<div class="name">${escapeHtml(data.companyName)}</div>` : ''}
      ${data.companyAddress ? `<div>${escapeHtml(data.companyAddress)}</div>` : ''}
      ${data.companyPin ? `<div>Tax PIN: ${escapeHtml(data.companyPin)}</div>` : ''}
    </div>
  </div>

  <div class="accent-bar"></div>

  <div class="billto-row">
    <div class="billto">
      <div class="label">Billed To</div>
      <div class="name">${escapeHtml(data.customerName)}</div>
      ${data.customerAddress ? `<div class="addr">${escapeHtml(data.customerAddress)}</div>` : ''}
      ${data.customerPin ? `<div class="addr">Tax PIN: ${escapeHtml(data.customerPin)}</div>` : ''}
    </div>
    <span class="status-pill">${escapeHtml(data.status)}</span>
  </div>

  <h1>Invoice ${data.invoiceNo}</h1>

  <div class="meta-grid">
    ${metaRows
      .map(
        (m) => `<div class="meta-item"><div class="label">${m.label}</div><div class="value">${escapeHtml(m.value)}</div></div>`,
      )
      .join('')}
    <div class="meta-item"><div class="label">Payment Reference</div><div class="value">${data.invoiceNo}</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="num">Quantity</th>
        <th class="num">Unit Price</th>
        <th class="num">Tax</th>
        <th class="num">Amount</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals-wrap">
    <div class="totals">
      <div class="row"><span class="label">Untaxed Amount</span><span>${formatCurrency(data.subtotal)}</span></div>
      <div class="row"><span class="label">${vatLabel}</span><span>${formatCurrency(data.taxAmount)}</span></div>
      <div class="row grand"><span class="label">Total</span><span>${formatCurrency(data.total)}</span></div>
    </div>
  </div>

  ${data.notes ? `<div class="notes">${escapeHtml(data.notes)}</div>` : ''}

  <div class="footer">
    <span>${escapeHtml(data.companyName)}${data.companyPin ? ` · Tax PIN: ${escapeHtml(data.companyPin)}` : ''}</span>
    <span>Thank you for your business.</span>
  </div>

  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`;
};
