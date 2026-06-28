import { aeadDecrypt, aeadEncrypt, randomBytes } from '@/crypto/aead';
import { deriveMasterKey, DEFAULT_ARGON2 } from '@/crypto/argon2';
import { deriveRecoveryKey, generateRecoveryCode } from '@/crypto/recoveryCode';
import { decodeVaultFile, encodeVaultFile, serializeVaultHeader, type VaultFileFields } from '@/vault/format';
import type { VaultV1 } from '@/vault/types';
import { Keystore, VaultStore } from '@/native/keystore';
import { RecoverableError } from './unlock';

export async function recoverAndReset(
  code: string,
  newPassword: string,
): Promise<{ newRecoveryCode: string }> {
  // Step 1: Validate new password length
  if (newPassword.length < 8) throw new Error('new password too short');

  // Step 2: Load and parse the existing vault
  const oldBytes = await VaultStore.read('vault.enc');
  const old = decodeVaultFile(oldBytes);
  if (!old.recoveryWrappedKey) throw new RecoverableError('vault_corrupt');

  // Step 3: Derive recovery key from code + old salt; unwrap master key (no AAD — bare key wrap)
  const recoveryKey = await deriveRecoveryKey(code, old.salt);
  const wrapped = old.recoveryWrappedKey;
  const recNonce = wrapped.slice(0, 12);
  const recCt    = wrapped.slice(12, 44);
  const recTag   = wrapped.slice(44, 60);
  let masterKey: Uint8Array;
  try {
    masterKey = await aeadDecrypt(recCt, recTag, recoveryKey, recNonce, null);
  } catch {
    throw new RecoverableError('wrong_recovery_code');
  }

  // Step 4: Decrypt old vault payload — AAD is the OLD header (authenticates the header bytes)
  const oldAad = serializeVaultHeader(old);
  const plaintext = await aeadDecrypt(
    old.vaultCiphertext,
    old.vaultTag,
    masterKey,
    old.vaultNonce,
    oldAad,
  );
  const vault = JSON.parse(new TextDecoder().decode(plaintext)) as VaultV1;

  // Step 5: Rotate — new salt, new master key, new recovery code + key
  const newSalt        = await randomBytes(16);
  const newMasterKey   = await deriveMasterKey(newPassword, newSalt, DEFAULT_ARGON2);
  const newRecoveryCode = await generateRecoveryCode();
  const newRecoveryKey = await deriveRecoveryKey(newRecoveryCode, newSalt);

  // Step 6a: New recovery wrap (no AAD — bare key wrap, same as onboarding)
  const newRecoveryNonce = await randomBytes(12);
  const newRecoveryWrap  = await aeadEncrypt(newMasterKey, newRecoveryKey, newRecoveryNonce, null);
  const newRecoveryWrappedKey = concat(
    newRecoveryNonce,
    newRecoveryWrap.ciphertext,
    newRecoveryWrap.tag,
  );

  // Step 6b: Build new header fields FIRST so we can derive AAD from them
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

  // Step 6c: Re-encrypt vault payload with new master key + new header as AAD
  const updatedVault = { ...vault, updatedAt: new Date().toISOString() };
  const newPlaintext = new TextEncoder().encode(JSON.stringify(updatedVault));
  const newEnc = await aeadEncrypt(newPlaintext, newMasterKey, newPayloadNonce, newAad);

  // Step 7: Encode and write new vault file
  const newFields: VaultFileFields = {
    ...newHeaderFields,
    vaultCiphertext: newEnc.ciphertext,
    vaultTag: newEnc.tag,
  };
  const newBytes = encodeVaultFile(newFields);
  await VaultStore.write('vault.enc', newBytes);

  // Step 8: Re-wrap new master key in Keystore
  await Keystore.generateKeyIfMissing();
  const newWrapped = await Keystore.wrap(newMasterKey);
  await VaultStore.write('masterKey.wrapped', newWrapped);

  return { newRecoveryCode };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) { out.set(p, offset); offset += p.length; }
  return out;
}
