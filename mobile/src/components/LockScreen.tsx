import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput as RNTextInput,
  Pressable,
} from 'react-native';
import { Text, Button, ActivityIndicator } from 'react-native-paper';
import { useSession } from '../providers/SessionProvider';
import { brand } from '../theme';

const PIN_LENGTH = 4;

interface LockScreenProps {
  businessName?: string;
}

export const LockScreen: React.FC<LockScreenProps> = ({ businessName }) => {
  const { unlockWithPin, signOut, user } = useSession();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const inputRef = useRef<React.ComponentRef<typeof RNTextInput>>(null);

  const attemptUnlock = async (value: string) => {
    setError(null);
    setVerifying(true);
    try {
      const ok = await unlockWithPin(value);
      if (!ok) {
        setError('Incorrect PIN');
        setPin('');
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, PIN_LENGTH);
    setPin(digits);
    setError(null);
    if (digits.length === PIN_LENGTH) {
      void attemptUnlock(digits);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.tapArea}
        onPress={() => inputRef.current?.focus()}
      >
        <View style={styles.logo}>
          <Text style={styles.logoLetter}>N</Text>
        </View>
        <Text style={styles.businessName}>{businessName ?? 'Nexora ERP'}</Text>
        <Text style={styles.subtitle}>
          {user?.email ? `Locked — ${user.email}` : 'Register locked'}
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Enter your PIN</Text>
          <View style={styles.dotsRow}>
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i < pin.length && styles.dotFilled]}
              />
            ))}
          </View>
          {verifying && (
            <ActivityIndicator
              size="small"
              color={brand.gradientEnd}
              style={styles.spinner}
            />
          )}
          {error && <Text style={styles.error}>{error}</Text>}
        </View>

        <RNTextInput
          ref={inputRef}
          value={pin}
          onChangeText={handleChange}
          keyboardType="number-pad"
          secureTextEntry
          autoFocus
          maxLength={PIN_LENGTH}
          style={styles.hiddenInput}
        />
      </Pressable>

      <Button
        mode="text"
        textColor="rgba(255,255,255,0.85)"
        onPress={() => void signOut()}
        style={styles.discardButton}
      >
        Discard — sign out instead
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brand.gradientEnd,
    justifyContent: 'space-between',
    paddingVertical: 48,
  },
  tapArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoLetter: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  businessName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
    marginBottom: 32,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  cardLabel: {
    fontSize: 13,
    color: brand.textMuted,
    marginBottom: 18,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: brand.textMuted,
  },
  dotFilled: {
    backgroundColor: brand.gradientEnd,
    borderColor: brand.gradientEnd,
  },
  spinner: {
    marginTop: 16,
  },
  error: {
    marginTop: 14,
    fontSize: 12.5,
    color: '#d4380d',
    fontWeight: '600',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
  },
  discardButton: {
    alignSelf: 'center',
  },
});
