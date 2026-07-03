package expo.modules.vaultsyncnative.autofill

import android.content.Context
import expo.modules.vaultsyncnative.VaultIO
import org.bouncycastle.crypto.modes.ChaCha20Poly1305
import org.bouncycastle.crypto.params.AEADParameters
import org.bouncycastle.crypto.params.KeyParameter
import java.security.SecureRandom

/**
 * Re-encrypts the vault after an in-service edit (e.g. save-new-login from an autofill prompt),
 * mirroring the JS write path: ChaCha20-Poly1305-IETF with the serialized header as AEAD
 * associated-data. A fresh random 12-byte nonce is generated on every save; all other header
 * fields (salt, argon2 params, hint, recovery section) are preserved byte-for-byte.
 * Output layout = newHeader || ciphertext || tag.
 */
class VaultEncryptor(private val ctx: Context) {

  /**
   * Re-encrypt the current vault with a caller-supplied master key. The key is already unwrapped by
   * the CryptoObject-bound BiometricPrompt (see [authenticateAndUnwrapMasterKey]); this helper does
   * NOT touch the Keystore and does NOT zero the caller-owned key. Holds the process-wide write lock
   * across the FULL read->modify->write so an interleaving JS persistVault (which also locks in
   * writeAtomic) can't land between our read and our write.
   */
  fun updateCurrentWithKey(masterKey: ByteArray, modifier: (String) -> String) {
    val io = VaultIO(ctx)
    synchronized(VaultIO.WRITE_LOCK) {
      val original = io.read("vault.enc")
      io.writeAtomic("vault.enc", reencrypt(original, masterKey, modifier))
    }
  }

  companion object {
    private const val NONCE_LEN = 12
    private const val KEY_LEN = 32
    private const val MAC_BITS = 128

    /**
     * Pure crypto: decrypt [originalBytes], apply [modifier] to the raw JSON, and re-encrypt.
     * A fresh random nonce replaces the old one; the rest of the header is preserved verbatim and
     * becomes the AEAD associated-data. Returns the new file bytes.
     */
    fun reencrypt(originalBytes: ByteArray, masterKey: ByteArray, modifier: (String) -> String): ByteArray {
      require(masterKey.size == KEY_LEN) { "master key must be $KEY_LEN bytes" }
      val layout = VaultDecryptor.parseLayout(originalBytes)
      val newJson = modifier(VaultDecryptor.decryptToJson(originalBytes, masterKey))

      // Rebuild the header: copy the original header, overwrite only its trailing nonce region.
      // serializeVaultHeader ends with vaultNonce, so the last NONCE_LEN header bytes ARE the nonce.
      val newHeader = originalBytes.copyOfRange(0, layout.headerEnd)
      val newNonce = ByteArray(NONCE_LEN).also { SecureRandom().nextBytes(it) }
      System.arraycopy(newNonce, 0, newHeader, newHeader.size - NONCE_LEN, NONCE_LEN)

      val cipherAndTag = aeadSeal(masterKey, newNonce, newHeader, newJson.toByteArray(Charsets.UTF_8))
      val out = ByteArray(newHeader.size + cipherAndTag.size)
      System.arraycopy(newHeader, 0, out, 0, newHeader.size)
      System.arraycopy(cipherAndTag, 0, out, newHeader.size, cipherAndTag.size)
      return out
    }

    /** BouncyCastle ChaCha20-Poly1305 seal. Returns ciphertext || tag. */
    private fun aeadSeal(key: ByteArray, nonce: ByteArray, aad: ByteArray, plaintext: ByteArray): ByteArray {
      val cipher = ChaCha20Poly1305()
      cipher.init(true, AEADParameters(KeyParameter(key), MAC_BITS, nonce, aad))
      val out = ByteArray(cipher.getOutputSize(plaintext.size))
      var len = cipher.processBytes(plaintext, 0, plaintext.size, out, 0)
      len += cipher.doFinal(out, len)
      return if (len == out.size) out else out.copyOf(len)
    }
  }
}
