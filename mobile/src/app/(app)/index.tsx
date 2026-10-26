import React from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Card, ActivityIndicator, Badge } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { mobileApi } from '../../api/mobile.api';
import { brand } from '../../theme';

const formatCurrency = (value: number) =>
  `KES ${value.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

interface StatProps {
  label: string;
  value: string;
  tone?: 'default' | 'warning' | 'danger';
}

const Stat: React.FC<StatProps> = ({ label, value, tone = 'default' }) => (
  <Card style={styles.statCard} mode="contained">
    <Card.Content>
      <Text style={styles.statLabel}>{label}</Text>
      <Text
        style={[
          styles.statValue,
          tone === 'warning' && { color: '#ad7a14' },
          tone === 'danger' && { color: '#d4380d' },
        ]}
      >
        {value}
      </Text>
    </Card.Content>
  </Card>
);

export default function DashboardScreen() {
  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['mobile-dashboard'],
    queryFn: mobileApi.getDashboard,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={brand.gradientEnd} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => {
            void refetch();
          }}
        />
      }
    >
      <Text style={styles.heading}>Today</Text>
      <View style={styles.grid}>
        <Stat
          label="Sales today"
          value={formatCurrency(data?.salesToday.amount ?? 0)}
        />
        <Stat
          label="Invoices today"
          value={String(data?.salesToday.count ?? 0)}
        />
      </View>

      <Text style={styles.heading}>This month</Text>
      <View style={styles.grid}>
        <Stat
          label="Sales this month"
          value={formatCurrency(data?.salesThisMonth ?? 0)}
        />
        <Stat
          label="Pending invoices"
          value={String(data?.pendingInvoices ?? 0)}
        />
      </View>

      <Text style={styles.heading}>Needs attention</Text>
      <View style={styles.grid}>
        <Stat
          label="Pending approvals"
          value={String(data?.pendingApprovals ?? 0)}
          tone={data?.pendingApprovals ? 'warning' : 'default'}
        />
        <Stat
          label="Low stock items"
          value={String(data?.lowStockCount ?? 0)}
          tone={data?.lowStockCount ? 'danger' : 'default'}
        />
      </View>

      {!!data?.unreadNotifications && (
        <Card style={styles.noticeCard} mode="contained">
          <Card.Content style={styles.noticeContent}>
            <Badge style={styles.badge}>{data.unreadNotifications}</Badge>
            <Text style={styles.noticeText}>unread notifications</Text>
          </Card.Content>
        </Card>
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
    gap: 8,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f5ef',
  },
  heading: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: brand.textMuted,
    marginTop: 12,
    marginBottom: 8,
  },
  grid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#ffffff',
  },
  statLabel: {
    fontSize: 12,
    color: brand.textMuted,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: brand.textDark,
  },
  noticeCard: {
    marginTop: 16,
    borderRadius: 16,
    backgroundColor: '#fff3e0',
  },
  noticeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  badge: {
    backgroundColor: brand.gradientStart,
  },
  noticeText: {
    color: brand.textDark,
    fontWeight: '600',
  },
});
