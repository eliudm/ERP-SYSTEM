import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import {
  Text,
  Card,
  ActivityIndicator,
  SegmentedButtons,
} from 'react-native-paper';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  analyticsApi,
  ProfitTrendPoint,
  TopProduct,
  TopCustomer,
} from '../../api/analytics.api';
import {
  getPeriodRange,
  Period,
  PERIOD_BUTTONS,
} from '../../utils/periodRange';
import { brand } from '../../theme';

const formatCurrency = (value: number) =>
  `KES ${value.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const formatPeriodLabel = (period: string, granularity: 'day' | 'month') => {
  if (granularity === 'day') {
    return period.slice(8, 10); // YYYY-MM-DD -> DD
  }
  const [, month] = period.split('-');
  const names = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  return names[Number(month) - 1] ?? period;
};

interface SummaryCardProps {
  label: string;
  value: string;
  tone?: 'neutral' | 'positive' | 'negative';
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  label,
  value,
  tone = 'neutral',
}) => (
  <Card style={styles.summaryCard} mode="contained">
    <Card.Content style={styles.summaryContent}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text
        style={[
          styles.summaryValue,
          tone === 'positive' && { color: '#2E8B57' },
          tone === 'negative' && { color: '#d4380d' },
        ]}
      >
        {value}
      </Text>
    </Card.Content>
  </Card>
);

const ProfitTrendChart: React.FC<{
  data: ProfitTrendPoint[];
  granularity: 'day' | 'month';
}> = ({ data, granularity }) => {
  const maxAbs = Math.max(1, ...data.map((d) => Math.abs(d.profit)));
  const barAreaHeight = 110;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.chartRow}>
        {data.map((point) => {
          const height = Math.max(
            3,
            (Math.abs(point.profit) / maxAbs) * barAreaHeight,
          );
          const positive = point.profit >= 0;
          return (
            <View key={point.period} style={styles.chartBarWrap}>
              <View style={[styles.chartBarTrack, { height: barAreaHeight }]}>
                <View
                  style={[
                    styles.chartBar,
                    {
                      height,
                      backgroundColor: positive ? '#2E8B57' : '#d4380d',
                    },
                  ]}
                />
              </View>
              <Text style={styles.chartBarLabel}>
                {formatPeriodLabel(point.period, granularity)}
              </Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
};

const TopProductRow: React.FC<{ rank: number; product: TopProduct }> = ({
  rank,
  product,
}) => (
  <View style={styles.rankRow}>
    <Text style={styles.rankNumber}>{rank}</Text>
    <View style={styles.rankInfo}>
      <Text style={styles.rankName} numberOfLines={1}>
        {product.name}
      </Text>
      <Text style={styles.rankSub}>{product.quantitySold} sold</Text>
    </View>
    <Text style={styles.rankValue}>{formatCurrency(product.revenue)}</Text>
  </View>
);

const TopCustomerRow: React.FC<{ rank: number; customer: TopCustomer }> = ({
  rank,
  customer,
}) => (
  <View style={styles.rankRow}>
    <Text style={styles.rankNumber}>{rank}</Text>
    <View style={styles.rankInfo}>
      <Text style={styles.rankName} numberOfLines={1}>
        {customer.name}
      </Text>
      <Text style={styles.rankSub}>
        {customer.invoiceCount} order{customer.invoiceCount === 1 ? '' : 's'}
      </Text>
    </View>
    <Text style={styles.rankValue}>{formatCurrency(customer.revenue)}</Text>
  </View>
);

export default function AnalyticsScreen() {
  const [period, setPeriod] = useState<Period>('this_month');
  const range = useMemo(() => getPeriodRange(period), [period]);
  const queryClient = useQueryClient();

  const plQuery = useQuery({
    queryKey: ['profit-and-loss', range.startDate, range.endDate],
    queryFn: () =>
      analyticsApi.getProfitAndLoss(range.startDate, range.endDate),
  });

  const trendQuery = useQuery({
    queryKey: [
      'profit-trend',
      range.startDate,
      range.endDate,
      range.granularity,
    ],
    queryFn: () =>
      analyticsApi.getProfitTrend(
        range.startDate,
        range.endDate,
        range.granularity,
      ),
  });

  const topProductsQuery = useQuery({
    queryKey: ['top-products', range.startDate, range.endDate],
    queryFn: () =>
      analyticsApi.getTopProducts(range.startDate, range.endDate, 5),
  });

  const topCustomersQuery = useQuery({
    queryKey: ['top-customers', range.startDate, range.endDate],
    queryFn: () =>
      analyticsApi.getTopCustomers(range.startDate, range.endDate, 5),
  });

  const isLoading =
    plQuery.isLoading ||
    trendQuery.isLoading ||
    topProductsQuery.isLoading ||
    topCustomersQuery.isLoading;
  const isRefetching =
    plQuery.isRefetching ||
    trendQuery.isRefetching ||
    topProductsQuery.isRefetching ||
    topCustomersQuery.isRefetching;

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['profit-and-loss'] });
    void queryClient.invalidateQueries({ queryKey: ['profit-trend'] });
    void queryClient.invalidateQueries({ queryKey: ['top-products'] });
    void queryClient.invalidateQueries({ queryKey: ['top-customers'] });
  };

  const pl = plQuery.data;
  const netPositive = (pl?.netProfit ?? 0) >= 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching && !isLoading}
          onRefresh={refreshAll}
        />
      }
    >
      <SegmentedButtons
        value={period}
        onValueChange={(v) => setPeriod(v)}
        buttons={[...PERIOD_BUTTONS]}
        style={styles.segmented}
      />

      {isLoading ? (
        <ActivityIndicator
          size="large"
          color={brand.gradientEnd}
          style={styles.loader}
        />
      ) : (
        <>
          <View style={styles.summaryGrid}>
            <SummaryCard
              label="Revenue"
              value={formatCurrency(pl?.revenue.total ?? 0)}
            />
            <SummaryCard
              label="Expenses"
              value={formatCurrency(pl?.expenses.total ?? 0)}
            />
            <SummaryCard
              label="Net Profit"
              value={formatCurrency(pl?.netProfit ?? 0)}
              tone={netPositive ? 'positive' : 'negative'}
            />
            <SummaryCard
              label="Margin"
              value={`${(pl?.netProfitMargin ?? 0).toFixed(1)}%`}
              tone={netPositive ? 'positive' : 'negative'}
            />
          </View>

          <Text style={styles.sectionTitle}>Profit Trend</Text>
          <Card style={styles.chartCard} mode="contained">
            <Card.Content>
              {trendQuery.data && trendQuery.data.data.length > 0 ? (
                <ProfitTrendChart
                  data={trendQuery.data.data}
                  granularity={range.granularity}
                />
              ) : (
                <Text style={styles.emptyText}>
                  No activity in this period.
                </Text>
              )}
            </Card.Content>
          </Card>

          <Text style={styles.sectionTitle}>Top Products</Text>
          <Card style={styles.listCard} mode="contained">
            <Card.Content style={styles.listContent}>
              {topProductsQuery.data &&
              topProductsQuery.data.data.length > 0 ? (
                topProductsQuery.data.data.map((product, i) => (
                  <TopProductRow
                    key={product.productId}
                    rank={i + 1}
                    product={product}
                  />
                ))
              ) : (
                <Text style={styles.emptyText}>No sales in this period.</Text>
              )}
            </Card.Content>
          </Card>

          <Text style={styles.sectionTitle}>Top Customers</Text>
          <Card style={styles.listCard} mode="contained">
            <Card.Content style={styles.listContent}>
              {topCustomersQuery.data &&
              topCustomersQuery.data.data.length > 0 ? (
                topCustomersQuery.data.data.map((customer, i) => (
                  <TopCustomerRow
                    key={customer.customerId}
                    rank={i + 1}
                    customer={customer}
                  />
                ))
              ) : (
                <Text style={styles.emptyText}>No sales in this period.</Text>
              )}
            </Card.Content>
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f5ef',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 4,
  },
  segmented: {
    marginBottom: 16,
  },
  loader: {
    marginTop: 60,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  summaryCard: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: 16,
    backgroundColor: '#ffffff',
  },
  summaryContent: {
    paddingVertical: 14,
  },
  summaryLabel: {
    fontSize: 11.5,
    color: brand.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontWeight: '700',
  },
  summaryValue: {
    fontSize: 19,
    fontWeight: '700',
    color: brand.textDark,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: brand.textMuted,
    marginTop: 16,
    marginBottom: 8,
  },
  chartCard: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingVertical: 4,
  },
  chartBarWrap: {
    alignItems: 'center',
    width: 26,
  },
  chartBarTrack: {
    width: 14,
    justifyContent: 'flex-end',
  },
  chartBar: {
    width: 14,
    borderRadius: 4,
  },
  chartBarLabel: {
    fontSize: 10,
    color: brand.textMuted,
    marginTop: 6,
  },
  listCard: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
  },
  listContent: {
    paddingVertical: 4,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  rankNumber: {
    width: 20,
    fontSize: 13,
    fontWeight: '700',
    color: brand.textMuted,
  },
  rankInfo: {
    flex: 1,
  },
  rankName: {
    fontSize: 13.5,
    fontWeight: '600',
    color: brand.textDark,
  },
  rankSub: {
    fontSize: 11.5,
    color: brand.textMuted,
  },
  rankValue: {
    fontSize: 13,
    fontWeight: '700',
    color: brand.gradientEnd,
  },
  emptyText: {
    fontSize: 13,
    color: brand.textMuted,
    paddingVertical: 8,
  },
});
