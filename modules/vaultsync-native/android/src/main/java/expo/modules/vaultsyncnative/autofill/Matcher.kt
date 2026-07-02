package expo.modules.vaultsyncnative.autofill

data class EntryView(
  val id: String,
  val title: String,
  val username: String,
  val password: String,
  val url: String?,
  val packageNames: List<String>,
)

class Matcher {
  fun match(entries: List<EntryView>, packageName: String?, webDomain: String?): List<EntryView> {
    val byPackage = entries.filter { e -> packageName != null && packageName in e.packageNames }
    if (byPackage.isNotEmpty()) return byPackage

    if (webDomain != null) {
      val etld = etld1(webDomain)
      val byUrl = entries.filter { e ->
        val u = e.url ?: return@filter false
        etld1(u) == etld
      }
      if (byUrl.isNotEmpty()) return byUrl
    }

    if (packageName != null) {
      val brand = brandFromPackage(packageName)
      if (brand.isNotEmpty()) {
        val fuzzy = entries.filter { e ->
          e.title.contains(brand, true) || (e.url ?: "").contains(brand, true)
        }
        if (fuzzy.isNotEmpty()) return fuzzy
      }
    }
    return emptyList()
  }

  private fun brandFromPackage(pkg: String): String {
    val parts = pkg.split('.')
    val skip = setOf("com", "org", "io", "app", "android", "br", "net")
    return parts.firstOrNull { it !in skip } ?: ""
  }

  /**
   * eTLD+1 approximation: last two labels by default, but THREE when the last two form a known
   * multi-label public suffix (e.g. `nubank.com.br` -> `nubank.com.br`, not `com.br`). Prevents
   * cross-tenant misfires like every `*.com.br` matching every other. Full PSL still postponed.
   */
  internal fun etld1(host: String): String {
    val hostOnly = host.removePrefix("https://").removePrefix("http://").substringBefore('/').lowercase()
    val labels = hostOnly.split('.').filter { it.isNotEmpty() }
    if (labels.size <= 2) return hostOnly
    val lastTwo = labels.takeLast(2).joinToString(".")
    val take = if (lastTwo in MULTI_LABEL_SUFFIXES) 3 else 2
    if (labels.size <= take) return hostOnly
    return labels.takeLast(take).joinToString(".")
  }

  companion object {
    /** Minimal embedded multi-label public-suffix set (full PSL postponed). */
    private val MULTI_LABEL_SUFFIXES = setOf(
      "com.br", "net.br", "org.br", "gov.br", "edu.br",
      "co.uk", "org.uk", "gov.uk",
      "com.au", "co.jp", "co.nz",
    )
  }
}
