import { useMemo, type JSX } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { buildPreview, executeImport, deleteTempFile } from '@/import/csvImporter';
import { rowsToEntries } from '@/import/parsers';
import type { Mapping } from '@/import/presets';
import { useTheme } from '@/theme';

/** Parses the `mapping` route param, falling back to an empty mapping on malformed input. */
function parseMapping(mapping: string | undefined): Mapping {
  try {
    return JSON.parse(mapping ?? '{}') as Mapping;
  } catch {
    return {};
  }
}

export default function Confirm(): JSX.Element {
  const { t } = useTranslation('import');
  const { colors, spacing, radii, sizes, type } = useTheme();
  const { content, uri, mapping } = useLocalSearchParams<{
    content: string;
    uri: string;
    mapping: string;
  }>();

  const map = useMemo<Mapping>(() => parseMapping(mapping), [mapping]);
  const preview = useMemo(() => buildPreview(content ?? ''), [content]);
  const sim = useMemo(() => rowsToEntries(preview.rows, map), [preview.rows, map]);

  const logins = sim.rows.filter((e) => e.type === 'login').length;
  const notes = sim.rows.filter((e) => e.type === 'note').length;

  const go = async (): Promise<void> => {
    try {
      await executeImport(sim.rows, sim.skipped);
      Alert.alert(t('preview', { logins, notes, skipped: sim.skipped }), t('deleteReminder'));
      router.replace('/(app)/(tabs)');
    } catch {
      Alert.alert(t('importError'));
    } finally {
      if (uri) await deleteTempFile(uri);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    content: {
      padding: spacing.lg,
    },
    title: {
      ...type.title,
      color: colors.textPrimary,
    },
    preview: {
      ...type.body,
      color: colors.textSecondary,
      marginTop: spacing.lg,
    },
    cta: {
      height: sizes.control,
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing['2xl'],
    },
    ctaLabel: {
      ...type.bodyStrong,
      color: colors.onPrimary,
    },
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('title')}</Text>
      <Text style={styles.preview}>{t('preview', { logins, notes, skipped: sim.skipped })}</Text>
      {preview.errorCount > 0 && (
        <Text style={styles.preview}>{t('parseErrors', { count: preview.errorCount })}</Text>
      )}
      <Pressable accessibilityRole="button" onPress={() => void go()} style={styles.cta}>
        <Text style={styles.ctaLabel}>{t('confirm')}</Text>
      </Pressable>
    </ScrollView>
  );
}
