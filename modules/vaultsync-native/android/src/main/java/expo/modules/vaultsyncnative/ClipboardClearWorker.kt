package expo.modules.vaultsyncnative

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters

class ClipboardClearWorker(ctx: Context, params: WorkerParameters) : Worker(ctx, params) {
  override fun doWork(): Result {
    val expected = inputData.getString(KEY_EXPECTED) ?: return Result.success()
    try {
      val cm = applicationContext.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
      // primaryClip can be non-null with itemCount == 0; getItemAt(0) would throw
      // IndexOutOfBounds and fail the worker (WorkManager would then retry). Guard it.
      val clip = cm.primaryClip
      val current =
        if (clip != null && clip.itemCount > 0) clip.getItemAt(0)?.text?.toString() else null
      if (current == expected) {
        cm.setPrimaryClip(ClipData.newPlainText("", ""))
      }
    } catch (e: Exception) {
      // Best-effort clear: never fail the worker on a transient clipboard error.
    }
    return Result.success()
  }

  companion object {
    const val KEY_EXPECTED = "expected"
  }
}
