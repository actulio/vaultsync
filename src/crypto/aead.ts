import sodium from 'react-native-libsodium';

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

  // libsodium returns ciphertext || tag concatenated; split for our format.
  const combined = sodium.crypto_aead_chacha20poly1305_ietf_encrypt(
    plaintext,
    ad,
    null,
    nonce,
    key,
  );
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

  return sodium.crypto_aead_chacha20poly1305_ietf_decrypt(null, combined, ad, nonce, key);
}

export async function randomBytes(n: number): Promise<Uint8Array> {
  await ensureReady();
  return sodium.randombytes_buf(n);
}
