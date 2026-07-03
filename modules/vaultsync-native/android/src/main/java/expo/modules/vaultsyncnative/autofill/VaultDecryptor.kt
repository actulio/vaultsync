package expo.modules.vaultsyncnative.autofill

import android.content.Context
import org.bouncycastle.crypto.modes.ChaCha20Poly1305
import org.bouncycastle.crypto.params.AEADParameters
import org.bouncycastle.crypto.params.KeyParameter

/**
 * Parsed byte offsets of a VLT1 vault file.
 *
 * [headerEnd] is both the ciphertext start offset AND the AAD length: the JS side authenticates
 * `bytes[0 until headerEnd]` (magic..vaultNonce inclusive) as AEAD associated-data.
 */
data class VaultLayout(
  val headerEnd: Int,
  val nonce: ByteArray,
  /** ciphertext || tag, i.e. `bytes[headerEnd until end]` — the input BouncyCastle expects. */
  val cipherAndTag: ByteArray,
)

/**
 * Decrypts the ChaCha20-Poly1305-IETF vault payload inside the autofill service process, where
 * neither libsodium nor JS is available. Uses the BouncyCastle lightweight AEAD API — the bundled
 * BC JCE provider is deprioritized/stripped on Android, and the lightweight API sidesteps that.
 *
 * Vault format (authoritative: src/vault/format.ts):
 *   MAGIC "VLT1"(4) | version(1)=1 | salt(16) | argon2Params(10) | hintLen(1) | hint(hintLen)
 *     | hasRecovery(1) | [recoveryWrappedKey(60) if hasRecovery==1] | vaultNonce(12)
 *     | ciphertext(var) | tag(16)
 * argon2Params (all little-endian): memoryKiB u32 | timeCost u16 | parallelism u16 | hashLen u16.
 */
class VaultDecryptor(private val ctx: Context) {

  companion object {
    private val MAGIC = byteArrayOf(0x56, 0x4c, 0x54, 0x31) // "VLT1"
    private const val VERSION_OFF = 4
    private const val SALT_LEN = 16
    private const val PARAMS_LEN = 10 // memoryKiB u32 + timeCost u16 + parallelism u16 + hashLen u16
    private const val NONCE_LEN = 12
    private const val TAG_LEN = 16
    private const val WRAPPED_KEY_LEN = 60
    private const val KEY_LEN = 32
    private const val MAC_BITS = 128

    // magic + version + salt + argon2 + hintLen(1) + hasRecovery(1) + nonce + tag, hint=0, no recovery
    private const val MIN_LEN = 4 + 1 + SALT_LEN + PARAMS_LEN + 1 + 1 + NONCE_LEN + TAG_LEN

    /** Parses the binary header, resolving hint/recovery variable-length regions. */
    fun parseLayout(bytes: ByteArray): VaultLayout {
      require(bytes.size >= MIN_LEN) { "vault file truncated" }
      for (i in MAGIC.indices) require(bytes[i] == MAGIC[i]) { "bad magic" }
      val version = bytes[VERSION_OFF].toInt() and 0xff
      require(version == 1) { "unsupported version: $version" }

      var o = 4 + 1 + SALT_LEN + PARAMS_LEN
      require(o < bytes.size) { "vault file truncated" }
      val hintLen = bytes[o].toInt() and 0xff; o += 1
      o += hintLen
      require(o < bytes.size) { "vault file truncated" }
      val hasRecovery = bytes[o].toInt() and 0xff; o += 1
      if (hasRecovery == 1) o += WRAPPED_KEY_LEN

      require(bytes.size >= o + NONCE_LEN + TAG_LEN) { "vault file truncated" }
      val nonce = bytes.copyOfRange(o, o + NONCE_LEN); o += NONCE_LEN
      val headerEnd = o // ciphertext start; AAD = bytes[0 until headerEnd]
      val cipherAndTag = bytes.copyOfRange(headerEnd, bytes.size)
      return VaultLayout(headerEnd, nonce, cipherAndTag)
    }

    /** Pure crypto: decrypt full file bytes with [masterKey] into the raw UTF-8 JSON string. */
    fun decryptToJson(fileBytes: ByteArray, masterKey: ByteArray): String {
      require(masterKey.size == KEY_LEN) { "master key must be $KEY_LEN bytes" }
      val layout = parseLayout(fileBytes)
      val aad = fileBytes.copyOfRange(0, layout.headerEnd) // header incl. nonce is the AAD
      return openWithAad(fileBytes, masterKey, aad)
    }

    /**
     * Test seam: decrypt with an explicitly supplied [aad]. Production always passes the header
     * bytes; instrumented tests pass `null` to prove AAD is enforced (tag verification must fail).
     */
    internal fun openWithAad(fileBytes: ByteArray, masterKey: ByteArray, aad: ByteArray?): String {
      require(masterKey.size == KEY_LEN) { "master key must be $KEY_LEN bytes" }
      val layout = parseLayout(fileBytes)
      return String(aeadOpen(masterKey, layout.nonce, aad, layout.cipherAndTag), Charsets.UTF_8)
    }

    /** Pure crypto: decrypt + parse into the autofill view. */
    fun decryptToView(fileBytes: ByteArray, masterKey: ByteArray): VaultJsonView =
      VaultJson.parse(decryptToJson(fileBytes, masterKey))

    /** BouncyCastle ChaCha20-Poly1305 open. Throws InvalidCipherTextException on tag mismatch. */
    private fun aeadOpen(key: ByteArray, nonce: ByteArray, aad: ByteArray?, cipherAndTag: ByteArray): ByteArray {
      val cipher = ChaCha20Poly1305()
      cipher.init(false, AEADParameters(KeyParameter(key), MAC_BITS, nonce, aad))
      val out = ByteArray(cipher.getOutputSize(cipherAndTag.size))
      var len = cipher.processBytes(cipherAndTag, 0, cipherAndTag.size, out, 0)
      len += cipher.doFinal(out, len)
      return if (len == out.size) out else out.copyOf(len)
    }
  }
}
