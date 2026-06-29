import { Stack } from 'expo-router';
import { useEffect, type JSX } from 'react';
import * as Localization from 'expo-localization';
import { initI18n, detectLanguageFromTag, type SupportedLanguage } from '@/i18n';
import { registerUiNamespaces } from '@/i18n/registerUiNamespaces';
import { ThemeProvider } from '@/theme';
import { startAutoLock } from '@/auth/autoLock';
import { loadPrefs } from '@/settings/prefs';

export default function RootLayout(): JSX.Element {
  useEffect(() => {
    const deviceTag = Localization.getLocales()[0]?.languageTag;
    const initial: SupportedLanguage = detectLanguageFromTag(deviceTag);
    void initI18n(initial).then(() => {
      registerUiNamespaces();
    });
  }, []);

  useEffect(() => {
    let stop: (() => void) | null = null;
    void loadPrefs().then((p) => {
      stop = startAutoLock(p.autoLockMs);
    });
    return () => stop?.();
  }, []);

  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
