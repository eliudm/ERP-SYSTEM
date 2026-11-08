import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Modal,
} from 'react-native';
import { Text, Button, ActivityIndicator, Divider, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { salesApi } from '../../api/sales.api';
import { brand } from '../../theme';

const fmt = (v: number) =>
  `KES ${v.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });

const safeNum = (v: unknown) => {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

const STATUS_COLOR: Record<string, string> = {
  APPROVED: '#d46b08',
  PAID: '#389e0d',
  DRAFT: '#8c8c8c',
  VOID: '#cf1322',
};

type CreditInvoice = {
  id: string;
  invoiceNo: string;
  invoiceDate: string;
  customer: { id: string; name: string; phone?: string } | null;
  total: number;
  amountPaid: number;
  balance: number;
};

export default function CreditsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const {
    data: invoices = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['outstanding-credit'],
    queryFn: () => salesApi.getOutstandingCredit(),
    refetchInterval: 60000,
    select: (data: Array<{ id: string; invoiceNo: string; invoiceDate: string; customer: { id: string; name: string; phone?: string } | null; total: number; amountPaid: number; balance: number }>) =>
      data.map((inv) => ({
        ...inv,
        total: safeNum(inv.total),
        amountPaid: safeNum(inv.amountPaid),
        balance: safeNum(inv.balance),
      })),
  });

  const { data: statement, isLoading: statementLoading } = useQuery({
    queryKey: ['customer-statement', selectedCustomerId],
    queryFn: () => salesApi.getCustomerStatement(selectedCustomerId!),
    enabled: !!selectedCustomerId,
  });

  const totalBalance = invoices.reduce((s: number, inv: CreditInvoice) => s + inv.balance, 0);
  const totalInvoiced = invoices.reduce((s: number, inv: CreditInvoice) => s + inv.total, 0);

  const renderItem = ({ item }: { item: CreditInvoice }) => {
    const paidPct = item.total > 0 ? Math.min(100, (item.amountPaid / item.total) * 100) : 0;
    const isToday = new Date(item.invoiceDate).toDateString() === new Date().toDateString();
    const hasCustomer = item.customer != null;

    return (
      <Pressable
        style={styles.card}
        onPress={() => hasCustomer ? setSelectedCustomerId(item.customer!.id) : null}
      >
        <View style={styles.cardTop}>
          <View style={styles.cardLeft}>
            <View style={styles.customerRow}>
              <Text style={styles.customerName}>
                {item.customer?.name ?? 'Walk-in Customer'}
              </Text>
              {hasCustomer && (
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={16}
                  color={brand.gradientEnd}
                />
              )}
            </View>
            <Text style={styles.invoiceMeta}>
              {item.invoiceNo} · {fmtDate(item.invoiceDate)}
            </Text>
          </View>
          <View style={styles.cardRight}>
            <Text style={styles.balanceAmount}>{fmt(item.balance)}</Text>
            <Text style={styles.dateLabel}>{isToday ? 'Today' : fmtDate(item.invoiceDate)}</Text>
          </View>
        </View>

        <View style={styles.progressRow}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${paidPct}%` as any }]} />
          </View>
          <Text style={styles.paidLabel}>{paidPct.toFixed(0)}% paid</Text>
          <Pressable
            style={styles.payIcon}
            onPress={(e) => { e.stopPropagation?.(); router.navigate('/pos'); }}
          >
            <MaterialCommunityIcons
              name="cash-plus"
              size={22}
              color={brand.gradientEnd}
            />
          </Pressable>
        </View>
      </Pressable>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={brand.gradientEnd} />
      </View>
    );
  }

  const statementCustomer = statement?.customer;
  const statementSummary = statement?.summary;

  return (
    <View style={styles.container}>
      {/* Summary banner */}
      <View style={styles.banner}>
        <View style={styles.bannerLeft}>
          <Text style={styles.bannerCount}>
            {invoices.length} unpaid credit {invoices.length === 1 ? 'invoice' : 'invoices'}
          </Text>
          <Text style={styles.bannerTotal}>{fmt(totalBalance)} outstanding</Text>
          {totalInvoiced > 0 && (
            <Text style={styles.bannerSub}>
              of {fmt(totalInvoiced)} total invoiced
            </Text>
          )}
        </View>
        <MaterialCommunityIcons
          name="account-clock-outline"
          size={36}
          color={brand.gradientEnd}
          style={{ opacity: 0.6 }}
        />
      </View>

      <FlatList
        data={invoices}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            colors={[brand.gradientEnd]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons
              name="check-circle-outline"
              size={48}
              color={brand.gradientEnd}
            />
            <Text style={styles.emptyText}>No outstanding credit invoices</Text>
          </View>
        }
      />

      {/* Customer Detail Modal */}
      <Modal
        visible={!!selectedCustomerId}
        animationType="slide"
        onRequestClose={() => setSelectedCustomerId(null)}
      >
        <View style={styles.sheetContainer}>
          <View style={styles.sheetHeader}>
            <Pressable onPress={() => setSelectedCustomerId(null)} style={styles.closeBtn}>
              <MaterialCommunityIcons name="close" size={24} color={brand.textDark} />
            </Pressable>
            <Text style={styles.sheetTitle}>
              {statementCustomer?.name ?? 'Customer'}
            </Text>
            <View style={{ width: 36 }} />
          </View>

          {statementLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={brand.gradientEnd} />
            </View>
          ) : statementCustomer ? (
            <ScrollView contentContainerStyle={styles.sheetContent}>
              {/* Contact info */}
              <View style={styles.contactRow}>
                {statementCustomer.phone ? (
                  <View style={styles.contactItem}>
                    <MaterialCommunityIcons name="phone" size={14} color={brand.textMuted} />
                    <Text style={styles.contactText}>{statementCustomer.phone}</Text>
                  </View>
                ) : null}
                {statementCustomer.email ? (
                  <View style={styles.contactItem}>
                    <MaterialCommunityIcons name="email" size={14} color={brand.textMuted} />
                    <Text style={styles.contactText}>{statementCustomer.email}</Text>
                  </View>
                ) : null}
              </View>

              {/* Summary stats */}
              {statementSummary && (
                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Total Billed</Text>
                    <Text style={styles.statValue}>{fmt(safeNum(statementSummary.totalBilled))}</Text>
                  </View>
                  <View style={[styles.statBox, styles.statBoxMiddle]}>
                    <Text style={styles.statLabel}>Paid</Text>
                    <Text style={[styles.statValue, { color: '#389e0d' }]}>
                      {fmt(safeNum(statementSummary.totalPaid))}
                    </Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Outstanding</Text>
                    <Text style={[styles.statValue, { color: '#cf1322' }]}>
                      {fmt(safeNum(statementSummary.outstandingBalance))}
                    </Text>
                  </View>
                </View>
              )}

              <Divider style={{ marginVertical: 16 }} />
              <Text style={styles.sectionTitle}>
                Purchase History ({statementCustomer.invoices.length})
              </Text>

              {statementCustomer.invoices.map((inv) => {
                const total = safeNum(inv.total);
                const creditPaid = (inv.creditPayments ?? []).reduce(
                  (s: number, p: { amount: number | string }) => s + safeNum(p.amount), 0,
                );
                const balance = inv.status === 'PAID' ? 0 : total - creditPaid;
                const statusColor = STATUS_COLOR[inv.status] ?? '#8c8c8c';

                return (
                  <View key={inv.id} style={styles.invRow}>
                    <View style={styles.invLeft}>
                      <Text style={styles.invNo}>{inv.invoiceNo}</Text>
                      <Text style={styles.invDate}>{fmtDate(inv.invoiceDate)}</Text>
                    </View>
                    <View style={styles.invRight}>
                      <Text style={styles.invTotal}>{fmt(total)}</Text>
                      <View style={styles.invBottom}>
                        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                        <Text style={[styles.invStatus, { color: statusColor }]}>
                          {inv.status}
                        </Text>
                        {balance > 0 && (
                          <Text style={styles.invBalance}>· owes {fmt(balance)}</Text>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f5ef' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d6f3ee',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  bannerLeft: { flex: 1 },
  bannerCount: { fontSize: 14, color: '#1a7a68', fontWeight: '600' },
  bannerTotal: { fontSize: 22, fontWeight: '800', color: brand.textDark, marginTop: 2 },
  bannerSub: { fontSize: 12, color: '#1a7a68', marginTop: 2 },
  list: { padding: 16, gap: 10 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardLeft: { flex: 1, gap: 2 },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  customerName: { fontSize: 15, fontWeight: '700', color: brand.textDark },
  invoiceMeta: { fontSize: 12, color: brand.textMuted },
  cardRight: { alignItems: 'flex-end', gap: 2 },
  balanceAmount: { fontSize: 15, fontWeight: '700', color: '#d4380d' },
  dateLabel: { fontSize: 11, color: brand.textMuted },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressBar: {
    flex: 1, height: 6, backgroundColor: '#e8e4f0',
    borderRadius: 3, overflow: 'hidden',
  },
  progressFill: { height: 6, backgroundColor: brand.gradientEnd, borderRadius: 3 },
  paidLabel: { fontSize: 11, color: brand.textMuted, minWidth: 54 },
  payIcon: { padding: 2 },
  empty: { paddingTop: 80, alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 14, color: brand.textMuted },

  // Customer detail sheet
  sheetContainer: { flex: 1, backgroundColor: '#fff' },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  closeBtn: { padding: 4 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: brand.textDark, flex: 1, textAlign: 'center' },
  sheetContent: { padding: 20, paddingBottom: 48 },
  contactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  contactItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  contactText: { fontSize: 13, color: brand.textMuted },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#f8f5ef',
    borderRadius: 12,
    marginBottom: 4,
    overflow: 'hidden',
  },
  statBox: { flex: 1, padding: 14, alignItems: 'center' },
  statBoxMiddle: {
    borderLeftWidth: 1, borderRightWidth: 1,
    borderLeftColor: '#e8e4e0', borderRightColor: '#e8e4e0',
  },
  statLabel: { fontSize: 11, color: brand.textMuted, marginBottom: 4 },
  statValue: { fontSize: 13, fontWeight: '700', color: brand.textDark },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: brand.textDark, marginBottom: 12 },
  invRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  invLeft: { flex: 1, gap: 2 },
  invNo: { fontSize: 13, fontWeight: '600', color: brand.textDark, fontFamily: 'monospace' },
  invDate: { fontSize: 11, color: brand.textMuted },
  invRight: { alignItems: 'flex-end', gap: 2 },
  invTotal: { fontSize: 13, fontWeight: '600', color: brand.textDark },
  invBottom: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  invStatus: { fontSize: 11, fontWeight: '600' },
  invBalance: { fontSize: 11, color: '#cf1322' },
});
