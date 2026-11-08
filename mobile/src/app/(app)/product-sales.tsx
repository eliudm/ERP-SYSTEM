import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  ScrollView,
} from 'react-native';
import { Text, Card, ActivityIndicator, Searchbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { mobileApi, ProductSaleRow } from '../../api/mobile.api';
import { brand } from '../../theme';

type DateFilter = 'today' | 'week' | 'month' | 'all';

const DATE_FILTERS: { key: DateFilter; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'all', label: 'All Time' },
];

function getDateRange(filter: DateFilter) {
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

function parseDateFilter(v: string | undefined): DateFilter {
  if (v === 'week' || v === 'month' || v === 'all') return v;
  return 'today';
}

const formatCurrency = (v: number) =>
  `KES ${v.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const ProductRow: React.FC<{ row: ProductSaleRow; rank: number; maxRevenue: number }> = ({
  row,
  rank,
  maxRevenue,
}) => {
  const barWidth = maxRevenue > 0 ? (row.revenue / maxRevenue) * 100 : 0;
  return (
    <Card style={styles.card} mode="contained">
      <Card.Content style={styles.cardContent}>
        <View style={styles.rankBadge}>
          <Text style={styles.rankText}>{rank}</Text>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <Text style={styles.productName} numberOfLines={1}>
              {row.productName}
            </Text>
            <Text style={styles.revenue}>{formatCurrency(row.revenue)}</Text>
          </View>
          <View style={styles.cardMeta}>
            <Text style={styles.metaText}>
              {row.qtySold % 1 === 0 ? row.qtySold : row.qtySold.toFixed(2)} sold
            </Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>{row.invoiceCount} invoices</Text>
            {row.productCode ? (
              <>
                <Text style={styles.metaDot}>·</Text>
                <Text style={[styles.metaText, { color: brand.textMuted, opacity: 0.6 }]}>
                  {row.productCode}
                </Text>
              </>
            ) : null}
          </View>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${barWidth}%` }]} />
          </View>
        </View>
      </Card.Content>
    </Card>
  );
};

export default function ProductSalesScreen() {
  const params = useLocalSearchParams<{ filter?: string }>();
  const [dateFilter, setDateFilter] = useState<DateFilter>(() => parseDateFilter(params.filter));
  const [query, setQuery] = useState('');

  const { dateFrom, dateTo } = getDateRange(dateFilter);

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['product-sales', dateFilter],
    queryFn: () => mobileApi.getProductSales(dateFrom, dateTo),
  });

  const rows = data ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.productName.toLowerCase().includes(q) ||
        r.productCode.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalQty = rows.reduce((s, r) => s + r.qtySold, 0);
  const maxRevenue = filtered[0]?.revenue ?? 0;

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={brand.gradientEnd} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Back + title */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={brand.textDark} />
        </Pressable>
        <Text style={styles.headerTitle}>Products Sold</Text>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Searchbar
          placeholder="Search product name or code"
          value={query}
          onChangeText={setQuery}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
        />
      </View>

      {/* Date filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {DATE_FILTERS.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => setDateFilter(f.key)}
            style={[styles.filterChip, dateFilter === f.key && styles.filterChipActive]}
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

      {/* Summary banner */}
      <View style={styles.summaryBanner}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>
            {formatCurrency(totalRevenue)}
          </Text>
          <Text style={styles.summaryLabel}>Total Revenue</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>
            {totalQty % 1 === 0 ? totalQty : totalQty.toFixed(1)}
          </Text>
          <Text style={styles.summaryLabel}>Units Sold</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>
            {rows.length}
          </Text>
          <Text style={styles.summaryLabel}>Products</Text>
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.productId}
        contentContainerStyle={styles.content}
        renderItem={({ item, index }) => (
          <ProductRow row={item} rank={index + 1} maxRevenue={maxRevenue} />
        )}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <MaterialCommunityIcons
              name="package-variant-closed"
              size={44}
              color={brand.gradientEnd}
              style={{ opacity: 0.5 }}
            />
            <Text style={styles.emptyTitle}>
              {query ? 'No matching products' : 'No sales recorded'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {query
                ? 'Try a different product name or code.'
                : 'No approved or paid invoices found for this period.'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f5ef' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f5ef',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
    gap: 10,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: brand.textDark,
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  searchbar: {
    borderRadius: 14,
    backgroundColor: '#ffffff',
    elevation: 0,
  },
  searchInput: { fontSize: 14, minHeight: 0 },
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
  filterChipActive: { backgroundColor: brand.gradientEnd },
  filterChipText: { fontSize: 13, fontWeight: '600', color: brand.textMuted },
  filterChipTextActive: { color: '#fff' },
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
  summaryItem: { alignItems: 'center', flex: 1, minWidth: 0 },
  summaryValue: {
    fontSize: 15,
    fontWeight: '800',
    color: brand.textDark,
  },
  summaryLabel: { fontSize: 11, color: brand.textMuted, marginTop: 1 },
  summaryDivider: { width: 1, height: 28, backgroundColor: '#e8e4e0' },
  content: { padding: 16, paddingTop: 8, gap: 10 },
  card: { borderRadius: 16, backgroundColor: '#ffffff' },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f0eef7',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  rankText: {
    fontSize: 12,
    fontWeight: '800',
    color: brand.textMuted,
  },
  cardBody: { flex: 1, gap: 4 },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  productName: {
    fontSize: 15,
    fontWeight: '700',
    color: brand.textDark,
    flex: 1,
  },
  revenue: {
    fontSize: 15,
    fontWeight: '700',
    color: brand.gradientEnd,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: brand.textMuted,
  },
  metaDot: {
    fontSize: 12,
    color: brand.textMuted,
    opacity: 0.5,
  },
  barTrack: {
    height: 4,
    backgroundColor: '#f0eef7',
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: 4,
    backgroundColor: brand.gradientEnd,
    borderRadius: 2,
    opacity: 0.6,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 64,
    paddingHorizontal: 24,
    gap: 6,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: brand.textDark },
  emptySubtitle: { fontSize: 13, color: brand.textMuted, textAlign: 'center' },
});
