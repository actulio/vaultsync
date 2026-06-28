import { useState, type JSX } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { createVault } from '@/auth/onboarding';
import { useAuthStore } from '@/auth/store';
import { useTheme } from '@/theme';

export default function SetPassword(): JSX.Element {
  const { t } = useTranslation('onboarding');
  const { colors, spacing, radii, type } = useTheme();

  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [hint, setHint] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);
  const [hintFocused, setHintFocused] = useState(false);

  const onSubmit = async (): Promise<void> => {
    if (pw.length < 8) {
      setError(t('setPassword.errorTooShort'));
      return;
    }
    if (pw !== confirm) {
      setError(t('setPassword.errorMismatch'));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const result = await createVault({ password: pw, hint });
      useAuthStore.getState().unlock(result.masterKey, result.vault);
      router.push({
        pathname: '/(onboarding)/recovery-code',
        params: { code: result.recoveryCode },
      });
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const styles = StyleSheet.create({
    scroll: { flex: 1, backgroundColor: colors.bg },
    container: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing['4xl'],
      paddingBottom: spacing['3xl'],
    },
    title: { ...type.title, color: colors.textPrimary },
    body: { ...type.body, color: colors.textSecondary, marginTop: spacing.sm },
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
    hintWarning: { ...type.caption, color: colors.textMuted, marginTop: spacing.xs },
    errorText: { ...type.caption, color: colors.danger, marginTop: spacing.md },
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
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{t('setPassword.title')}</Text>
      <Text style={styles.body}>{t('setPassword.body')}</Text>

      <Text style={styles.label}>{t('setPassword.passwordLabel')}</Text>
      <TextInput
        style={[styles.input, pwFocused && styles.inputFocused]}
        accessibilityLabel={t('setPassword.passwordLabel')}
        secureTextEntry
        value={pw}
        onChangeText={setPw}
        onFocus={() => setPwFocused(true)}
        onBlur={() => setPwFocused(false)}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={styles.label}>{t('setPassword.confirmLabel')}</Text>
      <TextInput
        style={[styles.input, confirmFocused && styles.inputFocused]}
        accessibilityLabel={t('setPassword.confirmLabel')}
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
        onFocus={() => setConfirmFocused(true)}
        onBlur={() => setConfirmFocused(false)}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={styles.label}>{t('setPassword.hintLabel')}</Text>
      <TextInput
        style={[styles.input, hintFocused && styles.inputFocused]}
        accessibilityLabel={t('setPassword.hintLabel')}
        value={hint}
        onChangeText={setHint}
        onFocus={() => setHintFocused(true)}
        onBlur={() => setHintFocused(false)}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={styles.hintWarning}>{t('setPassword.hintWarning')}</Text>

      {error !== null && <Text style={styles.errorText}>{error}</Text>}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('setPassword.cta')}
        disabled={submitting}
        onPress={() => { void onSubmit(); }}
        style={({ pressed }) => [
          styles.cta,
          submitting && styles.ctaDisabled,
          !submitting && pressed && { opacity: 0.85 },
        ]}
      >
        {submitting ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.ctaLabel}>{t('setPassword.cta')}</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}
