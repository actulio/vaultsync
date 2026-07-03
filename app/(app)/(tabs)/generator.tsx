import type { JSX } from 'react';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
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
      height: sizes.control,
      backgroundColor: colors.surfaceAlt,
      borderRadius: radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.lg,
    },
    copyBtnText: {
      color: colors.textPrimary,
    },
  });

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <PasswordGenerator onChange={setPw} />
      <Pressable
        accessibilityRole="button"
        style={styles.copyBtn}
        disabled={pw === ''}
        onPress={() => { if (pw !== '') void copyAndScheduleClear(pw, 30); }}
      >
        <Text style={styles.copyBtnText}>{t('detail.copy')}</Text>
      </Pressable>
    </ScrollView>
  );
}
