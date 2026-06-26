import VaultsyncNative from '../../modules/vaultsync-native/src';

export const Keystore = {
  generateKeyIfMissing: () => VaultsyncNative.generateKeystoreKeyIfMissing(),
  keyExists: () => VaultsyncNative.keystoreKeyExists(),
  deleteKey: () => VaultsyncNative.deleteKeystoreKey(),
  wrap: (plaintext: Uint8Array) => VaultsyncNative.keystoreWrap(plaintext),
  unwrap: (wrapped: Uint8Array) => VaultsyncNative.keystoreUnwrap(wrapped),
};

export const VaultStore = {
  read: (name: string) => VaultsyncNative.vaultRead(name),
  write: (name: string, bytes: Uint8Array) => VaultsyncNative.vaultWrite(name, bytes),
  exists: (name: string) => VaultsyncNative.vaultExists(name),
  delete: (name: string) => VaultsyncNative.vaultDelete(name),
};
