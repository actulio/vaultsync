const mockMemoryStore = new Map<string, Uint8Array>();

jest.mock('@/native/keystore', () => ({
  Keystore: {
    generateKeyIfMissing: jest.fn(async () => {}),
    wrap: jest.fn(async (b: Uint8Array) => b), // identity for the test
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

import { enableBiometric, disableBiometric, isBiometricEnabled } from '@/auth/biometric';

const WRAPPED = 'masterKey.wrapped';

function mocked() {
  const m = jest.requireMock('@/native/keystore');
  return {
    Keystore: m.Keystore as {
      generateKeyIfMissing: jest.Mock;
      wrap: jest.Mock;
      deleteKey: jest.Mock;
    },
    VaultStore: m.VaultStore as { delete: jest.Mock },
  };
}

beforeEach(() => {
  mockMemoryStore.clear();
  const { Keystore, VaultStore } = mocked();
  Keystore.generateKeyIfMissing.mockClear();
  Keystore.wrap.mockClear();
  Keystore.deleteKey.mockClear();
  VaultStore.delete.mockClear();
});

describe('biometric opt-in', () => {
  it('isBiometricEnabled reflects presence of the wrapped key', async () => {
    expect(await isBiometricEnabled()).toBe(false);
    mockMemoryStore.set(WRAPPED, new Uint8Array([1, 2, 3]));
    expect(await isBiometricEnabled()).toBe(true);
  });

  it('enableBiometric generates the key, wraps, and writes the wrapped blob', async () => {
    const { Keystore } = mocked();
    const key = new Uint8Array([9, 8, 7, 6]);

    await enableBiometric(key);

    expect(Keystore.generateKeyIfMissing).toHaveBeenCalledTimes(1);
    expect(Keystore.wrap).toHaveBeenCalledWith(key);
    expect(await isBiometricEnabled()).toBe(true);
    expect(mockMemoryStore.get(WRAPPED)).toEqual(key); // wrap is identity in the mock
  });

  it('disableBiometric deletes the Keystore key and removes the wrapped blob', async () => {
    const { Keystore, VaultStore } = mocked();
    mockMemoryStore.set(WRAPPED, new Uint8Array([1, 2, 3]));

    await disableBiometric();

    expect(Keystore.deleteKey).toHaveBeenCalledTimes(1);
    expect(VaultStore.delete).toHaveBeenCalledWith(WRAPPED);
    expect(await isBiometricEnabled()).toBe(false);
  });

  it('disableBiometric is a safe no-op on the wrapped blob when biometric was never enabled', async () => {
    const { Keystore, VaultStore } = mocked();

    await disableBiometric();

    // Key deletion is always attempted (idempotent on the native side)...
    expect(Keystore.deleteKey).toHaveBeenCalledTimes(1);
    // ...but we never delete a wrapped blob that doesn't exist.
    expect(VaultStore.delete).not.toHaveBeenCalled();
    expect(await isBiometricEnabled()).toBe(false);
  });

  it('enable then disable returns to the disabled state', async () => {
    await enableBiometric(new Uint8Array([5, 5, 5]));
    expect(await isBiometricEnabled()).toBe(true);
    await disableBiometric();
    expect(await isBiometricEnabled()).toBe(false);
  });
});
