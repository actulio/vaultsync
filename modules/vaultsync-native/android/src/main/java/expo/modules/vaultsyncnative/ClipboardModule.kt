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
   * popup. The extra is set unconditionally (some OEM builds honour the same key
   * before API 33); the constant is only referenced on API 33+ where it exists.
   */
  fun copySensitive(text: String) {
    val cm = ctx.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    val clip = ClipData.newPlainText("", text)
    val extras = PersistableBundle()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      extras.putBoolean(ClipDescription.EXTRA_IS_SENSITIVE, true)
    } else {
      extras.putBoolean("android.content.extra.IS_SENSITIVE", true)
    }
    clip.description.extras = extras
    cm.setPrimaryClip(clip)
  }

  fun cancelPending() {
    WorkManager.getInstance(ctx).cancelAllWorkByTag(tag)
  }
}
