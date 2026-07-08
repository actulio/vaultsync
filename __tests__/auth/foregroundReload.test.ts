import { useAuthStore } from '@/auth/store';
import { reloadVaultIfNewer } from '@/auth/foregroundReload';
import { readVaultWithKey } from '@/auth/unlock';
import type { VaultV1 } from '@/vault/types';

jest.mock('@/auth/unlock', () => ({
  readVaultWithKey: jest.fn(),
}));

const mockRead = readVaultWithKey as jest.MockedFunction<typeof readVaultWithKey>;

// The reload logic only reads `.updatedAt`; a minimal shape keeps the test independent of the
// full VaultV1 field set.
function vaultAt(updatedAt: string): VaultV1 {
  return { updatedAt, entries: [] } as unknown as VaultV1;
}

describe('reloadVaultIfNewer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.getState().reset();
  });

  it('adopts the on-disk vault when its updatedAt is strictly newer', async () => {
    const key = new Uint8Array(32);
    useAuthStore.getState().unlock(key, vaultAt('2026-07-08T10:00:00.000Z'));
    const newer = vaultAt('2026-07-08T11:00:00.000Z');
    mockRead.mockResolvedValueOnce(newer);

    await reloadVaultIfNewer();

    expect(mockRead).toHaveBeenCalledWith(key);
    expect(useAuthStore.getState().vault).toBe(newer);
  });

  it('keeps the in-memory vault when the on-disk updatedAt is older', async () => {
    const key = new Uint8Array(32);
    const current = vaultAt('2026-07-08T10:00:00.000Z');
    useAuthStore.getState().unlock(key, current);
    mockRead.mockResolvedValueOnce(vaultAt('2026-07-08T09:00:00.000Z'));

    await reloadVaultIfNewer();

    expect(useAuthStore.getState().vault).toBe(current);
  });

  it('keeps the in-memory vault when the on-disk updatedAt is equal', async () => {
    const key = new Uint8Array(32);
    const current = vaultAt('2026-07-08T10:00:00.000Z');
    useAuthStore.getState().unlock(key, current);
    mockRead.mockResolvedValueOnce(vaultAt('2026-07-08T10:00:00.000Z'));

    await reloadVaultIfNewer();

    expect(useAuthStore.getState().vault).toBe(current);
  });

  it('does nothing (no disk read) when the vault is locked', async () => {
    useAuthStore.getState().setLocked();
    await reloadVaultIfNewer();
    expect(mockRead).not.toHaveBeenCalled();
  });

  it('swallows read/decrypt errors and keeps the in-memory vault', async () => {
    const key = new Uint8Array(32);
    const current = vaultAt('2026-07-08T10:00:00.000Z');
    useAuthStore.getState().unlock(key, current);
    mockRead.mockRejectedValueOnce(new Error('vault_corrupt'));

    await expect(reloadVaultIfNewer()).resolves.toBeUndefined();
    expect(useAuthStore.getState().vault).toBe(current);
  });
});
