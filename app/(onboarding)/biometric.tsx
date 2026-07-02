import { Alert, PermissionsAndroid, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { JSX } from 'react';
import { Biometric } from '@/native/biometric';
import { Keystore, VaultStore } from '@/native/keystore';
import { useAuthStore } from '@/auth/store';
import { useTheme } from '@/theme';

export default function BiometricEnroll(): JSX.Element {
  const { t } = useTranslation('onboarding');
  const { colors, spacing, radii, type } = useTheme();

  const enable = async (): Promise<void> => {
    const result = await Biometric.prompt(t('biometric.title'), t('biometric.body'));
    if (result === 'unavailable') {
      Alert.alert(t('biometric.title'), 'Biometric unavailable on this device.');
      router.push('/(onboarding)/drive-signin');
      return;
    }
    if (result !== 'success') return;
    const key = useAuthStore.getState().masterKey;
    if (!key) return;
    await Keystore.generateKeyIfMissing();
    const wrapped = await Keystore.wrap(key);
    await VaultStore.write('masterKey.wrapped', wrapped);
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    }
    router.push('/(onboarding)/drive-signin');
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
          onPress={() => router.push('/(onboarding)/drive-signin')}
          style={({ pressed }) => [styles.ctaSkip, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={styles.ctaSkipLabel}>{t('biometric.ctaSkip')}</Text>
        </Pressable>
      </View>
    </View>
  );
}
