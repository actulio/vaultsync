import { useEffect, useState, type JSX } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  unlockWithPassword,
  unlockWithBiometric,
  readVaultHint,
  RecoverableError,
} from '@/auth/unlock';
import { isBiometricEnabled } from '@/auth/biometric';
import { useAuthStore } from '@/auth/store';
import { useTheme } from '@/theme';

export default function Unlock(): JSX.Element {
  const { t } = useTranslation('auth');
  const { colors, spacing, radii, type } = useTheme();

  const [pw, setPw] = useState('');
  const [pwFocused, setPwFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  useEffect(() => {
    void readVaultHint().then(setHint);
    // Only offer biometric unlock if the user opted in (a Keystore-wrapped key
    // exists). A password-only vault never shows the button.
    void isBiometricEnabled().then(setBiometricEnabled);
  }, []);

  const onBiometric = async (): Promise<void> => {
    // unlockWithBiometric unwraps via the auth-per-use Keystore key, which shows
    // the system biometric prompt (CryptoObject-bound). It rejects with
    // E_KEYSTORE_CANCELED if the user dismisses it — treat that as a no-op.
    try {
      const { masterKey, vault } = await unlockWithBiometric();
      useAuthStore.getState().unlock(masterKey, vault);
      router.replace('/(app)/(tabs)');
    } catch (e) {
      if ((e as { code?: string }).code === 'E_KEYSTORE_CANCELED') return;
      Alert.alert('Error', (e as Error).message);
    }
  };

  const onPasswordSubmit = async (): Promise<void> => {
    setError(null);
    try {
      const { masterKey, vault } = await unlockWithPassword(pw);
      useAuthStore.getState().unlock(masterKey, vault);
      router.replace('/(app)/(tabs)');
    } catch (e) {
      if (e instanceof RecoverableError && e.code === 'wrong_password') {
        setError(t('unlock.wrongPassword'));
      } else {
        Alert.alert('Error', (e as Error).message);
      }
    }
  };

  const styles = StyleSheet.create({
    scroll: { flex: 1, backgroundColor: colors.bg },
    container: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing['4xl'],
      paddingBottom: spacing['3xl'],
      justifyContent: 'center',
      flexGrow: 1,
    },
    title: { ...type.display, color: colors.textPrimary },
    cta: {
      height: 52,
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: spacing['2xl'],
    },
    ctaLabel: { ...type.bodyStrong, color: colors.onPrimary },
    label: { ...type.subhead, color: colors.textSecondary, marginTop: spacing['2xl'] },
    input: {
      height: 52,
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      ...type.body,
      color: colors.textPrimary,
      marginTop: spacing.xs,
    },
    inputFocused: { borderColor: colors.primary },
    errorText: { ...type.caption, color: colors.danger, marginTop: spacing.sm },
    hintToggle: { marginTop: spacing.lg, alignItems: 'center' },
    hintText: { ...type.body, color: colors.textSecondary, textAlign: 'center' },
    forgotLink: { marginTop: spacing['2xl'], alignItems: 'center' },
    forgotText: { ...type.body, color: colors.primary, textAlign: 'center' },
  });

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>{t('unlock.title')}</Text>

      {biometricEnabled && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('unlock.biometricCta')}
          onPress={() => { void onBiometric(); }}
          style={({ pressed }) => [styles.cta, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={styles.ctaLabel}>{t('unlock.biometricCta')}</Text>
        </Pressable>
      )}

      <Text style={styles.label}>{t('unlock.passwordLabel')}</Text>
      <TextInput
        style={[styles.input, pwFocused && styles.inputFocused]}
        accessibilityLabel={t('unlock.passwordLabel')}
        secureTextEntry
        value={pw}
        onChangeText={setPw}
        onFocus={() => setPwFocused(true)}
        onBlur={() => setPwFocused(false)}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
      />

      {error !== null && <Text style={styles.errorText}>{error}</Text>}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('unlock.passwordCta')}
        onPress={() => { void onPasswordSubmit(); }}
        style={({ pressed }) => [styles.cta, { opacity: pressed ? 0.85 : 1 }]}
      >
        <Text style={styles.ctaLabel}>{t('unlock.passwordCta')}</Text>
      </Pressable>

      {hint.length > 0 && (
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowHint((v) => !v)}
          style={styles.hintToggle}
        >
          <Text style={styles.hintText}>
            {showHint ? hint : t('unlock.showHint')}
          </Text>
        </Pressable>
      )}

      <View style={styles.forgotLink}>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push('/recovery-unlock')}
        >
          <Text style={styles.forgotText}>{t('unlock.forgot')}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
