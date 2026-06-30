// jest.mock calls are hoisted to the top of the file by Jest.
jest.mock('expo-network', () => ({ getNetworkStateAsync: jest.fn() }));
jest.mock('@/drive/auth', () => ({ hasDriveToken: jest.fn() }));
jest.mock('@/drive/files', () => ({
  uploadVaultFile: jest.fn(),
  downloadVaultFile: jest.fn(),
  fetchVaultFileMetadata: jest.fn(),
}));
jest.mock('@/native/keystore', () => ({
  VaultStore: { read: jest.fn(), write: jest.fn() },
}));
jest.mock('@/sync/queue', () => ({
  peek: jest.fn(),
  remove: jest.fn(),
  count: jest.fn(),
}));
jest.mock('@/vault/format', () => ({ decodeVaultFile: jest.fn() }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

import * as Network from 'expo-network';
import { hasDriveToken } from '@/drive/auth';
import { uploadVaultFile, downloadVaultFile, fetchVaultFileMetadata } from '@/drive/files';
import { VaultStore } from '@/native/keystore';
import { peek, remove, count } from '@/sync/queue';
import { decodeVaultFile } from '@/vault/format';
import * as SecureStore from 'expo-secure-store';
import { useSyncStore } from '@/sync/store';
import { useAuthStore } from '@/auth/store';
import { syncOnce } from '@/sync/orchestrator';

// Typed shorthand helpers — avoids repeating casts in every test.
type NetState = Awaited<ReturnType<typeof Network.getNetworkStateAsync>>;

// Partial objects suffice: the orchestrator only reads isConnected + isInternetReachable.
const ONLINE: NetState = { isConnected: true, isInternetReachable: true };
const OFFLINE: NetState = { isConnected: false, isInternetReachable: false };

/** Common gate setup — token present + online (override per-test as needed). */
function setupGates(opts: { hasToken?: boolean; online?: boolean } = {}): void {
  const { hasToken = true, online = true } = opts;
  jest.mocked(hasDriveToken).mockResolvedValue(hasToken);
  jest.mocked(Network.getNetworkStateAsync).mockResolvedValue(online ? ONLINE : OFFLINE);
}

/** Remote file descriptor with a given modifiedTime. */
function remoteFile(modifiedTime: string) {
  return { id: 'f1', name: 'vault.enc', modifiedTime };
}

beforeEach(() => {
  jest.resetAllMocks();
  // Reset both stores to clean initial state between tests.
  useSyncStore.setState(
    { status: 'idle', lastSyncedAt: null, queueDepth: 0 } as Parameters<typeof useSyncStore.setState>[0],
  );
  useAuthStore.setState(
    { status: 'locked', masterKey: null, vault: null } as Parameters<typeof useAuthStore.setState>[0],
  );
});

// ─── Gate tests ──────────────────────────────────────────────────────────────

test('sets paused_no_token when hasDriveToken returns false', async () => {
  jest.mocked(hasDriveToken).mockResolvedValue(false);

  await syncOnce();

  expect(useSyncStore.getState().status).toBe('paused_no_token');
});

test('sets paused_offline when network is unreachable', async () => {
  setupGates({ online: false });

  await syncOnce();

  expect(useSyncStore.getState().status).toBe('paused_offline');
});

// ─── Queue drain ─────────────────────────────────────────────────────────────

test('drains queue: uploadVaultFile called per item, remove called, ends with idle+synced', async () => {
  setupGates();
  const item1 = { id: 1, kind: 'push' as const, createdAt: Date.now() };
  const item2 = { id: 2, kind: 'push' as const, createdAt: Date.now() };
  jest.mocked(peek)
    .mockResolvedValueOnce(item1)
    .mockResolvedValueOnce(item2)
    .mockResolvedValueOnce(null);
  jest.mocked(VaultStore.read).mockResolvedValue(new Uint8Array([1, 2, 3]));
  jest.mocked(uploadVaultFile).mockResolvedValue(remoteFile('2025-06-01T00:00:00Z'));
  jest.mocked(remove).mockResolvedValue(undefined);
  // Remote NOT newer than stored timestamp → skip pull branch.
  jest.mocked(fetchVaultFileMetadata).mockResolvedValue(remoteFile('2024-01-01T00:00:00Z'));
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue('2025-01-01T00:00:00Z');
  jest.mocked(count).mockResolvedValue(0);

  await syncOnce();

  expect(jest.mocked(uploadVaultFile)).toHaveBeenCalledTimes(2);
  expect(jest.mocked(remove)).toHaveBeenCalledWith(1);
  expect(jest.mocked(remove)).toHaveBeenCalledWith(2);
  // setSyncedNow() resets status → 'idle' and sets lastSyncedAt.
  expect(useSyncStore.getState().status).toBe('idle');
  expect(useSyncStore.getState().lastSyncedAt).not.toBeNull();
});

// ─── Pull branch (D1 + D2) ───────────────────────────────────────────────────

test('remote newer + status locked → writes vault.enc and updates drive_last_upload_iso', async () => {
  setupGates();
  jest.mocked(peek).mockResolvedValue(null);
  jest.mocked(fetchVaultFileMetadata).mockResolvedValue(remoteFile('2025-06-01T00:00:00Z'));
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue('2024-01-01T00:00:00Z'); // older than remote
  const downloadedBytes = new Uint8Array([10, 20, 30]);
  jest.mocked(downloadVaultFile).mockResolvedValue({
    bytes: downloadedBytes,
    modifiedTime: '2025-06-01T00:00:00Z',
  });
  // decodeVaultFile does NOT throw → validation passes (return value unused by orchestrator).
  jest.mocked(decodeVaultFile).mockReturnValue(undefined as unknown as ReturnType<typeof decodeVaultFile>);
  jest.mocked(VaultStore.write).mockResolvedValue(undefined);
  jest.mocked(SecureStore.setItemAsync).mockResolvedValue(undefined);
  jest.mocked(count).mockResolvedValue(0);
  // Auth status is 'locked' (set in beforeEach).

  await syncOnce();

  expect(jest.mocked(VaultStore.write)).toHaveBeenCalledWith('vault.enc', downloadedBytes);
  expect(jest.mocked(SecureStore.setItemAsync)).toHaveBeenCalledWith(
    'drive_last_upload_iso',
    '2025-06-01T00:00:00Z',
  );
  expect(useSyncStore.getState().status).toBe('idle');
});

test('D1: remote newer + status unlocked → VaultStore.write NOT called (in-session guard)', async () => {
  setupGates();
  jest.mocked(peek).mockResolvedValue(null);
  jest.mocked(fetchVaultFileMetadata).mockResolvedValue(remoteFile('2025-06-01T00:00:00Z'));
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue('2024-01-01T00:00:00Z');
  jest.mocked(downloadVaultFile).mockResolvedValue({
    bytes: new Uint8Array([10, 20, 30]),
    modifiedTime: '2025-06-01T00:00:00Z',
  });
  jest.mocked(count).mockResolvedValue(0);
  // Override auth status to 'unlocked' — in-memory vault is source of truth.
  useAuthStore.setState({ status: 'unlocked' } as Parameters<typeof useAuthStore.setState>[0]);

  await syncOnce();

  // Write must NOT have been called — cold-path pull is skipped when unlocked.
  expect(jest.mocked(VaultStore.write)).not.toHaveBeenCalled();
  // downloadVaultFile must NOT have been called either (no wasted bandwidth).
  expect(jest.mocked(downloadVaultFile)).not.toHaveBeenCalled();
  // Sync still ends successfully.
  expect(useSyncStore.getState().status).toBe('idle');
});

test('D2: downloaded bytes fail decodeVaultFile → error/remote_corrupt, VaultStore.write NOT called', async () => {
  setupGates();
  jest.mocked(peek).mockResolvedValue(null);
  jest.mocked(fetchVaultFileMetadata).mockResolvedValue(remoteFile('2025-06-01T00:00:00Z'));
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue('2024-01-01T00:00:00Z');
  jest.mocked(downloadVaultFile).mockResolvedValue({
    bytes: new Uint8Array([0xff, 0xfe, 0xfd]), // garbage bytes
    modifiedTime: '2025-06-01T00:00:00Z',
  });
  // decodeVaultFile throws — remote bytes are malformed/foreign.
  jest.mocked(decodeVaultFile).mockImplementation(() => {
    throw new Error('bad magic');
  });
  // Auth status is 'locked' (set in beforeEach) → cold path is entered.

  await syncOnce();

  // Local file must be untouched.
  expect(jest.mocked(VaultStore.write)).not.toHaveBeenCalled();
  const state = useSyncStore.getState();
  expect(state.status).toBe('error');
  if (state.status === 'error') {
    expect(state.message).toBe('remote_corrupt');
  }
});

// ─── Remote-missing (spec §5.4 case A) ───────────────────────────────────────

test('remote missing → error/remote_missing, no upload attempted', async () => {
  setupGates();
  jest.mocked(peek).mockResolvedValue(null);
  // No remote file in Drive.
  jest.mocked(fetchVaultFileMetadata).mockResolvedValue(null);

  await syncOnce();

  // Upload must NOT have been called (case A: do not auto-upload when remote absent).
  expect(jest.mocked(uploadVaultFile)).not.toHaveBeenCalled();
  const state = useSyncStore.getState();
  expect(state.status).toBe('error');
  if (state.status === 'error') {
    expect(state.message).toBe('remote_missing');
  }
});
