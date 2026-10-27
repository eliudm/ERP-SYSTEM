import React from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, Card, ActivityIndicator, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import {
  aiInsightsApi,
  Insight,
  InsightSeverity,
} from '../../api/ai-insights.api';
import { brand } from '../../theme';

const SEVERITY_ORDER: InsightSeverity[] = ['critical', 'warning', 'info'];

const SEVERITY_STYLE: Record<
  InsightSeverity,
  { bg: string; fg: string; icon: string; label: string }
> = {
  critical: {
    bg: '#fde3dc',
    fg: '#d4380d',
    icon: 'alert-circle',
    label: 'Critical',
  },
  warning: { bg: '#fbf1de', fg: '#ad7a14', icon: 'alert', label: 'Warning' },
  info: { bg: '#e0eaff', fg: '#2452c7', icon: 'information', label: 'Info' },
};

const TYPE_LABELS: Record<string, string> = {
  STOCK_ALERT: 'Stock',
  SALES_TREND: 'Sales',
  TOP_PRODUCTS: 'Products',
  PAYMENT_RISK: 'Payments',
  TOP_CUSTOMERS: 'Customers',
  DORMANT_CUSTOMERS: 'Customers',
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

const InsightCard: React.FC<{ insight: Insight }> = ({ insight }) => {
  const style = SEVERITY_STYLE[insight.severity] ?? SEVERITY_STYLE.info;
  return (
    <Card style={[styles.card, { backgroundColor: style.bg }]} mode="contained">
      <Card.Content>
        <View style={styles.cardHeader}>
          <View style={styles.severityRow}>
            <MaterialCommunityIcons
              name={style.icon as never}
              size={16}
              color={style.fg}
            />
            <Text style={[styles.severityLabel, { color: style.fg }]}>
              {style.label}
            </Text>
          </View>
          {TYPE_LABELS[insight.type] && (
            <Chip
              compact
              style={styles.typeChip}
              textStyle={styles.typeChipText}
            >
              {TYPE_LABELS[insight.type]}
            </Chip>
          )}
        </View>
        <Text style={styles.title}>{insight.title}</Text>
        <Text style={styles.message}>{insight.message}</Text>
        {insight.entity?.code && (
          <Text style={styles.ref}>Ref: {insight.entity.code}</Text>
        )}
      </Card.Content>
    </Card>
  );
};

export default function AiInsightsScreen() {
  const { data, isLoading, isRefetching, refetch, isError } = useQuery({
    queryKey: ['ai-insights'],
    queryFn: () => aiInsightsApi.getInsights(),
  });

  const sorted = [...(data?.insights ?? [])].sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={brand.gradientEnd} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {data?.generatedAt && (
        <Text style={styles.generatedAt}>
          Generated {formatDateTime(data.generatedAt)}
        </Text>
      )}
      <FlatList
        data={sorted}
        keyExtractor={(item, i) => `${item.type}-${i}`}
        contentContainerStyle={styles.content}
        renderItem={({ item }) => <InsightCard insight={item} />}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <MaterialCommunityIcons
              name={isError ? 'alert-circle-outline' : 'lightbulb-on-outline'}
              size={36}
              color={brand.textMuted}
            />
            <Text style={styles.emptyTitle}>
              {isError
                ? 'Could not load insights'
                : 'Nothing to flag right now'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {isError
                ? 'Pull down to try again.'
                : 'Everything looks healthy — check back later.'}
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
  generatedAt: {
    fontSize: 11.5,
    color: brand.textMuted,
    textAlign: 'center',
    paddingTop: 10,
  },
  content: {
    padding: 16,
    gap: 10,
  },
  card: {
    borderRadius: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  severityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  severityLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  typeChip: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    height: 24,
  },
  typeChipText: {
    fontSize: 10.5,
    marginVertical: 0,
  },
  title: {
    fontSize: 14.5,
    fontWeight: '700',
    color: brand.textDark,
    marginBottom: 2,
  },
  message: {
    fontSize: 12.5,
    color: brand.textMuted,
    lineHeight: 18,
  },
  ref: {
    fontSize: 11,
    color: brand.textMuted,
    marginTop: 6,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 72,
    paddingHorizontal: 24,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: brand.textDark,
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: brand.textMuted,
    textAlign: 'center',
  },
});
