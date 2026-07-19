import { Stack, router, usePathname, useSegments } from 'expo-router';
import { useEffect, useRef, type JSX } from 'react';
import { useAuthStore } from '@/auth/store';
import { runStaleCleanup } from '@/auth/staleCleanup';
import { setPendingRoute } from '@/auth/lockRoute';

export default function AppLayout(): JSX.Element {
  // Depend on `status` (not a one-shot `[]` effect): this layout can survive
  // a lock -> unlock cycle without unmounting, so a mount-only effect would
  // miss re-unlocks. Re-running on every transition into 'unlocked' covers
  // both a fresh mount and a layout that stayed alive across a re-lock.
  const status = useAuthStore((s) => s.status);
  // Two hooks, two jobs. `usePathname()` gives the navigable URL (`/entry/abc`)
  // — that is what gets stored and later handed to `router.replace`. It cannot
  // answer "is this inside the (app) group?", because expo-router strips group
  // segments from the URL. `useSegments()` returns unnormalized file segments
  // (`['(app)', 'entry', '[id]']`), so it is the only one that can.
  const pathname = usePathname();
  const segments = useSegments();

  // Track the live route without making the lock effect depend on it —
  // re-running that effect on every navigation would be wrong.
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const segmentsRef = useRef<readonly string[]>(segments);
  segmentsRef.current = segments;

  useEffect(() => {
    if (status === 'unlocked') void runStaleCleanup();
  }, [status]);

  // Leaving 'unlocked' (auto-lock, manual lock) nulls the vault. Without this
  // redirect the tab screens stay mounted with a null vault and render blank.
  // `replace` — not `push` — so the locked screens leave the stack entirely,
  // which also guarantees a fresh mount (and hidden secrets) on restore.
  useEffect(() => {
    if (status === 'locked') {
      setPendingRoute(pathRef.current, segmentsRef.current);
      router.replace('/unlock');
    }
  }, [status]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="entry/[id]" />
      <Stack.Screen name="entry/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="entry/edit/[id]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="settings/language" />
      <Stack.Screen name="settings/auto-lock" />
      <Stack.Screen name="settings/biometric" />
      <Stack.Screen name="settings/change-password" />
      <Stack.Screen name="settings/sync" />
      <Stack.Screen name="import/pick" />
      <Stack.Screen name="import/map" />
      <Stack.Screen name="import/confirm" />
    </Stack>
  );
}
