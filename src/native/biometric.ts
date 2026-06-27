import VaultsyncNative from '../../modules/vaultsync-native/src';

export type BiometricResult = 'success' | 'failed' | 'canceled' | 'unavailable';

export const Biometric = {
  prompt: (title: string, subtitle: string): Promise<BiometricResult> =>
    VaultsyncNative.promptBiometric(title, subtitle) as Promise<BiometricResult>,
};
