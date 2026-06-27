import { Redirect } from 'expo-router';
import { useEffect, type JSX } from 'react';
import { useAuthStore } from '@/auth/store';
import { bootstrapAuth } from '@/auth/bootstrap';

export default function Index(): JSX.Element | null {
  const status = useAuthStore((s) => s.status);
  useEffect(() => { void bootstrapAuth(); }, []);

  if (status === 'bootstrapping') return null;
  if (status === 'no_vault') return <Redirect href="/(onboarding)/welcome" />;
  if (status === 'locked') return <Redirect href="/unlock" />;
  return <Redirect href="/(app)" />;
}
