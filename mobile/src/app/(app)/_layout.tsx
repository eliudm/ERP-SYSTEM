import React, { useEffect } from 'react';
import { Tabs, usePathname, router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { brand } from '../../theme';
import { useSession } from '../../providers/SessionProvider';

// Routes a POS-only account's token is actually allowed to call
// server-side (see src/modules/auth/guards/jwt-auth.guard.ts on the
// backend) — mirrors frontend/src/components/layout/AppLayout.tsx's
// `posAllowed` menu filtering on the web app.
const POS_ONLY_ALLOWED_PATHS = ['/pos', '/profile'];

export default function AppTabsLayout() {
  const { user } = useSession();
  const { t } = useTranslation('nav');
  const isPosOnly = user?.posOnly === true;
  const pathname = usePathname();

  useEffect(() => {
    if (isPosOnly && !POS_ONLY_ALLOWED_PATHS.includes(pathname)) {
      router.replace('/pos');
    }
  }, [isPosOnly, pathname]);

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: brand.gradientEnd,
        tabBarInactiveTintColor: brand.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.dashboard'),
          href: isPosOnly ? null : undefined,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="view-dashboard"
              color={color as string}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="pos"
        options={{
          title: t('tabs.pos'),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="cart"
              color={color as string}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="sales"
        options={{
          title: t('tabs.sales'),
          href: isPosOnly ? null : undefined,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="receipt"
              color={color as string}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: t('tabs.alerts'),
          href: isPosOnly ? null : undefined,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="bell"
              color={color as string}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="account-circle"
              color={color as string}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}
