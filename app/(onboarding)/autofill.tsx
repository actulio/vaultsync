import { useEffect, type JSX } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Autofill } from '@/native/autofill';
import { useTheme } from '@/theme';

const NEXT = '/(onboarding)/drive-signin';

export default function AutofillOnboarding(): JSX.Element {
  const { t } = useTranslation('onboarding');
  const { colors, spacing, radii, type } = useTheme();

  useEffect(() => {
    // Nothing to offer on unsupported devices — skip straight past this step.
    void Autofill.isSupported().then((s) => {
      if (!s) router.replace(NEXT);
    });
  }, []);

  const onEnable = async (): Promise<void> => {
    // Fire the OS picker; advance regardless of outcome (enabling is optional
    // and can be done later in Settings).
    await Autofill.requestEnable();
    router.push(NEXT);
  };

  const styles = StyleSheet.create({
    scroll: { flex: 1, backgroundColor: colors.bg },
    container: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing['5xl'],
      paddingBottom: spacing['3xl'],
      justifyContent: 'center',
      flex: 1,
    },
    title: { ...type.title, color: colors.textPrimary, marginBottom: spacing.md },
    body: { ...type.body, color: colors.textSecondary, marginBottom: spacing['2xl'] },
    ctaEnable: {
      height: 52,
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      justifyContent: 'center',
      alignItems: 'center',
    },
    ctaEnableLabel: { ...type.bodyStrong, color: colors.onPrimary },
    ctaSkip: {
      height: 52,
      borderRadius: radii.md,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: spacing.md,
    },
    ctaSkipLabel: { ...type.bodyStrong, color: colors.primary },
  });

  return (
    <View style={styles.scroll}>
      <View style={styles.container}>
        <Text style={styles.title}>{t('autofill.title')}</Text>
        <Text style={styles.body}>{t('autofill.body')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('autofill.ctaEnable')}
          onPress={() => { void onEnable(); }}
          style={({ pressed }) => [styles.ctaEnable, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={styles.ctaEnableLabel}>{t('autofill.ctaEnable')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('autofill.ctaSkip')}
          onPress={() => router.push(NEXT)}
          style={({ pressed }) => [styles.ctaSkip, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={styles.ctaSkipLabel}>{t('autofill.ctaSkip')}</Text>
        </Pressable>
      </View>
    </View>
  );
}
