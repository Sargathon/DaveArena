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
            <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
              <Stack.Screen name="login" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="match/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="profile" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="vip" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="admin" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            </Stack>
          </MatchProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </AlertProvider>
  );
}
