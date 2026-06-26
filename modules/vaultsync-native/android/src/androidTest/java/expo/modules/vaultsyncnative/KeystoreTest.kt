package expo.modules.vaultsyncnative

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertThrows
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class KeystoreTest {
  private val alias = "vault_kek_test"
  private lateinit var keystore: Keystore

  @Before
  fun setUp() {
    keystore = Keystore(alias = alias, requireUserAuth = false)
    keystore.deleteKey() // ensure clean slate
  }

  @Test
  fun wrapAndUnwrapRoundTrip() {
    keystore.generateKeyIfMissing()
    val plaintext = ByteArray(32) { it.toByte() }
    val wrapped = keystore.wrap(plaintext)
    val unwrapped = keystore.unwrap(wrapped)
    assertArrayEquals(plaintext, unwrapped)
  }

  @Test
  fun wrappedBytesContainsNonceAndTag() {
    keystore.generateKeyIfMissing()
    val wrapped = keystore.wrap(ByteArray(32))
    // layout = nonce(12) + ciphertext(32) + tag(16)
    assert(wrapped.size == 12 + 32 + 16)
  }

  @Test
  fun tamperingFailsDecryption() {
    keystore.generateKeyIfMissing()
    val wrapped = keystore.wrap(ByteArray(32) { 1 })
    wrapped[20] = (wrapped[20].toInt() xor 0xff).toByte() // flip a byte
    assertThrows(Exception::class.java) { keystore.unwrap(wrapped) }
  }

  @Test
  fun missingKeyThrowsOnWrap() {
    keystore.deleteKey()
    assertThrows(IllegalStateException::class.java) {
      keystore.wrap(ByteArray(32))
    }
  }
}
