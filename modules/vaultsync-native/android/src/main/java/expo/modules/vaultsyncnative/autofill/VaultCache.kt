package expo.modules.vaultsyncnative.autofill

class VaultCache(private val ttlMs: Long = 5 * 60 * 1000L) {
  @Volatile private var cached: Pair<VaultJsonView, Long>? = null

  fun get(): VaultJsonView? {
    val c = cached ?: return null
    if (System.currentTimeMillis() - c.second > ttlMs) { cached = null; return null }
    return c.first
  }

  fun put(view: VaultJsonView) { cached = view to System.currentTimeMillis() }
  fun invalidate() { cached = null }
}

object VaultCacheHolder {
  @Volatile var instance: VaultCache = VaultCache()
}
