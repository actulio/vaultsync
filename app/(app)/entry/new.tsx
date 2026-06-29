import type { JSX } from 'react';
import { router } from 'expo-router';
import { useAuthStore } from '@/auth/store';
import { addLogin, addNote } from '@/vault/mutations';
import { persistVault } from '@/vault/persist';
import { EntryForm } from '@/vault/EntryForm';
import type { EntryFormResult } from '@/vault/EntryForm';

export default function NewEntry(): JSX.Element {
  const handleSubmit = async (r: EntryFormResult): Promise<void> => {
    const vault = useAuthStore.getState().vault;
    const key = useAuthStore.getState().masterKey;
    if (!vault || !key) return;
    const next = r.type === 'login' ? addLogin(vault, r.data) : addNote(vault, r.data);
    useAuthStore.getState().updateVault(next);
    await persistVault(next, key);
    router.back();
  };

  return <EntryForm onSubmit={handleSubmit} />;
}
