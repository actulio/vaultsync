import type { JSX } from 'react';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PasswordGenerator } from '@/generator/PasswordGenerator';
import { copyAndScheduleClear } from '@/native/clipboardWorker';
import { useTheme } from '@/theme';

// ---------------------------------------------------------------------------
// Generator screen — renders the shared PasswordGenerator controls and owns
// only the Copy action (reads the current password via onChange).
// ---------------------------------------------------------------------------

export default function GeneratorScreen(): JSX.Element {
  const { t } = useTranslation('vault');
  const { colors, spacing, radii, sizes } = useTheme();

  const [pw, setPw] = useState<string>('');

  const styles = StyleSheet.create({
    scroll: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    container: {
      padding: spacing.lg,
    },
    copyBtn: {
      flexDirection: 'row',
      height: sizes.control,
      backgroundColor: colors.surfaceAlt,
      borderRadius: radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    copyBtnIcon: {
      color: colors.textPrimary,
    },
    copyBtnText: {
      color: colors.textPrimary,
    },
  });

  const copyLabel = t('detail.copy');

  const copy = async (): Promise<void> => {
    if (pw === '') return;
    await copyAndScheduleClear(pw, 30);
    Alert.alert(t('generator.copied'));
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <PasswordGenerator onChange={setPw} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copyLabel}
        style={styles.copyBtn}
        disabled={pw === ''}
        onPress={() => { void copy(); }}
      >
        <Text style={styles.copyBtnIcon} accessibilityLabel={copyLabel} testID="generator-copy-icon">⧉</Text>
        <Text style={styles.copyBtnText}>{copyLabel}</Text>
      </Pressable>
    </ScrollView>
  );
}
