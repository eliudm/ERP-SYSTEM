import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import {
  Text,
  Card,
  ActivityIndicator,
  Chip,
  SegmentedButtons,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import {
  accountingApi,
  AgedBucket,
  AgedReceivableRow,
  AgedPayableRow,
} from '../api/accounting.api';
import { getPeriodRange, Period, PERIOD_BUTTONS } from '../utils/periodRange';
import { brand } from '../theme';

type ReportType = 'receivables' | 'payables' | 'cashflow' | 'balance' | 'vat';

const REPORT_TYPES: { value: ReportType; label: string; icon: string }[] = [
  { value: 'receivables', label: 'Receivables', icon: 'cash-plus' },
  { value: 'payables', label: 'Payables', icon: 'cash-minus' },
  { value: 'cashflow', label: 'Cash Flow', icon: 'swap-horizontal' },
  { value: 'balance', label: 'Balance Sheet', icon: 'scale-balance' },
  { value: 'vat', label: 'VAT Return', icon: 'file-percent-outline' },
];

// Receivables/Payables and the Balance Sheet are point-in-time snapshots —
// only Cash Flow and VAT Return need a date range.
const NEEDS_PERIOD: ReportType[] = ['cashflow', 'vat'];

const formatCurrency = (value: number) =>
  `KES ${value.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-KE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

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

const AGING_LABELS: { key: keyof AgedBucket; label: string }[] = [
  { key: 'current', label: 'Current' },
  { key: 'days30', label: '1-30 days' },
  { key: 'days60', label: '31-60 days' },
  { key: 'days90', label: '61-90 days' },
  { key: 'over90', label: '90+ days' },
];

const AgingSummary: React.FC<{ summary: AgedBucket; total: number }> = ({
  summary,
  total,
}) => (
  <>
    <View style={styles.summaryGrid}>
      <SummaryCard
        label="Total Outstanding"
        value={formatCurrency(total)}
        tone="negative"
      />
      {AGING_LABELS.slice(0, 1).map((b) => (
        <SummaryCard
          key={b.key}
          label={b.label}
          value={formatCurrency(summary[b.key])}
          tone="positive"
        />
      ))}
    </View>
    <View style={styles.summaryGrid}>
      {AGING_LABELS.slice(1).map((b) => (
        <SummaryCard
          key={b.key}
          label={b.label}
          value={formatCurrency(summary[b.key])}
          tone={b.key === 'over90' ? 'negative' : 'neutral'}
        />
      ))}
    </View>
  </>
);

const ReceivablesReport: React.FC = () => {
  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['aged-receivables'],
    queryFn: () => accountingApi.getAgedReceivables(),
  });

  if (isLoading)
    return (
      <ActivityIndicator
        size="large"
        color={brand.gradientEnd}
        style={styles.loader}
      />
    );

  return (
    <ScrollView
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
        />
      }
    >
      <AgingSummary summary={data!.summary} total={data!.totalOutstanding} />
      <Text style={styles.sectionTitle}>Outstanding Invoices</Text>
      <Card style={styles.listCard} mode="contained">
        <Card.Content style={styles.listContent}>
          {data!.rows.length > 0 ? (
            data!.rows.map((row: AgedReceivableRow) => (
              <View key={row.invoiceNo} style={styles.rowItem}>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {row.customer}
                  </Text>
                  <Text style={styles.rowSub}>
                    {row.invoiceNo} · Due {formatDate(row.dueDate)}
                  </Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.rowValue}>
                    {formatCurrency(row.outstanding)}
                  </Text>
                  {row.daysOverdue > 0 && (
                    <Chip
                      compact
                      style={styles.overdueChip}
                      textStyle={styles.overdueChipText}
                    >
                      {row.daysOverdue}d overdue
                    </Chip>
                  )}
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No outstanding invoices.</Text>
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const PayablesReport: React.FC = () => {
  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['aged-payables'],
    queryFn: () => accountingApi.getAgedPayables(),
  });

  if (isLoading)
    return (
      <ActivityIndicator
        size="large"
        color={brand.gradientEnd}
        style={styles.loader}
      />
    );

  return (
    <ScrollView
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
        />
      }
    >
      <AgingSummary summary={data!.summary} total={data!.totalOutstanding} />
      <Text style={styles.sectionTitle}>Outstanding Bills</Text>
      <Card style={styles.listCard} mode="contained">
        <Card.Content style={styles.listContent}>
          {data!.rows.length > 0 ? (
            data!.rows.map((row: AgedPayableRow) => (
              <View key={row.billNumber} style={styles.rowItem}>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {row.supplier}
                  </Text>
                  <Text style={styles.rowSub}>
                    {row.billNumber} · Due {formatDate(row.dueDate)}
                  </Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.rowValue}>
                    {formatCurrency(row.outstanding)}
                  </Text>
                  {row.daysOverdue > 0 && (
                    <Chip
                      compact
                      style={styles.overdueChip}
                      textStyle={styles.overdueChipText}
                    >
                      {row.daysOverdue}d overdue
                    </Chip>
                  )}
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No outstanding bills.</Text>
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const CashFlowReport: React.FC<{
  range: { startDate: string; endDate: string };
}> = ({ range }) => {
  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['cash-flow', range.startDate, range.endDate],
    queryFn: () => accountingApi.getCashFlow(range.startDate, range.endDate),
  });

  if (isLoading)
    return (
      <ActivityIndicator
        size="large"
        color={brand.gradientEnd}
        style={styles.loader}
      />
    );

  const netPositive = data!.netChange >= 0;

  return (
    <ScrollView
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
        />
      }
    >
      <View style={styles.summaryGrid}>
        <SummaryCard
          label="Net Change"
          value={formatCurrency(data!.netChange)}
          tone={netPositive ? 'positive' : 'negative'}
        />
        <SummaryCard
          label="Operating"
          value={formatCurrency(data!.operating.total)}
        />
      </View>
      <View style={styles.summaryGrid}>
        <SummaryCard
          label="Investing"
          value={formatCurrency(data!.investing.total)}
        />
        <SummaryCard
          label="Financing"
          value={formatCurrency(data!.financing.total)}
        />
      </View>
    </ScrollView>
  );
};

const BalanceSheetReport: React.FC = () => {
  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['balance-sheet'],
    queryFn: () => accountingApi.getBalanceSheet(),
  });

  if (isLoading)
    return (
      <ActivityIndicator
        size="large"
        color={brand.gradientEnd}
        style={styles.loader}
      />
    );

  return (
    <ScrollView
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
        />
      }
    >
      <Text style={styles.asOfText}>As of {formatDate(data!.asOf)}</Text>
      <View style={styles.summaryGrid}>
        <SummaryCard
          label="Assets"
          value={formatCurrency(data!.assets.total)}
          tone="positive"
        />
        <SummaryCard
          label="Liabilities"
          value={formatCurrency(data!.liabilities.total)}
          tone="negative"
        />
      </View>
      <View style={styles.summaryGrid}>
        <SummaryCard
          label="Equity"
          value={formatCurrency(data!.equity.total)}
        />
        <SummaryCard
          label="Balanced?"
          value={data!.isBalanced ? 'Yes' : 'No'}
          tone={data!.isBalanced ? 'positive' : 'negative'}
        />
      </View>

      {(
        [
          ['Assets', data!.assets.accounts],
          ['Liabilities', data!.liabilities.accounts],
          ['Equity', data!.equity.accounts],
        ] as const
      ).map(([title, accounts]) => (
        <React.Fragment key={title}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Card style={styles.listCard} mode="contained">
            <Card.Content style={styles.listContent}>
              {accounts.length > 0 ? (
                accounts.map((acc) => (
                  <View key={acc.code} style={styles.rowItem}>
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowName}>{acc.name}</Text>
                      <Text style={styles.rowSub}>{acc.code}</Text>
                    </View>
                    <Text style={styles.rowValue}>
                      {formatCurrency(acc.balance)}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>
                  No {title.toLowerCase()} recorded.
                </Text>
              )}
            </Card.Content>
          </Card>
        </React.Fragment>
      ))}
    </ScrollView>
  );
};

const VatReturnReport: React.FC<{
  range: { startDate: string; endDate: string };
}> = ({ range }) => {
  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['vat-return', range.startDate, range.endDate],
    queryFn: () => accountingApi.getVatReturn(range.startDate, range.endDate),
  });

  if (isLoading)
    return (
      <ActivityIndicator
        size="large"
        color={brand.gradientEnd}
        style={styles.loader}
      />
    );

  const payable = data!.vatPayable;

  return (
    <ScrollView
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
        />
      }
    >
      <View style={styles.summaryGrid}>
        <SummaryCard
          label={payable >= 0 ? 'VAT Payable' : 'VAT Refundable'}
          value={formatCurrency(Math.abs(payable))}
          tone={payable >= 0 ? 'negative' : 'positive'}
        />
        <SummaryCard
          label="Output VAT"
          value={formatCurrency(data!.outputVat.vatAmount)}
        />
      </View>
      <View style={styles.summaryGrid}>
        <SummaryCard
          label="Input VAT"
          value={formatCurrency(data!.inputVat.vatAmount)}
        />
        <SummaryCard
          label="Invoices / Bills"
          value={`${data!.outputVat.invoiceCount} / ${data!.inputVat.billCount}`}
        />
      </View>
      <Text style={styles.sectionTitle}>Breakdown</Text>
      <Card style={styles.listCard} mode="contained">
        <Card.Content style={styles.listContent}>
          <View style={styles.rowItem}>
            <Text style={styles.rowName}>Taxable Supplies (Sales)</Text>
            <Text style={styles.rowValue}>
              {formatCurrency(data!.outputVat.taxableSupplies)}
            </Text>
          </View>
          <View style={styles.rowItem}>
            <Text style={styles.rowName}>Taxable Purchases</Text>
            <Text style={styles.rowValue}>
              {formatCurrency(data!.inputVat.taxablePurchases)}
            </Text>
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

export default function AccountingReportsScreen() {
  const [reportType, setReportType] = useState<ReportType>('receivables');
  const [period, setPeriod] = useState<Period>('this_month');
  const range = useMemo(() => getPeriodRange(period), [period]);

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.typeRow}
        contentContainerStyle={styles.typeContent}
      >
        {REPORT_TYPES.map((rt) => (
          <Chip
            key={rt.value}
            selected={reportType === rt.value}
            onPress={() => setReportType(rt.value)}
            style={styles.typeChip}
            mode={reportType === rt.value ? 'flat' : 'outlined'}
            textStyle={
              reportType === rt.value ? styles.typeChipTextSelected : undefined
            }
            icon={() => (
              <MaterialCommunityIcons
                name={rt.icon as never}
                size={16}
                color={reportType === rt.value ? '#ffffff' : brand.textMuted}
              />
            )}
            compact
          >
            {rt.label}
          </Chip>
        ))}
      </ScrollView>

      {NEEDS_PERIOD.includes(reportType) && (
        <SegmentedButtons
          value={period}
          onValueChange={(v) => setPeriod(v)}
          buttons={[...PERIOD_BUTTONS]}
          style={styles.segmented}
        />
      )}

      <View style={styles.content}>
        {reportType === 'receivables' && <ReceivablesReport />}
        {reportType === 'payables' && <PayablesReport />}
        {reportType === 'cashflow' && <CashFlowReport range={range} />}
        {reportType === 'balance' && <BalanceSheetReport />}
        {reportType === 'vat' && <VatReturnReport range={range} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f5ef',
  },
  typeRow: {
    flexGrow: 0,
    maxHeight: 48,
  },
  typeContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  typeChip: {
    marginRight: 0,
  },
  typeChipTextSelected: {
    color: '#ffffff',
  },
  segmented: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loader: {
    marginTop: 60,
  },
  asOfText: {
    fontSize: 12,
    color: brand.textMuted,
    marginBottom: 8,
  },
  summaryGrid: {
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
    fontSize: 11,
    color: brand.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    fontWeight: '700',
  },
  summaryValue: {
    fontSize: 17,
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
    marginBottom: 16,
  },
  listContent: {
    paddingVertical: 4,
  },
  rowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0eef7',
  },
  rowInfo: {
    flex: 1,
    marginRight: 8,
  },
  rowName: {
    fontSize: 13.5,
    fontWeight: '600',
    color: brand.textDark,
  },
  rowSub: {
    fontSize: 11.5,
    color: brand.textMuted,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  rowValue: {
    fontSize: 13,
    fontWeight: '700',
    color: brand.textDark,
  },
  overdueChip: {
    backgroundColor: '#fde3dc',
    height: 22,
  },
  overdueChipText: {
    color: '#d4380d',
    fontSize: 10,
    lineHeight: 12,
    marginVertical: 0,
  },
  emptyText: {
    fontSize: 13,
    color: brand.textMuted,
    paddingVertical: 8,
  },
});
