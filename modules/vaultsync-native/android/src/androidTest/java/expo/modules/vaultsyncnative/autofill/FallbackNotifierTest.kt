package expo.modules.vaultsyncnative.autofill

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Instrumented tests for [FallbackNotifier]'s once-per-(key,hour) rate limit (spec §6.6).
 *
 * The rate-limit decision is exercised directly via [FallbackNotifier.shouldNotify], which takes
 * an explicit `now` so the once-per-hour window is testable without a real clock. Actual
 * NotificationManager posting is not asserted here — see the task brief.
 */
@RunWith(AndroidJUnit4::class)
class FallbackNotifierTest {
  private lateinit var ctx: Context
  private lateinit var notifier: FallbackNotifier

  @Before
  fun setUp() {
    ctx = ApplicationProvider.getApplicationContext()
    // Clean slate: earlier test runs may have left "last_*" keys in this SharedPreferences file.
    ctx.getSharedPreferences("vaultsync_fallback", Context.MODE_PRIVATE).edit().clear().apply()
    notifier = FallbackNotifier(ctx)
  }

  // A realistic epoch-millis timestamp (~2023-11-14). shouldNotify's default "never shown"
  // sentinel is 0L (epoch), so the base instant must sit well beyond RATE_LIMIT_MS past epoch —
  // otherwise "first call" comparisons (now - 0 < RATE_LIMIT_MS) would themselves look rate
  // limited. Real callers pass System.currentTimeMillis(), which always satisfies this.
  private val baseNow = 1_700_000_000_000L

  @Test
  fun firstCall_isAllowed() {
    assertTrue(notifier.shouldNotify("com.example.app", now = baseNow))
  }

  @Test
  fun secondCallWithinTheHour_isSuppressed() {
    assertTrue(notifier.shouldNotify("com.example.app", now = baseNow))
    val fiftyNineMinutesLater = baseNow + 59 * 60 * 1000L
    assertFalse(notifier.shouldNotify("com.example.app", now = fiftyNineMinutesLater))
  }

  @Test
  fun allowedAgainAfterAnHourHasPassed() {
    assertTrue(notifier.shouldNotify("com.example.app", now = baseNow))
    val oneHourLater = baseNow + 60 * 60 * 1000L
    assertTrue(notifier.shouldNotify("com.example.app", now = oneHourLater))
  }

  @Test
  fun independentKeysAreRateLimitedIndependently() {
    assertTrue(notifier.shouldNotify("com.example.app", now = baseNow))
    // A different key at the same instant must not be suppressed by the first key's rate limit.
    assertTrue(notifier.shouldNotify("example.com", now = baseNow))
  }

  @Test
  fun ensureChannel_doesNotThrow() {
    notifier.ensureChannel()
  }
}
