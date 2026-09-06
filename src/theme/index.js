import { MD3LightTheme as DefaultTheme } from 'react-native-paper';

export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#2563eb',
    onPrimary: '#ffffff',
    primaryContainer: '#dbeafe',
    onPrimaryContainer: '#1e40af',
    secondary: '#3b82f6',
    tertiary: '#1d4ed8',
    background: '#f5f7fb',
    surface: '#ffffff',
    surfaceVariant: '#f1f5f9',
    onSurface: '#111827',
    onSurfaceVariant: '#475569',
    outline: '#cbd5e1',
    outlineVariant: '#e2e8f0',
    error: '#ef4444',
    elevation: {
      level0: 'transparent',
      level1: '#ffffff',
      level2: '#f8fafc',
      level3: '#f1f5f9',
      level4: '#e2e8f0',
      level5: '#cbd5e1',
    },
  },
  custom: {
    overdue: '#ef4444',
    dueToday: '#f59e0b',
    dueFuture: '#2563eb',
    completedText: '#94a3b8',
    border: '#e2e8f0',
  }
};
