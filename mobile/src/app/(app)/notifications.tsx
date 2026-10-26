import React from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  ListRenderItem,
} from 'react-native';
import { Text, ActivityIndicator, Button } from 'react-native-paper';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi, Notification } from '../../api/notifications.api';
import { brand } from '../../theme';

const TYPE_META: Record<
  Notification['type'],
  { label: string; color: string; bg: string }
> = {
  LOW_STOCK: { label: 'Low stock', color: '#ad7a14', bg: '#fff3e0' },
  OUT_OF_STOCK: { label: 'Out of stock', color: '#d4380d', bg: '#fde3df' },
  SYSTEM: { label: 'System', color: '#1d61c9', bg: '#e3edfb' },
};

const formatTimestamp = (iso: string): string => {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
};

export default function NotificationsScreen() {
  const queryClient = useQueryClient();

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.getAll(1, 50),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const notifications = data?.data ?? [];
  const unreadCount = notifications.filter((item) => !item.isRead).length;

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={brand.gradientEnd} />
      </View>
    );
  }

  const renderItem: ListRenderItem<Notification> = ({ item }) => {
    const meta = TYPE_META[item.type];
    const isMarkingThis =
      markReadMutation.isPending && markReadMutation.variables === item.id;

    return (
      <Pressable
        onPress={() => {
          if (!item.isRead) {
            markReadMutation.mutate(item.id);
          }
        }}
        disabled={item.isRead || isMarkingThis}
        style={({ pressed }) => [
          styles.row,
          !item.isRead && styles.rowUnread,
          pressed && styles.rowPressed,
        ]}
      >
        <View style={styles.rowTop}>
          <View style={[styles.typeChip, { backgroundColor: meta.bg }]}>
            <Text style={[styles.typeChipText, { color: meta.color }]}>
              {meta.label}
            </Text>
          </View>
          {!item.isRead && <View style={styles.unreadDot} />}
        </View>
        <Text
          style={[
            styles.rowTitle,
            item.isRead ? styles.rowTitleRead : styles.rowTitleUnread,
          ]}
        >
          {item.title}
        </Text>
        <Text style={styles.rowMessage}>{item.message}</Text>
        <Text style={styles.rowTimestamp}>
          {formatTimestamp(item.createdAt)}
        </Text>
      </Pressable>
    );
  };

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={notifications}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => {
            void refetch();
          }}
        />
      }
      ListHeaderComponent={
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Notifications</Text>
            <Text style={styles.headerSubtitle}>
              {unreadCount > 0
                ? `${unreadCount} unread`
                : "You're all caught up"}
            </Text>
          </View>
          <Button
            mode="text"
            compact
            disabled={unreadCount === 0 || markAllReadMutation.isPending}
            loading={markAllReadMutation.isPending}
            onPress={() => markAllReadMutation.mutate()}
          >
            Mark all read
          </Button>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>🔔</Text>
          <Text style={styles.emptyTitle}>You're all caught up</Text>
          <Text style={styles.emptySubtitle}>
            New alerts will show up here.
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f5ef',
  },
  content: {
    padding: 16,
    gap: 10,
    flexGrow: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f5ef',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: brand.textDark,
  },
  headerSubtitle: {
    fontSize: 13,
    color: brand.textMuted,
    marginTop: 2,
  },
  row: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 14,
    gap: 4,
  },
  rowUnread: {
    backgroundColor: '#fbfaff',
    borderWidth: 1,
    borderColor: '#e6e4ff',
  },
  rowPressed: {
    opacity: 0.7,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  typeChipText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: brand.gradientStart,
  },
  rowTitle: {
    fontSize: 15,
    color: brand.textDark,
  },
  rowTitleUnread: {
    fontWeight: '700',
  },
  rowTitleRead: {
    fontWeight: '400',
  },
  rowMessage: {
    fontSize: 13,
    color: brand.textMuted,
  },
  rowTimestamp: {
    fontSize: 12,
    color: brand.textMuted,
    marginTop: 2,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 6,
  },
  emptyEmoji: {
    fontSize: 36,
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: brand.textDark,
  },
  emptySubtitle: {
    fontSize: 13,
    color: brand.textMuted,
  },
});
