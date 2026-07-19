import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { JSX } from 'react';
import { isDriveConfigured, signInWithGoogle, skipDriveForNow } from '@/drive/auth';
import { useDialog } from '@/components/DialogProvider';
import { showToast } from '@/components/toast';
import { useTheme } from '@/theme';

export default function DriveSignin(): JSX.Element {
  const { t } = useTranslation('onboarding');
  const { t: tSync } = useTranslation('sync');
  const { t: tCommon } = useTranslation('common');
  const { colors, spacing, radii, type } = useTheme();
  const dialog = useDialog();

  const connect = async (): Promise<void> => {
    if (!isDriveConfigured()) {
      await dialog.alert({ title: tCommon('errorTitle'), message: tSync('notConfigured') });
      return;
    }
    try {
      const ok = await signInWithGoogle();
      if (ok) {
        router.replace('/(app)/(tabs)');
        return;
      }
      // `false` means the user cancelled the OAuth prompt, or Google returned
      // no refresh token. Not an error — non-blocking toast, and we stay on
      // this screen so the user can retry or skip.
      showToast(tSync('connectCancelled'));
    } catch (e) {
      // exchangeCodeAsync messages are untranslated and can embed the token
      // endpoint URL and OAuth error payloads. Log the detail for debugging
      // (never the auth code or token) and show the friendly PT/EN copy.
      console.warn('[drive-signin] Google sign-in failed:', (e as Error).message);
      await dialog.alert({ title: tCommon('errorTitle'), message: tSync('signInFailed') });
    }
  };

  const skip = (): void => {
    skipDriveForNow();
    router.replace('/(app)/(tabs)');
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
      paddingHorizontal: spacing.xl,
      justifyContent: 'center',
    },
    title: { ...type.title, color: colors.textPrimary },
    body: { ...type.body, color: colors.textSecondary, marginTop: spacing.md },
    ctaConnect: {
      height: 52,
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: spacing['3xl'],
    },
    ctaConnectLabel: { ...type.bodyStrong, color: colors.onPrimary },
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
    <View style={styles.container}>
      <Text style={styles.title}>{t('driveSignin.title')}</Text>
      <Text style={styles.body}>{t('driveSignin.body')}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('driveSignin.ctaConnect')}
        onPress={() => { void connect(); }}
        style={({ pressed }) => [styles.ctaConnect, { opacity: pressed ? 0.85 : 1 }]}
      >
        <Text style={styles.ctaConnectLabel}>{t('driveSignin.ctaConnect')}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('driveSignin.ctaSkip')}
        onPress={skip}
        style={({ pressed }) => [styles.ctaSkip, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Text style={styles.ctaSkipLabel}>{t('driveSignin.ctaSkip')}</Text>
      </Pressable>
    </View>
  );
}
