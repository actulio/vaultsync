package expo.modules.vaultsyncnative.autofill

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Instrumented tests for [VaultCache].
 *
 * Tests the in-process TTL cache used by AutofillService to avoid
 * re-decrypting vault data on every fill request.
 */
@RunWith(AndroidJUnit4::class)
class VaultCacheTest {

  @Test
  fun putAndGetReturnsTheSameView() {
    val cache = VaultCache()
    val view = VaultJsonView(entries = emptyList(), updatedAt = "2026-07-01T00:00:00Z")
    cache.put(view)
    val retrieved = cache.get()
    assertEquals(view, retrieved)
  }

  @Test
  fun ttlExpiryReturnsNull() {
    val cache = VaultCache(ttlMs = 50)
    val view = VaultJsonView(entries = emptyList(), updatedAt = "2026-07-01T00:00:00Z")
    cache.put(view)
    Thread.sleep(80)
    val retrieved = cache.get()
    assertNull(retrieved)
  }

  @Test
  fun getBeforeAnyPutReturnsNull() {
    val cache = VaultCache()
    val retrieved = cache.get()
    assertNull(retrieved)
  }

  @Test
  fun invalidateClearsCache() {
    val cache = VaultCache()
    val view = VaultJsonView(entries = emptyList(), updatedAt = "2026-07-01T00:00:00Z")
    cache.put(view)
    cache.invalidate()
    val retrieved = cache.get()
    assertNull(retrieved)
  }
}
