import { deriveMasterKey } from '@/crypto/argon2';

const SALT = new Uint8Array(16).fill(0x42);

describe('Argon2id KDF', () => {
  test('derives a 32-byte key', async () => {
    const key = await deriveMasterKey('correct horse battery staple', SALT);
    expect(key.length).toBe(32);
  });

  test('same password + salt produce same key (deterministic)', async () => {
    const a = await deriveMasterKey('password', SALT);
    const b = await deriveMasterKey('password', SALT);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  test('different password produces different key', async () => {
    const a = await deriveMasterKey('password1', SALT);
    const b = await deriveMasterKey('password2', SALT);
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });

  test('different salt produces different key', async () => {
    const a = await deriveMasterKey('password', SALT);
    const b = await deriveMasterKey('password', new Uint8Array(16).fill(0x11));
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });

  test('NFKC normalizes Unicode passwords', async () => {
    // U+00C5 (Å precomposed) vs U+0041 U+030A (A + combining ring) — same NFKC form
    const a = await deriveMasterKey('Åpple', SALT);
    const b = await deriveMasterKey('Åpple', SALT);
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});
