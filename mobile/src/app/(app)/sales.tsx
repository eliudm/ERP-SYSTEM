import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  ScrollView,
} from 'react-native';
import {
  Text,
  Card,
  ActivityIndicator,
  Chip,
  Searchbar,
  Snackbar,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { mobileApi, RecentInvoice } from '../../api/mobile.api';
import { OrderDetail } from '../../components/pos/OrderDetail';
import { useOrderDetailActions } from '../../hooks/useOrderDetailActions';
import { brand } from '../../theme';

type DateFilter = 'today' | 'week' | 'month' | 'all';
type StatusFilter = 'ALL' | 'PAID' | 'PENDING' | 'DRAFT' | 'VOID';

const DATE_FILTERS: { key: DateFilter; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'all', label: 'All Time' },
];

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PAID', label: 'Paid' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'VOID', label: 'Void' },
];

// PENDING = DRAFT | APPROVED | SENT (not yet fully settled)
const PENDING_STATUSES = new Set(['DRAFT', 'APPROVED', 'SENT']);

function getDateRange(filter: DateFilter): { dateFrom?: string; dateTo?: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const toISO = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (filter === 'all') return {};

  const from = new Date(now);
  if (filter === 'today') {
    from.setHours(0, 0, 0, 0);
  } else if (filter === 'week') {
    const day = now.getDay();
    from.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    from.setHours(0, 0, 0, 0);
  } else if (filter === 'month') {
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
  }

  return { dateFrom: toISO(from), dateTo: toISO(now) };
}

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

const ETIMS_STYLES: Record<
  string,
  { fg: string; icon: string; label: string }
> = {
  SUCCESS: { fg: '#0d7a66', icon: 'check-decagram', label: 'KRA eTIMS' },
  SUBMITTED: { fg: '#2452c7', icon: 'progress-clock', label: 'KRA pending' },
  PENDING: { fg: '#ad7a14', icon: 'clock-outline', label: 'KRA pending' },
  FAILED: { fg: '#d4380d', icon: 'alert-circle-outline', label: 'KRA failed' },
};

const EtimsBadge: React.FC<{ status: RecentInvoice['etimsStatus'] }> = ({
  status,
}) => {
  if (!status) return null;
  const style = ETIMS_STYLES[status];
  if (!style) return null;
  return (
    <View style={styles.etimsBadge}>
      <MaterialCommunityIcons
        name={style.icon as never}
        size={12}
        color={style.fg}
      />
      <Text style={[styles.etimsBadgeText, { color: style.fg }]}>
        {style.label}
      </Text>
    </View>
  );
};

const isCredit = (inv: RecentInvoice) =>
  inv.paymentMethod === 'CREDIT' || (inv.status === 'APPROVED' && !inv.paymentMethod);

const InvoiceRow: React.FC<{ invoice: RecentInvoice; onPress: () => void }> = ({
  invoice,
  onPress,
}) => (
  <Pressable onPress={onPress}>
    <Card style={styles.card} mode="contained">
      <Card.Content style={styles.cardContent}>
        <View style={styles.cardLeft}>
          <View style={styles.invoiceNoRow}>
            <Text style={styles.invoiceNo}>{invoice.invoiceNo}</Text>
            {isCredit(invoice) && (
              <View style={styles.creditBadge}>
                <MaterialCommunityIcons name="clock-outline" size={10} color="#ad7a14" />
                <Text style={styles.creditBadgeText}>CREDIT</Text>
              </View>
            )}
          </View>
          <Text style={styles.customerName} numberOfLines={1}>
            {invoice.customer?.name ?? 'Walk-in Customer'}
          </Text>
          <Text style={styles.date}>{formatDate(invoice.invoiceDate)}</Text>
          <EtimsBadge status={invoice.etimsStatus} />
        </View>
        <View style={styles.cardRight}>
          <Text style={[styles.total, isCredit(invoice) && styles.totalCredit]}>
            {formatCurrency(invoice.total)}
          </Text>
          <StatusChip status={invoice.status} />
        </View>
      </Card.Content>
    </Card>
  </Pressable>
);

function parseDateFilter(v: string | undefined): DateFilter {
  if (v === 'week' || v === 'month' || v === 'all') return v;
  return 'today';
}

function parseStatusFilter(v: string | undefined): StatusFilter {
  if (v === 'PAID' || v === 'PENDING' || v === 'DRAFT' || v === 'VOID') return v;
  return 'ALL';
}

export default function SalesScreen() {
  const params = useLocalSearchParams<{ filter?: string; status?: string }>();

  const [query, setQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>(() => parseDateFilter(params.filter));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => parseStatusFilter(params.status));
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });

  const { dateFrom, dateTo } = getDateRange(dateFilter);

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['recent-invoices', dateFilter],
    queryFn: () => mobileApi.getRecentInvoices(200, dateFrom, dateTo),
  });

  const orderDetail = useOrderDetailActions(selectedInvoiceId, (message) =>
    setToast({ visible: true, message }),
  );

  const invoices = data ?? [];

  const filtered = useMemo(() => {
    let result = invoices;
    if (statusFilter === 'PENDING') {
      result = result.filter((inv) => PENDING_STATUSES.has(inv.status));
    } else if (statusFilter !== 'ALL') {
      result = result.filter((inv) => inv.status === statusFilter);
    }
    const q = query.trim().toLowerCase();
    if (!q) return result;
    return result.filter((inv) => {
      const invoiceNo = inv.invoiceNo?.toLowerCase() ?? '';
      const customerName = inv.customer?.name?.toLowerCase() ?? '';
      return invoiceNo.includes(q) || customerName.includes(q);
    });
  }, [invoices, query, statusFilter]);

  const totalRevenue = filtered.reduce((sum, inv) => sum + inv.total, 0);
  const collectedRevenue = filtered
    .filter((inv) => inv.status === 'PAID')
    .reduce((sum, inv) => sum + inv.total, 0);
  const creditRevenue = filtered
    .filter((inv) => isCredit(inv))
    .reduce((sum, inv) => sum + inv.total, 0);

  if (selectedInvoiceId) {
    return (
      <View style={styles.container}>
        <OrderDetail
          invoice={orderDetail.invoice}
          isLoading={orderDetail.isLoading}
          currentUserRole={orderDetail.currentUserRole}
          onBack={() => setSelectedInvoiceId(null)}
          onPrint={() => void orderDetail.print()}
          printing={orderDetail.printing}
          onSavePdf={() => void orderDetail.savePdf()}
          savingPdf={orderDetail.savingPdf}
          refundState={orderDetail.refundState}
          refundApproved={orderDetail.refundApproved}
          refundError={orderDetail.refundError}
          onRequestRefund={orderDetail.requestRefund}
          onCancelRefund={orderDetail.cancelRefund}
          onConfirmRefund={() => void orderDetail.confirmRefund()}
        />
        <Snackbar
          visible={toast.visible}
          onDismiss={() => setToast((t) => ({ ...t, visible: false }))}
          duration={4000}
        >
          {toast.message}
        </Snackbar>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={brand.gradientEnd} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search bar — always visible */}
      <View style={styles.searchWrap}>
        <Searchbar
          placeholder="Search invoice # or customer"
          value={query}
          onChangeText={setQuery}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
        />
      </View>

      {/* Date filter chips — always visible, horizontal scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {DATE_FILTERS.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => setDateFilter(f.key)}
            style={[
              styles.filterChip,
              dateFilter === f.key && styles.filterChipActive,
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                dateFilter === f.key && styles.filterChipTextActive,
              ]}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Status filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.statusFilterRow}
      >
        {STATUS_FILTERS.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => setStatusFilter(f.key)}
            style={[
              styles.statusChipBtn,
              statusFilter === f.key && styles.statusChipBtnActive,
            ]}
          >
            <Text
              style={[
                styles.statusChipBtnText,
                statusFilter === f.key && styles.statusChipBtnTextActive,
              ]}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Summary banner — always visible */}
      <View style={styles.summaryBanner}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>
            {formatCurrency(totalRevenue)}
          </Text>
          <Text style={styles.summaryLabel}>{filtered.length} Sales</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text
            style={[styles.summaryValue, { color: '#0d7a66' }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatCurrency(collectedRevenue)}
          </Text>
          <Text style={styles.summaryLabel}>Collected</Text>
        </View>
        {creditRevenue > 0 && (
          <>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text
                style={[styles.summaryValue, { color: '#ad7a14' }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatCurrency(creditRevenue)}
              </Text>
              <Text style={styles.summaryLabel}>On Credit</Text>
            </View>
          </>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        renderItem={({ item }) => (
          <InvoiceRow
            invoice={item}
            onPress={() => setSelectedInvoiceId(item.id)}
          />
        )}
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
            <MaterialCommunityIcons
              name="receipt-text-outline"
              size={44}
              color={brand.gradientEnd}
              style={{ opacity: 0.5 }}
            />
            <Text style={styles.emptyTitle}>
              {query ? 'No matching invoices' : 'No invoices found'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {query
                ? 'Try a different invoice number or customer name.'
                : dateFilter === 'today'
                  ? 'No sales recorded today.'
                  : dateFilter === 'week'
                    ? 'No sales this week.'
                    : dateFilter === 'month'
                      ? 'No sales this month.'
                      : 'No invoices yet.'}
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
  filterRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row',
  },
  filterChip: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#ede9fe',
  },
  filterChipActive: {
    backgroundColor: brand.gradientEnd,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: brand.textMuted,
  },
  filterChipTextActive: {
    color: '#fff',
  },
  statusFilterRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
    flexDirection: 'row',
  },
  statusChipBtn: {
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#f0eef7',
    borderWidth: 1,
    borderColor: '#e0ddf0',
  },
  statusChipBtnActive: {
    backgroundColor: brand.textDark,
    borderColor: brand.textDark,
  },
  statusChipBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: brand.textMuted,
  },
  statusChipBtnTextActive: {
    color: '#fff',
  },
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginBottom: 4,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 14,
    gap: 16,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '800',
    color: brand.textDark,
  },
  summaryLabel: {
    fontSize: 11,
    color: brand.textMuted,
    marginTop: 1,
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#e8e4e0',
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
  invoiceNoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  invoiceNo: {
    fontSize: 15,
    fontWeight: '700',
    color: brand.textDark,
  },
  creditBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#fff3d6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  creditBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ad7a14',
    letterSpacing: 0.5,
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
  etimsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  etimsBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  total: {
    fontSize: 15,
    fontWeight: '700',
    color: brand.textDark,
  },
  totalCredit: {
    color: '#ad7a14',
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
