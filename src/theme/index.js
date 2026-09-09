import { MD3DarkTheme as DefaultTheme } from 'react-native-paper';

export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#f5f5f5',
    onPrimary: '#0a0a0a',
    primaryContainer: '#2a2a2a',
    onPrimaryContainer: '#fafafa',
    secondary: '#d4d4d4',
    onSecondary: '#111111',
    tertiary: '#a3a3a3',
    background: '#090909',
    surface: '#151515',
    surfaceVariant: '#222222',
    onSurface: '#f5f5f5',
    onSurfaceVariant: '#b5b5b5',
    outline: '#4a4a4a',
    outlineVariant: '#303030',
    error: '#f87171',
    onError: '#1a0505',
    elevation: {
      level0: 'transparent',
      level1: '#151515',
      level2: '#191919',
      level3: '#1e1e1e',
      level4: '#242424',
      level5: '#2a2a2a',
    },
  },
  custom: {
    overdue: '#f87171',
    dueToday: '#fbbf24',
    dueFuture: '#e5e5e5',
    completedText: '#737373',
    border: '#303030',
    syncSuccess: '#22c55e',
  }
};
