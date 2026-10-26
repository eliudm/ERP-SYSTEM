import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  Text,
  Card,
  ActivityIndicator,
  Button,
  Snackbar,
  Divider,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  etimsApi,
  EtimsFailedSubmission,
  EtimsQueueStatus,
  EtimsStats,
} from '../../api/etims.api';
import { useSession } from '../../providers/SessionProvider';
import { brand } from '../../theme';

const STATS_QUERY_KEY = ['etims-stats'];
const FAILED_QUERY_KEY = ['etims-failed'];
const QUEUE_QUERY_KEY = ['etims-queue-status'];

const SUCCESS_GREEN = '#2E8B57';
const FAILED_RED = '#d4380d';
const PENDING_AMBER = '#ad7a14';

const formatCurrency = (value: number) =>
  `KES ${value.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (value: string) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-KE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const extractErrorMessage = (err: unknown, fallback: string): string => {
  const message =
    (err as any)?.response?.data?.message ?? (err as any)?.message ?? fallback;
  return Array.isArray(message) ? message.join(', ') : message;
};

interface StatTileProps {
  label: string;
  value: string;
  color?: string;
}

const StatTile: React.FC<StatTileProps> = ({ label, value, color }) => (
  <Card style={styles.statCard} mode="contained">
    <Card.Content>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
    </Card.Content>
  </Card>
);

interface QueueTileProps {
  label: string;
  value: number;
  color?: string;
}

const QueueTile: React.FC<QueueTileProps> = ({ label, value, color }) => (
  <View style={styles.queueTile}>
    <Text style={[styles.queueValue, color ? { color } : null]}>{value}</Text>
    <Text style={styles.queueLabel}>{label}</Text>
  </View>
);

const FailedSubmissionRow: React.FC<{
  submission: EtimsFailedSubmission;
  onRetry: (invoiceId: string) => void;
  retrying: boolean;
}> = ({ submission, onRetry, retrying }) => {
  const latestError = submission.submissionLogs?.[0]?.errorMessage;
  return (
    <Card style={styles.card} mode="contained">
      <Card.Content>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.invoiceNo}>{submission.invoice.invoiceNo}</Text>
            <Text style={styles.customerName} numberOfLines={1}>
              {submission.invoice.customer?.name ?? 'Walk-in Customer'}
            </Text>
          </View>
          <View style={styles.cardHeaderRight}>
            <Text style={styles.total}>
              {formatCurrency(submission.invoice.total)}
            </Text>
            <Text style={styles.retryCount}>
              Retries: {submission.retryCount}
            </Text>
          </View>
        </View>

        {!!latestError && (
          <View style={styles.errorBox}>
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={14}
              color={FAILED_RED}
            />
            <Text style={styles.errorText} numberOfLines={3}>
              {latestError}
            </Text>
          </View>
        )}

        <View style={styles.cardFooterRow}>
          <Text style={styles.updatedAt}>
            Updated {formatDate(submission.updatedAt)}
          </Text>
          <Button
            mode="outlined"
            compact
            loading={retrying}
            disabled={retrying}
            onPress={() => onRetry(submission.invoiceId)}
            style={styles.retryButton}
          >
            Retry
          </Button>
        </View>
      </Card.Content>
    </Card>
  );
};

export default function EtimsScreen() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'ADMIN';
  const canView = isAdmin || user?.role === 'ACCOUNTANT';

  const [snackbar, setSnackbar] = useState<{
    visible: boolean;
    message: string;
    isError?: boolean;
  }>({ visible: false, message: '' });
  const [retryingInvoiceId, setRetryingInvoiceId] = useState<string | null>(
    null,
  );

  const showSnackbar = (message: string, isError = false) =>
    setSnackbar({ visible: true, message, isError });

  const statsQuery = useQuery<EtimsStats>({
    queryKey: STATS_QUERY_KEY,
    queryFn: () => etimsApi.getStats(),
    refetchInterval: 30_000,
    enabled: canView,
  });

  const failedQuery = useQuery<EtimsFailedSubmission[]>({
    queryKey: FAILED_QUERY_KEY,
    queryFn: () => etimsApi.getFailedSubmissions(),
    refetchInterval: 30_000,
    enabled: canView,
  });

  const queueQuery = useQuery<EtimsQueueStatus>({
    queryKey: QUEUE_QUERY_KEY,
    queryFn: () => etimsApi.getQueueStatus(),
    refetchInterval: 30_000,
    enabled: canView && isAdmin,
  });

  const retryMutation = useMutation({
    mutationFn: (invoiceId: string) => {
      setRetryingInvoiceId(invoiceId);
      return etimsApi.retry(invoiceId);
    },
    onSuccess: () => {
      showSnackbar('Submission queued for retry.');
      void queryClient.invalidateQueries({ queryKey: FAILED_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: STATS_QUERY_KEY });
    },
    onError: (err) => {
      showSnackbar(
        extractErrorMessage(err, 'Failed to retry submission.'),
        true,
      );
    },
    onSettled: () => setRetryingInvoiceId(null),
  });

  const retryAllMutation = useMutation({
    mutationFn: () => etimsApi.retryAllFailed(),
    onSuccess: (result) => {
      const count =
        result && typeof result === 'object'
          ? ((result as any).count ?? (result as any).retried ?? null)
          : null;
      showSnackbar(
        typeof count === 'number'
          ? `Retried ${count} failed submission${count === 1 ? '' : 's'}.`
          : 'All failed submissions have been queued for retry.',
      );
      void queryClient.invalidateQueries({ queryKey: FAILED_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: STATS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: QUEUE_QUERY_KEY });
    },
    onError: (err) => {
      showSnackbar(
        extractErrorMessage(err, 'Failed to retry all submissions.'),
        true,
      );
    },
  });

  const confirmRetryAll = () => {
    const failedCount = failedQuery.data?.length ?? 0;
    Alert.alert(
      'Retry all failed submissions?',
      `This will re-queue ${failedCount} failed eTIMS submission${failedCount === 1 ? '' : 's'} for resubmission to KRA.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Retry all',
          style: 'default',
          onPress: () => retryAllMutation.mutate(),
        },
      ],
    );
  };

  if (!canView) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons
          name="shield-lock-outline"
          size={40}
          color={brand.textMuted}
        />
        <Text style={styles.restrictedText}>
          eTIMS monitoring is only available to admins and accountants.
        </Text>
      </View>
    );
  }

  const failed = failedQuery.data ?? [];
  const isRefreshing =
    statsQuery.isRefetching ||
    failedQuery.isRefetching ||
    (isAdmin && queueQuery.isRefetching);

  const onRefresh = () => {
    void statsQuery.refetch();
    void failedQuery.refetch();
    if (isAdmin) void queueQuery.refetch();
  };

  const stats = statsQuery.data;

  return (
    <View style={styles.container}>
      <FlatList
        data={failed}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          <View>
            <Text style={styles.heading}>Submission stats</Text>
            {statsQuery.isLoading ? (
              <ActivityIndicator
                size="small"
                color={brand.gradientEnd}
                style={styles.sectionLoader}
              />
            ) : statsQuery.isError ? (
              <Text style={styles.errorBanner}>
                {extractErrorMessage(statsQuery.error, 'Failed to load stats.')}
              </Text>
            ) : (
              <>
                <View style={styles.statsGrid}>
                  <StatTile label="Total" value={String(stats?.total ?? 0)} />
                  <StatTile
                    label="Success"
                    value={String(stats?.success ?? 0)}
                    color={SUCCESS_GREEN}
                  />
                </View>
                <View style={styles.statsGrid}>
                  <StatTile
                    label="Failed"
                    value={String(stats?.failed ?? 0)}
                    color={FAILED_RED}
                  />
                  <StatTile
                    label="Pending"
                    value={String(stats?.pending ?? 0)}
                    color={PENDING_AMBER}
                  />
                </View>
                <Card style={styles.successRateCard} mode="contained">
                  <Card.Content style={styles.successRateContent}>
                    <Text style={styles.successRateLabel}>Success rate</Text>
                    <Text style={styles.successRateValue}>
                      {stats?.successRate ?? '—'}
                    </Text>
                  </Card.Content>
                </Card>
              </>
            )}

            {isAdmin && (
              <>
                <Text style={styles.heading}>Queue status</Text>
                {queueQuery.isLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={brand.gradientEnd}
                    style={styles.sectionLoader}
                  />
                ) : queueQuery.isError ? (
                  <Text style={styles.errorBanner}>
                    {extractErrorMessage(
                      queueQuery.error,
                      'Failed to load queue status.',
                    )}
                  </Text>
                ) : (
                  <Card style={styles.queueCard} mode="contained">
                    <Card.Content style={styles.queueContent}>
                      <QueueTile
                        label="Waiting"
                        value={queueQuery.data?.waiting ?? 0}
                      />
                      <QueueTile
                        label="Active"
                        value={queueQuery.data?.active ?? 0}
                        color={brand.gradientEnd}
                      />
                      <QueueTile
                        label="Completed"
                        value={queueQuery.data?.completed ?? 0}
                        color={SUCCESS_GREEN}
                      />
                      <QueueTile
                        label="Failed"
                        value={queueQuery.data?.failed ?? 0}
                        color={FAILED_RED}
                      />
                      <QueueTile
                        label="Delayed"
                        value={queueQuery.data?.delayed ?? 0}
                        color={PENDING_AMBER}
                      />
                    </Card.Content>
                  </Card>
                )}

                <Button
                  mode="contained"
                  onPress={confirmRetryAll}
                  loading={retryAllMutation.isPending}
                  disabled={retryAllMutation.isPending || failed.length === 0}
                  style={styles.retryAllButton}
                  buttonColor={brand.gradientStart}
                >
                  Retry all failed ({failed.length})
                </Button>
              </>
            )}

            <Divider style={styles.divider} />
            <Text style={styles.heading}>
              Failed submissions {failed.length > 0 ? `(${failed.length})` : ''}
            </Text>

            {failedQuery.isLoading && (
              <ActivityIndicator
                size="small"
                color={brand.gradientEnd}
                style={styles.sectionLoader}
              />
            )}
            {failedQuery.isError && (
              <Text style={styles.errorBanner}>
                {extractErrorMessage(
                  failedQuery.error,
                  'Failed to load failed submissions.',
                )}
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <FailedSubmissionRow
            submission={item}
            onRetry={(invoiceId) => retryMutation.mutate(invoiceId)}
            retrying={
              retryMutation.isPending && retryingInvoiceId === item.invoiceId
            }
          />
        )}
        ListEmptyComponent={
          !failedQuery.isLoading && !failedQuery.isError ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons
                name="check-circle-outline"
                size={40}
                color={SUCCESS_GREEN}
              />
              <Text style={styles.emptyTitle}>
                All invoices submitted successfully
              </Text>
              <Text style={styles.emptySubtitle}>
                No failed eTIMS submissions right now.
              </Text>
            </View>
          ) : undefined
        }
      />

      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar((s) => ({ ...s, visible: false }))}
        duration={4000}
        style={snackbar.isError ? styles.snackbarError : styles.snackbarSuccess}
      >
        {snackbar.message}
      </Snackbar>
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
    padding: 24,
    gap: 12,
  },
  restrictedText: {
    fontSize: 14,
    color: brand.textMuted,
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
    paddingTop: 12,
    gap: 10,
  },
  heading: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: brand.textMuted,
    marginTop: 14,
    marginBottom: 8,
  },
  sectionLoader: {
    marginVertical: 12,
  },
  errorBanner: {
    color: FAILED_RED,
    fontSize: 13,
    marginBottom: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
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
    fontSize: 22,
    fontWeight: '700',
    color: brand.textDark,
  },
  successRateCard: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
  },
  successRateContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  successRateLabel: {
    fontSize: 13,
    color: brand.textMuted,
    fontWeight: '600',
  },
  successRateValue: {
    fontSize: 18,
    fontWeight: '700',
    color: brand.gradientEnd,
  },
  queueCard: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
  },
  queueContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  queueTile: {
    minWidth: 64,
    alignItems: 'center',
    gap: 2,
  },
  queueValue: {
    fontSize: 18,
    fontWeight: '700',
    color: brand.textDark,
  },
  queueLabel: {
    fontSize: 11,
    color: brand.textMuted,
  },
  retryAllButton: {
    marginTop: 12,
    borderRadius: 12,
  },
  divider: {
    marginTop: 16,
  },
  card: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardHeaderLeft: {
    flex: 1,
    gap: 2,
  },
  cardHeaderRight: {
    alignItems: 'flex-end',
    gap: 2,
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
  total: {
    fontSize: 15,
    fontWeight: '700',
    color: brand.textDark,
  },
  retryCount: {
    fontSize: 11,
    color: PENDING_AMBER,
    fontWeight: '600',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#fde1dc',
    borderRadius: 10,
    padding: 8,
    marginTop: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: FAILED_RED,
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  updatedAt: {
    fontSize: 11,
    color: brand.textMuted,
  },
  retryButton: {
    borderColor: brand.gradientEnd,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 32,
    paddingHorizontal: 24,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: brand.textDark,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: brand.textMuted,
    textAlign: 'center',
  },
  snackbarError: {
    backgroundColor: FAILED_RED,
  },
  snackbarSuccess: {
    backgroundColor: SUCCESS_GREEN,
  },
});
