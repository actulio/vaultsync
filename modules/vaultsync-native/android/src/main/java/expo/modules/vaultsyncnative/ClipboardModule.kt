package expo.modules.vaultsyncnative

import android.content.Context
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

  fun cancelPending() {
    WorkManager.getInstance(ctx).cancelAllWorkByTag(tag)
  }
}
