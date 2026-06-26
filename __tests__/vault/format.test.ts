import { encodeVaultFile, decodeVaultFile, type VaultFileFields } from '@/vault/format';

const sampleFields = (): VaultFileFields => ({
  version: 1,
  salt: new Uint8Array(16).fill(7),
  argon2: { memoryKiB: 65536, timeCost: 3, parallelism: 1, hashLen: 32 },
  hint: 'my mum birthday',
  recoveryWrappedKey: new Uint8Array(60).fill(9), // nonce(12) + ct(32) + tag(16)
  vaultNonce: new Uint8Array(12).fill(11),
  vaultCiphertext: new Uint8Array([1, 2, 3, 4, 5]),
  vaultTag: new Uint8Array(16).fill(13),
});

describe('vault binary format', () => {
  test('round-trips all fields', () => {
    const input = sampleFields();
    const bytes = encodeVaultFile(input);
    const decoded = decodeVaultFile(bytes);
    expect(decoded).toEqual(input);
  });

  test('round-trips with no hint and no recovery key', () => {
    const input: VaultFileFields = { ...sampleFields(), hint: '', recoveryWrappedKey: null };
    const bytes = encodeVaultFile(input);
    const decoded = decodeVaultFile(bytes);
    expect(decoded.hint).toBe('');
    expect(decoded.recoveryWrappedKey).toBeNull();
    expect(decoded.vaultCiphertext).toEqual(input.vaultCiphertext);
  });

  test('rejects wrong magic bytes', () => {
    const bytes = encodeVaultFile(sampleFields());
    bytes[0] = 0; // corrupt magic
    expect(() => decodeVaultFile(bytes)).toThrow(/magic/i);
  });

  test('rejects unsupported version', () => {
    const bytes = encodeVaultFile(sampleFields());
    bytes[4] = 99;
    expect(() => decodeVaultFile(bytes)).toThrow(/version/i);
  });

  test('rejects hint longer than 255 bytes', () => {
    const fields = { ...sampleFields(), hint: 'x'.repeat(256) };
    expect(() => encodeVaultFile(fields)).toThrow(/hint/i);
  });

  test('non-ASCII hint round-trips as UTF-8', () => {
    const fields = { ...sampleFields(), hint: 'à mãe — 1985 🎂' };
    const bytes = encodeVaultFile(fields);
    expect(decodeVaultFile(bytes).hint).toBe(fields.hint);
  });
});
