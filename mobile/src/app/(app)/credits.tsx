import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  RefreshControl,
  ScrollView,
  Modal,
  TextInput as RNTextInput,
  KeyboardAvoidingView,
  Platform,
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

type MpesaStage = 'idle' | 'sending' | 'waiting' | 'failed';

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

  // M-Pesa state
  const [mpesaChannel, setMpesaChannel] = useState<'STK' | 'TILL'>('STK');
  const [stkPhone, setStkPhone] = useState('');
  const [mpesaStage, setMpesaStage] = useState<MpesaStage>('idle');

  // ScrollView ref for scrolling to expanded card
  const listRef = useRef<ScrollView>(null);
  const cardOffsets = useRef<Record<string, number>>({});

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

  // STK status polling — active only while waiting for M-Pesa confirmation
  const { data: mpesaStatus } = useQuery({
    queryKey: ['mpesa-status', expandedId],
    queryFn: () => salesApi.getMpesaStatus(expandedId!),
    enabled: !!expandedId && mpesaStage === 'waiting',
    refetchInterval: 3000,
  });

  // Till payments polling — active while TILL mode is open and idle
  const { data: tillPayments = [] } = useQuery({
    queryKey: ['till-payments'],
    queryFn: () => salesApi.getPendingTillPayments(),
    enabled:
      !!expandedId &&
      payMethod === 'MOBILE_MONEY' &&
      mpesaChannel === 'TILL' &&
      mpesaStage === 'idle',
    refetchInterval: 5000,
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
      setMpesaStage('idle');
      setStkPhone('');
      queryClient.invalidateQueries({ queryKey: ['outstanding-credit'] });
      queryClient.invalidateQueries({ queryKey: ['customer-statement'] });
    },
    onError: (err: any) => {
      setPayError(err?.response?.data?.message || 'Payment failed — please try again');
      setMpesaStage('idle');
    },
  });

  const matchTillMutation = useMutation({
    mutationFn: ({ tillPaymentId, invoiceId }: { tillPaymentId: string; invoiceId: string }) =>
      salesApi.matchTillPayment(tillPaymentId, invoiceId),
    onSuccess: (_, { invoiceId }) => {
      const amount = parseFloat(payAmount);
      recordPaymentMutation.mutate({
        invoiceId,
        amount: isNaN(amount) ? 0 : amount,
        paymentMethod: 'MOBILE_MONEY',
        notes: payNotes.trim() || undefined,
      });
    },
    onError: (err: any) => {
      setPayError(err?.response?.data?.message || 'Failed to match till payment');
    },
  });

  // Scroll expanded card into view so the form isn't hidden behind the keyboard
  useEffect(() => {
    if (!expandedId) return;
    const y = cardOffsets.current[expandedId];
    if (y != null) {
      setTimeout(() => {
        listRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
      }, 150);
    }
  }, [expandedId]);

  // React to STK polling result
  useEffect(() => {
    if (mpesaStage !== 'waiting' || !mpesaStatus || !expandedId) return;
    const status = mpesaStatus.mpesa?.status;
    if (status === 'SUCCESS') {
      const amount = parseFloat(payAmount);
      recordPaymentMutation.mutate({
        invoiceId: expandedId,
        amount: isNaN(amount) ? 0 : amount,
        paymentMethod: 'MOBILE_MONEY',
        notes: payNotes.trim() || undefined,
      });
    } else if (status === 'FAILED') {
      setMpesaStage('failed');
      setPayError(mpesaStatus.mpesa?.resultDesc ?? 'M-Pesa payment failed — please try again');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mpesaStatus]);

  const totalBalance = invoices.reduce((s: number, inv: CreditInvoice) => s + inv.balance, 0);
  const totalInvoiced = invoices.reduce((s: number, inv: CreditInvoice) => s + inv.total, 0);

  const resetMpesa = () => {
    setMpesaStage('idle');
    setPayError(null);
  };

  const toggleExpand = (inv: CreditInvoice) => {
    if (expandedId === inv.id) {
      setExpandedId(null);
    } else {
      setExpandedId(inv.id);
      setPayAmount('');
      setPayMethod('CASH');
      setPayNotes('');
      setPayError(null);
      setMpesaStage('idle');
      setStkPhone('');
    }
  };

  const handleMethodChange = (key: string, inv: CreditInvoice) => {
    setPayMethod(key);
    setPayError(null);
    if (key === 'MOBILE_MONEY') {
      const phone = inv.customer?.phone ?? '';
      setStkPhone(phone);
      setMpesaChannel(phone ? 'STK' : 'TILL');
      setMpesaStage('idle');
    }
  };

  const handleStkPush = async (inv: CreditInvoice) => {
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) {
      setPayError('Enter a valid amount');
      return;
    }
    if (amount > inv.balance) {
      setPayError(`Amount cannot exceed balance of ${fmt(inv.balance)}`);
      return;
    }
    const phone = stkPhone.trim();
    if (!phone) {
      setPayError('Enter a phone number');
      return;
    }
    setPayError(null);
    setMpesaStage('sending');
    try {
      await salesApi.initiateMpesaStkPush(inv.id, {
        phoneNumber: phone,
        accountReference: inv.invoiceNo,
        amount,
      });
      setMpesaStage('waiting');
    } catch (err: any) {
      setMpesaStage('failed');
      setPayError(err?.response?.data?.message || 'Failed to initiate M-Pesa push');
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
    const isMpesa = payMethod === 'MOBILE_MONEY';

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
                editable={mpesaStage === 'idle' || mpesaStage === 'failed'}
              />
            </View>

            {/* Payment method */}
            <Text style={styles.sectionLabel}>PAYMENT METHOD</Text>
            <View style={styles.methodRow}>
              {PAYMENT_METHODS.map((m) => (
                <Pressable
                  key={m.key}
                  onPress={() => handleMethodChange(m.key, item)}
                  style={[
                    styles.methodChip,
                    payMethod === m.key && styles.methodChipActive,
                  ]}
                  disabled={mpesaStage === 'sending' || mpesaStage === 'waiting'}
                >
                  <Text style={[styles.methodLabel, payMethod === m.key && styles.methodLabelActive]}>
                    {m.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* M-Pesa panel */}
            {isMpesa ? (
              <View style={styles.mpesaPanel}>
                {/* Channel toggle */}
                <View style={styles.channelRow}>
                  <Pressable
                    style={[styles.channelBtn, mpesaChannel === 'STK' && styles.channelBtnActive]}
                    onPress={() => { setMpesaChannel('STK'); resetMpesa(); }}
                    disabled={mpesaStage === 'sending' || mpesaStage === 'waiting'}
                  >
                    <MaterialCommunityIcons
                      name="cellphone-arrow-down"
                      size={14}
                      color={mpesaChannel === 'STK' ? '#fff' : brand.gradientEnd}
                    />
                    <Text style={[styles.channelLabel, mpesaChannel === 'STK' && styles.channelLabelActive]}>
                      STK Push
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.channelBtn, mpesaChannel === 'TILL' && styles.channelBtnActive]}
                    onPress={() => { setMpesaChannel('TILL'); resetMpesa(); }}
                    disabled={mpesaStage === 'sending' || mpesaStage === 'waiting'}
                  >
                    <MaterialCommunityIcons
                      name="cash-register"
                      size={14}
                      color={mpesaChannel === 'TILL' ? '#fff' : brand.gradientEnd}
                    />
                    <Text style={[styles.channelLabel, mpesaChannel === 'TILL' && styles.channelLabelActive]}>
                      Till / BuyGoods
                    </Text>
                  </Pressable>
                </View>

                {/* STK Push flow */}
                {mpesaChannel === 'STK' && (
                  <View>
                    {(mpesaStage === 'idle' || mpesaStage === 'failed') && (
                      <>
                        <Text style={styles.sectionLabel}>CUSTOMER PHONE (M-PESA)</Text>
                        <View style={styles.phoneBox}>
                          <MaterialCommunityIcons name="phone" size={16} color={brand.gradientEnd} />
                          <RNTextInput
                            style={styles.phoneInput}
                            keyboardType="phone-pad"
                            value={stkPhone}
                            onChangeText={(v) => { setStkPhone(v); setPayError(null); }}
                            placeholder="e.g. 0712345678"
                            placeholderTextColor="#bbb"
                          />
                        </View>
                      </>
                    )}

                    {mpesaStage === 'waiting' && (
                      <View style={styles.waitingBox}>
                        <ActivityIndicator size={22} color={brand.gradientEnd} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.waitingTitle}>Waiting for M-Pesa...</Text>
                          <Text style={styles.waitingSubtitle}>
                            Prompt sent to {stkPhone}. Customer should enter PIN.
                          </Text>
                        </View>
                      </View>
                    )}

                    {mpesaStage === 'sending' && (
                      <View style={styles.waitingBox}>
                        <ActivityIndicator size={22} color={brand.gradientEnd} />
                        <Text style={styles.waitingTitle}>Sending STK push...</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Till flow */}
                {mpesaChannel === 'TILL' && (
                  <View>
                    {tillPayments.length === 0 ? (
                      <View style={styles.waitingBox}>
                        <ActivityIndicator size={18} color={brand.gradientEnd} />
                        <Text style={styles.waitingTitle}>Waiting for till payment...</Text>
                      </View>
                    ) : (
                      <>
                        <Text style={styles.sectionLabel}>MATCH A TILL PAYMENT</Text>
                        {tillPayments.map((tp) => (
                          <Pressable
                            key={tp.id}
                            style={styles.tillRow}
                            onPress={() => matchTillMutation.mutate({ tillPaymentId: tp.id, invoiceId: item.id })}
                            disabled={matchTillMutation.isPending}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={styles.tillAmount}>
                                {fmt(tp.amount)}
                              </Text>
                              <Text style={styles.tillMeta}>
                                {tp.payerName} · {tp.msisdn}
                              </Text>
                              {tp.billRefNumber ? (
                                <Text style={styles.tillRef}>Ref: {tp.billRefNumber}</Text>
                              ) : null}
                            </View>
                            {matchTillMutation.isPending ? (
                              <ActivityIndicator size={18} color={brand.gradientEnd} />
                            ) : (
                              <View style={styles.matchBtn}>
                                <Text style={styles.matchLabel}>Match</Text>
                              </View>
                            )}
                          </Pressable>
                        ))}
                      </>
                    )}
                  </View>
                )}
              </View>
            ) : (
              /* Notes for non-M-Pesa */
              <RNTextInput
                style={styles.notesInput}
                value={payNotes}
                onChangeText={setPayNotes}
                placeholder="Notes (optional)"
                placeholderTextColor="#bbb"
                multiline
                numberOfLines={2}
              />
            )}

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

              {isMpesa ? (
                mpesaChannel === 'STK' && (mpesaStage === 'idle' || mpesaStage === 'failed') ? (
                  <Pressable
                    style={[styles.recordBtn, !amountValid && styles.recordBtnDisabled]}
                    onPress={() => void handleStkPush(item)}
                    disabled={!amountValid}
                  >
                    <MaterialCommunityIcons name="cellphone-arrow-down" size={16} color="#fff" />
                    <Text style={styles.recordLabel}>Send STK Push</Text>
                  </Pressable>
                ) : mpesaChannel === 'STK' && mpesaStage === 'waiting' ? (
                  <View style={[styles.recordBtn, styles.recordBtnDisabled, { flexDirection: 'row', gap: 8 }]}>
                    <ActivityIndicator size={16} color="#fff" />
                    <Text style={styles.recordLabel}>Waiting...</Text>
                  </View>
                ) : null
              ) : (
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
              )}
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
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

      <ScrollView
        ref={listRef as any}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            colors={[brand.gradientEnd]}
          />
        }
      >
        {invoices.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="check-circle-outline" size={48} color={brand.gradientEnd} />
            <Text style={styles.emptyText}>No outstanding credit invoices</Text>
          </View>
        ) : (
          invoices.map((item: CreditInvoice) => (
            <View
              key={item.id}
              style={{ marginBottom: 10 }}
              onLayout={(e) => { cardOffsets.current[item.id] = e.nativeEvent.layout.y; }}
            >
              {renderItem({ item })}
            </View>
          ))
        )}
      </ScrollView>

      {/* Customer detail modal — rendered outside KeyboardAvoidingView so it covers the full screen */}
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f5ef', overflow: 'hidden' },
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
    flex: 2, paddingVertical: 12, alignItems: 'center', justifyContent: 'center',
    borderRadius: 10, backgroundColor: brand.gradientEnd, flexDirection: 'row', gap: 6,
  },
  recordBtnDisabled: { opacity: 0.45 },
  recordLabel: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // M-Pesa panel
  mpesaPanel: { marginBottom: 10 },
  channelRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  channelBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 9, borderRadius: 10,
    borderWidth: 1.5, borderColor: brand.gradientEnd, backgroundColor: '#f8f5ef',
  },
  channelBtnActive: { backgroundColor: brand.gradientEnd },
  channelLabel: { fontSize: 13, fontWeight: '700', color: brand.gradientEnd },
  channelLabelActive: { color: '#fff' },
  phoneBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: brand.gradientEnd, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12,
  },
  phoneInput: { flex: 1, fontSize: 16, color: brand.textDark, padding: 0 },
  waitingBox: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#f0faf7', borderRadius: 10, padding: 14, marginBottom: 12,
  },
  waitingTitle: { fontSize: 14, fontWeight: '700', color: brand.textDark },
  waitingSubtitle: { fontSize: 12, color: brand.textMuted, marginTop: 2 },
  tillRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 12,
    borderWidth: 1, borderColor: '#e0dde8', borderRadius: 10, marginBottom: 8,
  },
  tillAmount: { fontSize: 15, fontWeight: '700', color: brand.textDark },
  tillMeta: { fontSize: 12, color: brand.textMuted, marginTop: 2 },
  tillRef: { fontSize: 11, color: brand.textMuted },
  matchBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
    backgroundColor: brand.gradientEnd,
  },
  matchLabel: { fontSize: 13, fontWeight: '700', color: '#fff' },

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
