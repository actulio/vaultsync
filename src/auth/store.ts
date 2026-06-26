import { create } from 'zustand';
import type { VaultV1 } from '@/vault';

export type AuthStatus = 'bootstrapping' | 'no_vault' | 'locked' | 'unlocked';

type AuthState = {
  status: AuthStatus;
  masterKey: Uint8Array | null;
  vault: VaultV1 | null;
  setNoVault: () => void;
  setLocked: () => void;
  unlock: (key: Uint8Array, vault: VaultV1) => void;
  lock: () => void;
  updateVault: (vault: VaultV1) => void;
  reset: () => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'bootstrapping',
  masterKey: null,
  vault: null,
  setNoVault: () => set({ status: 'no_vault', masterKey: null, vault: null }),
  setLocked: () => set({ status: 'locked', masterKey: null, vault: null }),
  unlock: (key, vault) => set({ status: 'unlocked', masterKey: key, vault }),
  lock: () => {
    const { masterKey } = get();
    if (masterKey) masterKey.fill(0); // best-effort overwrite
    set({ status: 'locked', masterKey: null, vault: null });
  },
  updateVault: (vault) => {
    if (get().status !== 'unlocked') throw new Error('vault is locked');
    set({ vault });
  },
  reset: () => set({ status: 'bootstrapping', masterKey: null, vault: null }),
}));
