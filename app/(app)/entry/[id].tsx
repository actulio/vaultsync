import type { JSX } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/auth/store';
import { useTheme } from '@/theme';
import { copyAndScheduleClear } from '@/native/clipboardWorker';
import { showToast } from '@/components/toast';
import { persistVault } from '@/vault/persist';
import { deleteEntry } from '@/vault/mutations';
import { useDialog } from '@/components/DialogProvider';

// ---------------------------------------------------------------------------
// Field row — label + value + Copy button
// ---------------------------------------------------------------------------

type FieldProps = {
  label: string;
  value: string;
  onCopy: () => void;
  copyLabel: string;
};

function Field({ label, value, onCopy, copyLabel }: FieldProps): JSX.Element {
  const { colors, spacing, radii, type } = useTheme();
  const fieldStyles = StyleSheet.create({
    card: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      padding: spacing.md,
    },
    label: {
      ...type.caption,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    value: {
      ...type.body,
      color: colors.textPrimary,
      flex: 1,
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
  });

  return (
    <View style={fieldStyles.card}>
      <Text style={fieldStyles.label}>{label}</Text>
      <View style={fieldStyles.row}>
        <Text style={fieldStyles.value} numberOfLines={2}>
          {value}
        </Text>
        <Pressable accessibilityRole="button" onPress={onCopy} style={fieldStyles.copyBtn}>
          <Text style={fieldStyles.copyBtnText}>{copyLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Entry detail screen
// ---------------------------------------------------------------------------

export default function EntryDetail(): JSX.Element {
  const { t } = useTranslation('vault');
  const { colors, spacing, radii, sizes, type } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const dialog = useDialog();

  const vault = useAuthStore((s) => s.vault);
  const masterKey = useAuthStore((s) => s.masterKey);
  const entry = vault?.entries.find((e) => e.id === id);

  const styles = StyleSheet.create({
    scroll: { flex: 1, backgroundColor: colors.bg },
    container: {
      padding: spacing.lg,
    },
    title: {
      ...type.title,
      color: colors.textPrimary,
      marginBottom: spacing.lg,
    },
    fieldsGap: {
      gap: spacing.md,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing['2xl'],
    },
    editBtn: {
      flex: 1,
      height: sizes.control,
      backgroundColor: colors.primary,
      borderRadius: radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    editBtnText: {
      ...type.bodyStrong,
      color: colors.onPrimary,
    },
    deleteBtn: {
      flex: 1,
      height: sizes.control,
      backgroundColor: colors.danger,
      borderRadius: radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteBtnText: {
      ...type.bodyStrong,
      color: colors.onPrimary,
    },
    notFound: {
      ...type.body,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: spacing['4xl'],
    },
  });

  if (!vault || !masterKey || !entry) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <Text style={styles.notFound}>Not found</Text>
      </ScrollView>
    );
  }

  const copyLabel = t('detail.copy');

  const copy = async (text: string): Promise<void> => {
    await copyAndScheduleClear(text);
    showToast(t('detail.copied'));
  };

  const doDelete = async (): Promise<void> => {
    const next = deleteEntry(vault, entry.id);
    useAuthStore.getState().updateVault(next);
    await persistVault(next, masterKey);
    router.back();
  };

  const remove = (): void => {
    void dialog
      .confirm({
        title: t('detail.confirmDelete'),
        confirmLabel: t('detail.delete'),
        cancelLabel: t('detail.cancel'),
        destructive: true,
      })
      .then((ok) => {
        if (ok) void doDelete();
      });
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.title}>{entry.title}</Text>

      {entry.type === 'login' ? (
        <View style={styles.fieldsGap}>
          <Field
            label={t('detail.username')}
            value={entry.username}
            onCopy={() => void copy(entry.username)}
            copyLabel={copyLabel}
          />
          <Field
            label={t('detail.password')}
            value="••••••••"
            onCopy={() => void copy(entry.password)}
            copyLabel={copyLabel}
          />
          {entry.url != null && (
            <Field
              label={t('detail.url')}
              value={entry.url}
              onCopy={() => {
                const url = entry.url;
                if (url != null) void copy(url);
              }}
              copyLabel={copyLabel}
            />
          )}
          {entry.notes != null && (
            <Field
              label={t('detail.notes')}
              value={entry.notes}
              onCopy={() => {
                const notes = entry.notes;
                if (notes != null) void copy(notes);
              }}
              copyLabel={copyLabel}
            />
          )}
        </View>
      ) : (
        <View style={styles.fieldsGap}>
          <Field
            label={t('detail.body')}
            value={entry.body}
            onCopy={() => void copy(entry.body)}
            copyLabel={copyLabel}
          />
        </View>
      )}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({ pathname: '/(app)/entry/edit/[id]', params: { id: entry.id } })
          }
          style={styles.editBtn}
        >
          <Text style={styles.editBtnText}>{t('detail.edit')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={remove}
          style={styles.deleteBtn}
        >
          <Text style={styles.deleteBtnText}>{t('detail.delete')}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
