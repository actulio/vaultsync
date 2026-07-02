import type { Entry, Login, SecureNote, VaultV1 } from '@/vault/types';

type LoginFormData = Omit<Login, 'id' | 'type' | 'createdAt' | 'updatedAt'>;

const now = (): string => new Date().toISOString();

function uuid(): string {
  const b = new Uint8Array(16);
  globalThis.crypto.getRandomValues(b);
  b[6] = (b[6]! & 0x0f) | 0x40; b[8] = (b[8]! & 0x3f) | 0x80;
  const h = Array.from(b, (n) => n.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function addLogin(vault: VaultV1, data: Omit<Login, 'id' | 'type' | 'createdAt' | 'updatedAt'>): VaultV1 {
  const entry: Login = { ...data, id: uuid(), type: 'login', createdAt: now(), updatedAt: now() };
  return { ...vault, entries: [entry, ...vault.entries], updatedAt: now() };
}

export function addNote(vault: VaultV1, data: Omit<SecureNote, 'id' | 'type' | 'createdAt' | 'updatedAt'>): VaultV1 {
  const entry: SecureNote = { ...data, id: uuid(), type: 'note', createdAt: now(), updatedAt: now() };
  return { ...vault, entries: [entry, ...vault.entries], updatedAt: now() };
}

export function updateEntry(vault: VaultV1, id: string, patch: Partial<Entry>): VaultV1 {
  const entries = vault.entries.map((e) =>
    e.id === id ? ({ ...e, ...patch, updatedAt: now() } as Entry) : e,
  );
  return { ...vault, entries, updatedAt: now() };
}

/**
 * Mirrors the Kotlin autofill-save retention semantics (AutofillSaveActivity.updatePassword):
 * when a login's password actually changes to a new non-empty value, stash the old password
 * in `previousPassword` so `clearStalePreviousPasswords` can expire it after 7 days. A no-op
 * for notes, unchanged passwords, and empty incoming passwords.
 */
export function withPreviousPassword(
  current: Entry,
  data: LoginFormData,
): LoginFormData & { previousPassword?: string } {
  if (current.type === 'login' && data.password !== '' && data.password !== current.password) {
    return { ...data, previousPassword: current.password };
  }
  return data;
}

export function deleteEntry(vault: VaultV1, id: string): VaultV1 {
  return { ...vault, entries: vault.entries.filter((e) => e.id !== id), updatedAt: now() };
}

/** Clears `previousPassword` from entries whose change is older than 7 days. */
export function clearStalePreviousPasswords(vault: VaultV1, now: Date = new Date()): VaultV1 {
  const cutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const entries = vault.entries.map((e) => {
    if (e.type !== 'login' || !e.previousPassword) return e;
    if (new Date(e.updatedAt).getTime() < cutoff) {
      const rest: Login = { ...e };
      delete rest.previousPassword;
      return rest;
    }
    return e;
  });
  return { ...vault, entries };
}
