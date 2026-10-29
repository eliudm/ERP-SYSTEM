import React, { useEffect, useRef, useState } from 'react';
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
import { I18nextProvider, useTranslation } from 'react-i18next';
import { SessionProvider, useSession } from '../providers/SessionProvider';
import { settingsApi } from '../api/settings.api';
import { paperTheme } from '../theme';
import { SplashScreen } from '../components/SplashScreen';
import { LockScreen } from '../components/LockScreen';
import i18n, { bootstrapLanguage } from '../i18n';
import { localeToLanguage, LANGUAGE_STORAGE_KEY } from '../i18n/languageMap';
import { storage } from '../utils/storage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function RootNavigator() {
  const { user, isLoading, hasPin, isLocked, lock } = useSession();
  const { i18n: i18next } = useTranslation();
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

  // Once authenticated, the tenant's SystemSetting.defaultLanguage becomes
  // authoritative and overrides whatever language was locally chosen on the
  // (pre-login) Login screen — mirrors frontend/src/App.tsx's effect.
  useEffect(() => {
    if (!settings?.defaultLanguage) {
      return;
    }
    const language = localeToLanguage(settings.defaultLanguage);
    void i18next.changeLanguage(language);
    void storage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [settings?.defaultLanguage, i18next]);

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
        {/* Admin-tool "drill-in" screens, reachable from Profile's "Admin
            Tools" list. These live as top-level Stack routes rather than
            hidden (href: null) Tabs.Screen entries inside (app) — React
            Navigation's bottom-tabs doesn't reliably push/navigate to a
            hidden tab screen from a DIFFERENT tab (it was bouncing back to
            the Dashboard tab instead), where a plain Stack screen just
            works with router.push() and gets a native back button too. */}
        <Stack.Screen
          name="stock"
          options={{ headerShown: true, title: 'Stock' }}
        />
        <Stack.Screen
          name="etims"
          options={{ headerShown: true, title: 'eTIMS' }}
        />
        <Stack.Screen
          name="analytics"
          options={{ headerShown: true, title: 'Business Reports' }}
        />
        <Stack.Screen
          name="ai-insights"
          options={{ headerShown: true, title: 'AI Insights' }}
        />
        <Stack.Screen
          name="branches"
          options={{ headerShown: true, title: 'Branch Comparison' }}
        />
        <Stack.Screen
          name="accounting-reports"
          options={{ headerShown: true, title: 'Accounting Reports' }}
        />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  // i18next's init() (in ../i18n) runs synchronously at module load with the
  // 'en' default; this gate withholds the real provider tree until the
  // async read of the last-chosen language (bootstrapLanguage, backed by
  // on-device storage) has resolved, so there's no flash of the wrong
  // language on startup.
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    void bootstrapLanguage().finally(() => setI18nReady(true));
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {i18nReady ? (
          <QueryClientProvider client={queryClient}>
            <I18nextProvider i18n={i18n}>
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
            </I18nextProvider>
          </QueryClientProvider>
        ) : (
          <SplashScreen />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
