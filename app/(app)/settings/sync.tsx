import type { JSX } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSyncStore } from '@/sync/store';
import { syncOnce } from '@/sync/orchestrator';
import { signInWithGoogle } from '@/drive/auth';
import { useTheme } from '@/theme';

export default function SyncSettingsScreen(): JSX.Element {
  const { t } = useTranslation('sync');
  const { colors, spacing, radii, sizes, type } = useTheme();
  const s = useSyncStore();

  const isNoToken = s.status === 'paused_no_token';

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing['3xl'],
      paddingBottom: spacing['3xl'],
    },
    title: {
      ...type.title,
      color: colors.textPrimary,
    },
    status: {
      ...type.body,
      color: colors.textSecondary,
      marginTop: spacing.sm,
    },
    meta: {
      ...type.caption,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
    cta: {
      height: sizes.control,
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      justifyContent: 'center',
      alignItems: 'center',
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
      <Text style={styles.status}>{t(`status.${s.status}`)}</Text>
      {s.lastSyncedAt !== null && (
        <Text style={styles.meta}>
          {t('lastSynced', { time: new Date(s.lastSyncedAt).toLocaleTimeString() })}
        </Text>
      )}
      {s.queueDepth > 0 && (
        <Text style={styles.meta}>{t('queueDepth', { n: s.queueDepth })}</Text>
      )}
      <Pressable
        accessibilityRole="button"
        style={styles.cta}
        onPress={() => {
          if (isNoToken) {
            void signInWithGoogle();
          } else {
            void syncOnce();
          }
        }}
      >
        <Text style={styles.ctaLabel}>{isNoToken ? t('connect') : t('syncNow')}</Text>
      </Pressable>
    </ScrollView>
  );
}
