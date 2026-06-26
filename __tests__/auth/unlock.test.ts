import { unlockWithPassword, unlockWithBiometric, RecoverableError, vaultExists, readVaultHint } from '@/auth/unlock';
import { _internalAssemble } from '@/auth/onboarding';

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

describe('unlock', () => {
  it('unlockWithPassword returns vault after correct password', async () => {
    const { masterKey, vaultBytes } = await _internalAssemble({ password: 'pw1234567', hint: '' });
    mockMemoryStore.set('vault.enc', vaultBytes);
    mockMemoryStore.set('masterKey.wrapped', masterKey);

    const result = await unlockWithPassword('pw1234567');
    expect(result.vault.version).toBe(1);
    expect(result.masterKey).toEqual(masterKey);
  });

  it('unlockWithPassword throws RecoverableError on wrong password', async () => {
    const { vaultBytes } = await _internalAssemble({ password: 'pw1234567', hint: '' });
    mockMemoryStore.set('vault.enc', vaultBytes);

    await expect(unlockWithPassword('wrong')).rejects.toBeInstanceOf(RecoverableError);
  });

  it('unlockWithPassword code is wrong_password (not vault_corrupt)', async () => {
    const { vaultBytes } = await _internalAssemble({ password: 'pw1234567', hint: '' });
    mockMemoryStore.set('vault.enc', vaultBytes);

    const err = await unlockWithPassword('wrong').catch((e) => e);
    expect(err).toBeInstanceOf(RecoverableError);
    expect((err as RecoverableError).code).toBe('wrong_password');
  });

  it('unlockWithBiometric returns vault using Keystore-wrapped key', async () => {
    const { masterKey, vaultBytes } = await _internalAssemble({ password: 'pw1234567', hint: '' });
    mockMemoryStore.set('vault.enc', vaultBytes);
    mockMemoryStore.set('masterKey.wrapped', masterKey);

    const result = await unlockWithBiometric();
    expect(result.vault.version).toBe(1);
  });

  it('vaultExists returns false when no vault', async () => {
    expect(await vaultExists()).toBe(false);
  });

  it('vaultExists returns true when vault present', async () => {
    const { vaultBytes } = await _internalAssemble({ password: 'pw1234567', hint: '' });
    mockMemoryStore.set('vault.enc', vaultBytes);
    expect(await vaultExists()).toBe(true);
  });

  it('readVaultHint returns the hint from vault', async () => {
    const { vaultBytes } = await _internalAssemble({ password: 'pw1234567', hint: 'my hint' });
    mockMemoryStore.set('vault.enc', vaultBytes);
    expect(await readVaultHint()).toBe('my hint');
  });
});
