import { aeadEncrypt, randomBytes } from '@/crypto/aead';
import { deriveMasterKey, DEFAULT_ARGON2 } from '@/crypto/argon2';
import { generateRecoveryCode, deriveRecoveryKey } from '@/crypto/recoveryCode';
import { encodeVaultFile, serializeVaultHeader, type VaultFileFields } from '@/vault/format';
import type { VaultV1 } from '@/vault/types';
import { VaultStore } from '@/native/keystore';

export type CreateVaultArgs = { password: string; hint: string };
export type CreateVaultResult = { recoveryCode: string; masterKey: Uint8Array; vault: VaultV1 };

export async function _internalAssemble(args: CreateVaultArgs): Promise<{
  recoveryCode: string;
  masterKey: Uint8Array;
  vault: VaultV1;
  vaultBytes: Uint8Array;
}> {
  if (args.password.length < 8) {
    throw new Error('master password must be at least 8 characters');
  }

  const salt = await randomBytes(16);
  const masterKey = await deriveMasterKey(args.password, salt);

  const vault: VaultV1 = {
    version: 1,
    entries: [],
    updatedAt: new Date().toISOString(),
    deviceId: await cryptoUuid(),
  };
  const plaintext = new TextEncoder().encode(JSON.stringify(vault));
  const vaultNonce = await randomBytes(12);

  // Wrap masterKey under recovery key (no AAD — this is a bare key wrap)
  const recoveryCode = await generateRecoveryCode();
  const recoveryKey = await deriveRecoveryKey(recoveryCode, salt);
  const recoveryNonce = await randomBytes(12);
  const recoveryWrap = await aeadEncrypt(masterKey, recoveryKey, recoveryNonce);
  const recoveryWrappedKey = concat(recoveryNonce, recoveryWrap.ciphertext, recoveryWrap.tag);

  // Build header fields first so we can use them as AEAD associated-data (fold-in 2a)
  const headerFields: Omit<VaultFileFields, 'vaultCiphertext' | 'vaultTag'> = {
    version: 1,
    salt,
    argon2: DEFAULT_ARGON2,
    hint: args.hint,
    recoveryWrappedKey,
    vaultNonce,
  };
  const aad = serializeVaultHeader(headerFields);

  // Encrypt vault payload with masterKey + header as AAD
  const enc = await aeadEncrypt(plaintext, masterKey, vaultNonce, aad);

  const fields: VaultFileFields = {
    ...headerFields,
    vaultCiphertext: enc.ciphertext,
    vaultTag: enc.tag,
  };
  const vaultBytes = encodeVaultFile(fields);
  return { recoveryCode, masterKey, vault, vaultBytes };
}

export async function createVault(args: CreateVaultArgs): Promise<CreateVaultResult> {
  const { recoveryCode, masterKey, vault, vaultBytes } = await _internalAssemble(args);
  await VaultStore.write('vault.enc', vaultBytes);
  // Biometric unlock is opt-in: the master key is wrapped into the Keystore only
  // when the user explicitly enables it (onboarding biometric screen or Settings)
  // via enableBiometric(). Vault creation never touches the Keystore, so a
  // password-only user is never prompted for biometrics.
  return { recoveryCode, masterKey, vault };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/** UUID v4 built from randomBytes (consistent with the rest of the crypto layer). */
async function cryptoUuid(): Promise<string> {
  const b = await randomBytes(16);
  b[6] = (b[6]! & 0x0f) | 0x40; // version 4
  b[8] = (b[8]! & 0x3f) | 0x80; // variant bits
  const hex = Array.from(b, (n) => n.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
