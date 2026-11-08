import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import {
  Text,
  Button,
  ActivityIndicator,
  Divider,
  TextInput,
  Snackbar,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

const PAY_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
  { value: 'MOBILE_MONEY', label: 'M-Pesa' },
  { value: 'BANK_TRANSFER', label: 'Bank' },
];

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
  const queryClient = useQueryClient();

  // Customer detail sheet state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Payment modal state
  const [payInvoice, setPayInvoice] = useState<CreditInvoice | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('CASH');
  const [payNotes, setPayNotes] = useState('');
  const [snackbar, setSnackbar] = useState({ visible: false, message: '', isError: false });

  const {
    data: invoices = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['outstanding-credit'],
    queryFn: () => salesApi.getOutstandingCredit(),
    refetchInterval: 60000,
    select: (data) =>
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

  const recordMutation = useMutation({
    mutationFn: (invoiceId: string) =>
      salesApi.recordCreditPayment(invoiceId, {
        amount: parseFloat(payAmount),
        paymentMethod: payMethod,
        notes: payNotes.trim() || undefined,
      }),
    onSuccess: () => {
      setPayInvoice(null);
      void queryClient.invalidateQueries({ queryKey: ['outstanding-credit'] });
      void queryClient.invalidateQueries({ queryKey: ['customer-statement'] });
      void queryClient.invalidateQueries({ queryKey: ['mobile-dashboard'] });
      setSnackbar({ visible: true, message: 'Payment recorded successfully', isError: false });
    },
    onError: (err: any) => {
      setSnackbar({
        visible: true,
        message: (err?.response?.data?.message as string) ?? 'Failed to record payment.',
        isError: true,
      });
    },
  });

  const openPayForm = (inv: CreditInvoice) => {
    setPayInvoice(inv);
    setPayAmount(inv.balance.toFixed(2));
    setPayMethod('CASH');
    setPayNotes('');
  };

  const submitPayment = () => {
    const amount = parseFloat(payAmount);
    if (!payInvoice || isNaN(amount) || amount <= 0) {
      setSnackbar({ visible: true, message: 'Enter a valid payment amount', isError: true });
      return;
    }
    recordMutation.mutate(payInvoice.id);
  };

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
                <MaterialCommunityIcons name="chevron-right" size={16} color={brand.gradientEnd} />
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
            style={styles.payIconBtn}
            onPress={(e) => { e.stopPropagation?.(); openPayForm(item); }}
          >
            <MaterialCommunityIcons name="cash-plus" size={22} color={brand.gradientEnd} />
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
        keyboardShouldPersistTaps="handled"
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

      {/* ── Payment modal ── */}
      <Modal
        visible={!!payInvoice}
        transparent
        animationType="slide"
        onRequestClose={() => setPayInvoice(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableWithoutFeedback onPress={() => setPayInvoice(null)}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>

          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.paySheet}>
              {/* Handle */}
              <View style={styles.sheetHandle} />

              <Text style={styles.paySheetTitle}>Record Payment</Text>
              {payInvoice && (
                <Text style={styles.paySheetMeta}>
                  {payInvoice.customer?.name ?? 'Walk-in'} · {payInvoice.invoiceNo}
                </Text>
              )}

              {payInvoice && (
                <View style={styles.balanceRow}>
                  <View style={styles.balanceItem}>
                    <Text style={styles.balanceItemLabel}>Balance due</Text>
                    <Text style={[styles.balanceItemValue, { color: '#cf1322' }]}>
                      {fmt(payInvoice.balance)}
                    </Text>
                  </View>
                  <View style={styles.balanceItem}>
                    <Text style={styles.balanceItemLabel}>Total invoice</Text>
                    <Text style={styles.balanceItemValue}>{fmt(payInvoice.total)}</Text>
                  </View>
                  <View style={styles.balanceItem}>
                    <Text style={styles.balanceItemLabel}>Already paid</Text>
                    <Text style={[styles.balanceItemValue, { color: '#389e0d' }]}>
                      {fmt(payInvoice.amountPaid)}
                    </Text>
                  </View>
                </View>
              )}

              <TextInput
                mode="outlined"
                label="Amount (KES)"
                keyboardType="numeric"
                returnKeyType="done"
                value={payAmount}
                onChangeText={setPayAmount}
                style={styles.payInput}
                dense
              />

              <Text style={styles.methodLabel}>Payment Method</Text>
              <View style={styles.methodRow}>
                {PAY_METHODS.map((m) => (
                  <Pressable
                    key={m.value}
                    style={[styles.methodChip, payMethod === m.value && styles.methodChipActive]}
                    onPress={() => setPayMethod(m.value)}
                  >
                    <Text
                      style={[
                        styles.methodChipText,
                        payMethod === m.value && styles.methodChipTextActive,
                      ]}
                    >
                      {m.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <TextInput
                mode="outlined"
                label="Notes (optional)"
                value={payNotes}
                onChangeText={setPayNotes}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
                style={styles.payInput}
                dense
              />

              <View style={styles.payActions}>
                <Button
                  mode="text"
                  onPress={() => setPayInvoice(null)}
                  disabled={recordMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={submitPayment}
                  loading={recordMutation.isPending}
                  disabled={recordMutation.isPending}
                  style={styles.confirmBtn}
                >
                  Confirm Payment
                </Button>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Customer detail modal ── */}
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
                  (s: number, p: { amount: number | string }) => s + safeNum(p.amount),
                  0,
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

      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar((s) => ({ ...s, visible: false }))}
        duration={4000}
        style={snackbar.isError ? { backgroundColor: '#d4380d' } : undefined}
      >
        {snackbar.message}
      </Snackbar>
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
  list: { padding: 16, gap: 10, flexGrow: 1 },
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
  progressBar: { flex: 1, height: 6, backgroundColor: '#e8e4f0', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: brand.gradientEnd, borderRadius: 3 },
  paidLabel: { fontSize: 11, color: brand.textMuted, minWidth: 54 },
  payIconBtn: { padding: 4 },
  empty: { paddingTop: 80, alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 14, color: brand.textMuted },

  // Payment bottom sheet
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  paySheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingTop: 12,
    gap: 12,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e0dce8',
    marginBottom: 4,
  },
  paySheetTitle: { fontSize: 17, fontWeight: '700', color: brand.textDark },
  paySheetMeta: { fontSize: 13, color: brand.textMuted, marginTop: -6 },
  balanceRow: {
    flexDirection: 'row',
    backgroundColor: '#f8f5ef',
    borderRadius: 12,
    overflow: 'hidden',
  },
  balanceItem: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  balanceItemLabel: { fontSize: 10, color: brand.textMuted, marginBottom: 2 },
  balanceItemValue: { fontSize: 13, fontWeight: '700', color: brand.textDark },
  payInput: { backgroundColor: '#fff' },
  methodLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: brand.textMuted,
    marginBottom: -4,
  },
  methodRow: { flexDirection: 'row', gap: 8 },
  methodChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#f0eef7',
    alignItems: 'center',
  },
  methodChipActive: {
    backgroundColor: '#d6f3ee',
    borderWidth: 1.5,
    borderColor: brand.gradientEnd,
  },
  methodChipText: { fontSize: 12, fontWeight: '600', color: brand.textMuted },
  methodChipTextActive: { color: brand.gradientEnd },
  payActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  confirmBtn: { borderRadius: 10 },

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
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderLeftColor: '#e8e4e0',
    borderRightColor: '#e8e4e0',
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
