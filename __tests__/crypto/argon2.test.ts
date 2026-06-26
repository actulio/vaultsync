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
    // Precomposed A-ring (U+00C5) vs decomposed A + combining ring above
    // (U+0041 U+030A): different byte sequences that share one NFKC form.
    // The derived keys match ONLY if deriveMasterKey NFKC-normalizes its
    // input, so this test fails if the normalization step is removed.
    const precomposed = 'Åpple';
    const decomposed = 'Åpple';
    expect(precomposed).not.toBe(decomposed); // genuinely distinct inputs
    expect(precomposed.normalize('NFKC')).toBe(decomposed.normalize('NFKC'));
    const a = await deriveMasterKey(precomposed, SALT);
    const b = await deriveMasterKey(decomposed, SALT);
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});
