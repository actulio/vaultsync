package expo.modules.vaultsyncnative.autofill

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Instrumented tests for [Matcher].
 *
 * Tests the credential matching logic with three fallback strategies:
 * 1. Exact package match (highest precedence)
 * 2. eTLD+1 URL normalization
 * 3. Fuzzy brand-from-package fallback
 *
 * EntryView is plain data with no Android dependencies, so these tests
 * focus on the matching algorithm rather than Android framework integration.
 */
@RunWith(AndroidJUnit4::class)
class MatcherTest {

    private val matcher = Matcher()

    // ── Exact Package Match (Precedence) ────────────────────────────────────

    @Test
    fun matchByExactPackageReturnsEntries() {
        val entry1 = EntryView(
            id = "1",
            title = "Gmail",
            username = "user@gmail.com",
            password = "pass1",
            url = "https://gmail.com",
            packageNames = listOf("com.google.android.gm"),
        )
        val entry2 = EntryView(
            id = "2",
            title = "Google Account",
            username = "user@google.com",
            password = "pass2",
            url = null,
            packageNames = listOf("com.google.android.apps.docs"),
        )
        val result = matcher.match(listOf(entry1, entry2), packageName = "com.google.android.gm", webDomain = null)
        assertEquals(1, result.size)
        assertEquals("1", result[0].id)
    }

    @Test
    fun matchByExactPackageWinsOverUrlMatch() {
        // Precedence test: exact package match should be returned even when URL match exists.
        val packageEntry = EntryView(
            id = "pkg-entry",
            title = "Gmail App",
            username = "user@gmail.com",
            password = "pass",
            url = "https://outlook.com",  // Different URL
            packageNames = listOf("com.google.android.gm"),
        )
        val urlEntry = EntryView(
            id = "url-entry",
            title = "Outlook",
            username = "user@outlook.com",
            password = "pass",
            url = "https://gmail.com",  // Matching URL
            packageNames = listOf("com.microsoft.outlook"),
        )
        val result = matcher.match(
            listOf(packageEntry, urlEntry),
            packageName = "com.google.android.gm",
            webDomain = "gmail.com"
        )
        assertEquals(1, result.size)
        assertEquals("pkg-entry", result[0].id)
    }

    @Test
    fun matchByExactPackageWinsOverFuzzyMatch() {
        // Precedence test: exact package match should be returned even when fuzzy brand match exists.
        val packageEntry = EntryView(
            id = "pkg-entry",
            title = "Nubank Account",
            username = "user@nubank.com",
            password = "pass",
            url = null,
            packageNames = listOf("com.nubank.app"),
        )
        val fuzzyEntry = EntryView(
            id = "fuzzy-entry",
            title = "My Nubank Savings",
            username = "user@bank.com",
            password = "pass",
            url = "https://mybank.com",
            packageNames = listOf("com.mybank.app"),
        )
        val result = matcher.match(
            listOf(packageEntry, fuzzyEntry),
            packageName = "com.nubank.app",
            webDomain = null
        )
        assertEquals(1, result.size)
        assertEquals("pkg-entry", result[0].id)
    }

    // ── eTLD+1 URL Normalization ───────────────────────────────────────────

    @Test
    fun matchByEtld1StripsHttpsAndPath() {
        // eTLD+1: "accounts.google.com" and "https://google.com/login" both normalize to "google.com"
        val entry = EntryView(
            id = "1",
            title = "Google Login",
            username = "user@google.com",
            password = "pass",
            url = "https://accounts.google.com/signin",
            packageNames = emptyList(),
        )
        val result = matcher.match(listOf(entry), packageName = null, webDomain = "https://google.com/login")
        assertEquals(1, result.size)
        assertEquals("1", result[0].id)
    }

    @Test
    fun matchByEtld1NormalizesSubdomains() {
        val entry = EntryView(
            id = "1",
            title = "GitHub",
            username = "user",
            password = "pass",
            url = "https://api.github.com/login",
            packageNames = emptyList(),
        )
        val result = matcher.match(listOf(entry), packageName = null, webDomain = "github.com")
        assertEquals(1, result.size)
        assertEquals("1", result[0].id)
    }

    @Test
    fun matchByEtld1IsCaseInsensitive() {
        val entry = EntryView(
            id = "1",
            title = "Example",
            username = "user",
            password = "pass",
            url = "https://EXAMPLE.com",
            packageNames = emptyList(),
        )
        val result = matcher.match(listOf(entry), packageName = null, webDomain = "example.com")
        assertEquals(1, result.size)
        assertEquals("1", result[0].id)
    }

    @Test
    fun matchByEtld1HandlesHttpPrefix() {
        val entry = EntryView(
            id = "1",
            title = "Bank",
            username = "user",
            password = "pass",
            url = "http://bank.example.com",
            packageNames = emptyList(),
        )
        val result = matcher.match(listOf(entry), packageName = null, webDomain = "example.com")
        assertEquals(1, result.size)
        assertEquals("1", result[0].id)
    }

    @Test
    fun matchByEtld1SingleLabelDomain() {
        // Single label (no dots) should match itself exactly
        val entry = EntryView(
            id = "1",
            title = "Local",
            username = "user",
            password = "pass",
            url = "http://localhost",
            packageNames = emptyList(),
        )
        val result = matcher.match(listOf(entry), packageName = null, webDomain = "localhost")
        assertEquals(1, result.size)
        assertEquals("1", result[0].id)
    }

    @Test
    fun matchByEtld1NullUrlEntrySkipped() {
        // Entries with null url should not match during URL filtering
        val entry = EntryView(
            id = "1",
            title = "Google",
            username = "user",
            password = "pass",
            url = null,
            packageNames = emptyList(),
        )
        val result = matcher.match(listOf(entry), packageName = null, webDomain = "google.com")
        assertEquals(0, result.size)
    }

    // ── eTLD+1 Multi-Label Public Suffix (I3) ──────────────────────────────

    @Test
    fun etld1MultiLabelSuffixDoesNotOverMatch() {
        // nubank.com.br must NOT match evil.com.br (both share the com.br public suffix).
        val entry = EntryView(
            id = "nubank",
            title = "Nubank",
            username = "user",
            password = "pass",
            url = "https://nubank.com.br",
            packageNames = emptyList(),
        )
        val result = matcher.match(listOf(entry), packageName = null, webDomain = "evil.com.br")
        assertEquals(0, result.size)
    }

    @Test
    fun etld1MultiLabelSuffixCollapsesSubdomain() {
        // app.nubank.com.br collapses to nubank.com.br and matches the stored nubank.com.br entry.
        val entry = EntryView(
            id = "nubank",
            title = "Nubank",
            username = "user",
            password = "pass",
            url = "https://nubank.com.br/login",
            packageNames = emptyList(),
        )
        val result = matcher.match(listOf(entry), packageName = null, webDomain = "app.nubank.com.br")
        assertEquals(1, result.size)
        assertEquals("nubank", result[0].id)
    }

    @Test
    fun etld1PlainDomainStillCollapses() {
        // A plain example.com still collapses to example.com (last-2 default preserved).
        val entry = EntryView(
            id = "1",
            title = "Example",
            username = "user",
            password = "pass",
            url = "https://www.example.com",
            packageNames = emptyList(),
        )
        val result = matcher.match(listOf(entry), packageName = null, webDomain = "example.com")
        assertEquals(1, result.size)
        assertEquals("1", result[0].id)
    }

    @Test
    fun etld1CoUkDoesNotOverMatch() {
        // foo.co.uk must NOT match bar.co.uk.
        val entry = EntryView(
            id = "foo",
            title = "Foo",
            username = "user",
            password = "pass",
            url = "https://foo.co.uk",
            packageNames = emptyList(),
        )
        val result = matcher.match(listOf(entry), packageName = null, webDomain = "bar.co.uk")
        assertEquals(0, result.size)
    }

    // ── Fuzzy Brand-from-Package Fallback ──────────────────────────────────

    @Test
    fun matchByFuzzyBrandInTitle() {
        val entry = EntryView(
            id = "1",
            title = "Nubank Account",
            username = "user@nubank.com",
            password = "pass",
            url = null,
            packageNames = listOf("com.other.bank"),
        )
        val result = matcher.match(listOf(entry), packageName = "com.nubank.app", webDomain = null)
        assertEquals(1, result.size)
        assertEquals("1", result[0].id)
    }

    @Test
    fun matchByFuzzyBrandInUrl() {
        val entry = EntryView(
            id = "1",
            title = "My Account",
            username = "user",
            password = "pass",
            url = "https://nubank.com.br/login",
            packageNames = listOf("com.other.bank"),
        )
        val result = matcher.match(listOf(entry), packageName = "com.nubank.app", webDomain = null)
        assertEquals(1, result.size)
        assertEquals("1", result[0].id)
    }

    @Test
    fun matchByFuzzyBrandIsCaseInsensitive() {
        val entry = EntryView(
            id = "1",
            title = "FACEBOOK Login",
            username = "user",
            password = "pass",
            url = null,
            packageNames = emptyList(),
        )
        val result = matcher.match(listOf(entry), packageName = "com.facebook.katana", webDomain = null)
        assertEquals(1, result.size)
        assertEquals("1", result[0].id)
    }

    @Test
    fun matchByFuzzyBrandSkipsCommonPrefixes() {
        // "com", "org", "io", "app", "android", "br", "net" are in the skip list
        // so brand from "com.nubank.app" should be "nubank", not "com" or "app"
        val entryMatching = EntryView(
            id = "match",
            title = "Nubank",
            username = "user",
            password = "pass",
            url = null,
            packageNames = emptyList(),
        )
        val entrySkipped = EntryView(
            id = "skip",
            title = "Com Services",
            username = "user",
            password = "pass",
            url = null,
            packageNames = emptyList(),
        )
        val result = matcher.match(
            listOf(entryMatching, entrySkipped),
            packageName = "com.nubank.app",
            webDomain = null
        )
        assertEquals(1, result.size)
        assertEquals("match", result[0].id)
    }

    @Test
    fun matchByFuzzyBrandReturnsBrandNotFromSkipList() {
        // Only the first non-skip part is used as brand
        val entry = EntryView(
            id = "1",
            title = "Twitter Access",
            username = "user",
            password = "pass",
            url = null,
            packageNames = emptyList(),
        )
        val result = matcher.match(listOf(entry), packageName = "com.twitter.android", webDomain = null)
        assertEquals(1, result.size)
        assertEquals("1", result[0].id)
    }

    @Test
    fun matchByFuzzyBrandReturnsEmptyWhenBrandIsOnlySkipped() {
        // Package "com.org.io" would have only skip-list parts, so brand is empty
        val entry = EntryView(
            id = "1",
            title = "Some Account",
            username = "user",
            password = "pass",
            url = null,
            packageNames = emptyList(),
        )
        val result = matcher.match(listOf(entry), packageName = "com.org.io", webDomain = null)
        assertEquals(0, result.size)
    }

    // ── No Match ───────────────────────────────────────────────────────────

    @Test
    fun noMatchReturnsEmptyList() {
        val entry = EntryView(
            id = "1",
            title = "Gmail",
            username = "user@gmail.com",
            password = "pass",
            url = "https://gmail.com",
            packageNames = listOf("com.google.android.gm"),
        )
        val result = matcher.match(listOf(entry), packageName = "com.different.app", webDomain = null)
        assertEquals(0, result.size)
    }

    @Test
    fun noMatchWhenEmptyEntryList() {
        val result = matcher.match(emptyList(), packageName = "com.google.android.gm", webDomain = "gmail.com")
        assertEquals(0, result.size)
    }

    @Test
    fun noMatchWhenAllParametersNull() {
        val entry = EntryView(
            id = "1",
            title = "Gmail",
            username = "user@gmail.com",
            password = "pass",
            url = "https://gmail.com",
            packageNames = listOf("com.google.android.gm"),
        )
        val result = matcher.match(listOf(entry), packageName = null, webDomain = null)
        assertEquals(0, result.size)
    }

    @Test
    fun noMatchWhenNoUrlAndNoPackageMatch() {
        val entry = EntryView(
            id = "1",
            title = "Unknown Service",
            username = "user",
            password = "pass",
            url = null,
            packageNames = emptyList(),
        )
        val result = matcher.match(listOf(entry), packageName = "com.example.app", webDomain = "example.com")
        assertEquals(0, result.size)
    }

    // ── Multiple Matches ──────────────────────────────────────────────────

    @Test
    fun multiplePackageMatchesAllReturned() {
        val entry1 = EntryView(
            id = "1",
            title = "Gmail Work",
            username = "work@gmail.com",
            password = "pass1",
            url = "https://gmail.com",
            packageNames = listOf("com.google.android.gm"),
        )
        val entry2 = EntryView(
            id = "2",
            title = "Gmail Personal",
            username = "personal@gmail.com",
            password = "pass2",
            url = "https://gmail.com",
            packageNames = listOf("com.google.android.gm"),
        )
        val result = matcher.match(listOf(entry1, entry2), packageName = "com.google.android.gm", webDomain = null)
        assertEquals(2, result.size)
        assertEquals(setOf("1", "2"), result.map { it.id }.toSet())
    }

    @Test
    fun multipleUrlMatchesAllReturned() {
        val entry1 = EntryView(
            id = "1",
            title = "Google Account 1",
            username = "user1@google.com",
            password = "pass1",
            url = "https://accounts.google.com",
            packageNames = emptyList(),
        )
        val entry2 = EntryView(
            id = "2",
            title = "Google Account 2",
            username = "user2@google.com",
            password = "pass2",
            url = "https://google.com/login",
            packageNames = emptyList(),
        )
        val result = matcher.match(listOf(entry1, entry2), packageName = null, webDomain = "google.com")
        assertEquals(2, result.size)
        assertEquals(setOf("1", "2"), result.map { it.id }.toSet())
    }

    @Test
    fun multipleFuzzyMatchesAllReturned() {
        val entry1 = EntryView(
            id = "1",
            title = "Nubank Checking",
            username = "user1",
            password = "pass1",
            url = null,
            packageNames = emptyList(),
        )
        val entry2 = EntryView(
            id = "2",
            title = "Nubank Savings",
            username = "user2",
            password = "pass2",
            url = null,
            packageNames = emptyList(),
        )
        val result = matcher.match(listOf(entry1, entry2), packageName = "com.nubank.app", webDomain = null)
        assertEquals(2, result.size)
        assertEquals(setOf("1", "2"), result.map { it.id }.toSet())
    }
}
