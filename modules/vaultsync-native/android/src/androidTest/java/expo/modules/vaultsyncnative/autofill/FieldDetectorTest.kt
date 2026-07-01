package expo.modules.vaultsyncnative.autofill

import android.text.InputType
import android.view.View
import android.view.autofill.AutofillId
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Instrumented tests for [FieldDetector].
 *
 * AutofillId has no public constructor and AutofillId.parseString() is not a
 * usable public API (will not compile or run on device). Instead we mint real
 * AutofillId values from [View.getAutofillId] (API 26+), which returns a unique
 * non-null id for every fresh View instance.
 *
 * classify() is @VisibleForTesting internal so it can be called directly here,
 * letting us pin each classification branch independently without needing a real
 * AssistStructure. classify() never reads autofillId, so classifyNode() fakes
 * return null for that field. walk() tests use walkNode() with distinct freshId()
 * values so we can assert that the correct node's id is stored in DetectedFields.
 */
@RunWith(AndroidJUnit4::class)
class FieldDetectorTest {

    private val ctx = InstrumentationRegistry.getInstrumentation().targetContext

    /** Mint a unique real AutofillId from a fresh View (API 26+). */
    private fun freshId(): AutofillId = View(ctx).autofillId

    /**
     * Leaf-node stub for direct [FieldDetector.classify] tests.
     * autofillId is null because classify() never reads it.
     */
    private fun classifyNode(
        hints: Array<String>? = null,
        input: Int = 0,
        id: String? = null,
        html: HtmlInfoLike? = null,
    ): ViewNodeLike = object : ViewNodeLike {
        override val autofillId: AutofillId? = null
        override val autofillHints = hints
        override val inputType = input
        override val idEntry = id
        override val htmlInfo = html
        override val children = emptyList<ViewNodeLike>()
    }

    /**
     * Node stub for [FieldDetector.walk] tests.
     * Each call produces a distinct freshId() by default so walk() can
     * store and return the correct node id.
     */
    private fun walkNode(
        hints: Array<String>? = null,
        input: Int = 0,
        id: String? = null,
        html: HtmlInfoLike? = null,
        kids: List<ViewNodeLike> = emptyList(),
        autofillId: AutofillId = freshId(),
        web: String? = null,
    ): ViewNodeLike = object : ViewNodeLike {
        override val autofillId = autofillId
        override val autofillHints = hints
        override val inputType = input
        override val idEntry = id
        override val htmlInfo = html
        override val children = kids
        override val webDomain = web
    }

    // ── Branch 1: autofillHints ─────────────────────────────────────────────

    @Test fun classifyBranch1_autofillHintPassword() {
        val n = classifyNode(hints = arrayOf(View.AUTOFILL_HINT_PASSWORD))
        assertEquals(FieldDetector.Kind.PASSWORD, FieldDetector().classify(n))
    }

    @Test fun classifyBranch1_autofillHintUsername() {
        val n = classifyNode(hints = arrayOf(View.AUTOFILL_HINT_USERNAME))
        assertEquals(FieldDetector.Kind.USERNAME, FieldDetector().classify(n))
    }

    @Test fun classifyBranch1_autofillHintEmailAddress() {
        val n = classifyNode(hints = arrayOf(View.AUTOFILL_HINT_EMAIL_ADDRESS))
        assertEquals(FieldDetector.Kind.USERNAME, FieldDetector().classify(n))
    }

    // ── Branch 2: inputType ─────────────────────────────────────────────────

    @Test fun classifyBranch2_inputTypePassword() {
        val n = classifyNode(
            input = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        )
        assertEquals(FieldDetector.Kind.PASSWORD, FieldDetector().classify(n))
    }

    @Test fun classifyBranch2_inputTypeWebPassword() {
        val n = classifyNode(
            input = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD
        )
        assertEquals(FieldDetector.Kind.PASSWORD, FieldDetector().classify(n))
    }

    @Test fun classifyBranch2_inputTypeVisiblePassword() {
        val n = classifyNode(
            input = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
        )
        assertEquals(FieldDetector.Kind.PASSWORD, FieldDetector().classify(n))
    }

    @Test fun classifyBranch2_inputTypeEmailAddress() {
        val n = classifyNode(
            input = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
        )
        assertEquals(FieldDetector.Kind.USERNAME, FieldDetector().classify(n))
    }

    @Test fun classifyBranch2_inputTypeWebEmailAddress() {
        val n = classifyNode(
            input = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_WEB_EMAIL_ADDRESS
        )
        assertEquals(FieldDetector.Kind.USERNAME, FieldDetector().classify(n))
    }

    // ── Branch 3: android:id resource name ──────────────────────────────────

    @Test fun classifyBranch3_idEntryPassword() {
        assertEquals(FieldDetector.Kind.PASSWORD, FieldDetector().classify(classifyNode(id = "etPassword")))
    }

    @Test fun classifyBranch3_idEntryPasswd() {
        assertEquals(FieldDetector.Kind.PASSWORD, FieldDetector().classify(classifyNode(id = "passwd")))
    }

    @Test fun classifyBranch3_idEntryUsername() {
        assertEquals(FieldDetector.Kind.USERNAME, FieldDetector().classify(classifyNode(id = "etUsername")))
    }

    @Test fun classifyBranch3_idEntryEmail() {
        assertEquals(FieldDetector.Kind.USERNAME, FieldDetector().classify(classifyNode(id = "emailInput")))
    }

    @Test fun classifyBranch3_idEntryLogin() {
        assertEquals(FieldDetector.Kind.USERNAME, FieldDetector().classify(classifyNode(id = "login_field")))
    }

    @Test fun classifyBranch3_idEntryUserId() {
        // "userId" contains "user" keyword but not "username" — must still resolve to USERNAME
        assertEquals(FieldDetector.Kind.USERNAME, FieldDetector().classify(classifyNode(id = "userId")))
    }

    // ── Branch 4: HTML input type and name attributes ───────────────────────

    @Test fun classifyBranch4_htmlTypePassword() {
        val n = classifyNode(html = HtmlInfoLike("input", mapOf("type" to "password")))
        assertEquals(FieldDetector.Kind.PASSWORD, FieldDetector().classify(n))
    }

    @Test fun classifyBranch4_htmlTypeEmail() {
        val n = classifyNode(html = HtmlInfoLike("input", mapOf("type" to "email")))
        assertEquals(FieldDetector.Kind.USERNAME, FieldDetector().classify(n))
    }

    @Test fun classifyBranch4_htmlNamePassword() {
        val n = classifyNode(html = HtmlInfoLike("input", mapOf("name" to "password_field")))
        assertEquals(FieldDetector.Kind.PASSWORD, FieldDetector().classify(n))
    }

    @Test fun classifyBranch4_htmlNameUser() {
        val n = classifyNode(html = HtmlInfoLike("input", mapOf("name" to "username")))
        assertEquals(FieldDetector.Kind.USERNAME, FieldDetector().classify(n))
    }

    @Test fun classifyBranch4_htmlNameEmail() {
        val n = classifyNode(html = HtmlInfoLike("input", mapOf("name" to "email_address")))
        assertEquals(FieldDetector.Kind.USERNAME, FieldDetector().classify(n))
    }

    @Test fun classifyBranch4_htmlNameLogin() {
        // No "type" attr — must fall through to name-substring branch; "login_field" contains "login"
        val n = classifyNode(html = HtmlInfoLike("input", mapOf("name" to "login_field")))
        assertEquals(FieldDetector.Kind.USERNAME, FieldDetector().classify(n))
    }

    // ── Precedence: Branch 1 (autofillHint) wins over Branch 2 (inputType) ──

    @Test fun classifyPrecedence_autofillHintPasswordBeatsEmailInputType() {
        // Conflicting signals: hint says PASSWORD, inputType says USERNAME (email).
        // Branch 1 executes first via early return → must resolve to PASSWORD.
        val n = classifyNode(
            hints = arrayOf(View.AUTOFILL_HINT_PASSWORD),
            input = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS,
        )
        assertEquals(FieldDetector.Kind.PASSWORD, FieldDetector().classify(n))
    }

    @Test fun classifyNone_noSignals() {
        assertNull(FieldDetector().classify(classifyNode()))
    }

    // ── walk() tests ─────────────────────────────────────────────────────────

    @Test fun walkReturnsNonNullWhenPasswordPresent() {
        val pwId = freshId()
        val tree = walkNode(kids = listOf(
            walkNode(hints = arrayOf(View.AUTOFILL_HINT_USERNAME)),
            walkNode(hints = arrayOf(View.AUTOFILL_HINT_PASSWORD), autofillId = pwId),
        ))
        val r = FieldDetector().walk(tree)
        assertNotNull(r)
        assertEquals(pwId, r!!.passwordId)
    }

    @Test fun walkSetsUsernameIdWhenPresent() {
        val unId = freshId()
        val pwId = freshId()
        val tree = walkNode(kids = listOf(
            walkNode(hints = arrayOf(View.AUTOFILL_HINT_USERNAME), autofillId = unId),
            walkNode(hints = arrayOf(View.AUTOFILL_HINT_PASSWORD), autofillId = pwId),
        ))
        val r = FieldDetector().walk(tree)
        assertNotNull(r)
        assertEquals(unId, r!!.usernameId)
        assertEquals(pwId, r.passwordId)
    }

    @Test fun walkReturnsNullWhenNoPasswordField() {
        val tree = walkNode(kids = listOf(walkNode(id = "etUsername")))
        assertNull(FieldDetector().walk(tree))
    }

    @Test fun walkFirstMatchWinsForPassword() {
        val firstPwId = freshId()
        val secondPwId = freshId()
        val tree = walkNode(kids = listOf(
            walkNode(hints = arrayOf(View.AUTOFILL_HINT_PASSWORD), autofillId = firstPwId),
            walkNode(hints = arrayOf(View.AUTOFILL_HINT_PASSWORD), autofillId = secondPwId),
        ))
        val r = FieldDetector().walk(tree)
        assertNotNull(r)
        assertEquals(firstPwId, r!!.passwordId)
    }

    @Test fun walkPasswordOnlyNoUsernameIsAllowed() {
        val pwId = freshId()
        val tree = walkNode(kids = listOf(
            walkNode(hints = arrayOf(View.AUTOFILL_HINT_PASSWORD), autofillId = pwId),
        ))
        val r = FieldDetector().walk(tree)
        assertNotNull(r)
        assertEquals(pwId, r!!.passwordId)
        assertNull(r.usernameId)
    }

    @Test fun walkDeepTreeFindsPasswordInNestedChild() {
        val pwId = freshId()
        val inner = walkNode(
            kids = listOf(walkNode(hints = arrayOf(View.AUTOFILL_HINT_PASSWORD), autofillId = pwId))
        )
        val tree = walkNode(kids = listOf(walkNode(kids = listOf(inner))))
        val r = FieldDetector().walk(tree)
        assertNotNull(r)
        assertEquals(pwId, r!!.passwordId)
    }

    // ── webDomain() DFS helper ────────────────────────────────────────────────

    @Test fun webDomainReturnsNullWhenNoNodeCarriesIt() {
        val tree = walkNode(kids = listOf(walkNode(id = "etUsername"), walkNode(id = "etPassword")))
        assertNull(FieldDetector().webDomain(tree))
    }

    @Test fun webDomainFoundOnNestedChild() {
        val tree = walkNode(kids = listOf(
            walkNode(),
            walkNode(kids = listOf(walkNode(web = "example.com"))),
        ))
        assertEquals("example.com", FieldDetector().webDomain(tree))
    }

    @Test fun webDomainReturnsFirstNonBlankInDfsOrder() {
        // Root is blank, first child blank/empty, second child has the origin → skip blanks.
        val tree = walkNode(web = "", kids = listOf(
            walkNode(web = ""),
            walkNode(web = "login.example.org"),
        ))
        assertEquals("login.example.org", FieldDetector().webDomain(tree))
    }
}
