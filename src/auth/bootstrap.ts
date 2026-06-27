import { useAuthStore } from './store';
import { vaultExists } from './unlock';

export async function bootstrapAuth(): Promise<void> {
  const exists = await vaultExists();
  if (!exists) useAuthStore.getState().setNoVault();
  else useAuthStore.getState().setLocked();
}
