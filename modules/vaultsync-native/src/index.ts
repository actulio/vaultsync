import { requireNativeModule } from 'expo-modules-core';

type VaultsyncNativeModule = {
  generateKeystoreKeyIfMissing(): Promise<void>;
  keystoreKeyExists(): Promise<boolean>;
  deleteKeystoreKey(): Promise<void>;
  keystoreWrap(plaintext: Uint8Array): Promise<Uint8Array>;
  keystoreUnwrap(wrapped: Uint8Array): Promise<Uint8Array>;
  vaultRead(name: string): Promise<Uint8Array>;
  vaultWrite(name: string, bytes: Uint8Array): Promise<void>;
  vaultExists(name: string): Promise<boolean>;
  vaultDelete(name: string): Promise<void>;
  promptBiometric(title: string, subtitle: string): Promise<'success' | 'failed' | 'canceled' | 'unavailable'>;
  scheduleClipboardClear(expected: string, delaySeconds: number): Promise<void>;
  cancelClipboardClear(): Promise<void>;
  isAutofillSupported(): Promise<boolean>;
  isAutofillServiceEnabled(): Promise<boolean>;
  requestSetAutofillService(): Promise<void>;
};

const VaultsyncNative = requireNativeModule<VaultsyncNativeModule>('VaultsyncNative');

export default VaultsyncNative;
export type { VaultsyncNativeModule };
