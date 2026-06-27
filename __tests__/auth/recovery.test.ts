import { recoverAndReset } from '@/auth/recovery';
import { _internalAssemble } from '@/auth/onboarding';
import { unlockWithPassword, RecoverableError } from '@/auth/unlock';

const mockMemoryStore = new Map<string, Uint8Array>();

jest.mock('@/native/keystore', () => ({
  Keystore: {
    generateKeyIfMissing: jest.fn(async () => {}),
    wrap: jest.fn(async (b: Uint8Array) => b),
    unwrap: jest.fn(async (b: Uint8Array) => b),
    keyExists: jest.fn(async () => true),
    deleteKey: jest.fn(async () => {}),
  },
  VaultStore: {
    read: jest.fn(async (n: string) => {
      const v = mockMemoryStore.get(n);
      if (!v) throw new Error('FileNotFound');
      return v;
    }),
    write: jest.fn(async (n: string, b: Uint8Array) => { mockMemoryStore.set(n, b); }),
    exists: jest.fn(async (n: string) => mockMemoryStore.has(n)),
    delete: jest.fn(async (n: string) => { mockMemoryStore.delete(n); }),
  },
}));

beforeEach(() => mockMemoryStore.clear());

describe('recovery', () => {
  it('recovers with valid code, sets new password, and produces a new recovery code', async () => {
    const { recoveryCode, vaultBytes, masterKey } = await _internalAssemble({ password: 'old-pw-1234', hint: '' });
    mockMemoryStore.set('vault.enc', vaultBytes);
    mockMemoryStore.set('masterKey.wrapped', masterKey);

    const result = await recoverAndReset(recoveryCode, 'new-pw-5678');
    expect(result.newRecoveryCode).toMatch(/-/);
    expect(result.newRecoveryCode).not.toBe(recoveryCode);

    // End-to-end: new password must unlock the rotated vault
    const unlocked = await unlockWithPassword('new-pw-5678');
    expect(unlocked.vault.version).toBe(1);
  });

  it('rejects an invalid recovery code', async () => {
    const { vaultBytes } = await _internalAssemble({ password: 'pw1234567', hint: '' });
    mockMemoryStore.set('vault.enc', vaultBytes);
    // Use a valid-length new password so the failure is the wrong recovery code, not password length
    await expect(
      recoverAndReset('AAAA-AAAA-AAAA-AAAA-AAAA-AAAA', 'new-pw-5678'),
    ).rejects.toBeInstanceOf(RecoverableError);
  });

  it('rejects a new password that is too short', async () => {
    const { recoveryCode, vaultBytes } = await _internalAssemble({ password: 'pw1234567', hint: '' });
    mockMemoryStore.set('vault.enc', vaultBytes);
    await expect(
      recoverAndReset(recoveryCode, 'short'),
    ).rejects.toThrow('new password too short');
  });
});
