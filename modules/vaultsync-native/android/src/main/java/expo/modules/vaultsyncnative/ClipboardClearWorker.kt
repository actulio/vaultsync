package expo.modules.vaultsyncnative

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters

class ClipboardClearWorker(ctx: Context, params: WorkerParameters) : Worker(ctx, params) {
  override fun doWork(): Result {
    val cm = applicationContext.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    val expected = inputData.getString(KEY_EXPECTED) ?: return Result.success()
    val current = cm.primaryClip?.getItemAt(0)?.text?.toString()
    if (current == expected) {
      cm.setPrimaryClip(ClipData.newPlainText("", ""))
    }
    return Result.success()
  }

  companion object {
    const val KEY_EXPECTED = "expected"
  }
}
