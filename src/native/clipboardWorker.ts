import VaultsyncNative from '../../modules/vaultsync-native/src';

/**
 * How long a copied secret survives on the clipboard.
 *
 * Raised from 30s to 2min for usability. The exposure cost is offset by
 * marking the clip sensitive natively (EXTRA_IS_SENSITIVE), which keeps the
 * value out of the Android 13+ clipboard preview.
 *
 * Locale strings name this duration — keep `vault.detail.copied` in pt and en
 * in sync with any change here.
 */
export const CLIPBOARD_CLEAR_SECONDS = 120;

export async function copyAndScheduleClear(
  text: string,
  seconds: number = CLIPBOARD_CLEAR_SECONDS,
): Promise<void> {
  // Native write rather than expo-clipboard: only the native path can mark the
  // clip sensitive. expo-clipboard exposes no such option.
  await VaultsyncNative.copyToClipboard(text);
  await VaultsyncNative.scheduleClipboardClear(text, seconds);
}

export async function cancelPendingClear(): Promise<void> {
  await VaultsyncNative.cancelClipboardClear();
}
