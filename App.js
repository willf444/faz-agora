import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { theme } from './src/theme';
import HomeScreen from './src/screens/HomeScreen';
import EditTaskScreen from './src/screens/EditTaskScreen';
import { notificationService } from './src/services/notificationService';

const Stack = createNativeStackNavigator();

export default function App() {
  useEffect(() => {
    notificationService.requestPermissions();
  }, []);

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <StatusBar style="light" backgroundColor={theme.colors.primary} />
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName="Home"
            screenOptions={{
              headerStyle: {
                backgroundColor: theme.colors.primary,
              },
              headerTintColor: '#ffffff',
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
              options={{ title: 'WillDo' }}
            />
            <Stack.Screen
              name="EditTask"
              component={EditTaskScreen}
              options={({ route }) => ({
                title: route.params?.task ? 'Editar Tarefa' : 'Nova Tarefa',
              })}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
