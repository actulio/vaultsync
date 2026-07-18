import { AppState } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import VaultsyncNative from '../../modules/vaultsync-native/src';

/**
 * How long a copied secret survives on the clipboard.
 *
 * Raised from 30s to 2min for usability. Mitigations on the exposure: the clip
 * is marked EXTRA_IS_SENSITIVE natively, which Android honours from 13 (API 33)
 * by keeping the value out of the clipboard preview — this is not yet verified
 * on hardware, and it is inert below Android 13. Android 13+ additionally
 * auto-clears the clipboard on its own schedule. Neither is a guarantee, which
 * is why `startClipboardClearOnForeground` performs the actual clear.
 *
 * Locale strings name this duration — keep `vault.detail.copied` in pt and en
 * in sync with any change here.
 */
export const CLIPBOARD_CLEAR_SECONDS = 120;

/**
 * The secret currently sitting on the clipboard, plus when it becomes eligible
 * for clearing.
 *
 * In-memory ONLY, deliberately: persisting it would write a plaintext password
 * to storage, which is strictly worse than the exposure we are trying to close.
 * Accepted limitation: if the process is killed before the entry comes due, the
 * pending entry is lost and this app will never clear that clip. The clipboard
 * then relies on the WorkManager job (best-effort, see below) and on Android
 * 13+'s own auto-clear.
 */
let pending: { text: string; dueAt: number } | null = null;

export async function copyAndScheduleClear(
  text: string,
  seconds: number = CLIPBOARD_CLEAR_SECONDS,
): Promise<void> {
  // Native write rather than expo-clipboard: only the native path can mark the
  // clip sensitive. expo-clipboard exposes no such option.
  await VaultsyncNative.copyToClipboard(text);
  pending = { text, dueAt: Date.now() + seconds * 1000 };
  // Best-effort only. From Android 10 the clipboard is readable/writable solely
  // by the focused app or the default IME, so this background worker almost
  // certainly no-ops on modern devices. Kept for the devices where it does fire.
  await VaultsyncNative.scheduleClipboardClear(text, seconds);
}

export async function cancelPendingClear(): Promise<void> {
  pending = null;
  await VaultsyncNative.cancelClipboardClear();
}

/**
 * Clear the clipboard if a copied secret is past due and still on the clipboard.
 *
 * Must be called while the app has focus — that is the one condition under which
 * Android lets us read and write the clipboard at all.
 */
export async function clearClipboardIfDue(): Promise<void> {
  if (pending == null) return;
  if (Date.now() < pending.dueAt) return;
  const expected = pending.text;
  try {
    const current = await Clipboard.getStringAsync();
    // Only clear what we put there: the user may have copied something else
    // since, and wiping that would be destructive.
    if (current === expected) {
      await VaultsyncNative.clearClipboard();
    }
  } catch {
    // Best-effort: a clipboard read/write failure must never crash the app.
  } finally {
    // Either we cleared it or the clip is no longer ours — stop tracking it.
    pending = null;
  }
}

/** Subscribe clearClipboardIfDue to app-foreground transitions. Returns an unsubscribe fn. */
export function startClipboardClearOnForeground(): () => void {
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') void clearClipboardIfDue();
  });
  return () => sub.remove();
}

/** Test-only: reset the in-memory pending entry between cases. */
export function __resetPendingClearForTests(): void {
  pending = null;
}
