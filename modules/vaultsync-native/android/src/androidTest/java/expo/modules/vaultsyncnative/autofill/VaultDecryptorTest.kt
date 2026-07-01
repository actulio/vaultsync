package expo.modules.vaultsyncnative.autofill

import android.util.Base64
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Instrumented tests for [VaultDecryptor].
 *
 * Fixture strategy (a): the [FIXTURE_VAULT_B64] file was produced by the JS production code
 * (encodeVaultFile + serializeVaultHeader + aeadEncrypt from src/) with a FIXED 32-byte key,
 * so a green decrypt here proves true JS(libsodium) <-> Kotlin(BouncyCastle) parity for
 * ChaCha20-Poly1305-IETF with header-as-AAD.
 */
@RunWith(AndroidJUnit4::class)
class VaultDecryptorTest {

  companion object {
    // key = bytes 0x00..0x1f
    const val FIXTURE_KEY_B64 = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8="
    const val FIXTURE_VAULT_B64 =
      "VkxUMQFAQUJDREVGR0hJSktMTU5PAAABAAMAAQAgAAdteSBoaW50AaChoqOkpaanqKmqq6ytrq+goaKjpKWmp6ipqqusra6voKGio6SlpqeoqaqrrK2ur6ChoqOkpaanqKmqq5CRkpOUlZaXmJmam9SoG/76fFMVjBVBeYHoQsHwa+Aj0HY9ZOgX1XTH2EzJ3nr0GVnj12UJOfXTi4gIikGSqc3H9SmIPTopMgAMvfqfqGPN0d+ebwMoLDAhlSUukkxoOFPG0BXuYhThfT8/c5Kx6SumueabUwxJNLY6dvscQ9KcUW8haqFLAxxpibgr88NDXcQZC4r24buhCsW9Lu0CY20oVC2UyfJqFnMbGNm3RiLfAuiRC4aMGLBES2oA7AUZaCOpdixLVInHdGgUb64G14UtM3BpfswOyKePWuz7nzQW500DWCg2VWeFkroyFv4rr1BXDA0Mnm7GRTPY6MRIZW5f4hWPS0EkHFY9Py2F2PGp/vayEW3seGirrIs/HwymywWkV7TZ7tMGGyF4gejcHF6S2i0SIK1/wwKbOfZfqw82t/EZpYiriwT46Pn2Ta05UPPa3+3Q08rzVjzpssLc1wZGOKL49V/tvok5gDHxmt3nbmnEXC1/uQuR02eDjBTxVhyv3awA6vEmjYv4jo26vkmKo2Phzy8mtcLGAJuxalsF5n9QB2c7rA0ioExFwtQVaMjrNbPlpgcdX9AWUJNW0aHaY1EXij1OVsmbL3nC4fEMa7t9xfTmQsGxnqYD19CI5sC8n3d1Ni3rvAFIn3xbL7n4NTRZVAv4sxeYtwXP+kZ1K7JUekllDkaqZ3Ws3nbknQdz+62wpo553dOuEHwVp0yUwtDpnR85vMstOg5RZ4qhy5BNKp9ZEhUbjGAelE7Z5Y9UuE90hY3E8Kt5VjbsKW9SJqUOz6loo44ef0kN8ThvbYlaUgFxehnwAOkpviqb6v4AUY0HdVsuqRyk2OfuXQWgnnRseKVm89JCnObLaLX0D/MBLxpKpG1Ko6U="
    const val FIXTURE_JSON =
      "{\"version\":1,\"entries\":[{\"type\":\"login\",\"id\":\"e1\",\"title\":\"Gmail\",\"username\":\"alice@gmail.com\",\"password\":\"pw1\",\"url\":\"https://gmail.com\",\"packageNames\":[\"com.google.android.gm\"],\"notes\":\"keep me\",\"createdAt\":\"2024-01-01T00:00:00.000Z\",\"updatedAt\":\"2024-01-02T00:00:00.000Z\"},{\"type\":\"login\",\"id\":\"e2\",\"title\":\"NoPkg\",\"username\":\"bob\",\"password\":\"pw2\",\"createdAt\":\"2024-01-03T00:00:00.000Z\",\"updatedAt\":\"2024-01-04T00:00:00.000Z\"},{\"type\":\"note\",\"id\":\"n1\",\"title\":\"Secret note\",\"body\":\"not a login\",\"createdAt\":\"2024-01-05T00:00:00.000Z\",\"updatedAt\":\"2024-01-06T00:00:00.000Z\"}],\"updatedAt\":\"2024-06-01T00:00:00.000Z\",\"deviceId\":\"dev-123\"}"

    fun key(): ByteArray = Base64.decode(FIXTURE_KEY_B64, Base64.DEFAULT)
    fun vault(): ByteArray = Base64.decode(FIXTURE_VAULT_B64, Base64.DEFAULT)
  }

  @Test
  fun decryptHappyPath_parsesLoginEntries_skipsNonLogin() {
    val view = VaultDecryptor.decryptToView(vault(), key())

    assertEquals("2024-06-01T00:00:00.000Z", view.updatedAt)
    // note "n1" is skipped -> only two login entries
    assertEquals(2, view.entries.size)

    val e1 = view.entries[0]
    assertEquals("e1", e1.id)
    assertEquals("Gmail", e1.title)
    assertEquals("alice@gmail.com", e1.username)
    assertEquals("pw1", e1.password)
    assertEquals("https://gmail.com", e1.url)
    assertEquals(listOf("com.google.android.gm"), e1.packageNames)

    val e2 = view.entries[1]
    assertEquals("e2", e2.id)
    assertEquals("bob", e2.username)
    // absent url -> null; absent packageNames -> empty list (not a crash)
    assertNull(e2.url)
    assertTrue(e2.packageNames.isEmpty())
  }

  @Test
  fun decryptToJson_returnsExactPlaintext() {
    assertEquals(FIXTURE_JSON, VaultDecryptor.decryptToJson(vault(), key()))
  }

  @Test
  fun aadEnforcement_nullAadFailsTagVerification() {
    // Production passes the header bytes as AAD; decrypting with AAD=null MUST fail.
    assertThrows(Exception::class.java) {
      VaultDecryptor.openWithAad(vault(), key(), null)
    }
    // Sanity: with the correct header AAD it succeeds.
    assertEquals(FIXTURE_JSON, VaultDecryptor.decryptToJson(vault(), key()))
  }

  @Test
  fun tamper_flippedHeaderByte_failsBecauseHeaderIsAad() {
    val bytes = vault()
    bytes[6] = (bytes[6].toInt() xor 0x01).toByte() // flip a byte inside the salt region
    assertThrows(Exception::class.java) {
      VaultDecryptor.decryptToJson(bytes, key())
    }
  }

  @Test
  fun tamper_flippedCiphertextByte_fails() {
    val bytes = vault()
    val layout = VaultDecryptor.parseLayout(vault())
    bytes[layout.headerEnd + 2] = (bytes[layout.headerEnd + 2].toInt() xor 0x01).toByte()
    assertThrows(Exception::class.java) {
      VaultDecryptor.decryptToJson(bytes, key())
    }
  }

  @Test
  fun malformed_badMagic_throwsClearError() {
    val bytes = vault()
    bytes[0] = 0x00
    val ex = assertThrows(IllegalArgumentException::class.java) {
      VaultDecryptor.parseLayout(bytes)
    }
    assertEquals("bad magic", ex.message)
  }

  @Test
  fun malformed_truncated_throwsClearError() {
    val ex = assertThrows(IllegalArgumentException::class.java) {
      VaultDecryptor.parseLayout(vault().copyOfRange(0, 20))
    }
    assertEquals("vault file truncated", ex.message)
  }
}
