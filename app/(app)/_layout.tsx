import { Stack } from 'expo-router';
import type { JSX } from 'react';

export default function AppLayout(): JSX.Element {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="entry/[id]" />
      <Stack.Screen name="entry/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="entry/edit/[id]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="settings/language" />
      <Stack.Screen name="settings/auto-lock" />
      <Stack.Screen name="settings/change-password" />
    </Stack>
  );
}
