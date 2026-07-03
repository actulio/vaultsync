import { aeadDecrypt, aeadEncrypt, randomBytes } from '@/crypto/aead';
import { deriveMasterKey, DEFAULT_ARGON2 } from '@/crypto/argon2';
import { deriveRecoveryKey, generateRecoveryCode } from '@/crypto/recoveryCode';
import {
  decodeVaultFile,
  encodeVaultFile,
  serializeVaultHeader,
  type VaultFileFields,
} from '@/vault/format';
import type { VaultV1 } from '@/vault/types';
import { VaultStore } from '@/native/keystore';
import { enableBiometric, isBiometricEnabled } from '@/auth/biometric';

/**
 * Rotate the master password on an already-unlocked vault.
 *
 * Mirrors `recoverAndReset` (src/auth/recovery.ts) from the decrypt-old-payload
 * step onward — the only difference is we already hold the unlocked
 * `currentMasterKey`, so there is no recovery-code unwrap step.
 *
 * Header-as-AAD discipline: the vault payload encrypt/decrypt is authenticated
 * with `serializeVaultHeader(...)`; the recovery key-wrap uses no AAD (bare key wrap).
 */
export async function changeMasterPassword(
  currentMasterKey: Uint8Array,
  newPassword: string,
): Promise<{ newRecoveryCode: string; newMasterKey: Uint8Array }> {
  // Step 1: Validate new password length.
  if (newPassword.length < 8) throw new Error('new password too short');

  // Capture the biometric opt-in state up front (before any rewrites) so we can
  // preserve it across the rotation without silently enabling it for a
  // password-only user.
  const wasBiometricEnabled = await isBiometricEnabled();

  // Step 2: Load and parse the existing vault.
  const oldBytes = await VaultStore.read('vault.enc');
  const old = decodeVaultFile(oldBytes);

  // Step 3: Decrypt old vault payload — AAD is the OLD header.
  const oldAad = serializeVaultHeader(old);
  const plaintext = await aeadDecrypt(
    old.vaultCiphertext,
    old.vaultTag,
    currentMasterKey,
    old.vaultNonce,
    oldAad,
  );
  const vault = JSON.parse(new TextDecoder().decode(plaintext)) as VaultV1;

  // Step 4: Rotate — new salt, new master key, new recovery code + key.
  const newSalt = await randomBytes(16);
  const newMasterKey = await deriveMasterKey(newPassword, newSalt, DEFAULT_ARGON2);
  const newRecoveryCode = await generateRecoveryCode();
  const newRecoveryKey = await deriveRecoveryKey(newRecoveryCode, newSalt);

  // Step 5: Re-wrap master key under the new recovery key (no AAD — bare key wrap).
  const recNonce = await randomBytes(12);
  const recWrap = await aeadEncrypt(newMasterKey, newRecoveryKey, recNonce);
  const newRecoveryWrappedKey = concat(recNonce, recWrap.ciphertext, recWrap.tag);

  // Step 6: Build new header, encrypt payload with new master key + new header AAD.
  const newPayloadNonce = await randomBytes(12);
  const newHeaderFields: Omit<VaultFileFields, 'vaultCiphertext' | 'vaultTag'> = {
    version: 1,
    salt: newSalt,
    argon2: DEFAULT_ARGON2,
    hint: old.hint,
    recoveryWrappedKey: newRecoveryWrappedKey,
    vaultNonce: newPayloadNonce,
  };
  const newAad = serializeVaultHeader(newHeaderFields);

  const updatedVault = { ...vault, updatedAt: new Date().toISOString() };
  const newPlaintext = new TextEncoder().encode(JSON.stringify(updatedVault));
  const newEnc = await aeadEncrypt(newPlaintext, newMasterKey, newPayloadNonce, newAad);

  // Step 7: Encode and write the new vault file.
  const newFields: VaultFileFields = {
    ...newHeaderFields,
    vaultCiphertext: newEnc.ciphertext,
    vaultTag: newEnc.tag,
  };
  await VaultStore.write('vault.enc', encodeVaultFile(newFields));

  // Step 8: Preserve biometric opt-in. Only re-wrap the new master key under the
  // Keystore if biometric unlock was already enabled (the old wrapped copy holds
  // the OLD key and is now stale). A password-only user is neither enrolled nor
  // prompted. Re-wrapping shows a biometric prompt; if it fails the rotation has
  // already persisted (password unlock works) — surface it to the caller.
  if (wasBiometricEnabled) {
    await enableBiometric(newMasterKey);
  }

  return { newRecoveryCode, newMasterKey };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
