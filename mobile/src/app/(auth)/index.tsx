import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, Button, HelperText } from 'react-native-paper';
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.hero}>
        <View style={styles.logo}>
          <Text style={styles.logoLetter}>N</Text>
        </View>
        <Text style={styles.title}>Nexora ERP</Text>
        <Text style={styles.subtitle}>Sign in to your workspace</Text>
      </View>

      <View style={styles.form}>
        <TextInput
          mode="outlined"
          label="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
        />
        <TextInput
          mode="outlined"
          label="Password"
          secureTextEntry={secure}
          value={password}
          onChangeText={setPassword}
          style={styles.input}
          right={
            <TextInput.Icon
              icon={secure ? 'eye' : 'eye-off'}
              onPress={() => setSecure((s) => !s)}
            />
          }
        />
        <HelperText type="error" visible={!!error}>
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
        >
          Sign In
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f5ef',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: brand.gradientEnd,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoLetter: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: brand.textDark,
  },
  subtitle: {
    fontSize: 14,
    color: brand.textMuted,
    marginTop: 4,
  },
  form: {
    gap: 4,
  },
  input: {
    marginBottom: 12,
  },
  submit: {
    marginTop: 8,
    borderRadius: 10,
  },
  submitContent: {
    paddingVertical: 6,
  },
});
