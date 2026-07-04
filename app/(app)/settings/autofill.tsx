import { useCallback, useEffect, useState, type JSX } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Autofill } from '@/native/autofill';
import { useTheme } from '@/theme';

export default function AutofillSettings(): JSX.Element {
  const { t } = useTranslation('settings');
  const { colors, spacing, radii, type } = useTheme();
  // null = still loading; avoids a flash of the wrong state.
  const [supported, setSupported] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(false);

  const check = useCallback(async (): Promise<void> => {
    const s = await Autofill.isSupported();
    setSupported(s);
    setEnabled(s ? await Autofill.isEnabled() : false);
  }, []);

  useEffect(() => {
    void check();
    // Returning from the OS autofill picker fires AppState 'active' — re-read status then.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => sub.remove();
  }, [check]);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    content: { paddingHorizontal: spacing.lg, paddingTop: spacing['3xl'] },
    title: { ...type.title, color: colors.textPrimary, marginBottom: spacing.sm },
    status: { ...type.bodyStrong, color: colors.textSecondary, marginBottom: spacing.md },
    body: { ...type.body, color: colors.textSecondary, marginBottom: spacing['2xl'] },
    cta: {
      height: 52,
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      justifyContent: 'center',
      alignItems: 'center',
    },
    ctaLabel: { ...type.bodyStrong, color: colors.onPrimary },
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('autofill.title')}</Text>
      {supported === false ? (
        <Text style={styles.body}>{t('autofill.notSupported')}</Text>
      ) : supported === true ? (
        <>
          <Text style={styles.status}>
            {enabled ? t('autofill.statusActive') : t('autofill.statusNotSet')}
          </Text>
          <Text style={styles.body}>{t('autofill.body')}</Text>
          {!enabled && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('autofill.ctaEnable')}
              onPress={() => { void Autofill.requestEnable(); }}
              style={({ pressed }) => [styles.cta, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={styles.ctaLabel}>{t('autofill.ctaEnable')}</Text>
            </Pressable>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}
