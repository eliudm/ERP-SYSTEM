import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { salesApi } from '../api/sales.api';
import { creditNotesApi } from '../api/credit-notes.api';
import { customersApi } from '../api/customers.api';
import { settingsApi } from '../api/settings.api';
import { useSession } from '../providers/SessionProvider';
import { buildReceiptHtml } from '../utils/receiptHtml';
import { printReceiptHtml, saveReceiptPdf } from '../utils/printReceipt';
import type { RefundState } from '../components/pos/OrderDetail';

const WALK_IN_CUSTOMER_NAME = 'Walk-in Customer';

const resolveWalkInCustomer = async () => {
  const matches = await customersApi.getCustomers(WALK_IN_CUSTOMER_NAME);
  const existing = matches.find((c) => c.name === WALK_IN_CUSTOMER_NAME);
  if (existing) return existing;
  return customersApi.createCustomer({ name: WALK_IN_CUSTOMER_NAME });
};

// Shared behaviour behind "tap an order, see particulars, refund, print" —
// used from both the POS Orders tab and the Sales tab, which are separate
// screens but operate on the exact same invoice/credit-note data.
export const useOrderDetailActions = (
  invoiceId: string | null,
  onError: (message: string) => void,
) => {
  const queryClient = useQueryClient();
  const { user } = useSession();

  const { data: settings } = useQuery({
    queryKey: ['system-settings'],
    queryFn: () => settingsApi.getSystemSettings(),
  });

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => salesApi.getInvoice(invoiceId!),
    enabled: !!invoiceId,
  });

  const [refundState, setRefundState] = useState<RefundState>('idle');
  const [refundApproved, setRefundApproved] = useState<boolean | null>(null);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [savingPdf, setSavingPdf] = useState(false);

  useEffect(() => {
    setRefundState('idle');
    setRefundApproved(null);
    setRefundError(null);
  }, [invoiceId]);

  const buildHtml = () => {
    if (!invoice) return null;
    return buildReceiptHtml({
      invoiceNo: invoice.invoiceNo,
      createdAt: invoice.invoiceDate,
      customerName: invoice.customer?.name ?? WALK_IN_CUSTOMER_NAME,
      paymentMethod: invoice.paymentMethod,
      subtotal: Number(invoice.subtotal),
      taxTotal: Number(invoice.taxAmount),
      total: Number(invoice.total),
      items: invoice.items.map((item) => ({
        name: item.product.name,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
      })),
      businessName: settings?.companyName,
      businessAddress: settings?.companyAddress,
      businessPin: settings?.companyPin,
      qrCode: invoice.etimsInvoice?.qrCode ?? null,
      reprint: true,
    });
  };

  const print = async () => {
    const html = buildHtml();
    if (!html) return;
    setPrinting(true);
    try {
      await printReceiptHtml(html);
    } catch {
      onError('Could not open print dialog.');
    } finally {
      setPrinting(false);
    }
  };

  const savePdf = async () => {
    const html = buildHtml();
    if (!html) return;
    setSavingPdf(true);
    try {
      await saveReceiptPdf(html);
    } catch {
      onError('Could not generate the PDF receipt.');
    } finally {
      setSavingPdf(false);
    }
  };

  const requestRefund = () => {
    setRefundError(null);
    setRefundState('confirming');
  };

  const cancelRefund = () => setRefundState('idle');

  const confirmRefund = async () => {
    if (!invoice) return;
    setRefundState('submitting');
    setRefundError(null);
    try {
      const creditNote = await creditNotesApi.create({
        customerId: invoice.customer?.id ?? (await resolveWalkInCustomer()).id,
        invoiceId: invoice.id,
        reason: 'POS refund',
        items: invoice.items.map((item) => ({
          productId: item.productId,
          description: item.description ?? undefined,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          taxRate: Number(item.taxRate),
        })),
      });

      const canApprove = user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT';
      if (canApprove) {
        await creditNotesApi.approve(creditNote.id);
      }
      setRefundApproved(canApprove);
      setRefundState('done');
      void queryClient.invalidateQueries({ queryKey: ['invoice', invoice.id] });
      void queryClient.invalidateQueries({ queryKey: ['recent-invoices'] });
    } catch (err: any) {
      setRefundState('confirming');
      const message =
        err?.response?.data?.message ?? 'Failed to submit refund.';
      setRefundError(Array.isArray(message) ? message.join(', ') : message);
    }
  };

  return {
    invoice: invoice ?? null,
    isLoading,
    currentUserRole: user?.role ?? '',
    printing,
    savingPdf,
    refundState,
    refundApproved,
    refundError,
    print,
    savePdf,
    requestRefund,
    cancelRefund,
    confirmRefund,
  };
};
