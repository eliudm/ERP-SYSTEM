import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Text, TextInput, Button, HelperText } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useSession } from '../../providers/SessionProvider';
import { brand } from '../../theme';

export default function LoginScreen() {
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) {
      setError('Enter both email and password');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ?? 'Invalid email or password';
      setError(Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LinearGradient
      colors={[brand.gradientStart, brand.gradientEnd]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.wrap}>
            <View style={styles.hero}>
              <View style={styles.logo}>
                <Text style={styles.logoLetter}>N</Text>
              </View>
              <Text style={styles.brandName}>Nexora ERP</Text>
              <Text style={styles.brandTagline}>
                Streamlined operations, everywhere you work
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.title}>Welcome back</Text>
              <Text style={styles.subtitle}>Sign in to your workspace</Text>

              <View style={styles.form}>
                <TextInput
                  mode="outlined"
                  label="Email"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                  style={styles.input}
                  outlineStyle={styles.inputOutline}
                  left={<TextInput.Icon icon="email-outline" />}
                />
                <TextInput
                  mode="outlined"
                  label="Password"
                  secureTextEntry={secure}
                  value={password}
                  onChangeText={setPassword}
                  style={styles.input}
                  outlineStyle={styles.inputOutline}
                  left={<TextInput.Icon icon="lock-outline" />}
                  right={
                    <TextInput.Icon
                      icon={secure ? 'eye-outline' : 'eye-off-outline'}
                      onPress={() => setSecure((s) => !s)}
                      forceTextInputFocus={false}
                    />
                  }
                />
                <HelperText
                  type="error"
                  visible={!!error}
                  style={styles.helper}
                >
                  {error}
                </HelperText>
                <Button
                  mode="contained"
                  onPress={() => {
                    void handleSubmit();
                  }}
                  loading={submitting}
                  disabled={submitting}
                  style={styles.submit}
                  contentStyle={styles.submitContent}
                  labelStyle={styles.submitLabel}
                  buttonColor={brand.gradientEnd}
                >
                  Sign In
                </Button>
              </View>
            </View>

            <Text style={styles.footerNote}>
              Staff access only · Contact your administrator for an account
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const CARD_MAX_WIDTH = 420;

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
  },
  wrap: {
    width: '100%',
    maxWidth: CARD_MAX_WIDTH,
    alignItems: 'center',
  },
  hero: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoLetter: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  brandName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  brandTagline: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.82)',
    marginTop: 6,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 28,
    shadowColor: '#15101f',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: brand.textDark,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13.5,
    color: brand.textMuted,
    marginTop: 4,
    marginBottom: 24,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  input: {
    marginBottom: 14,
    backgroundColor: '#ffffff',
  },
  inputOutline: {
    borderRadius: 12,
  },
  helper: {
    marginTop: -10,
    paddingHorizontal: 0,
  },
  submit: {
    marginTop: 6,
    borderRadius: 12,
  },
  submitContent: {
    paddingVertical: 7,
  },
  submitLabel: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  footerNote: {
    marginTop: 24,
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
  },
});
