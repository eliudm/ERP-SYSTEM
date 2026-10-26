import React, { useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import {
  Text,
  Card,
  ActivityIndicator,
  Chip,
  Searchbar,
} from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { mobileApi, RecentInvoice } from '../../api/mobile.api';
import { brand } from '../../theme';

const formatCurrency = (value: number) =>
  `KES ${value.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const formatDate = (value: string) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-KE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const STATUS_STYLES: Record<string, { bg: string; fg: string }> = {
  PAID: { bg: '#d6f3ee', fg: '#0d7a66' },
  APPROVED: { bg: '#e0eaff', fg: '#2452c7' },
  SENT: { bg: '#fff3d6', fg: '#ad7a14' },
  DRAFT: { bg: '#eceaf3', fg: '#6b6485' },
  VOID: { bg: '#fde1dc', fg: '#d4380d' },
};

const StatusChip: React.FC<{ status: string }> = ({ status }) => {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.DRAFT;
  return (
    <Chip
      compact
      style={[styles.statusChip, { backgroundColor: style.bg }]}
      textStyle={[styles.statusChipText, { color: style.fg }]}
    >
      {status}
    </Chip>
  );
};

const InvoiceRow: React.FC<{ invoice: RecentInvoice }> = ({ invoice }) => (
  <Card style={styles.card} mode="contained">
    <Card.Content style={styles.cardContent}>
      <View style={styles.cardLeft}>
        <Text style={styles.invoiceNo}>{invoice.invoiceNo}</Text>
        <Text style={styles.customerName} numberOfLines={1}>
          {invoice.customer?.name ?? 'Walk-in Customer'}
        </Text>
        <Text style={styles.date}>{formatDate(invoice.invoiceDate)}</Text>
      </View>
      <View style={styles.cardRight}>
        <Text style={styles.total}>{formatCurrency(invoice.total)}</Text>
        <StatusChip status={invoice.status} />
      </View>
    </Card.Content>
  </Card>
);

export default function SalesScreen() {
  const [query, setQuery] = useState('');

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['recent-invoices'],
    queryFn: () => mobileApi.getRecentInvoices(30),
  });

  const invoices = data ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter((inv) => {
      const invoiceNo = inv.invoiceNo?.toLowerCase() ?? '';
      const customerName = inv.customer?.name?.toLowerCase() ?? '';
      return invoiceNo.includes(q) || customerName.includes(q);
    });
  }, [invoices, query]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={brand.gradientEnd} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchWrap}>
        <Searchbar
          placeholder="Search invoice # or customer"
          value={query}
          onChangeText={setQuery}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        renderItem={({ item }) => <InvoiceRow invoice={item} />}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              void refetch();
            }}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>
              {invoices.length === 0
                ? 'No invoices yet'
                : 'No matching invoices'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {invoices.length === 0
                ? 'Recent sales invoices will show up here.'
                : 'Try a different invoice number or customer name.'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f5ef',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f5ef',
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: '#f8f5ef',
  },
  searchbar: {
    borderRadius: 14,
    backgroundColor: '#ffffff',
    elevation: 0,
  },
  searchInput: {
    fontSize: 14,
    minHeight: 0,
  },
  content: {
    padding: 16,
    paddingTop: 8,
    gap: 10,
  },
  card: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardLeft: {
    flex: 1,
    gap: 2,
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  invoiceNo: {
    fontSize: 15,
    fontWeight: '700',
    color: brand.textDark,
  },
  customerName: {
    fontSize: 13,
    color: brand.textMuted,
  },
  date: {
    fontSize: 12,
    color: brand.textMuted,
    marginTop: 2,
  },
  total: {
    fontSize: 15,
    fontWeight: '700',
    color: brand.textDark,
  },
  statusChip: {
    height: 26,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 64,
    paddingHorizontal: 24,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: brand.textDark,
  },
  emptySubtitle: {
    fontSize: 13,
    color: brand.textMuted,
    textAlign: 'center',
  },
});
