import { Stack } from 'expo-router';
import { useEffect, type JSX } from 'react';
import * as Localization from 'expo-localization';
import { initI18n, detectLanguageFromTag, type SupportedLanguage } from '@/i18n';

export default function RootLayout(): JSX.Element {
  useEffect(() => {
    const deviceTag = Localization.getLocales()[0]?.languageTag;
    const initial: SupportedLanguage = detectLanguageFromTag(deviceTag);
    void initI18n(initial);
  }, []);

  return <Stack screenOptions={{ headerShown: false }} />;
}
