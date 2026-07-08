import { AppState } from 'react-native';
import { useAuthStore } from './store';
import { readVaultWithKey } from './unlock';

/**
 * When the app returns to the foreground while unlocked, re-read vault.enc and adopt it ONLY if
 * its `updatedAt` is strictly newer than the in-memory vault. This picks up an autofill save (which
 * writes the encrypted file directly, out of band from the JS store) without a relaunch.
 *
 * The strictly-newer guard is the data-safety invariant (P4-D1): the in-memory vault is never
 * clobbered by a stale or equal on-disk copy, and every in-app edit persists synchronously, so a
 * newer on-disk `updatedAt` can only mean an external writer (autofill save, or a future
 * second-device pull) — last-write-wins by timestamp.
 */
export async function reloadVaultIfNewer(): Promise<void> {
  const { status, masterKey, vault } = useAuthStore.getState();
  if (status !== 'unlocked' || masterKey == null || vault == null) return;
  try {
    const disk = await readVaultWithKey(masterKey);
    if (new Date(disk.updatedAt).getTime() > new Date(vault.updatedAt).getTime()) {
      // Re-check via getState(): auto-lock may have fired during the async read. updateVault
      // throws if locked; the catch below swallows it so a race never crashes the app.
      useAuthStore.getState().updateVault(disk);
    }
  } catch {
    // A transient read/decrypt failure (or a lock race) must never crash the app or disrupt the
    // session — the in-memory vault stays authoritative until the next successful reload.
  }
}

/** Subscribe reloadVaultIfNewer to app-foreground transitions. Returns an unsubscribe fn. */
export function startVaultReloadOnForeground(): () => void {
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') void reloadVaultIfNewer();
  });
  return () => sub.remove();
}
