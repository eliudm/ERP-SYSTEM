import { formatCurrency } from './format';
import { PAYMENT_METHOD_LABELS } from '../types';
import type { PaymentMethod, ReceiptTemplate } from '../types';

export interface ReceiptHtmlItem {
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface ReceiptHtmlData {
  receiptNo: string;
  createdAt: string;
  customerName: string;
  customerPin?: string | null;
  servedBy?: string | null;
  paymentMethod?: PaymentMethod | string | null;
  subtotal: number;
  taxAmount: number;
  total: number;
  items: ReceiptHtmlItem[];
  qrCode?: string | null;
  qrProvisional?: boolean;
  qrMessage?: string | null;
  reprint?: boolean;
  businessName: string;
  businessLogo?: string | null;
  businessAddress?: string | null;
  businessPin?: string | null;
  businessSlogan?: string | null;
  showBranding?: boolean;
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  );

const paymentLabelOf = (data: ReceiptHtmlData): string =>
  data.paymentMethod
    ? PAYMENT_METHOD_LABELS[data.paymentMethod as PaymentMethod] ?? data.paymentMethod
    : '—';

const qrLabelOf = (data: ReceiptHtmlData): string =>
  data.qrProvisional ? 'Provisional Receipt QR' : 'eTIMS QR Code';

const printScript = `<script>window.onload=function(){window.print()}</script>`;

// ─── STANDARD: the familiar till-receipt layout ────────────────────
const buildStandardReceiptHtml = (data: ReceiptHtmlData): string => {
  const rows = data.items
    .map(
      (item) => `<tr>
        <td style="padding:4px 0; width:18px; vertical-align:top; font-weight:600;">${item.quantity}</td>
        <td style="padding:4px 0; vertical-align:top;">
          <div>${escapeHtml(item.name)}</div>
          <div style="font-size:10px; color:#888;">${formatCurrency(item.unitPrice)} / Unit</div>
        </td>
        <td style="text-align:right; padding:4px 0; vertical-align:top; white-space:nowrap;">${formatCurrency(item.unitPrice * item.quantity)}</td>
      </tr>`,
    )
    .join('');

  const qrSection = data.qrCode
    ? `<div style="text-align:center; margin-top:10px;"><img src="${data.qrCode}" alt="${qrLabelOf(data)}" style="width:120px; height:120px;" /><div style="font-size:11px; margin-top:4px;">${qrLabelOf(data)}</div>${data.qrMessage ? `<div style="font-size:10px; margin-top:4px; color:#666;">${escapeHtml(data.qrMessage)}</div>` : ''}</div>`
    : `<div style="text-align:center; margin-top:10px; font-size:11px; color:#666;">eTIMS QR code pending</div>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${data.reprint ? 'Reprint' : 'Receipt'} ${data.receiptNo}</title>
  <style>
    @page { size: 80mm auto; margin: 4mm; }
    body { font-family: Arial, sans-serif; width: 72mm; margin: 0 auto; padding: 0; color: #111; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .totals { margin-top: 8px; font-size: 12px; }
    .line { display: flex; justify-content: space-between; margin: 3px 0; }
    .grand { font-weight: 700; font-size: 14px; border-top: 1px solid #111; border-bottom: 1px solid #111; padding: 4px 0; margin: 4px 0; }
  </style>
</head>
<body>
  <div style="text-align:center; margin-bottom:0;">
    ${data.businessLogo ? `<img src="${data.businessLogo}" alt="${escapeHtml(data.businessName)}" style="max-height:80px; max-width:200px; object-fit:contain;" />` : `<div style="font-size:16px; font-weight:700;">${escapeHtml(data.businessName)}</div>`}
    ${data.showBranding !== false ? `
    <div style="font-size:11px; margin-top:4px;">
      ${data.businessLogo ? `<div style="font-weight:700;">${escapeHtml(data.businessName)}</div>` : ''}
      ${data.businessAddress ? `<div>${escapeHtml(data.businessAddress)}</div>` : ''}
      ${data.businessPin ? `<div>PIN: ${escapeHtml(data.businessPin)}</div>` : ''}
    </div>` : ''}
  </div>

  <div style="text-align:center; font-size:11px; border-top:1px dashed #ccc; border-bottom:1px dashed #ccc; padding:6px 0; margin:8px 0;">
    ${data.reprint ? '<div style="font-weight:700;">REPRINT</div>' : ''}
    <div>Receipt: ${data.receiptNo}</div>
    <div>${new Date(data.createdAt).toLocaleString()}</div>
    ${data.servedBy ? `<div>Served by: ${escapeHtml(data.servedBy)}</div>` : ''}
    ${data.customerName && data.customerName !== 'Walk-in Customer' ? `<div>Customer: ${escapeHtml(data.customerName)}</div>` : ''}
    ${data.customerPin && data.customerPin !== 'N/A' ? `<div>PIN: ${escapeHtml(data.customerPin)}</div>` : ''}
  </div>

  <table>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals" style="border-top:1px dashed #999; padding-top:6px;">
    <div class="line"><span>Subtotal</span><span>${formatCurrency(data.subtotal)}</span></div>
    <div class="line"><span>VAT</span><span>${formatCurrency(data.taxAmount)}</span></div>
    <div class="line grand"><span>Total</span><span>${formatCurrency(data.total)}</span></div>
    <div class="line"><span>${paymentLabelOf(data)}</span><span>${formatCurrency(data.total)}</span></div>
  </div>

  ${qrSection}

  ${data.businessSlogan ? `<div style="text-align:center; font-size:11px; margin-top:10px; padding-top:8px; border-top:1px dashed #eee;">${escapeHtml(data.businessSlogan)}</div>` : ''}

  <div style="text-align:center; margin-top:10px; font-size:10px; color:#aaa; border-top:1px dashed #eee; padding-top:6px;">Powered by: Nexora ERP</div>
  ${printScript}
</body>
</html>`;
};

// ─── COMPACT: tighter spacing, fewer frills — saves paper ───────────
const buildCompactReceiptHtml = (data: ReceiptHtmlData): string => {
  const rows = data.items
    .map(
      (item) => `<tr>
        <td style="padding:2px 0">${item.quantity} x ${escapeHtml(item.name)}</td>
        <td style="text-align:right; padding:2px 0; white-space:nowrap;">${formatCurrency(item.unitPrice * item.quantity)}</td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${data.reprint ? 'Reprint' : 'Receipt'} ${data.receiptNo}</title>
  <style>
    @page { size: 80mm auto; margin: 3mm; }
    body { font-family: Arial, sans-serif; width: 74mm; margin: 0 auto; color: #111; font-size: 11px; line-height: 1.35; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    .line { display: flex; justify-content: space-between; margin: 1px 0; }
    .grand { font-weight: 700; font-size: 12.5px; border-top: 1px solid #111; padding-top: 3px; margin-top: 3px; }
  </style>
</head>
<body>
  <div style="text-align:center; font-weight:700; font-size:13px;">${escapeHtml(data.businessName)}</div>
  ${data.businessPin ? `<div style="text-align:center; font-size:10px;">PIN: ${escapeHtml(data.businessPin)}</div>` : ''}
  <div style="text-align:center; font-size:10px; margin:3px 0;">${data.reprint ? 'REPRINT &middot; ' : ''}${data.receiptNo} &middot; ${new Date(data.createdAt).toLocaleString()}</div>
  <div style="border-top:1px dashed #999; margin:3px 0;"></div>
  <table><tbody>${rows}</tbody></table>
  <div style="border-top:1px dashed #999; margin:3px 0;"></div>
  <div class="line"><span>Subtotal</span><span>${formatCurrency(data.subtotal)}</span></div>
  <div class="line"><span>VAT</span><span>${formatCurrency(data.taxAmount)}</span></div>
  <div class="line grand"><span>TOTAL</span><span>${formatCurrency(data.total)}</span></div>
  <div class="line"><span>${paymentLabelOf(data)}</span><span></span></div>
  ${data.qrCode ? `<div style="text-align:center; margin-top:6px;"><img src="${data.qrCode}" style="width:80px; height:80px;" /></div>` : ''}
  ${printScript}
</body>
</html>`;
};

// ─── BRANDED: leans into logo, slogan, a boxed total ────────────────
const buildBrandedReceiptHtml = (data: ReceiptHtmlData): string => {
  const rows = data.items
    .map(
      (item) => `<tr>
        <td style="padding:5px 0; vertical-align:top;">
          <div style="font-weight:600;">${escapeHtml(item.name)}</div>
          <div style="font-size:10px; color:#888;">${item.quantity} x ${formatCurrency(item.unitPrice)}</div>
        </td>
        <td style="text-align:right; padding:5px 0; vertical-align:top; white-space:nowrap; font-weight:600;">${formatCurrency(item.unitPrice * item.quantity)}</td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${data.reprint ? 'Reprint' : 'Receipt'} ${data.receiptNo}</title>
  <style>
    @page { size: 80mm auto; margin: 4mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: Arial, sans-serif; width: 72mm; margin: 0 auto; color: #15101f; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; }
    .grand { background:#1677ff; color:#fff; font-weight:700; font-size:14px; padding:8px 10px; border-radius:6px; margin:8px 0; display:flex; justify-content:space-between; }
    .line { display: flex; justify-content: space-between; margin: 3px 0; }
  </style>
</head>
<body>
  <div style="text-align:center; margin-bottom:6px;">
    ${data.businessLogo ? `<img src="${data.businessLogo}" alt="${escapeHtml(data.businessName)}" style="max-height:90px; max-width:220px; object-fit:contain;" />` : `<div style="font-size:19px; font-weight:800;">${escapeHtml(data.businessName)}</div>`}
  </div>
  ${data.businessSlogan ? `<div style="text-align:center; background:#f0eef7; border-radius:8px; padding:6px 8px; font-size:11px; font-style:italic; margin-bottom:8px;">${escapeHtml(data.businessSlogan)}</div>` : ''}
  ${data.businessAddress || data.businessPin ? `<div style="text-align:center; font-size:10.5px; color:#6b6485; margin-bottom:8px;">${[data.businessAddress, data.businessPin ? `PIN: ${data.businessPin}` : null].filter(Boolean).map((s) => escapeHtml(s as string)).join(' &middot; ')}</div>` : ''}

  <div style="text-align:center; font-size:11px; border-top:1px dashed #d8d4e8; border-bottom:1px dashed #d8d4e8; padding:6px 0; margin-bottom:8px;">
    ${data.reprint ? '<div style="font-weight:700;">REPRINT</div>' : ''}
    <div>${data.receiptNo} &middot; ${new Date(data.createdAt).toLocaleString()}</div>
    ${data.customerName && data.customerName !== 'Walk-in Customer' ? `<div>Customer: ${escapeHtml(data.customerName)}</div>` : ''}
  </div>

  <table><tbody>${rows}</tbody></table>

  <div style="border-top:1px dashed #d8d4e8; margin-top:6px; padding-top:6px;">
    <div class="line"><span>Subtotal</span><span>${formatCurrency(data.subtotal)}</span></div>
    <div class="line"><span>VAT</span><span>${formatCurrency(data.taxAmount)}</span></div>
  </div>
  <div class="grand"><span>Total</span><span>${formatCurrency(data.total)}</span></div>
  <div class="line"><span>Paid via</span><span>${paymentLabelOf(data)}</span></div>

  ${data.qrCode ? `<div style="text-align:center; margin-top:10px; padding:10px; border:1px solid #d8d4e8; border-radius:10px;"><img src="${data.qrCode}" style="width:110px; height:110px;" /><div style="font-size:10.5px; margin-top:4px;">${qrLabelOf(data)}</div></div>` : ''}

  <div style="text-align:center; margin-top:10px; font-size:10px; color:#aaa;">Thank you for shopping with ${escapeHtml(data.businessName)}!</div>
  ${printScript}
</body>
</html>`;
};

// Shared thermal-style receipt builder — used by the live POS checkout print
// and the POS Orders reprint button, so both always render the same chosen
// design (Settings > Companies > Receipt Design).
export const buildReceiptHtml = (
  data: ReceiptHtmlData,
  template: ReceiptTemplate = 'standard',
): string => {
  if (template === 'compact') return buildCompactReceiptHtml(data);
  if (template === 'branded') return buildBrandedReceiptHtml(data);
  return buildStandardReceiptHtml(data);
};

// The printed document itself triggers window.print() on its own load event
// (see printScript above) rather than the opener calling it synchronously —
// that survives async image loads (logo, QR code) that a same-tick
// win.print() right after document.write() could race ahead of.
// Returns false when the popup was blocked, so callers can surface that to
// the user instead of a silent no-op (the live POS checkout flow does).
export const openReceiptPrintWindow = (html: string): boolean => {
  const win = window.open('', '_blank', 'width=360,height=720');
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  return true;
};
