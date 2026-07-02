import { Stack } from 'expo-router';
import { useEffect, type JSX } from 'react';
import { useAuthStore } from '@/auth/store';
import { runStaleCleanup } from '@/auth/staleCleanup';

export default function AppLayout(): JSX.Element {
  // Depend on `status` (not a one-shot `[]` effect): this layout can survive
  // a lock -> unlock cycle without unmounting, so a mount-only effect would
  // miss re-unlocks. Re-running on every transition into 'unlocked' covers
  // both a fresh mount and a layout that stayed alive across a re-lock.
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    if (status === 'unlocked') void runStaleCleanup();
  }, [status]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="entry/[id]" />
      <Stack.Screen name="entry/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="entry/edit/[id]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="settings/language" />
      <Stack.Screen name="settings/auto-lock" />
      <Stack.Screen name="settings/change-password" />
      <Stack.Screen name="settings/sync" />
    </Stack>
  );
}
