import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
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
import { useQuery } from '@tanstack/react-query';
import { mobileApi, RecentInvoice } from '../../api/mobile.api';
import { OrderDetail } from '../../components/pos/OrderDetail';
import { useOrderDetailActions } from '../../hooks/useOrderDetailActions';
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

const InvoiceRow: React.FC<{ invoice: RecentInvoice; onPress: () => void }> = ({
  invoice,
  onPress,
}) => (
  <Pressable onPress={onPress}>
    <Card style={styles.card} mode="contained">
      <Card.Content style={styles.cardContent}>
        <View style={styles.cardLeft}>
          <Text style={styles.invoiceNo}>{invoice.invoiceNo}</Text>
          <Text style={styles.customerName} numberOfLines={1}>
            {invoice.customer?.name ?? 'Walk-in Customer'}
          </Text>
          <Text style={styles.date}>{formatDate(invoice.invoiceDate)}</Text>
          <EtimsBadge status={invoice.etimsStatus} />
        </View>
        <View style={styles.cardRight}>
          <Text style={styles.total}>{formatCurrency(invoice.total)}</Text>
          <StatusChip status={invoice.status} />
        </View>
      </Card.Content>
    </Card>
  </Pressable>
);

export default function SalesScreen() {
  const [query, setQuery] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(
    null,
  );
  const [toast, setToast] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['recent-invoices'],
    queryFn: () => mobileApi.getRecentInvoices(30),
  });

  const orderDetail = useOrderDetailActions(selectedInvoiceId, (message) =>
    setToast({ visible: true, message }),
  );

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
