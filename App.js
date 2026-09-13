import React, { useEffect } from 'react';
import { DarkTheme as NavigationDarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { theme } from './src/theme';
import HomeScreen from './src/screens/HomeScreen';
import EditTaskScreen from './src/screens/EditTaskScreen';
import WebDavSettingsScreen from './src/screens/WebDavSettingsScreen';
import { notificationService } from './src/services/notificationService';

const Stack = createNativeStackNavigator();

const navigationTheme = {
  ...NavigationDarkTheme,
  colors: {
    ...NavigationDarkTheme.colors,
    primary: '#f5f5f5',
    background: '#090909',
    card: '#000000',
    text: '#f5f5f5',
    border: '#303030',
  },
};

export default function App() {
  useEffect(() => {
    void notificationService.restoreScheduledTasks();
  }, []);

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <StatusBar style="light" backgroundColor="#000000" />
        <NavigationContainer theme={navigationTheme}>
          <Stack.Navigator
            initialRouteName="Home"
            screenOptions={{
              headerStyle: {
                backgroundColor: '#000000',
              },
              headerTintColor: '#f5f5f5',
              headerTitleStyle: {
                fontWeight: 'bold',
              },
              contentStyle: {
                backgroundColor: theme.colors.background,
              },
            }}
          >
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{ title: 'Faz agora!' }}
            />
            <Stack.Screen
              name="EditTask"
              component={EditTaskScreen}
              options={({ route }) => ({
                title: route.params?.task ? 'Editar Tarefa' : 'Nova Tarefa',
              })}
            />
            <Stack.Screen
              name="WebDavSettings"
              component={WebDavSettingsScreen}
              options={{ title: 'Sincronização WebDAV' }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
