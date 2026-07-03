import { useState, type JSX } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';

export default function RecoveryCode(): JSX.Element {
  const { t } = useTranslation('onboarding');
  const { colors, spacing, radii, type } = useTheme();
  const { code, from } = useLocalSearchParams<{ code: string; from?: string }>();
  const [confirmed, setConfirmed] = useState(false);

  const styles = StyleSheet.create({
    scroll: { flex: 1, backgroundColor: colors.bg },
    container: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing['4xl'],
      paddingBottom: spacing['3xl'],
    },
    title: { ...type.title, color: colors.textPrimary },
    body: { ...type.body, color: colors.textSecondary, marginTop: spacing.sm },
    codeBlock: {
      marginTop: spacing['2xl'],
      padding: spacing.lg,
      backgroundColor: colors.surfaceAlt,
      borderRadius: radii.lg,
    },
    codeText: {
      ...type.mono,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    copyBtn: {
      marginTop: spacing.sm,
      alignSelf: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    copyLabel: { ...type.subhead, color: colors.primary },
    warning: { ...type.caption, color: colors.danger, marginTop: spacing['2xl'] },
    checkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.lg,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderWidth: 2,
      borderColor: colors.primary,
      borderRadius: radii.sm,
      marginRight: spacing.sm,
      backgroundColor: 'transparent',
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkboxChecked: { backgroundColor: colors.primary },
    checkmark: { ...type.caption, color: colors.onPrimary, fontWeight: '700' },
    checkLabel: { ...type.body, color: colors.textPrimary, flex: 1 },
    cta: {
      height: 52,
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: spacing['2xl'],
    },
    ctaDisabled: { opacity: 0.4 },
    ctaLabel: { ...type.bodyStrong, color: colors.onPrimary },
  });

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.title}>{t('recoveryCode.title')}</Text>
      <Text style={styles.body}>{t('recoveryCode.body')}</Text>

      <View style={styles.codeBlock}>
        <Text style={styles.codeText}>{code}</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('recoveryCode.copy')}
        onPress={() => void Clipboard.setStringAsync(code ?? '')}
        style={styles.copyBtn}
      >
        <Text style={styles.copyLabel}>{t('recoveryCode.copy')}</Text>
      </Pressable>

      <Text style={styles.warning}>{t('recoveryCode.warning')}</Text>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: confirmed }}
        onPress={() => setConfirmed((v) => !v)}
        style={styles.checkRow}
      >
        <View style={[styles.checkbox, confirmed && styles.checkboxChecked]}>
          {confirmed && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={styles.checkLabel}>{t('recoveryCode.savedCheckbox')}</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('recoveryCode.cta')}
        accessibilityState={{ disabled: !confirmed }}
        disabled={!confirmed}
        onPress={() => {
          if (from === 'settings') {
            router.replace('/(app)/(tabs)');
          } else {
            router.push('/(onboarding)/biometric');
          }
        }}
        style={({ pressed }) => [
          styles.cta,
          !confirmed && styles.ctaDisabled,
          confirmed && pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={styles.ctaLabel}>{t('recoveryCode.cta')}</Text>
      </Pressable>
    </ScrollView>
  );
}
