import { useState } from 'react';
import type { JSX } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/auth/store';
import { useTheme } from '@/theme';
import { searchEntries, type EntryTypeFilter } from '@/vault/search';

const FILTERS: readonly EntryTypeFilter[] = ['all', 'login', 'note'] as const;

export default function VaultList(): JSX.Element {
  const { t } = useTranslation('vault');
  const { colors, spacing, radii, type } = useTheme();
  const vault = useAuthStore((s) => s.vault);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<EntryTypeFilter>('all');

  if (!vault) return <View />;

  const entries = searchEntries(vault, q, filter);

  const filterLabels: Record<EntryTypeFilter, string> = {
    all: t('list.filterAll'),
    login: t('list.filterLogin'),
    note: t('list.filterNote'),
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
    searchInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      ...type.body,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
    },
    pillRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    pillActive: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radii.pill,
    },
    pillInactive: {
      backgroundColor: colors.surfaceAlt,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radii.pill,
    },
    pillTextActive: {
      ...type.bodyStrong,
      color: colors.onPrimary,
    },
    pillTextInactive: {
      ...type.body,
      color: colors.textPrimary,
    },
    list: {
      marginTop: spacing.lg,
    },
    row: {
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowTitle: {
      ...type.bodyStrong,
      color: colors.textPrimary,
    },
    rowSubtitle: {
      ...type.body,
      color: colors.textSecondary,
    },
    emptyText: {
      textAlign: 'center',
      marginTop: spacing['4xl'],
      ...type.body,
      color: colors.textSecondary,
    },
    fab: {
      position: 'absolute',
      bottom: spacing['2xl'],
      right: spacing['2xl'],
      width: 56,
      height: 56,
      borderRadius: radii.pill,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fabLabel: {
      ...type.title,
      color: colors.onPrimary,
    },
  });

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        value={q}
        onChangeText={setQ}
        placeholder={t('list.searchPlaceholder')}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <View style={styles.pillRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={filter === f ? styles.pillActive : styles.pillInactive}
            accessibilityRole="button"
          >
            <Text style={filter === f ? styles.pillTextActive : styles.pillTextInactive}>
              {filterLabels[f]}
            </Text>
          </Pressable>
        ))}
      </View>

      {entries.length === 0 ? (
        <Text style={styles.emptyText}>{t('list.empty')}</Text>
      ) : (
        <FlatList
          style={styles.list}
          data={entries}
          keyExtractor={(e) => e.id}
          renderItem={({ item }) => (
            <Link href={{ pathname: '/(app)/entry/[id]', params: { id: item.id } }} asChild>
              <Pressable style={styles.row}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                {item.type === 'login' && (
                  <Text style={styles.rowSubtitle}>{item.username}</Text>
                )}
              </Pressable>
            </Link>
          )}
        />
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('list.fab')}
        onPress={() => {
          router.push('/(app)/entry/new');
        }}
        style={styles.fab}
      >
        <Text style={styles.fabLabel}>+</Text>
      </Pressable>
    </View>
  );
}
