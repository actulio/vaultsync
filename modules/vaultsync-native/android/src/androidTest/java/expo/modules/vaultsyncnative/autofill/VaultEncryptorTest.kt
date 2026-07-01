package expo.modules.vaultsyncnative.autofill

import android.util.Base64
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Instrumented tests for [VaultEncryptor] re-encrypt (save) flow and [VaultJson] reserialization.
 * Reuses the JS-produced fixture from [VaultDecryptorTest] to keep JS<->Kotlin parity end-to-end.
 */
@RunWith(AndroidJUnit4::class)
class VaultEncryptorTest {

  private fun key() = VaultDecryptorTest.key()
  private fun vault() = VaultDecryptorTest.vault()

  @Test
  fun reencryptRoundTrip_modifiedEntriesPresent() {
    val original = vault()
    val modified = VaultEncryptor.reencrypt(original, key()) { json ->
      VaultJson.reserialize(json) { root ->
        root.getJSONArray("entries").put(
          JSONObject().apply {
            put("type", "login")
            put("id", "e3")
            put("title", "Added")
            put("username", "carol")
            put("password", "pw3")
            put("packageNames", JSONArray(listOf("com.added.app")))
          },
        )
        root.put("updatedAt", "2025-01-01T00:00:00.000Z")
      }
    }

    val view = VaultDecryptor.decryptToView(modified, key())
    assertEquals("2025-01-01T00:00:00.000Z", view.updatedAt)
    // e1, e2 (logins) preserved + e3 added; note still skipped
    assertEquals(listOf("e1", "e2", "e3"), view.entries.map { it.id })
    val e3 = view.entries.last()
    assertEquals("carol", e3.username)
    assertEquals("pw3", e3.password)
    assertEquals(listOf("com.added.app"), e3.packageNames)
  }

  @Test
  fun reencrypt_preservesHeaderFieldsByteForByte_rotatesNonce() {
    val original = vault()
    val modified = VaultEncryptor.reencrypt(original, key()) { it } // no-op modifier

    val origLayout = VaultDecryptor.parseLayout(original)
    val newLayout = VaultDecryptor.parseLayout(modified)

    // headerEnd unchanged (salt/argon2/hint/recovery lengths identical)
    assertEquals(origLayout.headerEnd, newLayout.headerEnd)

    // Everything before the nonce (magic, version, salt, argon2, hint, recovery) is byte-identical.
    val nonceStart = origLayout.headerEnd - 12
    assertArrayEquals(
      original.copyOfRange(0, nonceStart),
      modified.copyOfRange(0, nonceStart),
    )

    // Nonce MUST have rotated.
    assertFalse(origLayout.nonce.contentEquals(newLayout.nonce))

    // And it still decrypts to the same plaintext (content preserved through the no-op modifier).
    assertEquals(
      VaultDecryptor.decryptToJson(original, key()),
      VaultDecryptor.decryptToJson(modified, key()),
    )
  }

  @Test
  fun reserialize_preservesUntouchedFields() {
    val out = VaultJson.reserialize(VaultDecryptorTest.FIXTURE_JSON) { root ->
      root.put("updatedAt", "2099-01-01T00:00:00.000Z")
    }
    val root = JSONObject(out)
    // touched field updated
    assertEquals("2099-01-01T00:00:00.000Z", root.getString("updatedAt"))
    // untouched top-level field preserved
    assertEquals("dev-123", root.getString("deviceId"))
    // untouched nested fields preserved (createdAt, notes on the first login)
    val e1 = root.getJSONArray("entries").getJSONObject(0)
    assertEquals("2024-01-01T00:00:00.000Z", e1.getString("createdAt"))
    assertEquals("keep me", e1.getString("notes"))
  }

  @Test
  fun reencrypt_producesNonTrivialCiphertext() {
    val modified = VaultEncryptor.reencrypt(vault(), key()) { it }
    // Not equal to original (nonce + fresh ciphertext), but same header prefix length.
    assertFalse(vault().contentEquals(modified))
    assertTrue(modified.isNotEmpty())
    // decode base64 helper unused-import guard
    assertTrue(Base64.encodeToString(modified, Base64.NO_WRAP).isNotEmpty())
  }
}
