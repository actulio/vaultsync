package expo.modules.vaultsyncnative

import android.content.ClipDescription
import android.content.ClipboardManager
import android.content.Context
import android.os.Build
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ClipboardSensitiveTest {
  @Test
  fun copySensitive_writesTextAndMarksItSensitive() {
    val ctx = ApplicationProvider.getApplicationContext<Context>()
    ClipboardModule(ctx).copySensitive("hunter2")

    val cm = ctx.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    val clip = cm.primaryClip!!
    assertEquals("hunter2", clip.getItemAt(0).text.toString())

    val key =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        ClipDescription.EXTRA_IS_SENSITIVE
      } else {
        "android.content.extra.IS_SENSITIVE"
      }
    assertTrue(clip.description.extras!!.getBoolean(key))
  }
}
