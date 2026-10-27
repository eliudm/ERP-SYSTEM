import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import {
  Text,
  Card,
  ActivityIndicator,
  SegmentedButtons,
} from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { branchesApi, BranchComparisonEntry } from '../api/branches.api';
import { getPeriodRange, Period, PERIOD_BUTTONS } from '../utils/periodRange';
import { brand } from '../theme';

const formatCurrency = (value: number) =>
  `KES ${value.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const RANK_COLORS = ['#1db8a0', '#6f67ff', '#f08c2f'];

const BranchRow: React.FC<{
  entry: BranchComparisonEntry;
  rank: number;
  maxRevenue: number;
}> = ({ entry, rank, maxRevenue }) => {
  const barWidth =
    maxRevenue > 0 ? Math.max(4, (entry.totals.revenue / maxRevenue) * 100) : 0;
  const accent = RANK_COLORS[rank - 1] ?? brand.textMuted;

  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <View style={styles.rowInfo}>
          <Text style={styles.rank}>#{rank}</Text>
          <View>
            <Text style={styles.branchName}>{entry.name}</Text>
            <Text style={styles.branchCode}>{entry.code}</Text>
          </View>
        </View>
        <Text style={styles.revenue}>
          {formatCurrency(entry.totals.revenue)}
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: `${barWidth}%`, backgroundColor: accent },
          ]}
        />
      </View>
      <Text style={styles.rowSub}>
        {entry.totals.invoices} order{entry.totals.invoices === 1 ? '' : 's'}
        {' · '}
        {entry.totals.paidInvoices} paid
      </Text>
    </View>
  );
};

export default function BranchComparisonScreen() {
  const [period, setPeriod] = useState<Period>('this_month');
  const range = useMemo(() => getPeriodRange(period), [period]);

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['branch-comparison', range.startDate, range.endDate],
    queryFn: () => branchesApi.getComparison(range.startDate, range.endDate),
  });

  const branches = data?.branches ?? [];
  const maxRevenue = Math.max(0, ...branches.map((b) => b.totals.revenue));
  const totalRevenue = branches.reduce((sum, b) => sum + b.totals.revenue, 0);
  const totalInvoices = branches.reduce((sum, b) => sum + b.totals.invoices, 0);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching && !isLoading}
          onRefresh={() => void refetch()}
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
          <View style={styles.summaryRow}>
            <Card style={styles.summaryCard} mode="contained">
              <Card.Content style={styles.summaryContent}>
                <Text style={styles.summaryLabel}>Total Revenue</Text>
                <Text style={styles.summaryValue}>
                  {formatCurrency(totalRevenue)}
                </Text>
              </Card.Content>
            </Card>
            <Card style={styles.summaryCard} mode="contained">
              <Card.Content style={styles.summaryContent}>
                <Text style={styles.summaryLabel}>Total Orders</Text>
                <Text style={styles.summaryValue}>{totalInvoices}</Text>
              </Card.Content>
            </Card>
          </View>

          <Text style={styles.sectionTitle}>Branches by Revenue</Text>
          <Card style={styles.listCard} mode="contained">
            <Card.Content style={styles.listContent}>
              {branches.length > 0 ? (
                branches.map((entry, i) => (
                  <BranchRow
                    key={entry.branchId}
                    entry={entry}
                    rank={i + 1}
                    maxRevenue={maxRevenue}
                  />
                ))
              ) : (
                <Text style={styles.emptyText}>No active branches found.</Text>
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
  },
  segmented: {
    marginBottom: 16,
  },
  loader: {
    marginTop: 60,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  summaryCard: {
    flex: 1,
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
  listCard: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
  },
  listContent: {
    paddingVertical: 4,
  },
  row: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0eef7',
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rank: {
    fontSize: 13,
    fontWeight: '700',
    color: brand.textMuted,
    width: 24,
  },
  branchName: {
    fontSize: 14,
    fontWeight: '700',
    color: brand.textDark,
  },
  branchCode: {
    fontSize: 11,
    color: brand.textMuted,
  },
  revenue: {
    fontSize: 14,
    fontWeight: '700',
    color: brand.gradientEnd,
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f0eef7',
    marginTop: 8,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
  rowSub: {
    fontSize: 11.5,
    color: brand.textMuted,
    marginTop: 6,
  },
  emptyText: {
    fontSize: 13,
    color: brand.textMuted,
    paddingVertical: 8,
  },
});
