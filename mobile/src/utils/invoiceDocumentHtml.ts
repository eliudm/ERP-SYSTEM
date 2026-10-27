import type { InvoiceTemplate } from '../api/settings.api';

const formatCurrency = (value: number) =>
  `KES ${value.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-KE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  MOBILE_MONEY: 'M-Pesa',
  BANK_TRANSFER: 'Bank Transfer',
  CREDIT: 'Credit',
};

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ] as string,
  );

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
  paymentMethod?: string | null;
  subtotal: number;
  taxAmount: number;
  total: number;
  items: InvoiceDocumentItem[];
  notes?: string | null;
  companyName: string;
  companyLogo?: string | null;
  companyAddress?: string | null;
  companyPin?: string | null;
  companyPhone?: string | null;
  companySlogan?: string | null;
  paymentInstructions?: string | null;
}

interface PreparedInvoice {
  vatLabel: string;
  metaRows: { label: string; value: string }[];
}

const prepare = (data: InvoiceDocumentData): PreparedInvoice => {
  const paymentLabel = data.paymentMethod
    ? (PAYMENT_METHOD_LABELS[data.paymentMethod] ?? data.paymentMethod)
    : null;

  const paymentTermDays =
    data.dueDate && new Date(data.dueDate) > new Date(data.invoiceDate)
      ? Math.round(
          (new Date(data.dueDate).getTime() -
            new Date(data.invoiceDate).getTime()) /
            86400000,
        )
      : null;

  const uniqueRates = Array.from(new Set(data.items.map((i) => i.taxRate)));
  const vatLabel =
    uniqueRates.length === 1 && uniqueRates[0] > 0
      ? `VAT ${uniqueRates[0]}% on ${formatCurrency(data.subtotal)}`
      : 'VAT';

  const metaRows = [
    { label: 'Invoice Date', value: formatDate(data.invoiceDate) },
    data.dueDate
      ? { label: 'Due Date', value: formatDate(data.dueDate) }
      : null,
    paymentTermDays !== null
      ? { label: 'Payment Terms', value: `${paymentTermDays} Days` }
      : null,
    paymentLabel ? { label: 'Payment Method', value: paymentLabel } : null,
  ].filter((r): r is { label: string; value: string } => r !== null);

  return { vatLabel, metaRows };
};

const printScript = `<script>window.onload = function () { window.print(); };</script>`;

// ─── MODERN: blue accent bar, highlighted total box ──────────────
const buildModernInvoiceHtml = (data: InvoiceDocumentData): string => {
  const { vatLabel, metaRows } = prepare(data);

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

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice ${data.invoiceNo}</title>
  <style>
    @page { size: A4; margin: 16mm; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #1f2430; font-size: 13px; min-height: 265mm; display: flex; flex-direction: column; }
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
    .status-pill { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: 0.03em; background: #e6f0ff; color: #1677ff; }
    h1 { font-size: 24px; margin: 0 0 14px; font-weight: 700; }
    .meta-grid { display: flex; gap: 32px; flex-wrap: wrap; margin-bottom: 26px; }
    .meta-item .label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; color: #8a8f99; margin-bottom: 3px; }
    .meta-item .value { font-size: 13px; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    thead th { text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; color: #8a8f99; padding: 8px 10px; border-bottom: 2px solid #1f2430; }
    thead th.num { text-align: right; }
    tbody td { padding: 10px; font-size: 12.5px; border-bottom: 1px solid #edeef1; }
    tbody tr:nth-child(even) { background: #f8f9fb; }
    td.num { text-align: right; }
    td.muted { color: #8a8f99; }
    td.strong { font-weight: 700; }
    .totals-wrap { display: flex; justify-content: flex-end; }
    .totals { width: 280px; }
    .totals .row { display: flex; justify-content: space-between; padding: 6px 10px; font-size: 12.5px; }
    .totals .row.grand { background: #1677ff; color: #ffffff; border-radius: 6px; font-size: 15px; font-weight: 700; margin-top: 4px; padding: 10px; }
    .totals .row .label { color: #6b7280; }
    .totals .row.grand .label { color: #ffffff; }
    .footer { margin-top: auto; padding-top: 14px; border-top: 1px solid #edeef1; font-size: 11px; color: #8a8f99; }
    .footer-row { display: flex; justify-content: space-between; }
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
      ${data.companyPhone ? `<div>Tel: ${escapeHtml(data.companyPhone)}</div>` : ''}
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
    ${metaRows.map((m) => `<div class="meta-item"><div class="label">${m.label}</div><div class="value">${escapeHtml(m.value)}</div></div>`).join('')}
    <div class="meta-item"><div class="label">Payment Reference</div><div class="value">${data.invoiceNo}</div></div>
  </div>

  <table>
    <thead><tr><th>Description</th><th class="num">Quantity</th><th class="num">Unit Price</th><th class="num">Tax</th><th class="num">Amount</th></tr></thead>
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
    ${data.paymentInstructions ? `<div style="margin-bottom:8px">${escapeHtml(data.paymentInstructions)}</div>` : ''}
    <div class="footer-row">
      <span>${escapeHtml(data.companyName)}${data.companyPin ? ` · Tax PIN: ${escapeHtml(data.companyPin)}` : ''}</span>
      <span>Thank you for your business.</span>
    </div>
  </div>

  ${printScript}
</body>
</html>`;
};

// ─── CLASSIC: traditional black & white letterhead ────────────────
const buildClassicInvoiceHtml = (data: InvoiceDocumentData): string => {
  const { vatLabel, metaRows } = prepare(data);

  const rows = data.items
    .map(
      (item) => `<tr>
        <td>${escapeHtml(item.name)}</td>
        <td class="num">${item.quantity}</td>
        <td class="num">${formatCurrency(item.unitPrice)}</td>
        <td class="num">${item.taxRate}%</td>
        <td class="num">${formatCurrency(item.amount)}</td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice ${data.invoiceNo}</title>
  <style>
    @page { size: A4; margin: 18mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Georgia', 'Times New Roman', serif; color: #111; font-size: 12.5px; min-height: 261mm; display: flex; flex-direction: column; }
    .header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 14px; margin-bottom: 18px; }
    .header img { max-height: 55px; max-width: 200px; object-fit: contain; margin-bottom: 8px; }
    .header .name { font-size: 20px; font-weight: 700; letter-spacing: 0.02em; }
    .header .sub { font-size: 11.5px; color: #444; margin-top: 4px; }
    .title-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 18px; }
    h1 { font-size: 19px; margin: 0; font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase; }
    .status { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; border: 1px solid #111; padding: 3px 10px; }
    .billto-meta { display: flex; justify-content: space-between; margin-bottom: 22px; border-top: 1px solid #111; border-bottom: 1px solid #111; padding: 10px 0; }
    .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #555; margin-bottom: 3px; }
    .value { font-size: 12.5px; font-weight: 700; }
    .meta-col { text-align: right; }
    .meta-col div { margin-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    thead th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; padding: 6px 8px; border-bottom: 1.5px solid #111; }
    thead th.num { text-align: right; }
    tbody td { padding: 8px; font-size: 12px; border-bottom: 1px solid #ccc; }
    td.num { text-align: right; }
    .totals-wrap { display: flex; justify-content: flex-end; }
    .totals { width: 270px; border: 1px solid #111; }
    .totals .row { display: flex; justify-content: space-between; padding: 7px 12px; font-size: 12px; border-bottom: 1px solid #ccc; }
    .totals .row.grand { border-bottom: none; font-size: 14px; font-weight: 700; background: #f2f2f2; }
    .notes { margin-top: 18px; font-size: 11.5px; border-left: 3px solid #111; padding: 6px 12px; }
    .footer { margin-top: auto; padding-top: 12px; border-top: 1px solid #111; font-size: 10.5px; color: #444; text-align: center; }
    .footer div { margin-bottom: 4px; }
  </style>
</head>
<body>
  <div class="header">
    ${data.companyLogo ? `<img src="${data.companyLogo}" alt="${escapeHtml(data.companyName)}" />` : `<div class="name">${escapeHtml(data.companyName)}</div>`}
    <div class="sub">
      ${[
        data.companyAddress,
        data.companyPhone ? `Tel: ${data.companyPhone}` : null,
        data.companyPin ? `Tax PIN: ${data.companyPin}` : null,
      ]
        .filter(Boolean)
        .map((s) => escapeHtml(s as string))
        .join(' &nbsp;·&nbsp; ')}
    </div>
    ${data.companySlogan ? `<div class="sub" style="font-style: italic">${escapeHtml(data.companySlogan)}</div>` : ''}
  </div>

  <div class="title-row">
    <h1>Invoice ${data.invoiceNo}</h1>
    <span class="status">${escapeHtml(data.status)}</span>
  </div>

  <div class="billto-meta">
    <div>
      <div class="label">Billed To</div>
      <div class="value">${escapeHtml(data.customerName)}</div>
      ${data.customerAddress ? `<div style="font-size:11.5px;color:#444;margin-top:2px">${escapeHtml(data.customerAddress)}</div>` : ''}
      ${data.customerPin ? `<div style="font-size:11.5px;color:#444">Tax PIN: ${escapeHtml(data.customerPin)}</div>` : ''}
    </div>
    <div class="meta-col">
      ${metaRows.map((m) => `<div><span class="label">${m.label}:</span> <span class="value">${escapeHtml(m.value)}</span></div>`).join('')}
    </div>
  </div>

  <table>
    <thead><tr><th>Description</th><th class="num">Quantity</th><th class="num">Unit Price</th><th class="num">Tax</th><th class="num">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals-wrap">
    <div class="totals">
      <div class="row"><span>Untaxed Amount</span><span>${formatCurrency(data.subtotal)}</span></div>
      <div class="row"><span>${vatLabel}</span><span>${formatCurrency(data.taxAmount)}</span></div>
      <div class="row grand"><span>Total</span><span>${formatCurrency(data.total)}</span></div>
    </div>
  </div>

  ${data.notes ? `<div class="notes">${escapeHtml(data.notes)}</div>` : ''}

  <div class="footer">
    ${data.paymentInstructions ? `<div>${escapeHtml(data.paymentInstructions)}</div>` : ''}
    <div>${escapeHtml(data.companyName)} — Thank you for your business.</div>
  </div>

  ${printScript}
</body>
</html>`;
};

// ─── MINIMAL: clean lines, generous whitespace ─────────────────────
const buildMinimalInvoiceHtml = (data: InvoiceDocumentData): string => {
  const { vatLabel, metaRows } = prepare(data);

  const rows = data.items
    .map(
      (item) => `<tr>
        <td>${escapeHtml(item.name)}</td>
        <td class="num">${item.quantity}</td>
        <td class="num">${formatCurrency(item.unitPrice)}</td>
        <td class="num">${item.taxRate}%</td>
        <td class="num">${formatCurrency(item.amount)}</td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice ${data.invoiceNo}</title>
  <style>
    @page { size: A4; margin: 20mm; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #2b2b2b; font-size: 12.5px; min-height: 257mm; display: flex; flex-direction: column; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 36px; }
    .header img { max-height: 42px; max-width: 180px; object-fit: contain; }
    .company-name-fallback { font-size: 16px; font-weight: 600; }
    .company-block { text-align: right; font-size: 11.5px; color: #8a8a8a; line-height: 1.6; }
    h1 { font-size: 22px; font-weight: 300; margin: 0 0 4px; letter-spacing: 0.01em; }
    .invoice-sub { font-size: 12px; color: #8a8a8a; margin-bottom: 28px; }
    .row-split { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #aaa; margin-bottom: 4px; }
    .value { font-size: 13px; }
    .meta-col { text-align: right; }
    .meta-col .meta-item { margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    thead th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #aaa; font-weight: 400; padding: 0 0 10px; border-bottom: 1px solid #e5e5e5; }
    thead th.num { text-align: right; }
    tbody td { padding: 10px 0; font-size: 12.5px; border-bottom: 1px solid #f2f2f2; }
    td.num { text-align: right; }
    .totals-wrap { display: flex; justify-content: flex-end; }
    .totals { width: 260px; }
    .totals .row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 12.5px; color: #6b6b6b; }
    .totals .row.grand { border-top: 1px solid #2b2b2b; margin-top: 6px; padding-top: 10px; font-size: 15px; font-weight: 600; color: #2b2b2b; }
    .notes { margin-top: 24px; font-size: 11.5px; color: #8a8a8a; }
    .footer { margin-top: auto; padding-top: 24px; font-size: 10.5px; color: #aaa; }
    .footer div { margin-bottom: 4px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      ${data.companyLogo ? `<img src="${data.companyLogo}" alt="${escapeHtml(data.companyName)}" />` : `<div class="company-name-fallback">${escapeHtml(data.companyName)}</div>`}
    </div>
    <div class="company-block">
      ${data.companyAddress ? `<div>${escapeHtml(data.companyAddress)}</div>` : ''}
      ${data.companyPhone ? `<div>${escapeHtml(data.companyPhone)}</div>` : ''}
      ${data.companyPin ? `<div>Tax PIN ${escapeHtml(data.companyPin)}</div>` : ''}
    </div>
  </div>

  <h1>Invoice</h1>
  <div class="invoice-sub">${data.invoiceNo} &nbsp;·&nbsp; ${escapeHtml(data.status)}</div>

  <div class="row-split">
    <div>
      <div class="label">Billed To</div>
      <div class="value">${escapeHtml(data.customerName)}</div>
      ${data.customerAddress ? `<div class="value" style="color:#8a8a8a;font-size:11.5px;margin-top:2px">${escapeHtml(data.customerAddress)}</div>` : ''}
    </div>
    <div class="meta-col">
      ${metaRows.map((m) => `<div class="meta-item"><div class="label">${m.label}</div><div class="value">${escapeHtml(m.value)}</div></div>`).join('')}
    </div>
  </div>

  <table>
    <thead><tr><th>Description</th><th class="num">Quantity</th><th class="num">Unit Price</th><th class="num">Tax</th><th class="num">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals-wrap">
    <div class="totals">
      <div class="row"><span>Untaxed Amount</span><span>${formatCurrency(data.subtotal)}</span></div>
      <div class="row"><span>${vatLabel}</span><span>${formatCurrency(data.taxAmount)}</span></div>
      <div class="row grand"><span>Total</span><span>${formatCurrency(data.total)}</span></div>
    </div>
  </div>

  ${data.notes ? `<div class="notes">${escapeHtml(data.notes)}</div>` : ''}

  <div class="footer">
    ${data.paymentInstructions ? `<div>${escapeHtml(data.paymentInstructions)}</div>` : ''}
    <div>Thank you for your business.</div>
  </div>

  ${printScript}
</body>
</html>`;
};

// Full-page A4 invoice document — distinct from the small thermal-style
// receipt printed at checkout (utils/receiptHtml.ts). Used for "particulars"
// screens (POS Orders detail, Sales tab detail) — matches the web app's
// Sales > Invoice detail page's Print button pixel-for-pixel, in whichever
// of the three layouts is selected (Settings > Companies > Invoice Document
// Design).
export const buildInvoiceDocumentHtml = (
  data: InvoiceDocumentData,
  template: InvoiceTemplate = 'modern',
): string => {
  if (template === 'classic') return buildClassicInvoiceHtml(data);
  if (template === 'minimal') return buildMinimalInvoiceHtml(data);
  return buildModernInvoiceHtml(data);
};
