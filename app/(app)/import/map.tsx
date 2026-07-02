import { useMemo, useState, type JSX } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { buildPreview } from '@/import/csvImporter';
import type { Mapping } from '@/import/presets';
import { useTheme } from '@/theme';

const MAPPABLE_FIELDS = ['title', 'username', 'password', 'url', 'notes'] as const;
type MappableField = (typeof MAPPABLE_FIELDS)[number];

export default function Map(): JSX.Element {
  const { t } = useTranslation('import');
  const { colors, spacing, radii, sizes, type } = useTheme();
  const { content, uri } = useLocalSearchParams<{ content: string; uri: string }>();
  const preview = useMemo(() => buildPreview(content ?? ''), [content]);
  const [mapping, setMapping] = useState<Mapping>(preview.inferredMapping ?? {});

  const setField = (field: MappableField, header: string): void =>
    setMapping((m) => ({ ...m, [field]: header }));

  const goNext = (): void => {
    router.push({
      pathname: '/(app)/import/confirm',
      params: { content: content ?? '', uri, mapping: JSON.stringify(mapping) },
    });
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    content: {
      padding: spacing.lg,
    },
    detected: {
      ...type.body,
      color: colors.textSecondary,
      marginBottom: spacing.lg,
    },
    sectionTitle: {
      ...type.heading,
      color: colors.textPrimary,
    },
    fieldBlock: {
      marginTop: spacing.lg,
    },
    fieldLabel: {
      ...type.caption,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    chipRow: {
      flexDirection: 'row',
    },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radii.pill,
      backgroundColor: colors.surfaceAlt,
      marginRight: spacing.sm,
    },
    chipActive: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radii.pill,
      backgroundColor: colors.primary,
      marginRight: spacing.sm,
    },
    chipText: {
      ...type.subhead,
      color: colors.textPrimary,
    },
    chipTextActive: {
      ...type.subhead,
      color: colors.onPrimary,
    },
    nextBtn: {
      height: sizes.control,
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing['2xl'],
    },
    nextBtnLabel: {
      ...type.bodyStrong,
      color: colors.onPrimary,
    },
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {preview.inferredPreset && (
        <Text style={styles.detected}>{t('detected', { name: preview.inferredPreset })}</Text>
      )}
      <Text style={styles.sectionTitle}>{t('mapColumns')}</Text>
      {MAPPABLE_FIELDS.map((field) => (
        <View key={field} style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>{t(`fields.${field}`)}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {preview.headers.map((h) => {
                const active = mapping[field] === h;
                return (
                  <Pressable
                    key={h}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => setField(field, h)}
                    style={active ? styles.chipActive : styles.chip}
                  >
                    <Text style={active ? styles.chipTextActive : styles.chipText}>{h}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      ))}
      <Pressable accessibilityRole="button" onPress={goNext} style={styles.nextBtn}>
        <Text style={styles.nextBtnLabel}>{t('next')}</Text>
      </Pressable>
    </ScrollView>
  );
}
