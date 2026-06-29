// ── Mock native Keystore / VaultStore with an in-memory map ───────────────────

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
    write: jest.fn(async (n: string, b: Uint8Array) => {
      mockMemoryStore.set(n, b);
    }),
    exists: jest.fn(async (n: string) => mockMemoryStore.has(n)),
    delete: jest.fn(async (n: string) => {
      mockMemoryStore.delete(n);
    }),
  },
}));

import { changeMasterPassword } from '@/settings/changePassword';
import { _internalAssemble } from '@/auth/onboarding';
import { unlockWithPassword, RecoverableError } from '@/auth/unlock';

beforeEach(() => mockMemoryStore.clear());

describe('changeMasterPassword', () => {
  it('rotates the password and recovery code; the new password unlocks the vault', async () => {
    const { recoveryCode, vaultBytes, masterKey } = await _internalAssemble({
      password: 'old-pw-1234',
      hint: '',
    });
    mockMemoryStore.set('vault.enc', vaultBytes);
    mockMemoryStore.set('masterKey.wrapped', masterKey);

    const result = await changeMasterPassword(masterKey, 'new-pw-5678');
    expect(result.newRecoveryCode).toMatch(/-/);
    expect(result.newRecoveryCode).not.toBe(recoveryCode);

    // End-to-end: the new password must unlock the rotated vault.
    const unlocked = await unlockWithPassword('new-pw-5678');
    expect(unlocked.vault.version).toBe(1);
  });

  it('invalidates the old password after the change', async () => {
    const { vaultBytes, masterKey } = await _internalAssemble({
      password: 'old-pw-1234',
      hint: '',
    });
    mockMemoryStore.set('vault.enc', vaultBytes);
    mockMemoryStore.set('masterKey.wrapped', masterKey);

    await changeMasterPassword(masterKey, 'new-pw-5678');

    await expect(unlockWithPassword('old-pw-1234')).rejects.toBeInstanceOf(RecoverableError);
  });

  it('rejects a new password that is too short', async () => {
    const { vaultBytes, masterKey } = await _internalAssemble({
      password: 'old-pw-1234',
      hint: '',
    });
    mockMemoryStore.set('vault.enc', vaultBytes);
    await expect(changeMasterPassword(masterKey, 'short')).rejects.toThrow(
      'new password too short',
    );
  });
});
