import { useState, type JSX } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { recoverAndReset } from '@/auth/recovery';
import { RecoverableError } from '@/auth/unlock';
import { useTheme } from '@/theme';
import { useDialog } from '@/components/DialogProvider';

export default function RecoveryUnlock(): JSX.Element {
  const { t } = useTranslation('auth');
  const { t: tCommon } = useTranslation('common');
  const { colors, spacing, radii, type } = useTheme();
  const dialog = useDialog();

  const [code, setCode] = useState('');
  const [newPw, setNewPw] = useState('');
  const [codeFocused, setCodeFocused] = useState(false);
  const [newPwFocused, setNewPwFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (): Promise<void> => {
    setError(null);
    setSubmitting(true);
    try {
      const { newRecoveryCode } = await recoverAndReset(code, newPw);
      router.replace({
        pathname: '/(onboarding)/recovery-code',
        params: { code: newRecoveryCode },
      });
    } catch (e) {
      if (e instanceof RecoverableError && e.code === 'wrong_recovery_code') {
        setError(t('recoveryUnlock.invalid'));
      } else {
        void dialog.alert({ title: tCommon('errorTitle'), message: (e as Error).message });
      }
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
      flexGrow: 1,
      justifyContent: 'center',
    },
    title: { ...type.display, color: colors.textPrimary },
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
    errorText: { ...type.caption, color: colors.danger, marginTop: spacing.sm },
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
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>{t('recoveryUnlock.title')}</Text>
      <Text style={styles.body}>{t('recoveryUnlock.body')}</Text>

      <Text style={styles.label}>{t('recoveryUnlock.codeLabel')}</Text>
      <TextInput
        style={[styles.input, codeFocused && styles.inputFocused]}
        accessibilityLabel={t('recoveryUnlock.codeLabel')}
        value={code}
        onChangeText={setCode}
        onFocus={() => setCodeFocused(true)}
        onBlur={() => setCodeFocused(false)}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
      />

      <Text style={styles.label}>{t('recoveryUnlock.newPasswordLabel')}</Text>
      <TextInput
        style={[styles.input, newPwFocused && styles.inputFocused]}
        accessibilityLabel={t('recoveryUnlock.newPasswordLabel')}
        secureTextEntry
        value={newPw}
        onChangeText={setNewPw}
        onFocus={() => setNewPwFocused(true)}
        onBlur={() => setNewPwFocused(false)}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
      />

      {error !== null && <Text style={styles.errorText}>{error}</Text>}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('recoveryUnlock.cta')}
        disabled={submitting}
        onPress={() => { void submit(); }}
        style={({ pressed }) => [
          styles.cta,
          submitting && styles.ctaDisabled,
          !submitting && pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={styles.ctaLabel}>{t('recoveryUnlock.cta')}</Text>
      </Pressable>
    </ScrollView>
  );
}
