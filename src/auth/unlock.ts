import { aeadDecrypt } from '@/crypto/aead';
import { deriveMasterKey } from '@/crypto/argon2';
import { decodeVaultFile, serializeVaultHeader } from '@/vault/format';
import type { VaultV1 } from '@/vault/types';
import { Keystore, VaultStore } from '@/native/keystore';

export type UnlockResult = { masterKey: Uint8Array; vault: VaultV1 };

export class RecoverableError extends Error {
  constructor(public readonly code: 'wrong_password' | 'wrong_recovery_code' | 'vault_corrupt') {
    super(code);
    this.name = 'RecoverableError';
  }
}

/**
 * Decrypt the vault payload using the provided master key.
 * The vault header is used as AEAD associated-data (matches Task 3 encryption).
 * Throws RecoverableError('vault_corrupt') on any internal failure.
 */
async function decryptVaultWithKey(masterKey: Uint8Array, vaultBytes: Uint8Array): Promise<VaultV1> {
  try {
    const fields = decodeVaultFile(vaultBytes);
    const aad = serializeVaultHeader(fields);
    const plaintext = await aeadDecrypt(
      fields.vaultCiphertext,
      fields.vaultTag,
      masterKey,
      fields.vaultNonce,
      aad,
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as VaultV1;
  } catch (err) {
    if (err instanceof RecoverableError) throw err;
    throw new RecoverableError('vault_corrupt');
  }
}

/**
 * Cold path: re-derive the master key from the password via Argon2id and decrypt.
 * Wrong password → RecoverableError('wrong_password').
 */
export async function unlockWithPassword(password: string): Promise<UnlockResult> {
  const vaultBytes = await VaultStore.read('vault.enc');
  const fields = decodeVaultFile(vaultBytes);
  const masterKey = await deriveMasterKey(password, fields.salt, fields.argon2);
  try {
    const vault = await decryptVaultWithKey(masterKey, vaultBytes);
    return { masterKey, vault };
  } catch {
    throw new RecoverableError('wrong_password');
  }
}

/**
 * Hot path: unwrap the master key from Keystore (biometric prompt handled by native side)
 * and decrypt the vault.
 */
export async function unlockWithBiometric(): Promise<UnlockResult> {
  const vaultBytes = await VaultStore.read('vault.enc');
  const wrapped = await VaultStore.read('masterKey.wrapped');
  const masterKey = await Keystore.unwrap(wrapped);
  const vault = await decryptVaultWithKey(masterKey, vaultBytes);
  return { masterKey, vault };
}

/**
 * Re-read and decrypt vault.enc with an already-held master key (no password/biometric).
 * Used for in-session reload so an external write (e.g. an autofill save, which writes the
 * encrypted file directly) can be picked up without re-deriving or re-unwrapping the key.
 */
export async function readVaultWithKey(masterKey: Uint8Array): Promise<VaultV1> {
  const vaultBytes = await VaultStore.read('vault.enc');
  return decryptVaultWithKey(masterKey, vaultBytes);
}

/** Read the password hint stored in vault header (no decryption needed). */
export async function readVaultHint(): Promise<string> {
  const vaultBytes = await VaultStore.read('vault.enc');
  return decodeVaultFile(vaultBytes).hint;
}

/** Check whether vault.enc exists without reading or decrypting it. */
export async function vaultExists(): Promise<boolean> {
  return VaultStore.exists('vault.enc');
}
