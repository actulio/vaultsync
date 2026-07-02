import { useEffect } from 'react';
import type { JSX } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/auth/store';
import { useTheme } from '@/theme';
import { copyAndScheduleClear } from '@/native/clipboardWorker';
import type { Login } from '@/vault/types';

// ---------------------------------------------------------------------------
// Quick-search — deep-link target for the fallback autofill notification.
//
// Opened via `vaultsync://search?domain=<...>&package=<...>`. Both params are
// always present (the sender defaults the absent one to ''), so an empty
// string means "absent", not "search for the empty string".
// ---------------------------------------------------------------------------

export default function QuickSearch(): JSX.Element {
  const { t } = useTranslation('vault');
  const { colors, spacing, radii, type } = useTheme();
  const { domain, package: pkg } = useLocalSearchParams<{ domain?: string; package?: string }>();
  const vault = useAuthStore((s) => s.vault);
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    if (status === 'locked') router.replace('/unlock');
    else if (status === 'no_vault') router.replace('/(onboarding)/welcome');
  }, [status]);

  if (!vault) return <View />;

  const domainTerm = domain ?? '';
  const pkgTerm = pkg ?? '';
  const term = domainTerm !== '' ? domainTerm : pkgTerm;
  const lowerTerm = term.toLowerCase();

  const filtered = vault.entries.filter((e): e is Login => {
    if (e.type !== 'login') return false;
    if (lowerTerm === '') return false;
    const titleMatch = e.title.toLowerCase().includes(lowerTerm);
    const urlMatch = (e.url ?? '').toLowerCase().includes(lowerTerm);
    const pkgMatch = pkgTerm !== '' && (e.packageNames?.includes(pkgTerm) ?? false);
    return titleMatch || urlMatch || pkgMatch;
  });

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
    header: {
      ...type.bodyStrong,
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },
    list: {
      marginTop: spacing.sm,
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
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    copyBtn: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radii.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    copyBtnText: {
      ...type.subhead,
      color: colors.textPrimary,
    },
    emptyText: {
      textAlign: 'center',
      marginTop: spacing['4xl'],
      ...type.body,
      color: colors.textSecondary,
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.header}>
        {term === '' ? t('list.searchPlaceholder') : `${t('list.searchPlaceholder')}: ${term}`}
      </Text>

      {filtered.length === 0 ? (
        <Text style={styles.emptyText}>{t('list.empty')}</Text>
      ) : (
        <FlatList
          style={styles.list}
          data={filtered}
          keyExtractor={(e) => e.id}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowSubtitle}>{item.username}</Text>
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    void copyAndScheduleClear(item.username, 30);
                  }}
                  style={styles.copyBtn}
                >
                  <Text style={styles.copyBtnText}>{t('detail.username')}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    void copyAndScheduleClear(item.password, 30);
                  }}
                  style={styles.copyBtn}
                >
                  <Text style={styles.copyBtnText}>{t('detail.password')}</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}
