package expo.modules.vaultsyncnative

import android.app.Activity
import android.content.Intent
import expo.modules.kotlin.Promise

class BiometricModule(private val moduleHolder: VaultsyncNativeModule) {
  private var pendingPromise: Promise? = null

  fun prompt(title: String, subtitle: String, promise: Promise) {
    moduleHolder.appContext.currentActivity
      ?: return promise.reject("E_NO_ACTIVITY", "No current activity", null)
    if (pendingPromise != null) {
      return promise.reject("E_BIOMETRIC_BUSY", "Another biometric prompt is in flight", null)
    }
    pendingPromise = promise
    val activity = moduleHolder.appContext.currentActivity!!
    val intent = Intent(activity, BiometricPromptActivity::class.java)
      .putExtra(BiometricPromptActivity.EXTRA_TITLE, title)
      .putExtra(BiometricPromptActivity.EXTRA_SUBTITLE, subtitle)
    moduleHolder.startActivityForResult(intent, REQUEST_CODE_BIOMETRIC)
  }

  fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?): Boolean {
    if (requestCode != REQUEST_CODE_BIOMETRIC) return false
    val p = pendingPromise ?: return true
    pendingPromise = null
    when (resultCode) {
      Activity.RESULT_OK -> p.resolve("success")
      BiometricPromptActivity.RESULT_FAILED -> p.resolve("failed")
      BiometricPromptActivity.RESULT_UNAVAILABLE -> p.resolve("unavailable")
      else -> p.resolve("canceled")
    }
    return true
  }

  companion object {
    const val REQUEST_CODE_BIOMETRIC = 18371
  }
}
