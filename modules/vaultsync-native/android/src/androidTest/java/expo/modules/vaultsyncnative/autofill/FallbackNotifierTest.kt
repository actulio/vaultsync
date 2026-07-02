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

  // Regression test for the unbounded-growth review finding: shouldNotify's write path must
  // prune stale "last_*" entries (ones already past RATE_LIMIT_MS, which can never again
  // suppress a future call) in the same batch as recording the new timestamp.
  @Test
  fun shouldNotify_prunesStaleEntriesButKeepsInWindowOnes() {
    val fallbackPrefs = ctx.getSharedPreferences("vaultsync_fallback", Context.MODE_PRIVATE)

    // Seed a stale entry directly (older than the rate-limit window as of baseNow) and an
    // in-window one, bypassing shouldNotify so the seeded timestamps are exact.
    fallbackPrefs.edit()
      .putLong("last_stale.example", baseNow - FallbackNotifier.RATE_LIMIT_MS - 1L)
      .putLong("last_fresh.example", baseNow - FallbackNotifier.RATE_LIMIT_MS + 1L)
      .apply()

    // Recording a new key's timestamp is the write path under test.
    assertTrue(notifier.shouldNotify("com.example.newapp", now = baseNow))

    assertFalse(
      "stale entry older than the rate-limit window should have been pruned",
      fallbackPrefs.contains("last_stale.example"),
    )
    assertTrue(
      "in-window entry must survive pruning",
      fallbackPrefs.contains("last_fresh.example"),
    )
    assertTrue(
      "the newly recorded key must be present",
      fallbackPrefs.contains("last_com.example.newapp"),
    )
  }
}
