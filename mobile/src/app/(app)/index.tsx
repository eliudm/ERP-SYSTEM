import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
} from 'react-native';
import { Text, Card, ActivityIndicator, Badge } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { mobileApi } from '../../api/mobile.api';
import { brand } from '../../theme';

const formatCurrency = (value: number) =>
  `KES ${value.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

interface StatProps {
  label: string;
  value: string;
  tone?: 'default' | 'warning' | 'danger';
  icon?: string;
  onPress?: () => void;
}

const Stat: React.FC<StatProps> = ({ label, value, tone = 'default', icon, onPress }) => (
  <Pressable
    style={({ pressed }) => [styles.statCardWrap, pressed && onPress && { opacity: 0.75 }]}
    onPress={onPress}
    disabled={!onPress}
  >
    <Card style={styles.statCard} mode="contained">
      <Card.Content style={styles.statContent}>
        <View style={styles.statTop}>
          <Text style={styles.statLabel}>{label}</Text>
          {onPress && (
            <MaterialCommunityIcons name="chevron-right" size={16} color={brand.textMuted} />
          )}
        </View>
        <Text
          style={[
            styles.statValue,
            tone === 'warning' && { color: '#ad7a14' },
            tone === 'danger' && { color: '#d4380d' },
          ]}
        >
          {value}
        </Text>
        {icon && (
          <MaterialCommunityIcons
            name={icon as never}
            size={18}
            color={
              tone === 'warning' ? '#ad7a14' : tone === 'danger' ? '#d4380d' : brand.gradientEnd
            }
            style={styles.statIcon}
          />
        )}
      </Card.Content>
    </Card>
  </Pressable>
);

export default function DashboardScreen() {
  const { t } = useTranslation('dashboard');
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
      <Text style={styles.heading}>{t('today')}</Text>
      <View style={styles.grid}>
        <Stat
          label={t('salesToday')}
          value={formatCurrency(data?.salesToday.amount ?? 0)}
          icon="cash-multiple"
          onPress={() => router.push('/sales?filter=today')}
        />
        <Stat
          label={t('invoicesToday')}
          value={String(data?.salesToday.count ?? 0)}
          icon="receipt"
          onPress={() => router.push('/sales?filter=today')}
        />
      </View>

      <Text style={styles.heading}>{t('thisMonth')}</Text>
      <View style={styles.grid}>
        <Stat
          label={t('salesThisMonth')}
          value={formatCurrency(data?.salesThisMonth ?? 0)}
          icon="chart-line"
          onPress={() => router.push('/sales?filter=month')}
        />
        <Stat
          label={t('pendingInvoices')}
          value={String(data?.pendingInvoices ?? 0)}
          tone={data?.pendingInvoices ? 'warning' : 'default'}
          icon="clock-outline"
          onPress={() => router.push('/sales?filter=all&status=APPROVED')}
        />
      </View>

      <Text style={styles.heading}>{t('needsAttention')}</Text>
      <View style={styles.grid}>
        <Stat
          label={t('pendingApprovals')}
          value={String(data?.pendingApprovals ?? 0)}
          tone={data?.pendingApprovals ? 'warning' : 'default'}
          icon="file-clock-outline"
          onPress={() => router.push('/sales?filter=all&status=DRAFT')}
        />
        <Stat
          label={t('lowStockItems')}
          value={String(data?.lowStockCount ?? 0)}
          tone={data?.lowStockCount ? 'danger' : 'default'}
          icon="package-variant-remove"
          onPress={() => router.push('/notifications')}
        />
      </View>

      {!!data?.unreadNotifications && (
        <Pressable onPress={() => router.push('/notifications')}>
          <Card style={styles.noticeCard} mode="contained">
            <Card.Content style={styles.noticeContent}>
              <Badge style={styles.badge}>{data.unreadNotifications}</Badge>
              <Text style={styles.noticeText}>{t('unreadNotifications')}</Text>
              <MaterialCommunityIcons name="chevron-right" size={18} color={brand.textDark} />
            </Card.Content>
          </Card>
        </Pressable>
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
  statCardWrap: {
    flex: 1,
  },
  statCard: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
  },
  statContent: {
    gap: 4,
  },
  statTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statLabel: {
    fontSize: 12,
    color: brand.textMuted,
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: brand.textDark,
  },
  statIcon: {
    marginTop: 4,
    opacity: 0.6,
  },
  noticeCard: {
    marginTop: 8,
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
    flex: 1,
  },
});
