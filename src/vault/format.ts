const MAGIC = new Uint8Array([0x56, 0x4c, 0x54, 0x31]); // "VLT1"
const SUPPORTED_VERSION = 1;
const SALT_LEN = 16;
const PARAMS_LEN = 10; // memoryKiB (u32: 4) + timeCost (u16: 2) + parallelism (u16: 2) + hashLen (u16: 2)
const NONCE_LEN = 12;
const TAG_LEN = 16;
const WRAPPED_KEY_LEN = NONCE_LEN + 32 + TAG_LEN; // 60

export type Argon2Params = {
  memoryKiB: number; // u32 (supports values up to 4GB)
  timeCost: number; // u16
  parallelism: number; // u16
  hashLen: number; // u16
};

export type VaultFileFields = {
  version: 1;
  salt: Uint8Array;
  argon2: Argon2Params;
  hint: string;
  recoveryWrappedKey: Uint8Array | null;
  vaultNonce: Uint8Array;
  vaultCiphertext: Uint8Array;
  vaultTag: Uint8Array;
};

export function encodeVaultFile(f: VaultFileFields): Uint8Array {
  if (f.salt.length !== SALT_LEN) throw new Error('salt must be 16 bytes');
  if (f.vaultNonce.length !== NONCE_LEN) throw new Error('vault nonce must be 12 bytes');
  if (f.vaultTag.length !== TAG_LEN) throw new Error('vault tag must be 16 bytes');
  if (f.recoveryWrappedKey && f.recoveryWrappedKey.length !== WRAPPED_KEY_LEN) {
    throw new Error(`recovery wrapped key must be ${WRAPPED_KEY_LEN} bytes`);
  }

  const hintBytes = new TextEncoder().encode(f.hint);
  if (hintBytes.length > 255) throw new Error('hint exceeds 255 bytes');

  const fixed =
    MAGIC.length + 1 + SALT_LEN + PARAMS_LEN + 1 + 1 + NONCE_LEN + TAG_LEN; // see layout
  const recoveryLen = f.recoveryWrappedKey ? WRAPPED_KEY_LEN : 0;
  const totalLen = fixed + hintBytes.length + recoveryLen + f.vaultCiphertext.length;

  const out = new Uint8Array(totalLen);
  const view = new DataView(out.buffer);
  let o = 0;

  out.set(MAGIC, o); o += MAGIC.length;
  out[o++] = f.version;
  out.set(f.salt, o); o += SALT_LEN;
  view.setUint32(o, f.argon2.memoryKiB, true); o += 4;
  view.setUint16(o, f.argon2.timeCost, true); o += 2;
  view.setUint16(o, f.argon2.parallelism, true); o += 2;
  view.setUint16(o, f.argon2.hashLen, true); o += 2;
  out[o++] = hintBytes.length;
  out.set(hintBytes, o); o += hintBytes.length;
  out[o++] = f.recoveryWrappedKey ? 1 : 0;
  if (f.recoveryWrappedKey) { out.set(f.recoveryWrappedKey, o); o += WRAPPED_KEY_LEN; }
  out.set(f.vaultNonce, o); o += NONCE_LEN;
  out.set(f.vaultCiphertext, o); o += f.vaultCiphertext.length;
  out.set(f.vaultTag, o);

  return out;
}

export function decodeVaultFile(bytes: Uint8Array): VaultFileFields {
  if (bytes.length < MAGIC.length + 1) throw new Error('vault file truncated');
  for (let i = 0; i < MAGIC.length; i++) {
    if (bytes[i] !== MAGIC[i]) throw new Error('bad magic');
  }
  const version = bytes[MAGIC.length];
  if (version !== SUPPORTED_VERSION) throw new Error(`unsupported version: ${version}`);

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let o = MAGIC.length + 1;

  const salt = bytes.slice(o, o + SALT_LEN); o += SALT_LEN;
  const argon2: Argon2Params = {
    memoryKiB: view.getUint32(o, true),
    timeCost: view.getUint16(o + 4, true),
    parallelism: view.getUint16(o + 6, true),
    hashLen: view.getUint16(o + 8, true),
  };
  o += PARAMS_LEN;

  if (o >= bytes.length) throw new Error('vault file truncated');
  const hintLen = bytes[o]!;
  o++;
  const hint = new TextDecoder().decode(bytes.slice(o, o + hintLen));
  o += hintLen;

  if (o >= bytes.length) throw new Error('vault file truncated');
  const hasRecovery = bytes[o]! === 1;
  o++;
  let recoveryWrappedKey: Uint8Array | null = null;
  if (hasRecovery) {
    recoveryWrappedKey = bytes.slice(o, o + WRAPPED_KEY_LEN);
    o += WRAPPED_KEY_LEN;
  }

  if (bytes.length < o + NONCE_LEN + TAG_LEN) throw new Error('vault file truncated');
  const vaultNonce = bytes.slice(o, o + NONCE_LEN); o += NONCE_LEN;
  const ciphertextLen = bytes.length - o - TAG_LEN;
  if (ciphertextLen < 0) throw new Error('vault file truncated');
  const vaultCiphertext = bytes.slice(o, o + ciphertextLen);
  o += ciphertextLen;
  const vaultTag = bytes.slice(o, o + TAG_LEN);

  return {
    version: 1,
    salt,
    argon2,
    hint,
    recoveryWrappedKey,
    vaultNonce,
    vaultCiphertext,
    vaultTag,
  };
}
