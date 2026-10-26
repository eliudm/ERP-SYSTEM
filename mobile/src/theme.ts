import { MD3LightTheme } from 'react-native-paper';

// Mirrors the web app's brand accent (teal → purple gradient) from
// frontend/src/components/layout/AppLayout.tsx, adapted to Paper's MD3 tokens.
export const paperTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#1db8a0',
    onPrimary: '#ffffff',
    primaryContainer: '#d6f3ee',
    secondary: '#6f67ff',
    onSecondary: '#ffffff',
    secondaryContainer: '#e6e4ff',
    background: '#f8f5ef',
    surface: '#ffffff',
    surfaceVariant: '#f0eef7',
    error: '#d4380d',
    outline: '#d9d4e8',
  },
};

export const brand = {
  gradientStart: '#6f67ff',
  gradientEnd: '#1db8a0',
  textDark: '#2f2749',
  textMuted: '#6b6485',
};
