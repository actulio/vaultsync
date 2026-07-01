package expo.modules.vaultsyncnative.autofill

import android.app.assist.AssistStructure
import android.text.InputType
import android.view.View
import android.view.autofill.AutofillId
import androidx.annotation.VisibleForTesting

interface ViewNodeLike {
  val autofillId: AutofillId?
  val autofillHints: Array<String>?
  val inputType: Int
  val idEntry: String?           // android:id resource name
  val htmlInfo: HtmlInfoLike?
  val children: List<ViewNodeLike>

  // Web autofill contexts (WebView/browser) expose the origin here; native views leave it null.
  // Default getter keeps existing ViewNodeLike fakes source-compatible (no forced override).
  val webDomain: String? get() = null
}

data class HtmlInfoLike(val tag: String, val attributes: Map<String, String>)

data class DetectedFields(
  val usernameId: AutofillId?,
  val passwordId: AutofillId,
)

class FieldDetector {
  fun walk(root: ViewNodeLike): DetectedFields? {
    var username: AutofillId? = null
    var password: AutofillId? = null

    fun visit(node: ViewNodeLike) {
      classify(node)?.let { kind ->
        when (kind) {
          Kind.PASSWORD -> if (password == null) password = node.autofillId
          Kind.USERNAME -> if (username == null) username = node.autofillId
        }
      }
      node.children.forEach(::visit)
    }
    visit(root)
    val pw = password ?: return null
    return DetectedFields(username, pw)
  }

  // Internal so tests can call classify() directly with ViewNodeLike fakes.
  // Kind is also internal so tests can reference Kind.PASSWORD / Kind.USERNAME.
  internal enum class Kind { USERNAME, PASSWORD }

  @VisibleForTesting
  internal fun classify(n: ViewNodeLike): Kind? {
    // Branch 1: autofill hints (highest priority)
    val hints = n.autofillHints?.toSet().orEmpty()
    if (View.AUTOFILL_HINT_PASSWORD in hints) return Kind.PASSWORD
    if (View.AUTOFILL_HINT_USERNAME in hints || View.AUTOFILL_HINT_EMAIL_ADDRESS in hints) return Kind.USERNAME

    // Branch 2: inputType
    val variation = n.inputType and InputType.TYPE_MASK_VARIATION
    val cls = n.inputType and InputType.TYPE_MASK_CLASS
    if (cls == InputType.TYPE_CLASS_TEXT) {
      if (variation == InputType.TYPE_TEXT_VARIATION_PASSWORD
        || variation == InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD
        || variation == InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD) return Kind.PASSWORD
      if (variation == InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
        || variation == InputType.TYPE_TEXT_VARIATION_WEB_EMAIL_ADDRESS) return Kind.USERNAME
    }

    // Branch 3: android:id resource name
    val idLower = n.idEntry?.lowercase().orEmpty()
    if ("password" in idLower || "passwd" in idLower) return Kind.PASSWORD
    if ("username" in idLower || "email" in idLower || "user" in idLower || "login" in idLower) return Kind.USERNAME

    // Branch 4: HTML input element type and name attributes
    val html = n.htmlInfo ?: return null
    if (html.tag == "input") {
      when (html.attributes["type"]?.lowercase()) {
        "password" -> return Kind.PASSWORD
        "email" -> return Kind.USERNAME
      }
      val name = html.attributes["name"]?.lowercase().orEmpty()
      if ("password" in name) return Kind.PASSWORD
      if ("user" in name || "email" in name || "login" in name) return Kind.USERNAME
    }
    return null
  }

  /**
   * DFS for the first non-blank webDomain in the node tree.
   *
   * `webDomain` lives on [AssistStructure.ViewNode] (surfaced via [ViewNodeLike.webDomain]),
   * NOT on [AssistStructure] itself — so the service cannot read it off the structure directly.
   * Native app screens return null here; browser/WebView screens carry the origin on some node.
   */
  fun webDomain(root: ViewNodeLike): String? {
    root.webDomain?.takeIf { it.isNotEmpty() }?.let { return it }
    for (child in root.children) {
      webDomain(child)?.let { return it }
    }
    return null
  }

  /** Adapter to wrap a real AssistStructure.ViewNode. */
  fun adapt(node: AssistStructure.ViewNode): ViewNodeLike = object : ViewNodeLike {
    override val autofillId get() = node.autofillId
    override val autofillHints get() = node.autofillHints
    override val inputType get() = node.inputType
    override val idEntry get() = node.idEntry
    override val htmlInfo get() = node.htmlInfo?.let { hi ->
      HtmlInfoLike(hi.tag, hi.attributes?.associate { it.first to it.second } ?: emptyMap())
    }
    override val children get() = (0 until node.childCount).map { adapt(node.getChildAt(it)) }
    override val webDomain get() = node.webDomain
  }
}
