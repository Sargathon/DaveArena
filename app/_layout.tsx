import React from 'react';
import { Stack } from 'expo-router';
import { AlertProvider } from '@/template';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../contexts/AuthContext';
import { MatchProvider } from '../contexts/MatchContext';

export default function RootLayout() {
  return (
    <AlertProvider>
      <SafeAreaProvider>
        <AuthProvider>
          <MatchProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="login" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="match/[id]" options={{ presentation: 'modal' }} />
              <Stack.Screen name="profile" options={{ presentation: 'modal' }} />
              <Stack.Screen name="vip" options={{ presentation: 'modal' }} />
              <Stack.Screen name="admin" options={{ presentation: 'modal' }} />
            </Stack>
          </MatchProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </AlertProvider>
  );
}
