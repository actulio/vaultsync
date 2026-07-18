package expo.modules.vaultsyncnative

import android.content.ClipData
import android.content.ClipDescription
import android.content.ClipboardManager
import android.content.Context
import android.os.Build
import android.os.PersistableBundle
import androidx.work.Data
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

class ClipboardModule(private val ctx: Context) {
  private val tag = "vaultsync_clipboard_clear"

  fun scheduleClear(expected: String, delaySeconds: Long) {
    val req = OneTimeWorkRequestBuilder<ClipboardClearWorker>()
      .setInitialDelay(delaySeconds, TimeUnit.SECONDS)
      .setInputData(Data.Builder().putString(ClipboardClearWorker.KEY_EXPECTED, expected).build())
      .addTag(tag)
      .build()
    WorkManager.getInstance(ctx).enqueue(req)
  }

  /**
   * Write [text] to the clipboard marked as sensitive.
   *
   * EXTRA_IS_SENSITIVE keeps the value out of the Android 13+ clipboard preview
   * popup. It is honoured from API 33 and ignored (harmless) below that, so the
   * extra is set unconditionally — the constant is a compile-time String that
   * kotlinc inlines, so referencing it cannot fail on an older runtime.
   */
  fun copySensitive(text: String) {
    val cm = ctx.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    val clip = ClipData.newPlainText("", text)
    val extras = PersistableBundle()
    extras.putBoolean(ClipDescription.EXTRA_IS_SENSITIVE, true)
    clip.description.extras = extras
    cm.setPrimaryClip(clip)
  }

  /**
   * Clear the clipboard immediately. Only callable from the foreground: from
   * Android 10 (API 29) the platform gates clipboard writes to the focused app
   * or the default IME, which is why the WorkManager-based clear cannot be
   * relied on and the JS layer also clears on app foreground.
   */
  fun clearNow() {
    val cm = ctx.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      cm.clearPrimaryClip()
    } else {
      cm.setPrimaryClip(ClipData.newPlainText("", ""))
    }
  }

  fun cancelPending() {
    WorkManager.getInstance(ctx).cancelAllWorkByTag(tag)
  }
}
