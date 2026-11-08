import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Modal,
  TextInput as RNTextInput,
} from 'react-native';
import { Text, Button, ActivityIndicator, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

const PAYMENT_METHODS = [
  { key: 'CASH', label: 'Cash' },
  { key: 'CARD', label: 'Card' },
  { key: 'MOBILE_MONEY', label: 'M-Pesa' },
  { key: 'BANK_TRANSFER', label: 'Bank' },
] as const;

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

  // Which card has its payment form expanded
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Per-card local form state
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<string>('CASH');
  const [payNotes, setPayNotes] = useState('');
  const [payError, setPayError] = useState<string | null>(null);

  // Customer detail modal
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const {
    data: invoices = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['outstanding-credit'],
    queryFn: () => salesApi.getOutstandingCredit(),
    refetchInterval: 30000,
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

  const recordPaymentMutation = useMutation({
    mutationFn: ({ invoiceId, amount, paymentMethod, notes }: { invoiceId: string; amount: number; paymentMethod: string; notes?: string }) =>
      salesApi.recordCreditPayment(invoiceId, { amount, paymentMethod, notes }),
    onSuccess: () => {
      setExpandedId(null);
      setPayAmount('');
      setPayMethod('CASH');
      setPayNotes('');
      setPayError(null);
      queryClient.invalidateQueries({ queryKey: ['outstanding-credit'] });
      queryClient.invalidateQueries({ queryKey: ['customer-statement'] });
    },
    onError: (err: any) => {
      setPayError(err?.response?.data?.message || 'Payment failed — please try again');
    },
  });

  const totalBalance = invoices.reduce((s: number, inv: CreditInvoice) => s + inv.balance, 0);
  const totalInvoiced = invoices.reduce((s: number, inv: CreditInvoice) => s + inv.total, 0);

  const toggleExpand = (inv: CreditInvoice) => {
    if (expandedId === inv.id) {
      setExpandedId(null);
    } else {
      setExpandedId(inv.id);
      setPayAmount('');
      setPayMethod('CASH');
      setPayNotes('');
      setPayError(null);
    }
  };

  const handleRecord = (inv: CreditInvoice) => {
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) {
      setPayError('Enter a valid amount');
      return;
    }
    if (amount > inv.balance) {
      setPayError(`Amount cannot exceed balance of ${fmt(inv.balance)}`);
      return;
    }
    setPayError(null);
    recordPaymentMutation.mutate({
      invoiceId: inv.id,
      amount,
      paymentMethod: payMethod,
      notes: payNotes.trim() || undefined,
    });
  };

  const renderItem = ({ item }: { item: CreditInvoice }) => {
    const paidPct = item.total > 0 ? Math.min(100, (item.amountPaid / item.total) * 100) : 0;
    const isExpanded = expandedId === item.id;
    const isToday = new Date(item.invoiceDate).toDateString() === new Date().toDateString();
    const hasCustomer = item.customer != null;
    const amountNum = parseFloat(payAmount);
    const amountValid = !isNaN(amountNum) && amountNum > 0 && amountNum <= item.balance;

    return (
      <View style={styles.card}>
        {/* Card header row */}
        <View style={styles.cardTop}>
          <View style={styles.cardLeft}>
            <Pressable
              style={styles.customerRow}
              onPress={() => hasCustomer ? setSelectedCustomerId(item.customer!.id) : null}
            >
              <Text style={[styles.customerName, hasCustomer && styles.customerNameLink]}>
                {item.customer?.name ?? 'Walk-in Customer'}
              </Text>
              {hasCustomer && (
                <MaterialCommunityIcons name="open-in-new" size={12} color={brand.gradientEnd} />
              )}
            </Pressable>
            <Text style={styles.invoiceMeta}>
              {item.invoiceNo} · {fmtDate(item.invoiceDate)}
            </Text>
          </View>
          <View style={styles.cardRight}>
            <Text style={styles.balanceAmount}>{fmt(item.balance)}</Text>
            <Text style={styles.dateLabel}>{isToday ? 'Today' : fmtDate(item.invoiceDate)}</Text>
          </View>
        </View>

        {/* Progress row */}
        <Pressable style={styles.progressRow} onPress={() => toggleExpand(item)}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${paidPct}%` as any }]} />
          </View>
          <Text style={styles.paidLabel}>{paidPct.toFixed(0)}% paid</Text>
          <MaterialCommunityIcons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={brand.gradientEnd}
          />
        </Pressable>

        {/* Inline payment form */}
        {isExpanded && (
          <View style={styles.payForm}>
            <Divider style={{ marginBottom: 12 }} />
            <Text style={styles.payFormTitle}>Record Payment</Text>
            <Text style={styles.payBalance}>
              Balance: {fmt(item.balance)} · Total: {fmt(item.total)} · Paid: {fmt(item.amountPaid)}
            </Text>

            {/* Amount */}
            <View style={styles.amountBox}>
              <Text style={styles.amountLabel}>Amount (KES)</Text>
              <RNTextInput
                style={styles.amountInput}
                keyboardType="decimal-pad"
                value={payAmount}
                onChangeText={(v) => { setPayAmount(v); setPayError(null); }}
                placeholder="0.00"
                placeholderTextColor="#bbb"
              />
            </View>

            {/* Payment method */}
            <Text style={styles.sectionLabel}>PAYMENT METHOD</Text>
            <View style={styles.methodRow}>
              {PAYMENT_METHODS.map((m) => (
                <Pressable
                  key={m.key}
                  onPress={() => setPayMethod(m.key)}
                  style={[
                    styles.methodChip,
                    payMethod === m.key && styles.methodChipActive,
                  ]}
                >
                  <Text style={[styles.methodLabel, payMethod === m.key && styles.methodLabelActive]}>
                    {m.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Notes */}
            <RNTextInput
              style={styles.notesInput}
              value={payNotes}
              onChangeText={setPayNotes}
              placeholder="Notes (optional)"
              placeholderTextColor="#bbb"
              multiline
              numberOfLines={2}
            />

            {/* Error */}
            {payError && (
              <View style={styles.errorBox}>
                <MaterialCommunityIcons name="alert-circle-outline" size={14} color="#cf1322" />
                <Text style={styles.errorText}>{payError}</Text>
              </View>
            )}

            {/* Buttons */}
            <View style={styles.formButtons}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setExpandedId(null)}
              >
                <Text style={styles.cancelLabel}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.recordBtn, (!amountValid || recordPaymentMutation.isPending) && styles.recordBtnDisabled]}
                onPress={() => handleRecord(item)}
                disabled={!amountValid || recordPaymentMutation.isPending}
              >
                {recordPaymentMutation.isPending && expandedId === item.id ? (
                  <ActivityIndicator size={16} color="#fff" />
                ) : (
                  <Text style={styles.recordLabel}>Record Payment</Text>
                )}
              </Pressable>
            </View>
          </View>
        )}
      </View>
    );
  };

  const statementCustomer = statement?.customer;
  const statementSummary = statement?.summary;

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={brand.gradientEnd} />
      </View>
    );
  }

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
            <Text style={styles.bannerSub}>of {fmt(totalInvoiced)} total invoiced</Text>
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
            <MaterialCommunityIcons name="check-circle-outline" size={48} color={brand.gradientEnd} />
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
            <Text style={styles.sheetTitle}>{statementCustomer?.name ?? 'Customer'}</Text>
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
              <Text style={styles.sectionTitleLg}>
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
                        <Text style={[styles.invStatus, { color: statusColor }]}>{inv.status}</Text>
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
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#d6f3ee', paddingHorizontal: 20, paddingVertical: 16, gap: 12,
  },
  bannerLeft: { flex: 1 },
  bannerCount: { fontSize: 14, color: '#1a7a68', fontWeight: '600' },
  bannerTotal: { fontSize: 22, fontWeight: '800', color: brand.textDark, marginTop: 2 },
  bannerSub: { fontSize: 12, color: '#1a7a68', marginTop: 2 },
  list: { padding: 16, gap: 10 },

  // Card
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  cardLeft: { flex: 1, gap: 2 },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  customerName: { fontSize: 15, fontWeight: '700', color: brand.textDark },
  customerNameLink: { color: brand.gradientEnd },
  invoiceMeta: { fontSize: 12, color: brand.textMuted },
  cardRight: { alignItems: 'flex-end', gap: 2 },
  balanceAmount: { fontSize: 15, fontWeight: '700', color: '#d4380d' },
  dateLabel: { fontSize: 11, color: brand.textMuted },

  // Progress row (also the expand trigger)
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressBar: {
    flex: 1, height: 6, backgroundColor: '#e8e4f0',
    borderRadius: 3, overflow: 'hidden',
  },
  progressFill: { height: 6, backgroundColor: brand.gradientEnd, borderRadius: 3 },
  paidLabel: { fontSize: 11, color: brand.textMuted, minWidth: 54 },

  // Inline payment form
  payForm: { marginTop: 12 },
  payFormTitle: { fontSize: 15, fontWeight: '700', color: brand.textDark, marginBottom: 2 },
  payBalance: { fontSize: 12, color: brand.textMuted, marginBottom: 12 },
  amountBox: {
    borderWidth: 1.5, borderColor: brand.gradientEnd, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8, marginBottom: 14,
  },
  amountLabel: { fontSize: 11, color: brand.gradientEnd, fontWeight: '600', marginBottom: 2 },
  amountInput: { fontSize: 20, fontWeight: '700', color: brand.textDark, padding: 0 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: '#888',
    letterSpacing: 0.5, marginBottom: 8,
  },
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  methodChip: {
    paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10,
    backgroundColor: '#f0eef7',
  },
  methodChipActive: {
    backgroundColor: '#d6f3ee', borderWidth: 1.5, borderColor: brand.gradientEnd,
  },
  methodLabel: { fontSize: 13, fontWeight: '600', color: '#555' },
  methodLabelActive: { color: brand.gradientEnd },
  notesInput: {
    borderWidth: 1, borderColor: '#e0dde8', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: brand.textDark,
    marginBottom: 10, minHeight: 44,
  },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fff1f0', borderRadius: 8, padding: 10, marginBottom: 10,
  },
  errorText: { fontSize: 12, color: '#cf1322', flex: 1 },
  formButtons: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10,
    borderWidth: 1, borderColor: '#ccc',
  },
  cancelLabel: { fontSize: 14, fontWeight: '600', color: '#555' },
  recordBtn: {
    flex: 2, paddingVertical: 12, alignItems: 'center', borderRadius: 10,
    backgroundColor: brand.gradientEnd,
  },
  recordBtnDisabled: { opacity: 0.45 },
  recordLabel: { fontSize: 14, fontWeight: '700', color: '#fff' },

  empty: { paddingTop: 80, alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 14, color: brand.textMuted },

  // Customer detail sheet
  sheetContainer: { flex: 1, backgroundColor: '#fff' },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  closeBtn: { padding: 4 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: brand.textDark, flex: 1, textAlign: 'center' },
  sheetContent: { padding: 20, paddingBottom: 48 },
  contactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  contactItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  contactText: { fontSize: 13, color: brand.textMuted },
  statsRow: { flexDirection: 'row', backgroundColor: '#f8f5ef', borderRadius: 12, overflow: 'hidden' },
  statBox: { flex: 1, padding: 14, alignItems: 'center' },
  statBoxMiddle: {
    borderLeftWidth: 1, borderRightWidth: 1,
    borderLeftColor: '#e8e4e0', borderRightColor: '#e8e4e0',
  },
  statLabel: { fontSize: 11, color: brand.textMuted, marginBottom: 4 },
  statValue: { fontSize: 13, fontWeight: '700', color: brand.textDark },
  sectionTitleLg: { fontSize: 14, fontWeight: '700', color: brand.textDark, marginBottom: 12 },
  invRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
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
