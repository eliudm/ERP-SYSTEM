import React from 'react';
import { View, StyleSheet, FlatList, Pressable } from 'react-native';
import { Text, IconButton, Chip, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
  order.lines.reduce(
    (sum, l) => sum + l.unitPrice * l.quantity * (1 + l.taxRate),
    0,
  );

interface OrdersListProps {
  heldOrders: HeldOrder[];
  recentInvoices: RecentInvoice[];
  offlineSales: OfflineSale[];
  isLoading: boolean;
  onLoadOrder: (order: HeldOrder) => void;
  onDeleteOrder: (id: string) => void;
  onSelectInvoice: (invoiceId: string) => void;
  onRetryOfflineSale: (id: string) => void;
}

type Row =
  | { kind: 'offline'; sale: OfflineSale }
  | { kind: 'held'; order: HeldOrder }
  | { kind: 'invoice'; invoice: RecentInvoice };

const OFFLINE_STATUS_STYLE: Record<
  OfflineSale['status'],
  { bg: string; fg: string; label: string }
> = {
  pending: { bg: '#fbf1de', fg: '#ad7a14', label: 'Queued' },
  syncing: { bg: '#fbf1de', fg: '#ad7a14', label: 'Syncing…' },
  failed: { bg: '#fde3dc', fg: '#d4380d', label: 'Failed · Retry' },
  synced: { bg: '#d6f3ee', fg: brand.gradientEnd, label: 'Synced' }, // never actually rendered — filtered out above
};

export const OrdersList: React.FC<OrdersListProps> = ({
  heldOrders,
  recentInvoices,
  offlineSales,
  isLoading,
  onLoadOrder,
  onDeleteOrder,
  onSelectInvoice,
  onRetryOfflineSale,
}) => {
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
          <Text style={styles.emptyText}>No orders yet today.</Text>
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
                  {sale.customerName} · {sale.lines.length} item
                  {sale.lines.length === 1 ? '' : 's'}
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
                  {order.customerName ?? 'Walk-in Customer'} ·{' '}
                  {order.lines.length} item{order.lines.length === 1 ? '' : 's'}
                </Text>
              </View>
              <Text style={styles.rowTotal}>
                {formatCurrency(heldOrderTotal(order))}
              </Text>
              <Chip style={styles.statusHeld} textStyle={styles.statusHeldText}>
                Parked
              </Chip>
              <Button mode="text" compact onPress={() => onLoadOrder(order)}>
                Load
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
                {invoice.customer?.name ?? 'Walk-in Customer'}
              </Text>
            </View>
            <Text style={styles.rowTotal}>{formatCurrency(invoice.total)}</Text>
            <Chip style={styles.statusDone} textStyle={styles.statusDoneText}>
              {invoice.status}
            </Chip>
            <MaterialCommunityIcons
              name="chevron-right"
              size={18}
              color={brand.textMuted}
            />
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
  rowTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: brand.textDark,
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
});
