import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { JSX } from 'react';
import { useTheme } from '@/theme';

export default function Welcome(): JSX.Element {
  const { t } = useTranslation('onboarding');
  const { colors, spacing, radii, type } = useTheme();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
      paddingHorizontal: spacing.xl,
      justifyContent: 'center',
    },
    title: {
      ...type.display,
      color: colors.textPrimary,
    },
    subtitle: {
      ...type.body,
      color: colors.textSecondary,
      marginTop: spacing.md,
    },
    cta: {
      height: 52,
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: spacing['3xl'],
    },
    ctaLabel: {
      ...type.bodyStrong,
      color: colors.onPrimary,
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('welcome.title')}</Text>
      <Text style={styles.subtitle}>{t('welcome.subtitle')}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('welcome.cta')}
        onPress={() => router.push('/(onboarding)/set-password')}
        style={({ pressed }) => [styles.cta, { opacity: pressed ? 0.85 : 1 }]}
      >
        <Text style={styles.ctaLabel}>{t('welcome.cta')}</Text>
      </Pressable>
    </View>
  );
}
