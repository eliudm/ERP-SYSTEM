import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import {
  Text,
  Card,
  ActivityIndicator,
  Avatar,
  Chip,
  Button,
  Dialog,
  Portal,
  Divider,
  TextInput,
  HelperText,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { authApi } from '../../api/auth.api';
import { mobileApi } from '../../api/mobile.api';
import { useSession } from '../../providers/SessionProvider';
import { brand } from '../../theme';

const formatDateTime = (value: string | null) => {
  if (!value) {
    return 'Never';
  }
  return new Date(value).toLocaleString('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const getInitials = (firstName?: string, lastName?: string) => {
  const first = firstName?.trim()?.[0] ?? '';
  const last = lastName?.trim()?.[0] ?? '';
  const initials = `${first}${last}`.toUpperCase();
  return initials || '?';
};

const formatRole = (role?: string) => {
  if (!role) {
    return '';
  }
  return role
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
};

interface SyncRowProps {
  label: string;
  value: string;
}

const SyncRow: React.FC<SyncRowProps> = ({ label, value }) => (
  <View style={styles.syncRow}>
    <Text style={styles.syncLabel}>{label}</Text>
    <Text style={styles.syncValue}>{value}</Text>
  </View>
);

interface AdminToolRowProps {
  icon: string;
  label: string;
  description: string;
  onPress: () => void;
}

const AdminToolRow: React.FC<AdminToolRowProps> = ({
  icon,
  label,
  description,
  onPress,
}) => (
  <Pressable style={styles.toolRow} onPress={onPress}>
    <View style={styles.toolIcon}>
      <MaterialCommunityIcons
        name={icon as never}
        size={20}
        color={brand.gradientEnd}
      />
    </View>
    <View style={styles.toolInfo}>
      <Text style={styles.toolLabel}>{label}</Text>
      <Text style={styles.toolDescription}>{description}</Text>
    </View>
    <MaterialCommunityIcons
      name="chevron-right"
      size={20}
      color={brand.textMuted}
    />
  </Pressable>
);

export default function ProfileScreen() {
  const { signOut, user, hasPin, setPin } = useSession();
  const [signOutDialogVisible, setSignOutDialogVisible] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [pinDialogVisible, setPinDialogVisible] = useState(false);
  const [pinValue, setPinValue] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [savingPin, setSavingPin] = useState(false);

  const openPinDialog = () => {
    setPinValue('');
    setPinConfirm('');
    setPinError(null);
    setPinDialogVisible(true);
  };

  const handleSavePin = async () => {
    if (!/^\d{4,6}$/.test(pinValue)) {
      setPinError('PIN must be 4-6 digits');
      return;
    }
    if (pinValue !== pinConfirm) {
      setPinError('PINs do not match');
      return;
    }
    setSavingPin(true);
    setPinError(null);
    try {
      await setPin(pinValue);
      setPinDialogVisible(false);
    } catch (err: any) {
      setPinError(err?.response?.data?.message ?? 'Failed to set PIN');
    } finally {
      setSavingPin(false);
    }
  };

  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => authApi.me(),
  });

  const { data: syncStatus, isLoading: isSyncLoading } = useQuery({
    queryKey: ['mobile-sync-status'],
    queryFn: mobileApi.getSyncStatus,
  });

  const handleConfirmSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
    } finally {
      setIsSigningOut(false);
      setSignOutDialogVisible(false);
    }
  };

  if (isProfileLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={brand.gradientEnd} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.profileCard} mode="contained">
        <Card.Content style={styles.profileContent}>
          <Avatar.Text
            size={72}
            label={getInitials(profile?.firstName, profile?.lastName)}
            style={styles.avatar}
            color="#ffffff"
          />
          <Text style={styles.name}>
            {profile
              ? `${profile.firstName} ${profile.lastName}`
              : 'Unknown user'}
          </Text>
          <Text style={styles.email}>{profile?.email ?? '—'}</Text>
          <Chip
            style={styles.roleChip}
            textStyle={styles.roleChipText}
            icon="shield-account"
          >
            {formatRole(profile?.role)}
          </Chip>
          {profile?.posOnly && (
            <Chip
              style={styles.posChip}
              textStyle={styles.posChipText}
              icon="cash-register"
            >
              POS Only
            </Chip>
          )}
        </Card.Content>
      </Card>

      <Text style={styles.heading}>Sync Status</Text>
      <Card style={styles.syncCard} mode="contained">
        <Card.Content>
          {isSyncLoading ? (
            <ActivityIndicator color={brand.gradientEnd} />
          ) : (
            <>
              <SyncRow
                label="Products synced"
                value={String(syncStatus?.productCount ?? 0)}
              />
              <Divider style={styles.divider} />
              <SyncRow
                label="Customers synced"
                value={String(syncStatus?.customerCount ?? 0)}
              />
              <Divider style={styles.divider} />
              <SyncRow
                label="Last invoice"
                value={formatDateTime(syncStatus?.lastInvoiceAt ?? null)}
              />
              <Divider style={styles.divider} />
              <SyncRow
                label="Server time"
                value={formatDateTime(syncStatus?.serverTime ?? null)}
              />
            </>
          )}
        </Card.Content>
      </Card>

      <Text style={styles.heading}>Security</Text>
      <Card style={styles.toolsCard} mode="contained">
        <Card.Content style={styles.toolsContent}>
          <AdminToolRow
            icon="dialpad"
            label={hasPin ? 'Change PIN' : 'Set up a PIN'}
            description={
              hasPin
                ? 'Quick-unlock PIN is enabled for this device'
                : 'Unlock the register quickly without a full sign-in'
            }
            onPress={openPinDialog}
          />
        </Card.Content>
      </Card>

      {(user?.role === 'ADMIN' ||
        user?.role === 'INVENTORY_MANAGER' ||
        user?.role === 'ACCOUNTANT') && (
        <>
          <Text style={styles.heading}>Admin Tools</Text>
          <Card style={styles.toolsCard} mode="contained">
            <Card.Content style={styles.toolsContent}>
              {(user?.role === 'ADMIN' ||
                user?.role === 'INVENTORY_MANAGER') && (
                <AdminToolRow
                  icon="package-variant"
                  label="Stock"
                  description="Receive stock and view movement history"
                  onPress={() => router.push('/stock')}
                />
              )}
              {(user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT') && (
                <AdminToolRow
                  icon="file-certificate-outline"
                  label="eTIMS"
                  description="KRA submission status and retries"
                  onPress={() => router.push('/etims')}
                />
              )}
              {(user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT') && (
                <AdminToolRow
                  icon="chart-line"
                  label="Business Reports"
                  description="Profit & loss, sales trend, top products and customers"
                  onPress={() => router.push('/analytics')}
                />
              )}
              {(user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT') && (
                <AdminToolRow
                  icon="lightbulb-on-outline"
                  label="AI Insights"
                  description="Stock alerts, sales trends, payment risk, dormant customers"
                  onPress={() => router.push('/ai-insights')}
                />
              )}
              {(user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT') && (
                <AdminToolRow
                  icon="store-marker-outline"
                  label="Branch Comparison"
                  description="Revenue and orders ranked across all branches"
                  onPress={() => router.push('/branches')}
                />
              )}
            </Card.Content>
          </Card>
        </>
      )}

      <Button
        mode="outlined"
        icon="logout"
        textColor="#d4380d"
        style={styles.signOutButton}
        onPress={() => setSignOutDialogVisible(true)}
      >
        Sign Out
      </Button>

      <Portal>
        <Dialog
          visible={signOutDialogVisible}
          onDismiss={() => setSignOutDialogVisible(false)}
        >
          <Dialog.Title>Sign out</Dialog.Title>
          <Dialog.Content>
            <Text>Are you sure you want to sign out?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => setSignOutDialogVisible(false)}
              disabled={isSigningOut}
            >
              Cancel
            </Button>
            <Button
              onPress={() => {
                void handleConfirmSignOut();
              }}
              loading={isSigningOut}
              disabled={isSigningOut}
              textColor="#d4380d"
            >
              Sign Out
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <Dialog
          visible={pinDialogVisible}
          onDismiss={() => setPinDialogVisible(false)}
        >
          <Dialog.Title>{hasPin ? 'Change PIN' : 'Set up a PIN'}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label="New PIN"
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              value={pinValue}
              onChangeText={(v) => setPinValue(v.replace(/\D/g, ''))}
              style={styles.pinInput}
            />
            <TextInput
              mode="outlined"
              label="Confirm PIN"
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              value={pinConfirm}
              onChangeText={(v) => setPinConfirm(v.replace(/\D/g, ''))}
              style={styles.pinInput}
            />
            <HelperText type="error" visible={!!pinError}>
              {pinError}
            </HelperText>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => setPinDialogVisible(false)}
              disabled={savingPin}
            >
              Cancel
            </Button>
            <Button
              onPress={() => {
                void handleSavePin();
              }}
              loading={savingPin}
              disabled={savingPin}
            >
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
  profileCard: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
  },
  profileContent: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 6,
  },
  avatar: {
    backgroundColor: brand.gradientEnd,
    marginBottom: 8,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: brand.textDark,
  },
  email: {
    fontSize: 14,
    color: brand.textMuted,
    marginBottom: 8,
  },
  roleChip: {
    backgroundColor: '#e6e4ff',
    marginTop: 4,
  },
  roleChipText: {
    color: brand.gradientStart,
    fontWeight: '600',
  },
  posChip: {
    backgroundColor: '#d6f3ee',
    marginTop: 8,
  },
  posChipText: {
    color: brand.gradientEnd,
    fontWeight: '600',
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
  syncCard: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
  },
  syncRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  syncLabel: {
    fontSize: 13,
    color: brand.textMuted,
  },
  syncValue: {
    fontSize: 13,
    fontWeight: '600',
    color: brand.textDark,
  },
  divider: {
    backgroundColor: '#f0eef7',
  },
  toolsCard: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
  },
  toolsContent: {
    paddingVertical: 4,
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  toolIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#d6f3ee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolInfo: {
    flex: 1,
  },
  toolLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: brand.textDark,
  },
  toolDescription: {
    fontSize: 11.5,
    color: brand.textMuted,
  },
  pinInput: {
    marginBottom: 8,
  },
  signOutButton: {
    marginTop: 24,
    borderColor: '#d4380d',
    borderRadius: 12,
  },
});
