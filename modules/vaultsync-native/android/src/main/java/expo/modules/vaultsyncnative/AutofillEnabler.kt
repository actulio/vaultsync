package expo.modules.vaultsyncnative

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.view.autofill.AutofillManager

/**
 * Thin wrapper over the platform AutofillManager for the in-app "enable autofill"
 * affordance. All calls are no-ops / false below API 26 (AutofillManager is API 26+).
 */
class AutofillEnabler(private val context: Context) {
  private fun manager(): AutofillManager? =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.getSystemService(AutofillManager::class.java)
    } else {
      null
    }

  /** Whether this device supports the Autofill Framework. */
  fun isSupported(): Boolean = manager()?.isAutofillSupported == true

  /** Whether THIS app is the currently-selected autofill service. */
  fun isEnabled(): Boolean = manager()?.hasEnabledAutofillServices() == true

  /**
   * Open the OS autofill picker for this app (a system confirmation dialog).
   * Returns false if unsupported or there is no foreground activity.
   */
  fun requestEnable(activity: Activity?): Boolean {
    if (activity == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false
    val intent = Intent(Settings.ACTION_REQUEST_SET_AUTOFILL_SERVICE)
      .setData(Uri.parse("package:${activity.packageName}"))
    return try {
      activity.startActivity(intent)
      true
    } catch (e: Exception) {
      false
    }
  }
}
