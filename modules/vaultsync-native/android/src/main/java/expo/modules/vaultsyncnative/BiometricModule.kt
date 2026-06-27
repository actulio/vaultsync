package expo.modules.vaultsyncnative

import android.app.Activity
import android.content.Intent
import expo.modules.kotlin.Promise

class BiometricModule(private val moduleHolder: VaultsyncNativeModule) {
  private var pendingPromise: Promise? = null

  fun prompt(title: String, subtitle: String, promise: Promise) {
    // Capture the activity reference ONCE — re-fetching it (or using !!) after
    // setting pendingPromise risks an NPE that would leave the promise dangling
    // and wedge every later prompt on E_BIOMETRIC_BUSY.
    val activity = moduleHolder.appContext.currentActivity
      ?: return promise.reject("E_NO_ACTIVITY", "No current activity", null)
    if (pendingPromise != null) {
      return promise.reject("E_BIOMETRIC_BUSY", "Another biometric prompt is in flight", null)
    }
    pendingPromise = promise
    val intent = Intent(activity, BiometricPromptActivity::class.java)
      .putExtra(BiometricPromptActivity.EXTRA_TITLE, title)
      .putExtra(BiometricPromptActivity.EXTRA_SUBTITLE, subtitle)
    try {
      activity.startActivityForResult(intent, REQUEST_CODE_BIOMETRIC)
    } catch (e: Exception) {
      pendingPromise = null
      promise.reject("E_BIOMETRIC_LAUNCH", e.message ?: "failed to launch biometric prompt", e)
    }
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
