package expo.modules.vaultsyncnative.autofill

import org.json.JSONObject

/** Parsed, autofill-facing view of a decrypted vault. Only login entries are surfaced. */
data class VaultJsonView(val entries: List<EntryView>, val updatedAt: String)

/**
 * JSON parsing for the decrypted vault payload. Uses android's bundled [org.json] (no deps).
 * Field names mirror `src/vault/types.ts` (VaultV1 + Login).
 */
object VaultJson {
  fun parse(json: String): VaultJsonView {
    val root = JSONObject(json)
    val arr = root.getJSONArray("entries")
    val entries = mutableListOf<EntryView>()
    for (i in 0 until arr.length()) {
      val o = arr.getJSONObject(i)
      // Non-login entries (e.g. secure notes) are not autofillable — skip them.
      if (o.optString("type") != "login") continue
      entries += EntryView(
        id = o.getString("id"),
        title = o.optString("title"),
        username = o.optString("username"),
        password = o.optString("password"),
        url = o.optString("url").takeIf { it.isNotEmpty() },
        packageNames = run {
          // Missing/absent packageNames must yield an empty list, not crash.
          val pn = o.optJSONArray("packageNames")
          if (pn == null) emptyList() else List(pn.length()) { pn.getString(it) }
        },
      )
    }
    return VaultJsonView(entries, root.optString("updatedAt"))
  }

  /**
   * Applies [modifier] to the parsed root and reserializes. In-place [JSONObject] mutation
   * preserves every field the modifier does not touch (createdAt, notes, deviceId, ...).
   */
  fun reserialize(originalJson: String, modifier: (JSONObject) -> Unit): String {
    val root = JSONObject(originalJson)
    modifier(root)
    return root.toString()
  }
}
