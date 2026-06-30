jest.mock('@/drive/client', () => ({
  driveFetch: jest.fn(),
  DriveError: class extends Error {},
}));

import { driveFetch } from '@/drive/client';
import { findOrCreateVaultFolder, uploadVaultFile, downloadVaultFile } from '@/drive/files';

const mock = driveFetch as jest.Mock;

beforeEach(() => mock.mockReset());

test('findOrCreateVaultFolder reuses existing', async () => {
  mock.mockResolvedValueOnce({ ok: true, json: async () => ({ files: [{ id: 'f1', name: 'VaultSync', modifiedTime: 't' }] }) });
  const f = await findOrCreateVaultFolder();
  expect(f.id).toBe('f1');
});

test('uploadVaultFile creates folder + file when none exist', async () => {
  mock
    // 1) folder search: empty
    .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [] }) })
    // 2) create folder
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'fnew', name: 'VaultSync', modifiedTime: 't1' }) })
    // 3) file search inside folder: empty
    .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [] }) })
    // 4) upload
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'file1', name: 'vault.enc', modifiedTime: 't2' }) });
  const f = await uploadVaultFile(new Uint8Array([1, 2, 3]));
  expect(f.id).toBe('file1');
});

test('downloadVaultFile returns null when file missing', async () => {
  mock
    .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [{ id: 'f1', name: 'VaultSync', modifiedTime: 't' }] }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [] }) });
  expect(await downloadVaultFile()).toBeNull();
});
