package expo.modules.vaultsyncnative.autofill

import android.app.PendingIntent
import android.app.assist.AssistStructure
import android.content.Intent
import android.os.Build
import android.os.CancellationSignal
import android.service.autofill.AutofillService
import android.service.autofill.Dataset
import android.service.autofill.FillCallback
import android.service.autofill.FillRequest
import android.service.autofill.FillResponse
import android.service.autofill.SaveCallback
import android.service.autofill.SaveInfo
import android.service.autofill.SaveRequest
import android.util.Log
import android.view.autofill.AutofillId
import android.view.autofill.AutofillValue
import android.widget.RemoteViews
import androidx.annotation.RequiresApi
import expo.modules.vaultsyncnative.R

@RequiresApi(Build.VERSION_CODES.O)
class VaultAutofillService : AutofillService() {

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
      cb.onSuccess(buildUnlockResponse(detected))
      return
    }

    val matches = Matcher().match(cache.entries, packageName, webDomain)
    if (matches.isEmpty()) {
      postNoMatchNotification(packageName, webDomain)
      cb.onSuccess(null)
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
    startActivity(intent)
    cb.onSuccess()
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

  private fun buildUnlockResponse(detected: DetectedFields): FillResponse {
    val intent = Intent(this, AutofillUnlockActivity::class.java)
    val pi = PendingIntent.getActivity(
      this, 1, intent,
      PendingIntent.FLAG_CANCEL_CURRENT or PendingIntent.FLAG_MUTABLE,
    )
    val rv = RemoteViews(packageName, android.R.layout.simple_list_item_1).apply {
      setTextViewText(android.R.id.text1, getString(R.string.autofill_unlock))
    }
    val ids = listOfNotNull(detected.usernameId, detected.passwordId).toTypedArray()
    return FillResponse.Builder()
      .setAuthentication(ids, pi.intentSender, rv)
      .build()
  }

  private fun buildFillResponse(detected: DetectedFields, matches: List<EntryView>): FillResponse {
    val b = FillResponse.Builder()
    for (e in matches) {
      val rv = RemoteViews(packageName, android.R.layout.simple_list_item_2).apply {
        setTextViewText(android.R.id.text1, e.title)
        setTextViewText(android.R.id.text2, e.username)
      }
      val ds = Dataset.Builder(rv)
      detected.usernameId?.let { ds.setValue(it, AutofillValue.forText(e.username)) }
      ds.setValue(detected.passwordId, AutofillValue.forText(e.password))
      b.addDataset(ds.build())
    }
    // SaveInfo so Android calls onSaveRequest later when the user submits new/changed credentials.
    val saveIds = listOfNotNull(detected.usernameId, detected.passwordId).toTypedArray()
    b.setSaveInfo(SaveInfo.Builder(SaveInfo.SAVE_DATA_TYPE_PASSWORD, saveIds).build())
    return b.build()
  }

  private fun postNoMatchNotification(packageName: String?, webDomain: String?) {
    // Plan 6 builds the notification + deep link. Plan 5 leaves a TODO marker via logcat.
    Log.i("VaultSync", "Autofill miss: pkg=$packageName web=$webDomain")
  }
}
