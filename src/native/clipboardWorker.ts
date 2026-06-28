import * as Clipboard from 'expo-clipboard';

import VaultsyncNative from '../../modules/vaultsync-native/src';

export async function copyAndScheduleClear(text: string, seconds = 30): Promise<void> {
  await Clipboard.setStringAsync(text);
  await VaultsyncNative.scheduleClipboardClear(text, seconds);
}

export async function cancelPendingClear(): Promise<void> {
  await VaultsyncNative.cancelClipboardClear();
}
