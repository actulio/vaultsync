// Mocks — factories must be self-contained (no out-of-scope references).
// Only persistVault and the two native modules are mocked; the store and
// vault mutations (addLogin/addNote) run for real.
jest.mock('@/vault/persist', () => ({
  persistVault: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
}));

import { buildPreview, executeImport, pickCsv } from '@/import/csvImporter';
import { rowsToEntries } from '@/import/parsers';
import { persistVault } from '@/vault/persist';
import { useAuthStore } from '@/auth/store';
import type { Login, VaultV1 } from '@/vault/types';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

// -----------------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------------

const ONE_PASSWORD_CSV = [
  'Title,URL,Username,Password,Notes',
  'GitHub,https://github.com,alice,hunter2,work account',
  ',https://noname.com,bob,secret,no title here',
].join('\n');

const existingVault: VaultV1 = {
  version: 1,
  updatedAt: '',
  deviceId: 'device-1',
  entries: [
    {
      id: 'pre-existing',
      type: 'login',
      title: 'Existing Entry',
      username: 'u',
      password: 'p',
      createdAt: '',
      updatedAt: '',
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.getState().reset();
});

// -----------------------------------------------------------------------
// pickCsv
// -----------------------------------------------------------------------

describe('pickCsv', () => {
  it('deletes the temp cache copy immediately after reading its content', async () => {
    const asset: DocumentPicker.DocumentPickerAsset = {
      name: 'export.csv',
      uri: 'file:///tmp/export.csv',
      lastModified: 0,
    };
    jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue({
      canceled: false,
      assets: [asset],
    });
    jest.mocked(FileSystem.readAsStringAsync).mockResolvedValue(ONE_PASSWORD_CSV);

    const result = await pickCsv();

    expect(result).toEqual({ tmpUri: asset.uri, content: ONE_PASSWORD_CSV });
    expect(jest.mocked(FileSystem.deleteAsync)).toHaveBeenCalledWith(asset.uri, {
      idempotent: true,
    });
  });

  it('returns null without reading or deleting anything when the picker is canceled', async () => {
    jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue({
      canceled: true,
      assets: null,
    });

    const result = await pickCsv();

    expect(result).toBeNull();
    expect(jest.mocked(FileSystem.readAsStringAsync)).not.toHaveBeenCalled();
    expect(jest.mocked(FileSystem.deleteAsync)).not.toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------
// buildPreview
// -----------------------------------------------------------------------

describe('buildPreview', () => {
  it('parses a 1Password CSV string and returns headers, rows, and the inferred preset + mapping', () => {
    const preview = buildPreview(ONE_PASSWORD_CSV);

    expect(preview.headers).toEqual(['Title', 'URL', 'Username', 'Password', 'Notes']);
    expect(preview.rows).toEqual([
      {
        Title: 'GitHub',
        URL: 'https://github.com',
        Username: 'alice',
        Password: 'hunter2',
        Notes: 'work account',
      },
      {
        Title: '',
        URL: 'https://noname.com',
        Username: 'bob',
        Password: 'secret',
        Notes: 'no title here',
      },
    ]);
    expect(preview.inferredPreset).toBe('1Password');
    expect(preview.inferredMapping).toEqual({
      title: 'Title',
      url: 'URL',
      username: 'Username',
      password: 'Password',
      notes: 'Notes',
    });
    expect(preview.errorCount).toBe(0);
  });
});

// -----------------------------------------------------------------------
// executeImport
// -----------------------------------------------------------------------

describe('executeImport', () => {
  beforeEach(() => {
    useAuthStore.getState().unlock(new Uint8Array(32), existingVault);
  });

  it('appends parsed rows to the existing vault, persists once, and returns added/skipped counts', async () => {
    const preview = buildPreview(ONE_PASSWORD_CSV);
    const mapping = preview.inferredMapping;
    if (!mapping) throw new Error('expected an inferred mapping for the 1Password fixture');
    // Parse once (as confirm.tsx now does) and hand the already-parsed
    // entries to executeImport — it no longer parses rows itself.
    const { rows: entries, skipped } = rowsToEntries(preview.rows, mapping);

    const result = await executeImport(entries, skipped);

    // One row has no title -> skipped; the other imports as a login.
    expect(result).toEqual({ added: 1, skipped: 1 });

    // Append-not-replace: pre-existing entry survives alongside the import.
    const vault = useAuthStore.getState().vault;
    expect(vault).not.toBeNull();
    expect(vault!.entries).toHaveLength(2);
    expect(vault!.entries.some((e) => e.id === 'pre-existing')).toBe(true);

    const imported = vault!.entries.find((e) => e.id !== 'pre-existing') as Login;
    expect(imported.type).toBe('login');
    expect(imported.title).toBe('GitHub');
    expect(imported.username).toBe('alice');
    expect(imported.password).toBe('hunter2');
    expect(imported.url).toBe('https://github.com');
    expect(imported.source).toMatch(/^import-/);

    // persistVault called once with the updated (post-append) vault.
    expect(jest.mocked(persistVault)).toHaveBeenCalledTimes(1);
    const [savedVault] = jest.mocked(persistVault).mock.calls[0]!;
    expect(savedVault).toBe(vault);
  });

  it('throws when the vault is locked (no unlocked store state)', async () => {
    useAuthStore.getState().reset();
    const preview = buildPreview(ONE_PASSWORD_CSV);
    const mapping = preview.inferredMapping;
    if (!mapping) throw new Error('expected an inferred mapping for the 1Password fixture');
    const { rows: entries, skipped } = rowsToEntries(preview.rows, mapping);

    await expect(executeImport(entries, skipped)).rejects.toThrow(/locked/);
    expect(jest.mocked(persistVault)).not.toHaveBeenCalled();
  });
});
