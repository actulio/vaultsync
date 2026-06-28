import { Stack } from 'expo-router';
import type { JSX } from 'react';

export default function AppLayout(): JSX.Element {
  return <Stack screenOptions={{ headerShown: false }} />;
}
