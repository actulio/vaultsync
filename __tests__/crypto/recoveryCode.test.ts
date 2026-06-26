import {
  generateRecoveryCode,
  parseRecoveryCode,
  deriveRecoveryKey,
  RECOVERY_CODE_INFO,
} from '@/crypto/recoveryCode';

const SALT = new Uint8Array(16).fill(0x33);

describe('recovery code', () => {
  test('generates 24-character base32 in 6 groups of 4 with dashes', async () => {
    const code = await generateRecoveryCode();
    expect(code).toMatch(/^[A-Z2-7]{4}-[A-Z2-7]{4}-[A-Z2-7]{4}-[A-Z2-7]{4}-[A-Z2-7]{4}-[A-Z2-7]{4}$/);
  });

  test('two generated codes differ', async () => {
    expect(await generateRecoveryCode()).not.toBe(await generateRecoveryCode());
  });

  test('parse accepts spaces, dashes, mixed case', async () => {
    const code = await generateRecoveryCode();
    const variant = code.toLowerCase().replace(/-/g, ' ');
    expect(parseRecoveryCode(variant)).toEqual(parseRecoveryCode(code));
  });

  test('parse rejects invalid characters', () => {
    expect(() => parseRecoveryCode('AAAA-AAAA-AAAA-AAAA-AAAA-AAA1')).toThrow();
  });

  test('parse rejects wrong length', () => {
    expect(() => parseRecoveryCode('AAAA-BBBB')).toThrow(/length/i);
  });

  test('HKDF derives a 32-byte key', async () => {
    const code = await generateRecoveryCode();
    const key = await deriveRecoveryKey(code, SALT);
    expect(key.length).toBe(32);
  });

  test('HKDF: same code + same salt → same key', async () => {
    const code = await generateRecoveryCode();
    const a = await deriveRecoveryKey(code, SALT);
    const b = await deriveRecoveryKey(code, SALT);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  test('HKDF: different salt → different key', async () => {
    const code = await generateRecoveryCode();
    const a = await deriveRecoveryKey(code, SALT);
    const b = await deriveRecoveryKey(code, new Uint8Array(16).fill(0x55));
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });

  test('info string is the documented constant', () => {
    expect(RECOVERY_CODE_INFO).toBe('vaultsync-recovery-v1');
  });
});
