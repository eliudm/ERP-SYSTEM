import React from 'react';
import { View, StyleSheet, ScrollView, Image } from 'react-native';
import {
  Text,
  Button,
  IconButton,
  Chip,
  Divider,
  ActivityIndicator,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { InvoiceDetail } from '../../api/sales.api';
import { brand } from '../../theme';

const formatCurrency = (value: number) =>
  `KES ${value.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (v: number | string) => (typeof v === 'string' ? parseFloat(v) : v);

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  MOBILE_MONEY: 'M-Pesa',
  BANK_TRANSFER: 'Bank Transfer',
  CREDIT: 'Credit',
};

const STATUS_STYLES: Record<string, { bg: string; fg: string }> = {
  DRAFT: { bg: '#f0eef7', fg: brand.textMuted },
  APPROVED: { bg: '#d6e8fb', fg: '#1a5fb4' },
  SENT: { bg: '#d6e8fb', fg: '#1a5fb4' },
  PAID: { bg: '#d6f3ee', fg: brand.gradientEnd },
  VOID: { bg: '#fde3dc', fg: '#d4380d' },
};

export type RefundState = 'idle' | 'confirming' | 'submitting' | 'done';

interface OrderDetailProps {
  invoice: InvoiceDetail | null;
  isLoading: boolean;
  currentUserRole: string;
  onBack: () => void;
  onPrint: () => void;
  printing: boolean;
  refundState: RefundState;
  refundApproved: boolean | null;
  refundError: string | null;
  onRequestRefund: () => void;
  onCancelRefund: () => void;
  onConfirmRefund: () => void;
}

const canApproveRefunds = (role: string) =>
  role === 'ADMIN' || role === 'ACCOUNTANT';

export const OrderDetail: React.FC<OrderDetailProps> = ({
  invoice,
  isLoading,
  currentUserRole,
  onBack,
  onPrint,
  printing,
  refundState,
  refundApproved,
  refundError,
  onRequestRefund,
  onCancelRefund,
  onConfirmRefund,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <IconButton icon="chevron-left" onPress={onBack} />
        <Text style={styles.headerTitle}>
          {invoice ? invoice.invoiceNo : 'Order'}
        </Text>
      </View>

      {isLoading || !invoice ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={brand.gradientEnd} />
        </View>
      ) : (
        <OrderDetailBody
          invoice={invoice}
          currentUserRole={currentUserRole}
          onPrint={onPrint}
          printing={printing}
          refundState={refundState}
          refundApproved={refundApproved}
          refundError={refundError}
          onRequestRefund={onRequestRefund}
          onCancelRefund={onCancelRefund}
          onConfirmRefund={onConfirmRefund}
        />
      )}
    </View>
  );
};

const OrderDetailBody: React.FC<
  Omit<OrderDetailProps, 'isLoading' | 'onBack' | 'invoice'> & {
    invoice: InvoiceDetail;
  }
> = ({
  invoice,
  currentUserRole,
  onPrint,
  printing,
  refundState,
  refundApproved,
  refundError,
  onRequestRefund,
  onCancelRefund,
  onConfirmRefund,
}) => {
  const statusStyle = STATUS_STYLES[invoice.status] ?? STATUS_STYLES.DRAFT;
  const existingCreditNote = invoice.creditNotes[0];
  const alreadyRefunded =
    existingCreditNote &&
    (existingCreditNote.status === 'APPROVED' ||
      existingCreditNote.status === 'APPLIED');
  const refundPending = existingCreditNote?.status === 'DRAFT';
  const canRefund =
    invoice.status !== 'VOID' && !alreadyRefunded && !refundPending;

  return (
    <>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.metaRow}>
          <Chip
            style={{ backgroundColor: statusStyle.bg }}
            textStyle={{ color: statusStyle.fg, fontSize: 11 }}
            compact
          >
            {invoice.status}
          </Chip>
          <Text style={styles.metaDate}>
            {new Date(invoice.invoiceDate).toLocaleString()}
          </Text>
        </View>

        <Text style={styles.customerName}>
          {invoice.customer?.name ?? 'Walk-in Customer'}
        </Text>
        <Text style={styles.paymentLine}>
          Paid via{' '}
          {invoice.paymentMethod
            ? (PAYMENT_METHOD_LABELS[invoice.paymentMethod] ??
              invoice.paymentMethod)
            : '—'}
        </Text>

        <Divider style={styles.divider} />

        {invoice.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.product.name}</Text>
              <Text style={styles.itemMeta}>
                {num(item.quantity)} x {formatCurrency(num(item.unitPrice))}
              </Text>
            </View>
            <Text style={styles.itemTotal}>
              {formatCurrency(num(item.lineTotal))}
            </Text>
          </View>
        ))}

        <Divider style={styles.divider} />

        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Subtotal</Text>
          <Text style={styles.totalsValue}>
            {formatCurrency(num(invoice.subtotal))}
          </Text>
        </View>
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>VAT</Text>
          <Text style={styles.totalsValue}>
            {formatCurrency(num(invoice.taxAmount))}
          </Text>
        </View>
        <View style={styles.grandTotalRow}>
          <Text style={styles.grandTotalLabel}>Total</Text>
          <Text style={styles.grandTotalValue}>
            {formatCurrency(num(invoice.total))}
          </Text>
        </View>

        {invoice.etimsInvoice?.qrCode && (
          <View style={styles.qrSection}>
            <Image
              source={{ uri: invoice.etimsInvoice.qrCode }}
              style={styles.qrImage}
            />
            <Text style={styles.qrLabel}>
              {invoice.etimsInvoice.etimsInvoiceNo
                ? `eTIMS: ${invoice.etimsInvoice.etimsInvoiceNo}`
                : 'eTIMS QR Code'}
            </Text>
          </View>
        )}

        {alreadyRefunded && (
          <View style={styles.refundBanner}>
            <MaterialCommunityIcons
              name="cash-refund"
              size={16}
              color="#ad7a14"
            />
            <Text style={styles.refundBannerText}>
              Refunded via credit note {existingCreditNote.creditNoteNumber}
            </Text>
          </View>
        )}
        {refundPending && (
          <View style={styles.refundBanner}>
            <MaterialCommunityIcons
              name="clock-outline"
              size={16}
              color="#ad7a14"
            />
            <Text style={styles.refundBannerText}>
              Refund {existingCreditNote.creditNoteNumber} pending manager
              approval
            </Text>
          </View>
        )}

        {(refundState === 'confirming' || refundState === 'submitting') && (
          <View style={styles.confirmPanel}>
            <Text style={styles.confirmTitle}>Refund this order?</Text>
            <Text style={styles.confirmText}>
              This creates a credit note for the full order (
              {formatCurrency(num(invoice.total))})
              {canApproveRefunds(currentUserRole)
                ? ' and restores stock immediately.'
                : ', which a manager must approve before stock is restored.'}
            </Text>
            {refundError && (
              <Text style={styles.confirmError}>{refundError}</Text>
            )}
            <View style={styles.confirmActions}>
              <Button
                mode="outlined"
                style={styles.confirmActionButton}
                onPress={onCancelRefund}
                disabled={refundState === 'submitting'}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                style={[styles.confirmActionButton, styles.refundConfirmButton]}
                onPress={onConfirmRefund}
                loading={refundState === 'submitting'}
                disabled={refundState === 'submitting'}
              >
                Confirm Refund
              </Button>
            </View>
          </View>
        )}

        {refundState === 'done' && (
          <View style={styles.refundBanner}>
            <MaterialCommunityIcons
              name="check-circle-outline"
              size={16}
              color={brand.gradientEnd}
            />
            <Text
              style={[styles.refundBannerText, { color: brand.gradientEnd }]}
            >
              {refundApproved
                ? 'Refund approved — stock restored.'
                : 'Refund submitted — pending manager approval.'}
            </Text>
          </View>
        )}
      </ScrollView>

      {refundState !== 'confirming' && refundState !== 'submitting' && (
        <View style={styles.footer}>
          <Button
            mode="outlined"
            icon="printer-outline"
            style={styles.footerButton}
            onPress={onPrint}
            loading={printing}
            disabled={printing}
          >
            Reprint
          </Button>
          {canRefund && refundState === 'idle' && (
            <Button
              mode="contained"
              icon="cash-refund"
              style={[styles.footerButton, styles.refundButton]}
              onPress={onRequestRefund}
            >
              Refund
            </Button>
          )}
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0eef7',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: brand.textDark,
  },
  content: {
    padding: 20,
    paddingBottom: 24,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metaDate: {
    fontSize: 12,
    color: brand.textMuted,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '700',
    color: brand.textDark,
  },
  paymentLine: {
    fontSize: 12.5,
    color: brand.textMuted,
    marginTop: 2,
  },
  divider: {
    marginVertical: 14,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  itemInfo: {
    flex: 1,
    marginRight: 8,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: brand.textDark,
  },
  itemMeta: {
    fontSize: 12,
    color: brand.textMuted,
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: brand.textDark,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  totalsLabel: {
    fontSize: 13,
    color: brand.textMuted,
  },
  totalsValue: {
    fontSize: 13,
    color: brand.textDark,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginTop: 4,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: brand.textDark,
  },
  grandTotalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: brand.textDark,
  },
  grandTotalValue: {
    fontSize: 15,
    fontWeight: '700',
    color: brand.textDark,
  },
  qrSection: {
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#ece8f5',
    borderStyle: 'dashed',
  },
  qrImage: {
    width: 110,
    height: 110,
  },
  qrLabel: {
    fontSize: 11.5,
    color: brand.textMuted,
    marginTop: 6,
  },
  refundBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#fbf1de',
  },
  refundBannerText: {
    flex: 1,
    fontSize: 12.5,
    color: '#ad7a14',
    fontWeight: '600',
  },
  confirmPanel: {
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#f8f5ef',
  },
  confirmTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: brand.textDark,
    marginBottom: 4,
  },
  confirmText: {
    fontSize: 12.5,
    color: brand.textMuted,
  },
  confirmError: {
    fontSize: 12.5,
    color: '#d4380d',
    fontWeight: '600',
    marginTop: 8,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  confirmActionButton: {
    flex: 1,
  },
  refundConfirmButton: {
    backgroundColor: '#d4380d',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0eef7',
  },
  footerButton: {
    flex: 1,
    borderRadius: 12,
  },
  refundButton: {
    backgroundColor: '#d4380d',
  },
});
