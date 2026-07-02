import { aeadEncrypt, randomBytes } from '@/crypto/aead';
import {
  decodeVaultFile,
  encodeVaultFile,
  serializeVaultHeader,
  type VaultFileFields,
  type VaultHeaderFields,
} from '@/vault/format';
import type { VaultV1 } from '@/vault/types';
import { VaultStore } from '@/native/keystore';
import { enqueuePush } from '@/sync/queue';
import { syncOnce } from '@/sync/orchestrator';
import { useSyncStore } from '@/sync/store';

/**
 * Re-encrypt and atomically write the vault payload with the SAME master key
 * (the password is unchanged — no salt/master-key/recovery-code rotation).
 *
 * Mirrors the encrypt-half of `recovery.ts` and `onboarding.ts`: the on-disk
 * header (salt, argon2 params, hint, recovery-wrapped key) is preserved, only a
 * fresh payload nonce is generated. The new header is serialized and bound as
 * AEAD associated-data so this write round-trips with `unlock.ts`'s read path.
 */
export async function persistVault(vault: VaultV1, masterKey: Uint8Array): Promise<void> {
  // I5: the caller passes the store's LIVE key; auto-lock (`store.lock()`) zeroes it in place at an
  // await point. Copy it BEFORE the first await — JS is single-threaded, so lock() cannot run before
  // then — and encrypt under the copy, zeroing the copy in `finally`. This makes the write atomic
  // w.r.t. lock(): we never encrypt under a half-zeroed key.
  const key = masterKey.slice();
  try {
    // 1. Read the current header to preserve it (password unchanged).
    const old = decodeVaultFile(await VaultStore.read('vault.enc'));

    // 2. Fresh payload nonce for this write.
    const vaultNonce = await randomBytes(12);

    // 3. Build header fields preserving on-disk secrets; only the nonce changes.
    const headerFields: VaultHeaderFields = {
      version: 1,
      salt: old.salt,
      argon2: old.argon2,
      hint: old.hint,
      recoveryWrappedKey: old.recoveryWrappedKey,
      vaultNonce,
    };
    const aad = serializeVaultHeader(headerFields);

    // 4. Encrypt the vault payload with the new header as AAD.
    const plaintext = new TextEncoder().encode(JSON.stringify(vault));
    const enc = await aeadEncrypt(plaintext, key, vaultNonce, aad);

    // 5. Encode + atomically write.
    const fields: VaultFileFields = {
      ...headerFields,
      vaultCiphertext: enc.ciphertext,
      vaultTag: enc.tag,
    };
    await VaultStore.write('vault.enc', encodeVaultFile(fields));

    // 6. Hand off to the sync queue (Plan 4 wires the Drive push).
    enqueueSync();
  } finally {
    key.fill(0);
  }
}

/** Fire-and-forget: enqueue a push then kick off a sync cycle.
 * If enqueuePush fails the error is surfaced via the sync store so it is
 * visible in the UI; syncOnce still fires so a later drain can recover.
 */
function enqueueSync(): void {
  void (async () => {
    try {
      await enqueuePush();
    } catch (e) {
      useSyncStore.getState().setStatus('error', e instanceof Error ? e.message : String(e));
    }
    void syncOnce();
  })();
}
