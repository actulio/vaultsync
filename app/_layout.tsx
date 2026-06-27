import { Stack } from 'expo-router';
import { useEffect, type JSX } from 'react';
import * as Localization from 'expo-localization';
import { initI18n, detectLanguageFromTag, type SupportedLanguage } from '@/i18n';
import { registerUiNamespaces } from '@/i18n/registerUiNamespaces';
import { ThemeProvider } from '@/theme';

export default function RootLayout(): JSX.Element {
  useEffect(() => {
    const deviceTag = Localization.getLocales()[0]?.languageTag;
    const initial: SupportedLanguage = detectLanguageFromTag(deviceTag);
    void initI18n(initial).then(() => {
      registerUiNamespaces();
    });
  }, []);

  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
