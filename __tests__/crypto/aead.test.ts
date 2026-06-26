import { aeadEncrypt, aeadDecrypt, randomBytes } from '@/crypto/aead';

const KEY = new Uint8Array(32).fill(0x10);
const NONCE = new Uint8Array(12).fill(0x20);

describe('AEAD: ChaCha20-Poly1305-IETF', () => {
  test('encrypt then decrypt yields the original plaintext', async () => {
    const pt = new TextEncoder().encode('hello vault');
    const enc = await aeadEncrypt(pt, KEY, NONCE);
    expect(enc.ciphertext.length).toBe(pt.length);
    expect(enc.tag.length).toBe(16);
    const dec = await aeadDecrypt(enc.ciphertext, enc.tag, KEY, NONCE);
    expect(new TextDecoder().decode(dec)).toBe('hello vault');
  });

  test('ciphertext tamper detection', async () => {
    const pt = new TextEncoder().encode('hello vault');
    const enc = await aeadEncrypt(pt, KEY, NONCE);
    enc.ciphertext[0] = (enc.ciphertext[0] ?? 0) ^ 0xff;
    await expect(aeadDecrypt(enc.ciphertext, enc.tag, KEY, NONCE)).rejects.toThrow();
  });

  test('tag tamper detection', async () => {
    const pt = new TextEncoder().encode('hello vault');
    const enc = await aeadEncrypt(pt, KEY, NONCE);
    enc.tag[0] = (enc.tag[0] ?? 0) ^ 0xff;
    await expect(aeadDecrypt(enc.ciphertext, enc.tag, KEY, NONCE)).rejects.toThrow();
  });

  test('wrong key fails decryption', async () => {
    const pt = new TextEncoder().encode('hello vault');
    const enc = await aeadEncrypt(pt, KEY, NONCE);
    const wrong = new Uint8Array(32).fill(0x99);
    await expect(aeadDecrypt(enc.ciphertext, enc.tag, wrong, NONCE)).rejects.toThrow();
  });

  test('wrong nonce fails decryption', async () => {
    const pt = new TextEncoder().encode('hello vault');
    const enc = await aeadEncrypt(pt, KEY, NONCE);
    const bad = new Uint8Array(12).fill(0x77);
    await expect(aeadDecrypt(enc.ciphertext, enc.tag, KEY, bad)).rejects.toThrow();
  });

  test('randomBytes returns requested length', async () => {
    const a = await randomBytes(12);
    const b = await randomBytes(12);
    expect(a.length).toBe(12);
    expect(b.length).toBe(12);
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });

  test('rejects wrong key size', async () => {
    await expect(aeadEncrypt(new Uint8Array(1), new Uint8Array(16), NONCE)).rejects.toThrow(/key/);
  });

  test('rejects wrong nonce size', async () => {
    await expect(aeadEncrypt(new Uint8Array(1), KEY, new Uint8Array(11))).rejects.toThrow(/nonce/);
  });
});
