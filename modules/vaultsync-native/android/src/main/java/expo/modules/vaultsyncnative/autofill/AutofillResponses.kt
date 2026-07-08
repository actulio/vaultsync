package expo.modules.vaultsyncnative.autofill

import android.content.Context
import android.service.autofill.Dataset
import android.service.autofill.FillResponse
import android.service.autofill.SaveInfo
import android.view.autofill.AutofillId
import android.view.autofill.AutofillValue
import android.widget.RemoteViews

/**
 * Shared dataset construction, used by BOTH the warm-cache fill path
 * ([VaultAutofillService.buildFillResponse]) and the post-biometric-unlock path
 * ([AutofillUnlockActivity]) so a real, populated [FillResponse] comes back from either route.
 */
object AutofillResponses {

  /** Builds one [Dataset] per match, optionally attaching [saveInfo] (null = omit SaveInfo). */
  fun buildDatasets(
    context: Context,
    detected: DetectedFields,
    matches: List<EntryView>,
    saveInfo: SaveInfo?,
  ): FillResponse {
    val b = FillResponse.Builder()
    for (e in matches) {
      val rv = RemoteViews(context.packageName, android.R.layout.simple_list_item_2).apply {
        setTextViewText(android.R.id.text1, e.title)
        setTextViewText(android.R.id.text2, e.username)
      }
      val ds = Dataset.Builder(rv)
      datasetValues(detected, e).forEach { (id, value) -> ds.setValue(id, AutofillValue.forText(value)) }
      b.addDataset(ds.build())
    }
    if (saveInfo != null) b.setSaveInfo(saveInfo)
    return b.build()
  }

  /** Pure mapping from a matched entry to the (AutofillId, value) pairs a Dataset should carry. */
  fun datasetValues(detected: DetectedFields, e: EntryView): List<Pair<AutofillId, String>> {
    val pairs = mutableListOf<Pair<AutofillId, String>>()
    detected.usernameId?.let { pairs.add(it to e.username) }
    pairs.add(detected.passwordId to e.password)
    return pairs
  }
}
