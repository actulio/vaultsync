import { bootstrapAuth } from '@/auth/bootstrap';
import { useAuthStore } from '@/auth/store';
import { vaultExists } from '@/auth/unlock';
import { hasDriveToken } from '@/drive/auth';
import { downloadVaultFile } from '@/drive/files';
import { VaultStore } from '@/native/keystore';
import { decodeVaultFile } from '@/vault/format';

jest.mock('@/auth/unlock', () => ({ vaultExists: jest.fn() }));
jest.mock('@/drive/auth', () => ({ hasDriveToken: jest.fn() }));
jest.mock('@/drive/files', () => ({ downloadVaultFile: jest.fn() }));
jest.mock('@/native/keystore', () => ({ VaultStore: { write: jest.fn() } }));
jest.mock('@/vault/format', () => ({ decodeVaultFile: jest.fn() }));

const mockVaultExists = vaultExists as jest.MockedFunction<typeof vaultExists>;
const mockHasDriveToken = hasDriveToken as jest.MockedFunction<typeof hasDriveToken>;
const mockDownloadVaultFile = downloadVaultFile as jest.MockedFunction<typeof downloadVaultFile>;
const mockVaultStoreWrite = VaultStore.write as jest.MockedFunction<typeof VaultStore.write>;
const mockDecodeVaultFile = decodeVaultFile as jest.MockedFunction<typeof decodeVaultFile>;

describe('bootstrapAuth', () => {
  beforeEach(() => {
    useAuthStore.getState().reset();
    jest.clearAllMocks();
    // Default: no Drive token (keeps existing tests unaffected)
    mockHasDriveToken.mockResolvedValue(false);
  });

  it('sets no_vault when no vault on disk', async () => {
    mockVaultExists.mockResolvedValue(false);
    await bootstrapAuth();
    expect(useAuthStore.getState().status).toBe('no_vault');
  });

  it('sets locked when a vault exists', async () => {
    mockVaultExists.mockResolvedValue(true);
    await bootstrapAuth();
    expect(useAuthStore.getState().status).toBe('locked');
  });

  it('pulls from Drive and sets locked when local is missing but Drive token exists', async () => {
    const fakeBytes = new Uint8Array([1, 2, 3]);
    // First call (condition check): missing. Second call (decision): present after write.
    mockVaultExists.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    mockHasDriveToken.mockResolvedValue(true);
    mockDownloadVaultFile.mockResolvedValue({ bytes: fakeBytes, modifiedTime: '2024-01-01T00:00:00Z' });
    mockDecodeVaultFile.mockReturnValue(undefined as never); // valid — does not throw

    await bootstrapAuth();

    expect(mockVaultStoreWrite).toHaveBeenCalledWith('vault.enc', fakeBytes);
    expect(useAuthStore.getState().status).toBe('locked');
  });

  it('does not write and sets no_vault when downloaded bytes fail decodeVaultFile', async () => {
    const fakeBytes = new Uint8Array([0xde, 0xad]);
    mockVaultExists.mockResolvedValue(false);
    mockHasDriveToken.mockResolvedValue(true);
    mockDownloadVaultFile.mockResolvedValue({ bytes: fakeBytes, modifiedTime: '2024-01-01T00:00:00Z' });
    mockDecodeVaultFile.mockImplementation(() => { throw new Error('bad magic'); });

    await bootstrapAuth();

    expect(mockVaultStoreWrite).not.toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe('no_vault');
  });

  it('does not write and sets no_vault when downloadVaultFile returns null', async () => {
    mockVaultExists.mockResolvedValue(false);
    mockHasDriveToken.mockResolvedValue(true);
    mockDownloadVaultFile.mockResolvedValue(null);

    await bootstrapAuth();

    expect(mockVaultStoreWrite).not.toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe('no_vault');
  });
});
