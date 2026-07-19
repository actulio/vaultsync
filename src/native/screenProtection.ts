import VaultsyncNative from '../../modules/vaultsync-native/src';

/**
 * Turn on Android's FLAG_SECURE for the app window.
 *
 * Blocks screenshots, screen recordings and the recents/app-switcher thumbnail.
 * The thumbnail is the case that matters most here: the entry detail screen has
 * a reveal toggle whose state survives a background/return that does not trip
 * auto-lock, so without this the system could snapshot a plaintext password.
 *
 * Applied app-wide and unconditionally — the vault list, entry fields and the
 * generator show secrets too, so protecting only the reveal toggle would leave
 * most of the exposure open.
 *
 * Best-effort by design: a failure here must never block app startup, and the
 * native side no-ops (resolving false) when called before the Activity exists.
 */
export async function enableScreenCaptureProtection(): Promise<void> {
  try {
    await VaultsyncNative.enableScreenCaptureProtection();
  } catch {
    // Never let a window-flag failure take down the app.
  }
}
