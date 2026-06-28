import { useAuthStore } from '@/auth/store';
import { vaultExists } from '@/auth/unlock';

export async function bootstrapAuth(): Promise<void> {
  const exists = await vaultExists();
  if (!exists) useAuthStore.getState().setNoVault();
  else useAuthStore.getState().setLocked();
}
