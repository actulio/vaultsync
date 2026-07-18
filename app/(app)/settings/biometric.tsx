import { useEffect, useState, type JSX } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { enableBiometric, disableBiometric, isBiometricEnabled } from '@/auth/biometric';
import { useAuthStore } from '@/auth/store';
import { useTheme } from '@/theme';
import { useDialog } from '@/components/DialogProvider';

export default function BiometricSettings(): JSX.Element {
  const { t } = useTranslation('settings');
  const { colors, spacing, radii, type } = useTheme();
  const dialog = useDialog();
  // null = still loading the current state; avoids a flash of the wrong label.
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void isBiometricEnabled().then(setEnabled);
  }, []);

  const onToggle = async (): Promise<void> => {
    if (busy || enabled === null) return;
    setBusy(true);
    try {
      if (enabled) {
        // Disabling needs no auth, so it works even on a broken sensor.
        await disableBiometric();
        setEnabled(false);
      } else {
        const key = useAuthStore.getState().masterKey;
        if (!key) {
          void dialog.alert({ title: t('biometric.title'), message: t('biometric.locked') });
          return;
        }
        // Wrapping shows the system biometric prompt; rejects on cancel/unavailable.
        await enableBiometric(key);
        setEnabled(true);
      }
    } catch (e) {
      if ((e as { code?: string }).code !== 'E_KEYSTORE_CANCELED') {
        void dialog.alert({ title: t('biometric.title'), message: t('biometric.unavailable') });
      }
    } finally {
      setBusy(false);
    }
  };

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

  const actionLabel = enabled ? t('biometric.disable') : t('biometric.enable');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('biometric.title')}</Text>
      <Text style={styles.status}>
        {enabled === null ? '' : enabled ? t('biometric.enabled') : t('biometric.disabled')}
      </Text>
      <Text style={styles.body}>{t('biometric.body')}</Text>
      {enabled !== null && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={() => { void onToggle(); }}
          disabled={busy}
          style={({ pressed }) => [styles.cta, { opacity: pressed || busy ? 0.7 : 1 }]}
        >
          <Text style={styles.ctaLabel}>{actionLabel}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}
