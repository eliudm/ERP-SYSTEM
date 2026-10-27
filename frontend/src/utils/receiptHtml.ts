import dayjs from 'dayjs';
import { formatCurrency } from './format';
import { PAYMENT_METHOD_LABELS } from '../types';
import type { PaymentMethod } from '../types';

export interface ReceiptHtmlItem {
  name: string;
  quantity: number;
  // The row's displayed total — callers decide the convention (tax-inclusive
  // line total vs. plain unit price × quantity); this util only renders it.
  amount: number;
}

export interface ReceiptHtmlData {
  invoiceNo: string;
  invoiceDate: string;
  customerName: string;
  paymentMethod?: PaymentMethod | string | null;
  subtotal: number;
  taxAmount: number;
  total: number;
  items: ReceiptHtmlItem[];
  qrCode?: string | null;
  reprint?: boolean;
}

// Shared 80mm-thermal-style receipt template — used by both the POS Orders
// reprint button and the Sales invoice detail page's Print button, so the
// two never drift into two different-looking receipts.
export const buildReceiptHtml = (data: ReceiptHtmlData): string => {
  const rows = data.items
    .map(
      (item) => `<tr>
        <td style="padding:4px 0">${item.name}</td>
        <td style="text-align:right">${item.quantity}</td>
        <td style="text-align:right">${formatCurrency(item.amount)}</td>
      </tr>`,
    )
    .join('');

  const paymentLabel = data.paymentMethod
    ? PAYMENT_METHOD_LABELS[data.paymentMethod as PaymentMethod] ?? data.paymentMethod
    : '—';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt ${data.invoiceNo}</title>
  <style>
    @page{size:80mm auto;margin:4mm} body{font-family:Arial,sans-serif;width:72mm;margin:0 auto;font-size:12px}
    table{width:100%;border-collapse:collapse} th{border-bottom:1px solid #ddd;padding:4px 0;text-align:left}
    .grand{font-weight:700;font-size:14px;border-top:1px dashed #999;padding-top:6px;margin-top:6px}
    .qr{text-align:center;margin-top:12px} .qr img{width:100px;height:100px}
  </style>
</head>
<body>
  ${data.reprint ? '<h3 style="margin:0 0 6px 0;text-align:center">REPRINT</h3>' : ''}
  <div>Invoice: ${data.invoiceNo}</div>
  <div>Date: ${dayjs(data.invoiceDate).format('DD MMM YYYY HH:mm')}</div>
  <div>Customer: ${data.customerName}</div>
  <div>Payment: ${paymentLabel}</div>
  <hr/>
  <table>
    <thead><tr><th>Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <hr/>
  <div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>${formatCurrency(data.subtotal)}</span></div>
  <div style="display:flex;justify-content:space-between"><span>VAT</span><span>${formatCurrency(data.taxAmount)}</span></div>
  <div class="grand" style="display:flex;justify-content:space-between"><span>Total</span><span>${formatCurrency(data.total)}</span></div>
  ${data.qrCode ? `<div class="qr"><img src="${data.qrCode}" /><div>eTIMS QR Code</div></div>` : ''}
  <script>window.onload=function(){window.print()}</script>
</body>
</html>`;
};

export const openReceiptPrintWindow = (html: string): void => {
  const win = window.open('', '_blank', 'width=360,height=600');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
};
