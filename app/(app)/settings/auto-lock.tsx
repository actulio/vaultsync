import { useEffect, useState, type JSX } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { loadPrefs, setAutoLockPref } from '@/settings/prefs';
import { startAutoLock } from '@/auth/autoLock';
import { useTheme } from '@/theme';

/** Sentinel: never auto-lock (timeout the inactivity check can never reach). */
const NEVER_MS = Number.MAX_SAFE_INTEGER;
const MINUTE_MS = 60 * 1000;

type Option = { key: string; ms: number };

const OPTIONS: Option[] = [
  { key: '1', ms: 1 * MINUTE_MS },
  { key: '5', ms: 5 * MINUTE_MS },
  { key: '15', ms: 15 * MINUTE_MS },
  { key: '60', ms: 60 * MINUTE_MS },
  { key: 'never', ms: NEVER_MS },
];

export default function AutoLockScreen(): JSX.Element {
  const { t } = useTranslation('settings');
  const { colors, spacing, radii, type } = useTheme();
  const [currentMs, setCurrentMs] = useState<number>(5 * MINUTE_MS);

  useEffect(() => {
    void loadPrefs().then((prefs) => setCurrentMs(prefs.autoLockMs));
  }, []);

  const choose = async (ms: number): Promise<void> => {
    await setAutoLockPref(ms);
    startAutoLock(ms);
    setCurrentMs(ms);
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    content: {
      paddingTop: spacing['3xl'],
    },
    title: {
      ...type.title,
      color: colors.textPrimary,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    radioOuter: {
      width: 22,
      height: 22,
      borderRadius: radii.pill,
      borderWidth: 2,
      borderColor: colors.primary,
      marginRight: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioInner: {
      width: 12,
      height: 12,
      borderRadius: radii.pill,
      backgroundColor: colors.primary,
    },
    rowLabel: {
      ...type.body,
      color: colors.textPrimary,
    },
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('autoLock.title')}</Text>
      {OPTIONS.map((option) => {
        const selected = currentMs === option.ms;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => void choose(option.ms)}
            style={styles.row}
          >
            <View style={styles.radioOuter}>{selected && <View style={styles.radioInner} />}</View>
            <Text style={styles.rowLabel}>{t(`autoLock.options.${option.key}`)}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
