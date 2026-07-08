package expo.modules.vaultsyncnative.autofill

import android.app.PendingIntent
import android.app.assist.AssistStructure
import android.content.Intent
import android.os.Build
import android.os.CancellationSignal
import android.service.autofill.AutofillService
import android.service.autofill.FillCallback
import android.service.autofill.FillRequest
import android.service.autofill.FillResponse
import android.service.autofill.SaveCallback
import android.service.autofill.SaveInfo
import android.service.autofill.SaveRequest
import android.util.Log
import android.view.autofill.AutofillId
import android.widget.RemoteViews
import androidx.annotation.RequiresApi
import expo.modules.vaultsyncnative.R

@RequiresApi(Build.VERSION_CODES.O)
class VaultAutofillService : AutofillService() {

  private val notifier by lazy { FallbackNotifier(applicationContext) }

  override fun onFillRequest(request: FillRequest, cancel: CancellationSignal, cb: FillCallback) {
    val structure = request.fillContexts.lastOrNull()?.structure ?: return cb.onSuccess(null)
    val root = firstRoot(structure) ?: return cb.onSuccess(null)

    val detector = FieldDetector()
    val adapted = detector.adapt(root)
    val detected = detector.walk(adapted) ?: run {
      postNoMatchNotification(structure.activityComponent?.packageName, detector.webDomain(adapted))
      return cb.onSuccess(null)
    }
    // Defect fix: webDomain lives on ViewNode, not on AssistStructure. Extract it from the tree.
    val webDomain = detector.webDomain(adapted)
    val packageName = structure.activityComponent?.packageName

    val cache = VaultCacheHolder.instance.get()
    if (cache == null) {
      cb.onSuccess(buildUnlockResponse(detected, packageName, webDomain))
      return
    }

    val matches = Matcher().match(cache.entries, packageName, webDomain)
    if (matches.isEmpty()) {
      postNoMatchNotification(packageName, webDomain)
      // No dataset to offer, but detected fields exist — return a save-only FillResponse (zero
      // datasets + SaveInfo) so Android calls onSaveRequest when the user submits new credentials.
      cb.onSuccess(FillResponse.Builder().setSaveInfo(buildSaveInfo(detected)).build())
      return
    }
    cb.onSuccess(buildFillResponse(detected, matches))
  }

  override fun onSaveRequest(request: SaveRequest, cb: SaveCallback) {
    val structure = request.fillContexts.lastOrNull()?.structure ?: return cb.onSuccess()
    val root = firstRoot(structure) ?: return cb.onSuccess()
    val detector = FieldDetector()
    val adapted = detector.adapt(root)
    val detected = detector.walk(adapted) ?: return cb.onSuccess()

    // Task 7's AutofillSaveActivity runs standalone (no AssistStructure), so it cannot resolve an
    // AutofillId back to a value. Extract the just-submitted text values HERE — while we still hold
    // the structure — and hand them over directly as string extras.
    val intent = Intent().apply {
      setClassName(packageName, "expo.modules.vaultsyncnative.autofill.AutofillSaveActivity")
      putExtra("packageName", structure.activityComponent?.packageName)
      putExtra("webDomain", detector.webDomain(adapted))
      putExtra("usernameValue", extractValue(structure, detected.usernameId))
      putExtra("passwordValue", extractValue(structure, detected.passwordId))
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    // Background-activity-launch is blocked on API 29+, so we cannot startActivity() directly here.
    // Hand an IntentSender to the SaveCallback and let the SYSTEM launch AutofillSaveActivity.
    val pi = PendingIntent.getActivity(
      this, 2, intent,
      PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_CANCEL_CURRENT,
    )
    cb.onSuccess(pi.intentSender)
  }

  /** Finds the submitted text value for [id] anywhere in the filled structure (null if absent). */
  private fun extractValue(structure: AssistStructure, id: AutofillId?): String? {
    if (id == null) return null
    for (w in 0 until structure.windowNodeCount) {
      findValue(structure.getWindowNodeAt(w).rootViewNode, id)?.let { return it }
    }
    return null
  }

  private fun findValue(node: AssistStructure.ViewNode, id: AutofillId): String? {
    if (node.autofillId == id) {
      val v = node.autofillValue
      if (v != null && v.isText) return v.textValue?.toString()
    }
    for (i in 0 until node.childCount) {
      findValue(node.getChildAt(i), id)?.let { return it }
    }
    return null
  }

  /** First window's root ViewNode (Android passes one or more windows). */
  private fun firstRoot(structure: AssistStructure): AssistStructure.ViewNode? =
    if (structure.windowNodeCount > 0) structure.getWindowNodeAt(0).rootViewNode else null

  private fun buildUnlockResponse(
    detected: DetectedFields,
    packageName: String?,
    webDomain: String?,
  ): FillResponse {
    // NB: the `packageName` param above (the detected foreground app's package, passed through as
    // an intent extra) shadows the Context.packageName property (this service's own package,
    // needed below for RemoteViews' resource-owning package) — so the RemoteViews call below
    // qualifies with `this.packageName` to keep referring to the latter.
    val intent = Intent(this, AutofillUnlockActivity::class.java).apply {
      putExtra("usernameId", detected.usernameId) // AutofillId is Parcelable
      putExtra("passwordId", detected.passwordId)
      putExtra("packageName", packageName)
      putExtra("webDomain", webDomain)
    }
    val pi = PendingIntent.getActivity(
      this, 1, intent,
      PendingIntent.FLAG_CANCEL_CURRENT or PendingIntent.FLAG_MUTABLE,
    )
    val rv = RemoteViews(this.packageName, android.R.layout.simple_list_item_1).apply {
      setTextViewText(android.R.id.text1, getString(R.string.autofill_unlock))
    }
    val ids = listOfNotNull(detected.usernameId, detected.passwordId).toTypedArray()
    // Attach SaveInfo alongside the auth gate: onSaveRequest fires only if the session's
    // FillResponse carried SaveInfo, and the auth-gated path is otherwise a common no-match entry.
    return FillResponse.Builder()
      .setAuthentication(ids, pi.intentSender, rv)
      .setSaveInfo(buildSaveInfo(detected))
      .build()
  }

  /**
   * Builds the SaveInfo that makes Android invoke [onSaveRequest] on submit. Always flags PASSWORD;
   * ORs in USERNAME when a username field was detected. saveIds spans every detected field.
   */
  private fun buildSaveInfo(detected: DetectedFields): SaveInfo {
    val saveIds = listOfNotNull(detected.usernameId, detected.passwordId).toTypedArray()
    var type = SaveInfo.SAVE_DATA_TYPE_PASSWORD
    if (detected.usernameId != null) type = type or SaveInfo.SAVE_DATA_TYPE_USERNAME
    return SaveInfo.Builder(type, saveIds).build()
  }

  // SaveInfo attached so Android calls onSaveRequest later when the user submits new/changed
  // credentials. Delegates dataset construction to AutofillResponses, the single source shared
  // with the post-unlock path (AutofillUnlockActivity).
  private fun buildFillResponse(detected: DetectedFields, matches: List<EntryView>): FillResponse =
    AutofillResponses.buildDatasets(this, detected, matches, buildSaveInfo(detected))

  private fun postNoMatchNotification(packageName: String?, webDomain: String?) {
    // Defensive: notifyMiss touches NotificationManager/PendingIntent, which can throw on odd
    // OEM builds. Swallow + log so a notify failure never prevents cb.onSuccess(...) below from
    // running (losing that would break the FillCallback contract and drop the save-only response).
    try {
      notifier.notifyMiss(packageName, webDomain)
    } catch (e: Exception) {
      Log.w("VaultSync", "fallback notify failed", e)
    }
  }
}
