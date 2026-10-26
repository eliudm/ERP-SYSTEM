import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { brand } from '../theme';

export const SplashScreen: React.FC = () => (
  <View style={styles.container}>
    <ActivityIndicator size="large" color={brand.gradientEnd} />
    <Text style={styles.label}>Nexora ERP</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f5ef',
    gap: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: brand.textDark,
  },
});
