import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface OfflineBannerProps {
  isOnline: boolean;
  pendingCount: number;
  onPress: () => void;
}

// Styled like pos.tsx's own register banner (same row shape, amber/red
// tones) so it reads as part of the same "status strip", not a bolted-on
// alert.
export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  isOnline,
  pendingCount,
  onPress,
}) => {
  if (isOnline && pendingCount === 0) return null;

  const label = !isOnline
    ? pendingCount > 0
      ? `Offline · ${pendingCount} sale${pendingCount === 1 ? '' : 's'} queued · Tap to view`
      : 'Offline — cash/card sales will be queued and synced automatically'
    : `Syncing ${pendingCount} queued sale${pendingCount === 1 ? '' : 's'}…`;

  return (
    <Pressable
      style={[styles.banner, !isOnline ? styles.offline : styles.syncing]}
      onPress={onPress}
    >
      <MaterialCommunityIcons
        name={!isOnline ? 'wifi-off' : 'sync'}
        size={16}
        color={!isOnline ? '#d4380d' : '#ad7a14'}
      />
      <Text style={[styles.text, { color: !isOnline ? '#d4380d' : '#ad7a14' }]}>
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  offline: {
    backgroundColor: '#fde3dc',
  },
  syncing: {
    backgroundColor: '#fbf1de',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
});
