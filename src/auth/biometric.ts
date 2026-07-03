import { Keystore, VaultStore } from '@/native/keystore';

// Biometric unlock is an OPT-IN convenience layer, fully separable from the
// vault's encryption. The vault payload is always encrypted under the
// password-derived master key; enabling biometric simply stores a second copy
// of that master key wrapped by an auth-per-use AndroidKeyStore key. A
// password-only user never has this file and is never prompted.
const WRAPPED_KEY = 'masterKey.wrapped';

/** True when biometric unlock is set up (a Keystore-wrapped master key exists). */
export function isBiometricEnabled(): Promise<boolean> {
  return VaultStore.exists(WRAPPED_KEY);
}

/**
 * Opt in to biometric unlock: wrap the in-memory master key under the
 * auth-per-use Keystore key. The wrap triggers a system biometric prompt
 * (CryptoObject-bound); it rejects (E_KEYSTORE_*) if biometrics are unavailable
 * or the user cancels, in which case nothing is written and biometric stays off.
 */
export async function enableBiometric(masterKey: Uint8Array): Promise<void> {
  await Keystore.generateKeyIfMissing();
  const wrapped = await Keystore.wrap(masterKey);
  await VaultStore.write(WRAPPED_KEY, wrapped);
}

/**
 * Opt out: delete the Keystore key and the wrapped blob. Neither operation
 * requires authentication, so a broken or lost biometric can never block
 * disabling — the vault stays reachable with the master password.
 */
export async function disableBiometric(): Promise<void> {
  await Keystore.deleteKey();
  if (await VaultStore.exists(WRAPPED_KEY)) {
    await VaultStore.delete(WRAPPED_KEY);
  }
}
