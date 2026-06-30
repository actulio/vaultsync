import * as Network from 'expo-network';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '@/auth/store';
import { hasDriveToken } from '@/drive/auth';
import { downloadVaultFile, fetchVaultFileMetadata, uploadVaultFile } from '@/drive/files';
import { VaultStore } from '@/native/keystore';
import { peek, remove, count } from './queue';
import { useSyncStore } from './store';
import { decodeVaultFile } from '@/vault/format';

const LAST_UPLOAD_KEY = 'drive_last_upload_iso';

let inFlight: Promise<void> | null = null;

/**
 * Single-entry-point for push + pull. Re-entrant calls coalesce onto the
 * already-running promise (single-flight guard via `inFlight`).
 */
export async function syncOnce(): Promise<void> {
  if (inFlight) return inFlight;
  const p = _run();
  inFlight = p;
  try {
    await p;
  } finally {
    inFlight = null;
  }
}

async function _run(): Promise<void> {
  try {
    // Gate 1: Drive token present
    if (!(await hasDriveToken())) {
      useSyncStore.getState().setStatus('paused_no_token');
      return;
    }

    // Gate 2: Network connectivity
    const net = await Network.getNetworkStateAsync();
    if (!net.isConnected || net.isInternetReachable === false) {
      useSyncStore.getState().setStatus('paused_offline');
      return;
    }

    useSyncStore.getState().setStatus('syncing');

    // 1) Drain push queue — upload current vault.enc for each pending item.
    //    Track the last uploaded modifiedTime so the subsequent pull check
    //    can use it as the stale-marker, avoiding a redundant re-download.
    let lastUploadedModifiedTime: string | null = null;
    let head = await peek();
    while (head) {
      const bytes = await VaultStore.read('vault.enc');
      const uploaded = await uploadVaultFile(bytes);
      lastUploadedModifiedTime = uploaded.modifiedTime;
      await remove(head.id);
      head = await peek();
    }
    if (lastUploadedModifiedTime !== null) {
      await SecureStore.setItemAsync(LAST_UPLOAD_KEY, lastUploadedModifiedTime);
    }

    // 2) Pull if remote is newer than the last upload we recorded.
    //    D1 (cold-path only): skip download when the app is unlocked.
    //    In-session the in-memory vault is the source of truth; overwriting disk
    //    would be silently discarded and the next persist would clobber the remote.
    const remote = await fetchVaultFileMetadata();
    if (remote) {
      const lastUploadAt = await SecureStore.getItemAsync(LAST_UPLOAD_KEY);
      if (remote.modifiedTime > (lastUploadAt ?? '')) {
        if (useAuthStore.getState().status !== 'unlocked') {
          const dl = await downloadVaultFile();
          if (dl) {
            // D2: validate before overwrite — spec §5.4 case F.
            // Never replace a known-good local vault with malformed remote bytes.
            try {
              decodeVaultFile(dl.bytes);
            } catch {
              useSyncStore.getState().setStatus('error', 'remote_corrupt');
              return;
            }
            await VaultStore.write('vault.enc', dl.bytes);
            await SecureStore.setItemAsync(LAST_UPLOAD_KEY, dl.modifiedTime);
          }
        }
        // If unlocked: skip silently — push already drained; setSyncedNow() runs below.
      }
    } else {
      // Remote missing — spec §5.4 case A — do not auto-upload.
      useSyncStore.getState().setStatus('error', 'remote_missing');
      return;
    }

    useSyncStore.getState().setQueueDepth(await count());
    useSyncStore.getState().setSyncedNow();
  } catch (e) {
    useSyncStore.getState().setStatus('error', e instanceof Error ? e.message : String(e));
  }
}
