const formatCurrency = (value: number) =>
  `KES ${value.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  MOBILE_MONEY: 'M-Pesa',
  BANK_TRANSFER: 'Bank Transfer',
  CREDIT: 'Credit',
};

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
  businessAddress?: string;
  businessPin?: string;
  qrCode?: string | null;
  reprint?: boolean;
}

// 80mm-thermal-style layout, matching the printable receipt the web POS
// already produces (frontend/src/pages/pos/POSOrdersPage.tsx) — kept
// consistent so a receipt looks the same whether it was printed from a
// till or a phone.
export const buildReceiptHtml = (data: ReceiptHtmlData): string => {
  const rows = data.items
    .map(
      (item) => `<tr>
        <td style="padding:3px 0">${item.name}</td>
        <td style="text-align:right">${item.quantity}</td>
        <td style="text-align:right">${formatCurrency(item.unitPrice * item.quantity)}</td>
      </tr>`,
    )
    .join('');

  const paymentLabel = data.paymentMethod
    ? (PAYMENT_METHOD_LABELS[data.paymentMethod] ?? data.paymentMethod)
    : '—';

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
  <h3>${data.businessName ?? 'Nexora ERP'}</h3>
  ${data.businessAddress ? `<div class="muted">${data.businessAddress}</div>` : ''}
  ${data.businessPin ? `<div class="muted">PIN: ${data.businessPin}</div>` : ''}
  ${data.reprint ? '<h3 style="margin-top:6px">REPRINT</h3>' : ''}
  <hr/>
  <div>Invoice: ${data.invoiceNo}</div>
  <div>${new Date(data.createdAt).toLocaleString()}</div>
  <div>Customer: ${data.customerName}</div>
  <div>Payment: ${paymentLabel}</div>
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
    data.qrCode
      ? `<div class="qr"><img src="${data.qrCode}" /><div class="muted">eTIMS QR Code</div></div>`
      : ''
  }
  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`;
};
