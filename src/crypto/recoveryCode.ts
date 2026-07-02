import { sha256 } from '@noble/hashes/sha2.js';
import { randomBytes } from './aead';

// 15 bytes (120 bits) of entropy → exactly 24 base32 chars → 6 groups of 4
export const RECOVERY_BYTES = 15;
export const RECOVERY_CODE_INFO = 'vaultsync-recovery-v1';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const BASE32_INDEX: Record<string, number> = Object.fromEntries(
  BASE32_ALPHABET.split('').map((c, i) => [c, i]),
);

function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      // noUncheckedIndexedAccess: index is always 0-31, alphabet has 32 chars — safe
      out += BASE32_ALPHABET[(value >>> bits) & 0x1f]!;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f]!;
  }
  return out;
}

function base32Decode(s: string): Uint8Array {
  const normalized = s.toUpperCase();
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of normalized) {
    const idx = BASE32_INDEX[ch];
    if (idx === undefined) throw new Error(`invalid base32 char: ${ch}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

function formatGroups(s: string, groupSize = 4): string {
  return s.match(new RegExp(`.{1,${groupSize}}`, 'g'))!.join('-');
}

export async function generateRecoveryCode(): Promise<string> {
  const bytes = await randomBytes(RECOVERY_BYTES);
  const encoded = base32Encode(bytes);
  return formatGroups(encoded, 4);
}

export function parseRecoveryCode(input: string): Uint8Array {
  const cleaned = input.replace(/[\s-]+/g, '').toUpperCase();
  if (cleaned.length !== 24) throw new Error('recovery code wrong length');
  return base32Decode(cleaned);
}

const HMAC_BLOCK = 64; // SHA-256 block size in bytes

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

// Portable HMAC-SHA256 (RFC 2104). libsodium's crypto_auth_hmacsha256 only
// accepts a fixed 32-byte key, but HKDF needs arbitrary-length keys (the 16-byte
// salt during extract), so we implement HMAC directly on a raw SHA-256. Uses
// @noble/hashes (pure JS) → identical bytes on Node and Hermes, and unlike the
// WASM libsodium build it needs no WebAssembly (unavailable under Hermes).
function hmacSha256(key: Uint8Array, data: Uint8Array): Uint8Array {
  let k = key;
  if (k.length > HMAC_BLOCK) k = sha256(k);
  const block = new Uint8Array(HMAC_BLOCK);
  block.set(k);
  const ipad = new Uint8Array(HMAC_BLOCK);
  const opad = new Uint8Array(HMAC_BLOCK);
  for (let i = 0; i < HMAC_BLOCK; i++) {
    const b = block[i]!;
    ipad[i] = b ^ 0x36;
    opad[i] = b ^ 0x5c;
  }
  const inner = sha256(concat(ipad, data));
  return sha256(concat(opad, inner));
}

function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Uint8Array {
  return hmacSha256(salt, ikm);
}

function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Uint8Array {
  const out = new Uint8Array(length);
  let prev: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
  let pos = 0;
  let counter = 1;
  while (pos < length) {
    const input = new Uint8Array(prev.length + info.length + 1);
    input.set(prev, 0);
    input.set(info, prev.length);
    input[input.length - 1] = counter;
    prev = hmacSha256(prk, input);
    out.set(prev.slice(0, Math.min(prev.length, length - pos)), pos);
    pos += prev.length;
    counter++;
  }
  return out;
}

// Kept Promise-returning (the derivation itself is now synchronous) so existing
// `await deriveRecoveryKey(...)` call sites stay valid.
export function deriveRecoveryKey(code: string, salt: Uint8Array, length = 32): Promise<Uint8Array> {
  if (salt.length !== 16) throw new Error('salt must be 16 bytes');
  const ikm = parseRecoveryCode(code);
  const prk = hkdfExtract(salt, ikm);
  return Promise.resolve(hkdfExpand(prk, new TextEncoder().encode(RECOVERY_CODE_INFO), length));
}
