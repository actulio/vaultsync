import { useAuthStore } from './store';
import { clearStalePreviousPasswords } from '@/vault/mutations';
import { persistVault } from '@/vault/persist';
import type { VaultV1 } from '@/vault/types';

/**
 * Purges `previousPassword` values older than 7 days (spec §6.5/§3.1) from the
 * unlocked vault and persists the result. No-op when locked (mirrors
 * `updateVault`'s own guard) or when nothing was actually stale, so an
 * unlock never triggers a needless re-encrypt + Drive push.
 *
 * Intended to be invoked on every transition into `'unlocked'` — see the
 * `useEffect` in `app/(app)/_layout.tsx`.
 */
export async function runStaleCleanup(): Promise<void> {
  const { status, vault, masterKey } = useAuthStore.getState();
  if (status !== 'unlocked' || !vault || !masterKey) return;

  const cleaned = clearStalePreviousPasswords(vault);
  if (!hasStaleChanges(vault, cleaned)) return;

  useAuthStore.getState().updateVault(cleaned);
  // T8: never let a persistVault rejection escape as an unhandled promise rejection (the call site
  // voids this). Cleanup is self-healing — it re-runs on the next unlock — so log and move on.
  try {
    await persistVault(cleaned, masterKey);
  } catch (e) {
    console.warn('runStaleCleanup: persist failed (retried on next unlock)', e);
  }
}

/**
 * `clearStalePreviousPasswords` always returns a fresh `VaultV1` (it spreads
 * both the vault and its `entries` array), so reference identity can't be
 * used to detect a no-op. Compare the one field it actually mutates instead.
 */
function hasStaleChanges(before: VaultV1, after: VaultV1): boolean {
  return before.entries.some((entry, i) => {
    const cleanedEntry = after.entries[i];
    return (
      entry.type === 'login' &&
      cleanedEntry?.type === 'login' &&
      entry.previousPassword !== cleanedEntry.previousPassword
    );
  });
}
