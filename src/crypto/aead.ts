import { chacha20poly1305 } from '@noble/ciphers/chacha.js';
import sodium from 'react-native-libsodium';

// AEAD uses @noble/ciphers' ChaCha20-Poly1305-IETF (RFC 8439, 12-byte nonce):
// react-native-libsodium's NATIVE build only ships the XChaCha20 (24-byte nonce)
// variant, not the plain IETF one our vault format + the Kotlin BouncyCastle
// autofill use. @noble is pure JS (runs on Hermes) and byte-identical to both.
// Argon2 (crypto_pwhash) and randombytes_buf DO exist in the native build, so
// those stay on react-native-libsodium.

let ready: Promise<void> | null = null;
const ensureReady = (): Promise<void> => (ready ??= sodium.ready);

export const KEY_LEN = 32;
export const NONCE_LEN = 12;
export const TAG_LEN = 16;

export type AeadResult = {
  ciphertext: Uint8Array;
  tag: Uint8Array;
};

export async function aeadEncrypt(
  plaintext: Uint8Array,
  key: Uint8Array,
  nonce: Uint8Array,
  ad: Uint8Array | null = null,
): Promise<AeadResult> {
  await ensureReady();
  if (key.length !== KEY_LEN) throw new Error(`key must be ${KEY_LEN} bytes`);
  if (nonce.length !== NONCE_LEN) throw new Error(`nonce must be ${NONCE_LEN} bytes`);

  // Returns ciphertext || tag concatenated; split for our format.
  const combined = chacha20poly1305(key, nonce, ad ?? undefined).encrypt(plaintext);
  const ciphertext = combined.slice(0, combined.length - TAG_LEN);
  const tag = combined.slice(combined.length - TAG_LEN);
  return { ciphertext, tag };
}

export async function aeadDecrypt(
  ciphertext: Uint8Array,
  tag: Uint8Array,
  key: Uint8Array,
  nonce: Uint8Array,
  ad: Uint8Array | null = null,
): Promise<Uint8Array> {
  await ensureReady();
  if (key.length !== KEY_LEN) throw new Error(`key must be ${KEY_LEN} bytes`);
  if (nonce.length !== NONCE_LEN) throw new Error(`nonce must be ${NONCE_LEN} bytes`);
  if (tag.length !== TAG_LEN) throw new Error(`tag must be ${TAG_LEN} bytes`);

  const combined = new Uint8Array(ciphertext.length + tag.length);
  combined.set(ciphertext, 0);
  combined.set(tag, ciphertext.length);

  // Throws on authentication failure, matching the previous libsodium behaviour.
  return chacha20poly1305(key, nonce, ad ?? undefined).decrypt(combined);
}

export async function randomBytes(n: number): Promise<Uint8Array> {
  await ensureReady();
  return sodium.randombytes_buf(n);
}
