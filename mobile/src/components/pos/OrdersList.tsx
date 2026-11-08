import React from 'react';
import { View, StyleSheet, FlatList, Pressable } from 'react-native';
import { Text, IconButton, Chip, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { HeldOrder } from '../../hooks/useHeldOrders';
import { OfflineSale } from '../../hooks/useOfflineSales';
import { RecentInvoice } from '../../api/mobile.api';
import { brand } from '../../theme';

const formatCurrency = (value: number) =>
  `KES ${value.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-KE', {
    hour: '2-digit',
    minute: '2-digit',
  });

const heldOrderTotal = (order: HeldOrder) =>
  order.lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

interface OrdersListProps {
  heldOrders: HeldOrder[];
  recentInvoices: RecentInvoice[];
  offlineSales: OfflineSale[];
  isLoading: boolean;
  outstandingCreditMap?: Map<string, { amountPaid: number; balance: number }>;
  onLoadOrder: (order: HeldOrder) => void;
  onDeleteOrder: (id: string) => void;
  onSelectInvoice: (invoiceId: string) => void;
  onRetryOfflineSale: (id: string) => void;
  onRecordCreditPayment?: (invoice: RecentInvoice) => void;
}

type Row =
  | { kind: 'offline'; sale: OfflineSale }
  | { kind: 'held'; order: HeldOrder }
  | { kind: 'invoice'; invoice: RecentInvoice };

const getOfflineStatusStyle = (
  t: (key: string) => string,
): Record<
  OfflineSale['status'],
  { bg: string; fg: string; label: string }
> => ({
  pending: { bg: '#fbf1de', fg: '#ad7a14', label: t('offlineStatus.queued') },
  syncing: { bg: '#fbf1de', fg: '#ad7a14', label: t('offlineStatus.syncing') },
  failed: { bg: '#fde3dc', fg: '#d4380d', label: t('offlineStatus.failed') },
  // never actually rendered — synced sales are filtered out above
  synced: {
    bg: '#d6f3ee',
    fg: brand.gradientEnd,
    label: t('offlineStatus.synced'),
  },
});

export const OrdersList: React.FC<OrdersListProps> = ({
  heldOrders,
  recentInvoices,
  offlineSales,
  isLoading,
  outstandingCreditMap,
  onLoadOrder,
  onDeleteOrder,
  onSelectInvoice,
  onRetryOfflineSale,
  onRecordCreditPayment,
}) => {
  const { t } = useTranslation('pos');
  const OFFLINE_STATUS_STYLE = getOfflineStatusStyle(t);
  const today = new Date().toDateString();
  const todaysInvoices = recentInvoices.filter(
    (inv) => new Date(inv.invoiceDate).toDateString() === today,
  );
  // Synced offline sales become indistinguishable from a normal invoice
  // once they have a real invoiceNo — they show up via recentInvoices
  // instead, so drop them here rather than listing the same sale twice.
  const unsettledOfflineSales = offlineSales.filter(
    (s) => s.status !== 'synced',
  );

  const rows: Row[] = [
    ...unsettledOfflineSales.map((sale): Row => ({ kind: 'offline', sale })),
    ...heldOrders.map((order): Row => ({ kind: 'held', order })),
    ...todaysInvoices.map((invoice): Row => ({ kind: 'invoice', invoice })),
  ];

  if (isLoading) {
    return null;
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={rows}
      keyExtractor={(row) =>
        row.kind === 'offline'
          ? row.sale.id
          : row.kind === 'held'
            ? row.order.id
            : row.invoice.id
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{t('noOrdersToday')}</Text>
        </View>
      }
      renderItem={({ item }) => {
        if (item.kind === 'offline') {
          const { sale } = item;
          const style = OFFLINE_STATUS_STYLE[sale.status];
          const isFailed = sale.status === 'failed';
          return (
            <Pressable
              style={styles.row}
              onPress={() => {
                if (isFailed) onRetryOfflineSale(sale.id);
              }}
            >
              <View style={styles.rowInfo}>
                <Text style={styles.rowTime}>{formatTime(sale.createdAt)}</Text>
                <Text style={styles.rowRef}>{sale.reference}</Text>
                <Text style={styles.rowCustomer} numberOfLines={1}>
                  {sale.customerName} ·{' '}
                  {t('itemCount', { count: sale.lines.length })}
                  {isFailed && sale.error ? ` · ${sale.error}` : ''}
                </Text>
              </View>
              <Text style={styles.rowTotal}>{formatCurrency(sale.total)}</Text>
              <Chip
                style={{ backgroundColor: style.bg }}
                textStyle={{ color: style.fg, fontSize: 11 }}
              >
                {style.label}
              </Chip>
            </Pressable>
          );
        }

        if (item.kind === 'held') {
          const { order } = item;
          return (
            <View style={styles.row}>
              <View style={styles.rowInfo}>
                <Text style={styles.rowTime}>
                  {formatTime(order.createdAt)}
                </Text>
                <Text style={styles.rowRef}>{order.reference}</Text>
                <Text style={styles.rowCustomer}>
                  {order.customerName ?? t('common:walkInCustomer')} ·{' '}
                  {t('itemCount', { count: order.lines.length })}
                </Text>
              </View>
              <Text style={styles.rowTotal}>
                {formatCurrency(heldOrderTotal(order))}
              </Text>
              <Chip style={styles.statusHeld} textStyle={styles.statusHeldText}>
                {t('parked')}
              </Chip>
              <Button mode="text" compact onPress={() => onLoadOrder(order)}>
                {t('loadOrder')}
              </Button>
              <IconButton
                icon="trash-can-outline"
                size={18}
                iconColor={brand.gradientStart}
                onPress={() => onDeleteOrder(order.id)}
              />
            </View>
          );
        }

        const { invoice } = item;
        const isCreditPending = invoice.status === 'APPROVED' && invoice.paymentMethod === 'CREDIT';
        const creditInfo = isCreditPending ? outstandingCreditMap?.get(invoice.id) : undefined;
        const displayAmount = creditInfo != null ? (Number(creditInfo.balance) || 0) : Number(invoice.total) || 0;
        return (
          <Pressable
            style={styles.row}
            onPress={() => onSelectInvoice(invoice.id)}
          >
            <View style={styles.rowInfo}>
              <Text style={styles.rowTime}>
                {formatTime(invoice.invoiceDate)}
              </Text>
              <Text style={styles.rowRef}>{invoice.invoiceNo}</Text>
              <Text style={styles.rowCustomer}>
                {invoice.customer?.name ?? t('common:walkInCustomer')}
              </Text>
            </View>
            <View style={styles.rowAmountCol}>
              <Text style={[styles.rowTotal, isCreditPending && creditInfo != null && styles.rowTotalCredit]}>
                {formatCurrency(displayAmount)}
              </Text>
              {isCreditPending && creditInfo != null && (
                <Text style={styles.rowBalanceLabel}>balance</Text>
              )}
            </View>
            <Chip
              style={isCreditPending ? styles.statusCredit : styles.statusDone}
              textStyle={isCreditPending ? styles.statusCreditText : styles.statusDoneText}
            >
              {isCreditPending ? 'CREDIT' : invoice.status}
            </Chip>
            {isCreditPending && onRecordCreditPayment ? (
              <Button
                mode="contained"
                compact
                onPress={() => onRecordCreditPayment(invoice)}
                style={styles.payButton}
                labelStyle={{ fontSize: 12 }}
              >
                Pay
              </Button>
            ) : (
              <MaterialCommunityIcons
                name="chevron-right"
                size={18}
                color={brand.textMuted}
              />
            )}
          </Pressable>
        );
      }}
    />
  );
};

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: '#f8f5ef',
  },
  content: {
    padding: 16,
    gap: 8,
  },
  empty: {
    paddingTop: 64,
    alignItems: 'center',
  },
  emptyText: {
    color: brand.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  rowInfo: {
    flex: 1,
  },
  rowTime: {
    fontSize: 11,
    color: brand.textMuted,
  },
  rowRef: {
    fontSize: 14,
    fontWeight: '700',
    color: brand.textDark,
  },
  rowCustomer: {
    fontSize: 12,
    color: brand.textMuted,
  },
  rowAmountCol: {
    alignItems: 'flex-end',
  },
  rowTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: brand.textDark,
  },
  rowTotalCredit: {
    color: '#d4380d',
  },
  rowBalanceLabel: {
    fontSize: 10,
    color: '#d4380d',
    marginTop: 1,
  },
  statusHeld: {
    backgroundColor: '#fbf1de',
  },
  statusHeldText: {
    color: '#ad7a14',
    fontSize: 11,
  },
  statusDone: {
    backgroundColor: '#d6f3ee',
  },
  statusDoneText: {
    color: brand.gradientEnd,
    fontSize: 11,
  },
  statusCredit: {
    backgroundColor: '#fff1e6',
  },
  statusCreditText: {
    color: '#d4380d',
    fontSize: 11,
  },
  payButton: {
    borderRadius: 8,
    backgroundColor: brand.gradientEnd,
  },
});
