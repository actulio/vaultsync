import type { JSX } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';

// `path` is typed against the expo-router typed-route table (via .expo/types)
// instead of a bare `string`, so the literals below stay validated against the
// actual route list. Restricted to the string half of `Href` (excluding the
// `{ pathname, params }` object form) so it also works as a React list `key`.
type RoutePath = Extract<Href, string>;
type Row = { label: string; path: RoutePath };

export default function SettingsScreen(): JSX.Element {
  const { t } = useTranslation('settings');
  const { colors, spacing, type } = useTheme();

  const rows: Row[] = [
    { label: t('rows.language'), path: '/(app)/settings/language' },
    { label: t('rows.autoLock'), path: '/(app)/settings/auto-lock' },
    { label: t('rows.changePassword'), path: '/(app)/settings/change-password' },
    { label: t('rows.sync'), path: '/(app)/settings/sync' },
  ];

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    row: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    rowLabel: {
      ...type.body,
      color: colors.textPrimary,
    },
  });

  return (
    <ScrollView style={styles.container}>
      {rows.map((row) => (
        <Pressable
          key={row.path}
          accessibilityRole="button"
          onPress={() => router.push(row.path)}
          style={styles.row}
        >
          <Text style={styles.rowLabel}>{row.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
