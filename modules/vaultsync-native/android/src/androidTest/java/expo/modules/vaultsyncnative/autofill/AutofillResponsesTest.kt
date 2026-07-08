package expo.modules.vaultsyncnative.autofill

import android.view.View
import android.view.autofill.AutofillId
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Instrumented tests for [AutofillResponses.datasetValues].
 *
 * AutofillId has no public constructor and AutofillId.parseString() is not a usable public API.
 * Real ids are minted from View.getAutofillId() (API 26+), mirroring FieldDetectorTest's
 * freshId() pattern. FillResponse/Dataset internals are opaque (no accessors to assert against),
 * so buildDatasets() itself is exercised indirectly by relying on the pure mapping it delegates
 * to: datasetValues().
 */
@RunWith(AndroidJUnit4::class)
class AutofillResponsesTest {

  private val ctx = InstrumentationRegistry.getInstrumentation().targetContext

  /** Mint a unique real AutofillId from a fresh View (API 26+). */
  private fun freshId(): AutofillId = View(ctx).autofillId

  private fun entry(title: String, username: String, password: String): EntryView = EntryView(
    id = "1",
    title = title,
    username = username,
    password = password,
    url = null,
    packageNames = emptyList(),
  )

  @Test
  fun mapsUsernameAndPasswordWhenBothIdsPresent() {
    val u = freshId()
    val p = freshId()
    val pairs = AutofillResponses.datasetValues(DetectedFields(u, p), entry("t", "user", "pw"))
    assertEquals(listOf(u to "user", p to "pw"), pairs)
  }

  @Test
  fun omitsUsernameWhenIdNull() {
    val p = freshId()
    val pairs = AutofillResponses.datasetValues(DetectedFields(null, p), entry("t", "user", "pw"))
    assertEquals(listOf(p to "pw"), pairs)
  }
}
