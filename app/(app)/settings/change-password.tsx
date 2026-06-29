import { useState, type JSX } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/auth/store';
import { changeMasterPassword } from '@/settings/changePassword';
import { deriveMasterKey } from '@/crypto/argon2';
import { decodeVaultFile } from '@/vault/format';
import { VaultStore } from '@/native/keystore';
import { useTheme } from '@/theme';

export default function ChangePasswordScreen(): JSX.Element {
  const { t } = useTranslation('settings');
  const { colors, spacing, radii, sizes, type } = useTheme();
  const [cur, setCur] = useState('');
  const [npw, setNpw] = useState('');
  const [conf, setConf] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (): Promise<void> => {
    setError(null);
    if (npw.length < 8) {
      setError(t('changePassword.errorTooShort'));
      return;
    }
    if (npw !== conf) {
      setError(t('changePassword.errorMismatch'));
      return;
    }
    setBusy(true);
    try {
      // Re-derive the current master key from the entered password. If it is
      // wrong, changeMasterPassword's payload decrypt fails and we surface an error.
      const vaultBytes = await VaultStore.read('vault.enc');
      const fields = decodeVaultFile(vaultBytes);
      const candidate = await deriveMasterKey(cur, fields.salt, fields.argon2);
      const { newRecoveryCode, newMasterKey } = await changeMasterPassword(candidate, npw);

      const vault = useAuthStore.getState().vault;
      if (vault) useAuthStore.getState().unlock(newMasterKey, vault);

      router.replace({
        pathname: '/(onboarding)/recovery-code',
        params: { code: newRecoveryCode, from: 'settings' },
      });
    } catch {
      setError(t('changePassword.errorWrongCurrent'));
    } finally {
      setBusy(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing['3xl'],
      paddingBottom: spacing['3xl'],
    },
    title: {
      ...type.title,
      color: colors.textPrimary,
    },
    body: {
      ...type.body,
      color: colors.textSecondary,
      marginTop: spacing.sm,
    },
    fieldLabel: {
      ...type.subhead,
      color: colors.textSecondary,
      marginTop: spacing.lg,
      marginBottom: spacing.xs,
    },
    input: {
      height: sizes.control,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      ...type.body,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
    },
    error: {
      ...type.caption,
      color: colors.danger,
      marginTop: spacing.lg,
    },
    cta: {
      height: sizes.control,
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: spacing['2xl'],
    },
    ctaDisabled: {
      opacity: 0.4,
    },
    ctaLabel: {
      ...type.bodyStrong,
      color: colors.onPrimary,
    },
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('changePassword.title')}</Text>
      <Text style={styles.body}>{t('changePassword.body')}</Text>

      <Text style={styles.fieldLabel}>{t('changePassword.current')}</Text>
      <TextInput
        accessibilityLabel={t('changePassword.current')}
        style={styles.input}
        value={cur}
        onChangeText={setCur}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={colors.textMuted}
      />

      <Text style={styles.fieldLabel}>{t('changePassword.new')}</Text>
      <TextInput
        accessibilityLabel={t('changePassword.new')}
        style={styles.input}
        value={npw}
        onChangeText={setNpw}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={colors.textMuted}
      />

      <Text style={styles.fieldLabel}>{t('changePassword.confirm')}</Text>
      <TextInput
        accessibilityLabel={t('changePassword.confirm')}
        style={styles.input}
        value={conf}
        onChangeText={setConf}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={colors.textMuted}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('changePassword.cta')}
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={() => void onSubmit()}
        style={({ pressed }) => [
          styles.cta,
          busy && styles.ctaDisabled,
          !busy && pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={styles.ctaLabel}>{t('changePassword.cta')}</Text>
      </Pressable>
    </ScrollView>
  );
}
