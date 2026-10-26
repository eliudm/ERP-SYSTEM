import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SessionProvider, useSession } from '../providers/SessionProvider';
import { settingsApi } from '../api/settings.api';
import { paperTheme } from '../theme';
import { SplashScreen } from '../components/SplashScreen';
import { LockScreen } from '../components/LockScreen';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function RootNavigator() {
  const { user, isLoading, hasPin, isLocked, lock } = useSession();
  const appState = useRef(AppState.currentState);

  // Lock the register as soon as the app leaves the foreground (home
  // button, app switch, screen lock) — the same norm banking/POS apps
  // use, rather than a web-style continuous idle timer (there's no
  // reliable cross-screen "any touch" signal in React Native).
  useEffect(() => {
    if (!hasPin) return undefined;
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current === 'active' && next.match(/inactive|background/)) {
        lock();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [hasPin, lock]);

  const { data: settings } = useQuery({
    queryKey: ['system-settings'],
    queryFn: () => settingsApi.getSystemSettings(),
    enabled: !!user,
  });

  if (isLoading) {
    return <SplashScreen />;
  }

  if (user && isLocked) {
    return <LockScreen businessName={settings?.companyName} />;
  }

  return (
    <Stack>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <PaperProvider
            theme={paperTheme}
            settings={{
              icon: (props) => <MaterialCommunityIcons {...props} />,
            }}
          >
            <SessionProvider>
              <StatusBar style="dark" />
              <RootNavigator />
            </SessionProvider>
          </PaperProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
