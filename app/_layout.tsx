import { Stack } from 'expo-router';
import { useEffect, type JSX } from 'react';
import * as Localization from 'expo-localization';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { initI18n, detectLanguageFromTag, type SupportedLanguage } from '@/i18n';
import { registerUiNamespaces } from '@/i18n/registerUiNamespaces';
import { ThemeProvider, useTheme } from '@/theme';
import { startAutoLock } from '@/auth/autoLock';
import { loadPrefs } from '@/settings/prefs';
import { startSyncOnForeground } from '@/sync/hooks';
import { startVaultReloadOnForeground } from '@/auth/foregroundReload';
import { VaultToast } from '@/components/toast';

function ThemedRoot(): JSX.Element {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
  });

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <Stack screenOptions={{ headerShown: false }} />
      <VaultToast />
    </SafeAreaView>
  );
}

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

  useEffect(() => startSyncOnForeground(), []);

  // Pick up out-of-band writes (e.g. an autofill save) on foreground without a relaunch.
  useEffect(() => startVaultReloadOnForeground(), []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedRoot />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
