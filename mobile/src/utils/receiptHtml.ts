import type { ReceiptTemplate } from '../api/settings.api';

const formatCurrency = (value: number) =>
  `KES ${value.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

export interface ReceiptHtmlItem {
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface ReceiptHtmlData {
  invoiceNo: string;
  createdAt: string;
  customerName: string;
  paymentMethod?: string | null;
  subtotal: number;
  taxTotal: number;
  total: number;
  items: ReceiptHtmlItem[];
  businessName?: string;
  businessLogo?: string | null;
  businessAddress?: string | null;
  businessPin?: string | null;
  businessSlogan?: string | null;
  showBranding?: boolean;
  qrCode?: string | null;
  reprint?: boolean;
  // Sold while offline, not yet synced to a real tax invoice — no eTIMS QR
  // exists yet. Must be unmistakable on a printed/PDF copy so it's never
  // confused with a final KRA-validated receipt.
  pendingSync?: boolean;
}

const PENDING_SYNC_NOTE =
  'Sale saved offline — will sync automatically once back online. A tax receipt number will be assigned then.';

const paymentLabelOf = (data: ReceiptHtmlData): string =>
  data.paymentMethod
    ? (PAYMENT_METHOD_LABELS[data.paymentMethod] ?? data.paymentMethod)
    : '—';

const printScript = `<script>window.onload = function () { window.print(); };</script>`;

// ─── STANDARD: the familiar till-receipt layout ────────────────────
const buildStandardReceiptHtml = (data: ReceiptHtmlData): string => {
  const rows = data.items
    .map(
      (item) => `<tr>
        <td style="padding:3px 0">${escapeHtml(item.name)}</td>
        <td style="text-align:right">${item.quantity}</td>
        <td style="text-align:right">${formatCurrency(item.unitPrice * item.quantity)}</td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt ${data.invoiceNo}</title>
  <style>
    @page { size: 80mm auto; margin: 4mm; }
    body { font-family: Arial, sans-serif; width: 72mm; margin: 0 auto; font-size: 12px; color: #15101f; }
    h3 { margin: 0 0 4px 0; text-align: center; }
    .muted { text-align: center; color: #555; margin-bottom: 6px; }
    hr { border: none; border-top: 1px dashed #999; margin: 8px 0; }
    table { width: 100%; border-collapse: collapse; }
    th { border-bottom: 1px solid #ddd; padding: 4px 0; text-align: left; }
    .row { display: flex; justify-content: space-between; padding: 2px 0; }
    .grand { font-weight: 700; font-size: 14px; border-top: 1px dashed #999; padding-top: 6px; margin-top: 6px; }
    .qr { text-align: center; margin-top: 12px; }
    .qr img { width: 100px; height: 100px; }
  </style>
</head>
<body>
  ${data.businessLogo ? `<div style="text-align:center"><img src="${data.businessLogo}" style="max-height:70px;max-width:180px;object-fit:contain" /></div>` : `<h3>${escapeHtml(data.businessName ?? 'Nexora ERP')}</h3>`}
  ${data.showBranding !== false && data.businessAddress ? `<div class="muted">${escapeHtml(data.businessAddress)}</div>` : ''}
  ${data.showBranding !== false && data.businessPin ? `<div class="muted">PIN: ${escapeHtml(data.businessPin)}</div>` : ''}
  ${data.reprint ? '<h3 style="margin-top:6px">REPRINT</h3>' : ''}
  <hr/>
  <div>Invoice: ${data.invoiceNo}</div>
  <div>${new Date(data.createdAt).toLocaleString()}</div>
  <div>Customer: ${escapeHtml(data.customerName)}</div>
  <div>Payment: ${paymentLabelOf(data)}</div>
  <hr/>
  <table>
    <thead><tr><th>Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <hr/>
  <div class="row"><span>Subtotal</span><span>${formatCurrency(data.subtotal)}</span></div>
  <div class="row"><span>VAT</span><span>${formatCurrency(data.taxTotal)}</span></div>
  <div class="row grand"><span>Total</span><span>${formatCurrency(data.total)}</span></div>
  ${
    data.pendingSync
      ? `<div class="qr" style="border:1px dashed #ad7a14;border-radius:8px;padding:8px;color:#ad7a14;font-weight:700">${PENDING_SYNC_NOTE}</div>`
      : data.qrCode
        ? `<div class="qr"><img src="${data.qrCode}" /><div class="muted">eTIMS QR Code</div></div>`
        : ''
  }
  ${data.businessSlogan ? `<div class="muted" style="margin-top:10px;padding-top:8px;border-top:1px dashed #eee">${escapeHtml(data.businessSlogan)}</div>` : ''}
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
        <td style="text-align:right;padding:2px 0;white-space:nowrap">${formatCurrency(item.unitPrice * item.quantity)}</td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt ${data.invoiceNo}</title>
  <style>
    @page { size: 80mm auto; margin: 3mm; }
    body { font-family: Arial, sans-serif; width: 74mm; margin: 0 auto; font-size: 11px; color: #15101f; line-height: 1.35; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    .row { display: flex; justify-content: space-between; margin: 1px 0; }
    .grand { font-weight: 700; font-size: 12.5px; border-top: 1px solid #111; padding-top: 3px; margin-top: 3px; }
  </style>
</head>
<body>
  <div style="text-align:center;font-weight:700;font-size:13px">${escapeHtml(data.businessName ?? 'Nexora ERP')}</div>
  ${data.businessPin ? `<div style="text-align:center;font-size:10px">PIN: ${escapeHtml(data.businessPin)}</div>` : ''}
  <div style="text-align:center;font-size:10px;margin:3px 0">${data.reprint ? 'REPRINT &middot; ' : ''}${data.invoiceNo} &middot; ${new Date(data.createdAt).toLocaleString()}</div>
  <div style="border-top:1px dashed #999;margin:3px 0"></div>
  <table><tbody>${rows}</tbody></table>
  <div style="border-top:1px dashed #999;margin:3px 0"></div>
  <div class="row"><span>Subtotal</span><span>${formatCurrency(data.subtotal)}</span></div>
  <div class="row"><span>VAT</span><span>${formatCurrency(data.taxTotal)}</span></div>
  <div class="row grand"><span>TOTAL</span><span>${formatCurrency(data.total)}</span></div>
  <div class="row"><span>${paymentLabelOf(data)}</span><span></span></div>
  ${
    data.pendingSync
      ? `<div style="text-align:center;margin-top:6px;border:1px dashed #ad7a14;border-radius:6px;padding:4px;color:#ad7a14;font-weight:700;font-size:10px">${PENDING_SYNC_NOTE}</div>`
      : data.qrCode
        ? `<div style="text-align:center;margin-top:6px"><img src="${data.qrCode}" style="width:80px;height:80px" /></div>`
        : ''
  }
  ${printScript}
</body>
</html>`;
};

// ─── BRANDED: leans into logo, slogan, a boxed total ────────────────
const buildBrandedReceiptHtml = (data: ReceiptHtmlData): string => {
  const rows = data.items
    .map(
      (item) => `<tr>
        <td style="padding:5px 0;vertical-align:top">
          <div style="font-weight:600">${escapeHtml(item.name)}</div>
          <div style="font-size:10px;color:#888">${item.quantity} x ${formatCurrency(item.unitPrice)}</div>
        </td>
        <td style="text-align:right;padding:5px 0;vertical-align:top;white-space:nowrap;font-weight:600">${formatCurrency(item.unitPrice * item.quantity)}</td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt ${data.invoiceNo}</title>
  <style>
    @page { size: 80mm auto; margin: 4mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; width: 72mm; margin: 0 auto; color: #15101f; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; }
    .grand { background:#6f67ff; color:#fff; font-weight:700; font-size:14px; padding:8px 10px; border-radius:6px; margin:8px 0; display:flex; justify-content:space-between; }
    .row { display: flex; justify-content: space-between; margin: 3px 0; }
  </style>
</head>
<body>
  <div style="text-align:center;margin-bottom:6px">
    ${data.businessLogo ? `<img src="${data.businessLogo}" style="max-height:90px;max-width:220px;object-fit:contain" />` : `<div style="font-size:19px;font-weight:800">${escapeHtml(data.businessName ?? 'Nexora ERP')}</div>`}
  </div>
  ${data.businessSlogan ? `<div style="text-align:center;background:#f0eef7;border-radius:8px;padding:6px 8px;font-size:11px;font-style:italic;margin-bottom:8px">${escapeHtml(data.businessSlogan)}</div>` : ''}
  ${
    data.businessAddress || data.businessPin
      ? `<div style="text-align:center;font-size:10.5px;color:#6b6485;margin-bottom:8px">${[
          data.businessAddress,
          data.businessPin ? `PIN: ${data.businessPin}` : null,
        ]
          .filter(Boolean)
          .map((s) => escapeHtml(s as string))
          .join(' &middot; ')}</div>`
      : ''
  }

  <div style="text-align:center;font-size:11px;border-top:1px dashed #d8d4e8;border-bottom:1px dashed #d8d4e8;padding:6px 0;margin-bottom:8px">
    ${data.reprint ? '<div style="font-weight:700">REPRINT</div>' : ''}
    <div>${data.invoiceNo} &middot; ${new Date(data.createdAt).toLocaleString()}</div>
    <div>Customer: ${escapeHtml(data.customerName)}</div>
  </div>

  <table><tbody>${rows}</tbody></table>

  <div style="border-top:1px dashed #d8d4e8;margin-top:6px;padding-top:6px">
    <div class="row"><span>Subtotal</span><span>${formatCurrency(data.subtotal)}</span></div>
    <div class="row"><span>VAT</span><span>${formatCurrency(data.taxTotal)}</span></div>
  </div>
  <div class="grand"><span>Total</span><span>${formatCurrency(data.total)}</span></div>
  <div class="row"><span>Paid via</span><span>${paymentLabelOf(data)}</span></div>

  ${
    data.pendingSync
      ? `<div style="text-align:center;margin-top:10px;padding:10px;border:1px dashed #ad7a14;border-radius:10px;color:#ad7a14;font-weight:700;font-size:11px">${PENDING_SYNC_NOTE}</div>`
      : data.qrCode
        ? `<div style="text-align:center;margin-top:10px;padding:10px;border:1px solid #d8d4e8;border-radius:10px"><img src="${data.qrCode}" style="width:110px;height:110px" /><div style="font-size:10.5px;margin-top:4px">eTIMS QR Code</div></div>`
        : ''
  }

  <div style="text-align:center;margin-top:10px;font-size:10px;color:#aaa">Thank you for shopping with ${escapeHtml(data.businessName ?? 'us')}!</div>
  ${printScript}
</body>
</html>`;
};

// 80mm-thermal-style layout — matches the web POS's printable receipt
// (frontend/src/utils/receiptHtml.ts) so a receipt looks the same whether
// printed from a till or a phone, in whichever design is selected in
// Settings > Companies > Receipt Design.
export const buildReceiptHtml = (
  data: ReceiptHtmlData,
  template: ReceiptTemplate = 'standard',
): string => {
  if (template === 'compact') return buildCompactReceiptHtml(data);
  if (template === 'branded') return buildBrandedReceiptHtml(data);
  return buildStandardReceiptHtml(data);
};
