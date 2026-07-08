package expo.modules.vaultsyncnative.autofill

import android.content.Context
import android.service.autofill.Dataset
import android.service.autofill.FillResponse
import android.service.autofill.SaveInfo
import android.view.autofill.AutofillId
import android.view.autofill.AutofillValue
import android.widget.RemoteViews
import expo.modules.vaultsyncnative.R

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
      // Custom layout (LinearLayout + TextViews). The framework simple_list_item_2 root is
      // TwoLineListItem, which the system RemoteViews inflater rejects ("Class not allowed to be
      // inflated"), crashing FillUi and blocking the fill entirely.
      val rv = RemoteViews(context.packageName, R.layout.autofill_dataset).apply {
        setTextViewText(R.id.autofill_dataset_title, e.title)
        setTextViewText(R.id.autofill_dataset_subtitle, e.username)
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
