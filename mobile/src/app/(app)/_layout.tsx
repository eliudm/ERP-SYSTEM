import React, { useEffect } from 'react';
import { Tabs, usePathname, router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { brand } from '../../theme';
import { useSession } from '../../providers/SessionProvider';
import { salesApi } from '../../api/sales.api';

// Routes a POS-only account's token is actually allowed to call
// server-side (see src/modules/auth/guards/jwt-auth.guard.ts on the backend)
const POS_ONLY_ALLOWED_PATHS = ['/pos', '/credits', '/profile'];

// Roles that can access the POS terminal and make sales
const POS_ROLES = ['ADMIN', 'SALES_USER'];
// Roles that can access the Sales (invoices) tab
const SALES_ROLES = ['ADMIN', 'SALES_USER'];
// Roles that can access the Analytics tab
const ANALYTICS_ROLES = ['ADMIN', 'ACCOUNTANT'];
// Roles that can access the Credits tab
const CREDITS_ROLES = ['ADMIN', 'SALES_USER'];

export default function AppTabsLayout() {
  const { user } = useSession();
  const { t } = useTranslation('nav');
  const isPosOnly = user?.posOnly === true;
  const userRole = user?.role ?? 'SALES_USER';
  const canUsePOS = isPosOnly || POS_ROLES.includes(userRole);
  const pathname = usePathname();

  const { data: outstandingCredit } = useQuery({
    queryKey: ['outstanding-credit'],
    queryFn: () => salesApi.getOutstandingCredit(),
    refetchInterval: 60000,
    enabled: CREDITS_ROLES.includes(userRole),
  });
  const creditBadgeCount = outstandingCredit?.length ?? 0;

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
          // POS tab is always shown — unauthorized roles see "contact admin" inside pos.tsx
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
          href: (isPosOnly || !SALES_ROLES.includes(userRole)) ? null : undefined,
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
        name="analytics"
        options={{
          title: t('tabs.analytics'),
          href: (isPosOnly || !ANALYTICS_ROLES.includes(userRole)) ? null : undefined,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="chart-line"
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
        name="credits"
        options={{
          title: t('tabs.credits'),
          href: (isPosOnly || !CREDITS_ROLES.includes(userRole)) ? null : undefined,
          tabBarIcon: ({ color, size }) => (
            <View>
              <MaterialCommunityIcons
                name="account-clock-outline"
                color={color as string}
                size={size}
              />
              {creditBadgeCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {creditBadgeCount > 99 ? '99+' : creditBadgeCount}
                  </Text>
                </View>
              )}
            </View>
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

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#d4380d',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
});
