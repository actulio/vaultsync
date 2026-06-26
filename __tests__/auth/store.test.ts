import { useAuthStore } from '@/auth/store';
import type { VaultV1 } from '@/vault';

const emptyVault = (): VaultV1 => ({
  version: 1,
  entries: [],
  updatedAt: new Date().toISOString(),
  deviceId: 'test-device',
});

describe('auth store', () => {
  beforeEach(() => useAuthStore.getState().reset());

  test('initial status is bootstrapping', () => {
    expect(useAuthStore.getState().status).toBe('bootstrapping');
  });

  test('setNoVault sets status to no_vault', () => {
    useAuthStore.getState().setNoVault();
    expect(useAuthStore.getState().status).toBe('no_vault');
  });

  test('setLocked sets status to locked', () => {
    useAuthStore.getState().setLocked();
    expect(useAuthStore.getState().status).toBe('locked');
  });

  test('unlock stores masterKey and vault, sets status to unlocked', () => {
    const key = new Uint8Array(32).fill(1);
    const vault = emptyVault();
    useAuthStore.getState().unlock(key, vault);
    expect(useAuthStore.getState().status).toBe('unlocked');
    expect(useAuthStore.getState().masterKey).toEqual(key);
    expect(useAuthStore.getState().vault).toEqual(vault);
  });

  test('lock wipes masterKey and vault', () => {
    useAuthStore.getState().unlock(new Uint8Array(32).fill(1), emptyVault());
    useAuthStore.getState().lock();
    expect(useAuthStore.getState().status).toBe('locked');
    expect(useAuthStore.getState().masterKey).toBeNull();
    expect(useAuthStore.getState().vault).toBeNull();
  });

  test('updateVault refuses when locked', () => {
    useAuthStore.getState().setLocked();
    expect(() => useAuthStore.getState().updateVault(emptyVault())).toThrow(/locked/i);
  });
});
