import { useAuthStore } from '@/auth/store';
import { vaultExists } from '@/auth/unlock';
import { hasDriveToken } from '@/drive/auth';
import { downloadVaultFile } from '@/drive/files';
import { VaultStore } from '@/native/keystore';
import { decodeVaultFile } from '@/vault/format';

export async function bootstrapAuth(): Promise<void> {
  // Case B (§5.4): local missing + Drive token present → pull before deciding state.
  if (!(await vaultExists()) && (await hasDriveToken())) {
    try {
      const dl = await downloadVaultFile();
      if (dl) {
        decodeVaultFile(dl.bytes); // P4-D2: validate before write; throws on malformed/foreign file
        await VaultStore.write('vault.enc', dl.bytes);
      }
    } catch {
      // Fall through to no_vault (case C or corrupt remote).
    }
  }
  if (!(await vaultExists())) useAuthStore.getState().setNoVault();
  else useAuthStore.getState().setLocked();
}
