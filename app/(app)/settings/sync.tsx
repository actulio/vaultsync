import { useEffect, type JSX } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSyncStore } from '@/sync/store';
import { syncOnce } from '@/sync/orchestrator';
import { hasDriveToken, isDriveConfigured, signInWithGoogle } from '@/drive/auth';
import { useDialog } from '@/components/DialogProvider';
import { showToast } from '@/components/toast';
import { useTheme } from '@/theme';

export default function SyncSettingsScreen(): JSX.Element {
  const { t } = useTranslation('sync');
  const { t: tCommon } = useTranslation('common');
  const { colors, spacing, radii, sizes, type } = useTheme();
  const dialog = useDialog();
  const s = useSyncStore();

  const isNoToken = s.status === 'paused_no_token';

  // The store initialises to 'idle', which rendered "Sync now" even with no
  // token — the first tap then ran syncOnce() and appeared to do nothing.
  // Resolve token presence on mount so the CTA is correct from first paint.
  useEffect(() => {
    void hasDriveToken().then((has) => {
      if (!has) useSyncStore.getState().setStatus('paused_no_token');
    });
  }, []);

  const connect = async (): Promise<void> => {
    if (!isDriveConfigured()) {
      useSyncStore.getState().setStatus('error', 'not_configured');
      await dialog.alert({ title: tCommon('errorTitle'), message: t('notConfigured') });
      return;
    }
    try {
      const ok = await signInWithGoogle();
      // signInWithGoogle() never touches the sync store, and the mount effect
      // has a [] dep so it never re-runs — neither outcome would move the UI on
      // its own. Re-probe SecureStore rather than setting the status blind: it
      // is the single authority on whether a refresh token now exists, and the
      // same probe covers both the success and the false path.
      const has = await hasDriveToken();
      useSyncStore.getState().setStatus(has ? 'idle' : 'paused_no_token');
      // `false` means the user cancelled the OAuth prompt, or Google returned
      // no refresh token. A cancellation is not an error the user needs to
      // dismiss — non-blocking toast, never the blocking dialog.
      showToast(ok ? t('connected') : t('connectCancelled'));
    } catch (e) {
      useSyncStore.getState().setStatus('error', (e as Error).message);
      await dialog.alert({ title: tCommon('errorTitle'), message: t('signInFailed') });
    }
  };

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
      <Text style={styles.status}>
        {s.status === 'idle' && s.lastSyncedAt === null
          ? t('neverSynced')
          : t(`status.${s.status}`)}
      </Text>
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
            void connect();
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
