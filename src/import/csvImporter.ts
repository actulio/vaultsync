import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { detectPreset, parseCsv, rowsToEntries } from './parsers';
import type { Mapping } from './presets';
import { addLogin, addNote } from '@/vault/mutations';
import { useAuthStore } from '@/auth/store';
import { persistVault } from '@/vault/persist';

export type ImportPreview = {
  headers: string[];
  rows: Record<string, string>[];
  inferredPreset?: string;
  inferredMapping?: Mapping;
};

/**
 * Show the system document picker restricted to CSV files, then read the
 * picked file's contents via the expo-file-system LEGACY API (SDK 54+ moved
 * `readAsStringAsync`/`deleteAsync` out of the default export into this
 * submodule). Returns `null` when the user cancels the picker.
 */
export async function pickCsv(): Promise<{ tmpUri: string; content: string } | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'text/comma-separated-values'],
  });
  if (res.canceled || res.assets.length === 0) return null;
  const asset = res.assets[0]!;
  const content = await FileSystem.readAsStringAsync(asset.uri);
  // The full content is now in memory — the on-disk plaintext copy that
  // expo-document-picker wrote into app cache (copyToCacheDirectory: true)
  // is no longer needed. Delete it immediately so it can't survive a
  // cancel/back-out or a later import failure (best-effort; the caller's
  // later deleteTempFile(uri) is a harmless idempotent no-op after this).
  await deleteTempFile(asset.uri);
  return { tmpUri: asset.uri, content };
}

/** Parse the CSV content and auto-detect a known exporter preset from its header row. */
export function buildPreview(content: string): ImportPreview {
  const { headers, rows } = parseCsv(content);
  const det = detectPreset(headers);
  return {
    headers,
    rows,
    ...(det ? { inferredPreset: det.name, inferredMapping: det.mapping } : {}),
  };
}

/**
 * Map CSV rows into vault entries and append them (never replaces existing
 * entries — `addLogin`/`addNote` prepend). Persists the updated vault, which
 * also enqueues the Drive push (spec §8 step 7).
 */
export async function executeImport(
  rows: Record<string, string>[],
  mapping: Mapping,
): Promise<{ added: number; skipped: number }> {
  const { rows: entries, skipped } = rowsToEntries(rows, mapping);
  const currentVault = useAuthStore.getState().vault;
  const key = useAuthStore.getState().masterKey;
  if (!currentVault || !key) {
    throw new Error('cannot import: vault is locked');
  }

  let vault = currentVault;
  for (const e of entries) {
    if (e.type === 'login') {
      vault = addLogin(vault, {
        title: e.title,
        username: e.username,
        password: e.password,
        ...(e.url ? { url: e.url } : {}),
        ...(e.notes ? { notes: e.notes } : {}),
        ...(e.source ? { source: e.source } : {}),
      });
    } else {
      vault = addNote(vault, { title: e.title, body: e.body });
    }
  }

  useAuthStore.getState().updateVault(vault);
  await persistVault(vault, key);
  return { added: entries.length, skipped };
}

/** Best-effort removal of the temp CSV copy (it contains plaintext passwords). */
export async function deleteTempFile(uri: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    /* best effort — nothing actionable if cleanup fails */
  }
}
