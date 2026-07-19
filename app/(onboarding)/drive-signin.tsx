import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { JSX } from 'react';
import { isDriveConfigured, signInWithGoogle, skipDriveForNow } from '@/drive/auth';
import { useDialog } from '@/components/DialogProvider';
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
      if (ok) router.replace('/(app)/(tabs)');
    } catch (e) {
      await dialog.alert({ title: tCommon('errorTitle'), message: (e as Error).message });
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
