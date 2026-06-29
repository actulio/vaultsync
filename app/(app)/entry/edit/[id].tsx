import type { JSX } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '@/auth/store';
import { useTheme } from '@/theme';
import { updateEntry } from '@/vault/mutations';
import { persistVault } from '@/vault/persist';
import { EntryForm } from '@/vault/EntryForm';
import type { EntryFormResult } from '@/vault/EntryForm';
export default function EditEntry(): JSX.Element {
  const { colors, spacing, type } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const vault = useAuthStore((s) => s.vault);
  const entry = vault?.entries.find((e) => e.id === id);

  const notFoundStyles = StyleSheet.create({
    scroll: { flex: 1, backgroundColor: colors.bg },
    container: { padding: spacing.lg },
    text: {
      ...type.body,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: spacing['4xl'],
    },
  });

  if (!entry) {
    return (
      <ScrollView
        style={notFoundStyles.scroll}
        contentContainerStyle={notFoundStyles.container}
      >
        <Text style={notFoundStyles.text}>Not found</Text>
      </ScrollView>
    );
  }

  const handleSubmit = async (r: EntryFormResult): Promise<void> => {
    const currentVault = useAuthStore.getState().vault;
    const key = useAuthStore.getState().masterKey;
    if (!currentVault || !key) return;
    const next =
      r.type === 'login'
        ? updateEntry(currentVault, entry.id, r.data)
        : updateEntry(currentVault, entry.id, r.data);
    useAuthStore.getState().updateVault(next);
    await persistVault(next, key);
    router.back();
  };

  return <EntryForm initial={entry} onSubmit={handleSubmit} />;
}
