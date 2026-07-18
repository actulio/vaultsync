import { PermissionsAndroid, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { JSX } from 'react';
import { enableBiometric } from '@/auth/biometric';
import { useAuthStore } from '@/auth/store';
import { useTheme } from '@/theme';
import { useDialog } from '@/components/DialogProvider';

export default function BiometricEnroll(): JSX.Element {
  const { t } = useTranslation('onboarding');
  const { colors, spacing, radii, type } = useTheme();
  const dialog = useDialog();

  const enable = async (): Promise<void> => {
    const key = useAuthStore.getState().masterKey;
    // enableBiometric wraps the master key under the auth-per-use Keystore key,
    // which itself shows the system biometric prompt (CryptoObject-bound). No
    // separate availability probe is needed: it rejects if biometrics are
    // unavailable or the user cancels, leaving biometric disabled either way.
    if (key) {
      try {
        await enableBiometric(key);
        if (Platform.OS === 'android' && Platform.Version >= 33) {
          await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        }
      } catch (e) {
        // Cancel is a deliberate choice to skip; only surface real failures.
        if ((e as { code?: string }).code !== 'E_KEYSTORE_CANCELED') {
          void dialog.alert({ title: t('biometric.title'), message: t('biometric.unavailable') });
        }
      }
    }
    router.push('/(onboarding)/autofill');
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
    title: { ...type.title, color: colors.textPrimary },
    body: { ...type.body, color: colors.textSecondary, marginTop: spacing.md },
    ctaEnable: {
      height: 52,
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: spacing['3xl'],
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
        <Text style={styles.title}>{t('biometric.title')}</Text>
        <Text style={styles.body}>{t('biometric.body')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('biometric.ctaEnable')}
          onPress={() => { void enable(); }}
          style={({ pressed }) => [styles.ctaEnable, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={styles.ctaEnableLabel}>{t('biometric.ctaEnable')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('biometric.ctaSkip')}
          onPress={() => router.push('/(onboarding)/autofill')}
          style={({ pressed }) => [styles.ctaSkip, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={styles.ctaSkipLabel}>{t('biometric.ctaSkip')}</Text>
        </Pressable>
      </View>
    </View>
  );
}
