jest.mock('@/vault/persist', () => ({ persistVault: jest.fn().mockResolvedValue(undefined) }));

import { useAuthStore } from '@/auth/store';
import { runStaleCleanup } from '@/auth/staleCleanup';
import { persistVault } from '@/vault/persist';
import type { Login, VaultV1 } from '@/vault/types';

const persistVaultMock = jest.mocked(persistVault);

const daysAgo = (n: number): string => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

const masterKey = new Uint8Array(32).fill(7);

const staleLogin: Login = {
  id: 'stale',
  type: 'login',
  title: 'Stale Co',
  username: 'me',
  password: 'new-pass',
  previousPassword: 'old-pass',
  createdAt: daysAgo(30),
  updatedAt: daysAgo(8), // older than the 7-day retention window
};

const freshLogin: Login = {
  id: 'fresh',
  type: 'login',
  title: 'Fresh Co',
  username: 'me',
  password: 'new-pass-2',
  previousPassword: 'old-pass-2',
  createdAt: daysAgo(30),
  updatedAt: daysAgo(1), // within the 7-day retention window
};

function vaultWith(entries: VaultV1['entries']): VaultV1 {
  return { version: 1, entries, updatedAt: daysAgo(1), deviceId: 'device-1' };
}

describe('runStaleCleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.getState().reset();
  });

  it('clears previousPassword only on entries older than 7 days, and persists', async () => {
    const vault = vaultWith([staleLogin, freshLogin]);
    useAuthStore.getState().unlock(masterKey, vault);

    await runStaleCleanup();

    const updated = useAuthStore.getState().vault;
    expect(updated).not.toBe(vault); // updateVault was called with a new vault
    const [stale, fresh] = updated!.entries as [Login, Login];
    expect(stale.previousPassword).toBeUndefined(); // pinned: stale entry cleared
    expect(fresh.previousPassword).toBe('old-pass-2'); // pinned: fresh entry untouched

    expect(persistVaultMock).toHaveBeenCalledTimes(1);
    expect(persistVaultMock).toHaveBeenCalledWith(updated, masterKey);
  });

  it('does nothing when no entry is stale', async () => {
    const vault = vaultWith([freshLogin]);
    useAuthStore.getState().unlock(masterKey, vault);

    await runStaleCleanup();

    expect(useAuthStore.getState().vault).toBe(vault); // untouched reference: updateVault not called
    expect(persistVaultMock).not.toHaveBeenCalled();
  });

  it('is a no-op when locked', async () => {
    useAuthStore.getState().setLocked();

    await expect(runStaleCleanup()).resolves.toBeUndefined();

    expect(useAuthStore.getState().status).toBe('locked');
    expect(persistVaultMock).not.toHaveBeenCalled();
  });
});
