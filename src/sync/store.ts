import { create } from 'zustand';

export type SyncState =
  | { status: 'idle'; lastSyncedAt: number | null; queueDepth: number }
  | { status: 'syncing'; lastSyncedAt: number | null; queueDepth: number }
  | { status: 'paused_no_token'; lastSyncedAt: number | null; queueDepth: number }
  | { status: 'paused_offline'; lastSyncedAt: number | null; queueDepth: number }
  | { status: 'error'; lastSyncedAt: number | null; queueDepth: number; message: string };

type S = SyncState & {
  setStatus: (s: SyncState['status'], message?: string) => void;
  setQueueDepth: (n: number) => void;
  setSyncedNow: () => void;
};

export const useSyncStore = create<S>((set) => ({
  status: 'idle',
  lastSyncedAt: null,
  queueDepth: 0,
  setStatus: (status, message) => set((s) => ({ ...s, status, message } as S)),
  setQueueDepth: (queueDepth) => set((s) => ({ ...s, queueDepth })),
  setSyncedNow: () => set((s) => ({ ...s, status: 'idle', lastSyncedAt: Date.now() })),
}));
