import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { useTranslation } from 'react-i18next';

import { generatePassword, type GeneratorOptions } from '@/generator/generate';
import { DEFAULT_OPTIONS } from '@/generator/presets';
import { copyAndScheduleClear } from '@/native/clipboardWorker';
import { useTheme } from '@/theme';

// ---------------------------------------------------------------------------
// Toggle row — label + Switch
// ---------------------------------------------------------------------------

type ToggleProps = {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
};

function Toggle({ label, value, onChange }: ToggleProps): JSX.Element {
  const { colors, spacing } = useTheme();
  const s = StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    label: {
      color: colors.textPrimary,
    },
  });
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Generator screen
// ---------------------------------------------------------------------------

export default function GeneratorScreen(): JSX.Element {
  const { t } = useTranslation('vault');
  const { colors, spacing, radii, sizes, type } = useTheme();

  const [opts, setOpts] = useState<GeneratorOptions>(DEFAULT_OPTIONS);
  const [pw, setPw] = useState<string>('');

  const regen = async (): Promise<void> => {
    try {
      setPw(await generatePassword(opts));
    } catch {
      setPw('');
    }
  };

  // Re-generate whenever any option changes (including on mount).
  useEffect(() => { void regen(); }, [opts.length, opts.lower, opts.upper, opts.digits, opts.symbols, opts.avoidAmbiguous]);

  const styles = StyleSheet.create({
    scroll: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    container: {
      padding: spacing.lg,
    },
    pwBox: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    pwText: {
      ...type.mono,
      // type.mono.fontFamily is 'Menlo' (iOS-only); override so Android renders monospaced.
      fontFamily: 'monospace',
      textAlign: 'center',
      color: colors.textPrimary,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    generateBtn: {
      flex: 1,
      height: sizes.control,
      backgroundColor: colors.primary,
      borderRadius: radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    generateBtnText: {
      color: colors.onPrimary,
    },
    copyBtn: {
      flex: 1,
      height: sizes.control,
      backgroundColor: colors.surfaceAlt,
      borderRadius: radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copyBtnText: {
      color: colors.textPrimary,
    },
    lengthLabel: {
      color: colors.textPrimary,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.xs,
    },
    toggleSection: {
      marginTop: spacing.md,
    },
  });

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      {/* Password display */}
      <View style={styles.pwBox}>
        <Text style={styles.pwText} numberOfLines={3} selectable>
          {pw !== '' ? pw : '—'}
        </Text>
      </View>

      {/* Generate + Copy buttons */}
      <View style={styles.buttonRow}>
        <Pressable
          accessibilityRole="button"
          style={styles.generateBtn}
          onPress={() => { void regen(); }}
        >
          <Text style={styles.generateBtnText}>{t('edit.generate')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={styles.copyBtn}
          disabled={pw === ''}
          onPress={() => { if (pw !== '') void copyAndScheduleClear(pw, 30); }}
        >
          <Text style={styles.copyBtnText}>{t('detail.copy')}</Text>
        </Pressable>
      </View>

      {/* Length slider */}
      <Text style={styles.lengthLabel}>
        {t('generator.length')}: {opts.length}
      </Text>
      <Slider
        minimumValue={8}
        maximumValue={64}
        step={1}
        value={opts.length}
        onValueChange={(n) => { setOpts({ ...opts, length: Math.round(n) }); }}
        minimumTrackTintColor={colors.primary}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.primary}
      />

      {/* Character-class toggles */}
      <View style={styles.toggleSection}>
        <Toggle
          label={t('generator.lower')}
          value={opts.lower}
          onChange={(v) => { setOpts({ ...opts, lower: v }); }}
        />
        <Toggle
          label={t('generator.upper')}
          value={opts.upper}
          onChange={(v) => { setOpts({ ...opts, upper: v }); }}
        />
        <Toggle
          label={t('generator.digits')}
          value={opts.digits}
          onChange={(v) => { setOpts({ ...opts, digits: v }); }}
        />
        <Toggle
          label={t('generator.symbols')}
          value={opts.symbols}
          onChange={(v) => { setOpts({ ...opts, symbols: v }); }}
        />
        <Toggle
          label={t('generator.avoidAmbiguous')}
          value={opts.avoidAmbiguous}
          onChange={(v) => { setOpts({ ...opts, avoidAmbiguous: v }); }}
        />
      </View>
    </ScrollView>
  );
}
