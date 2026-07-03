import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { useTranslation } from 'react-i18next';

import { generatePassword, type GeneratorOptions } from '@/generator/generate';
import { DEFAULT_OPTIONS } from '@/generator/presets';
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
// PasswordGenerator — reusable generation controls
//
// Owns its own `opts` state, regenerates on mount and whenever any option
// changes, and reports every newly generated password via `onChange`.
// Callers (e.g. the Generator tab) render this for the result box + length
// slider + class toggles + Generate button, and layer their own actions
// (like Copy) around it.
// ---------------------------------------------------------------------------

export function PasswordGenerator({
  initialOptions,
  onChange,
}: {
  initialOptions?: GeneratorOptions;
  onChange: (password: string) => void;
}): JSX.Element {
  const { t } = useTranslation('vault');
  const { colors, spacing, radii, sizes, type } = useTheme();

  const [opts, setOpts] = useState<GeneratorOptions>(initialOptions ?? DEFAULT_OPTIONS);
  const [pw, setPw] = useState<string>('');

  const regen = async (): Promise<void> => {
    try {
      const next = await generatePassword(opts);
      setPw(next);
      onChange(next);
    } catch {
      setPw('');
    }
  };

  // Re-generate whenever any option changes (including on mount).
  useEffect(() => { void regen(); }, [opts.length, opts.lower, opts.upper, opts.digits, opts.symbols, opts.avoidAmbiguous]);

  const styles = StyleSheet.create({
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
    generateBtn: {
      height: sizes.control,
      backgroundColor: colors.primary,
      borderRadius: radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    generateBtnText: {
      color: colors.onPrimary,
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
    <>
      {/* Password display */}
      <View style={styles.pwBox}>
        <Text style={styles.pwText} numberOfLines={3} selectable>
          {pw !== '' ? pw : '—'}
        </Text>
      </View>

      {/* Generate button */}
      <Pressable
        accessibilityRole="button"
        style={styles.generateBtn}
        onPress={() => { void regen(); }}
      >
        <Text style={styles.generateBtnText}>{t('edit.generate')}</Text>
      </Pressable>

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
    </>
  );
}
