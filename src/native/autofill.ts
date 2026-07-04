import VaultsyncNative from '../../modules/vaultsync-native/src';

export const Autofill = {
  /** Whether this device supports the Android Autofill Framework. */
  isSupported: (): Promise<boolean> => VaultsyncNative.isAutofillSupported(),
  /** Whether VaultSync is the currently-selected autofill service. */
  isEnabled: (): Promise<boolean> => VaultsyncNative.isAutofillServiceEnabled(),
  /** Open the OS autofill picker so the user can select VaultSync. */
  requestEnable: (): Promise<void> => VaultsyncNative.requestSetAutofillService(),
};
