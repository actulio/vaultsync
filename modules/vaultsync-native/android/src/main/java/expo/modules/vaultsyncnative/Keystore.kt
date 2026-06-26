package expo.modules.vaultsyncnative

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class Keystore(
  private val alias: String = "vault_kek",
  private val requireUserAuth: Boolean = true,
) {
  private val keystore: KeyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }

  fun keyExists(): Boolean = keystore.containsAlias(alias)

  fun deleteKey() {
    if (keystore.containsAlias(alias)) keystore.deleteEntry(alias)
  }

  fun generateKeyIfMissing() {
    if (keyExists()) return
    val gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
    val builder = KeyGenParameterSpec.Builder(
      alias,
      KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
    )
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .setKeySize(256)

    if (requireUserAuth) {
      builder
        .setUserAuthenticationRequired(true)
        .setInvalidatedByBiometricEnrollment(true)
      // SetUserAuthenticationParameters(0, AUTH_BIOMETRIC_STRONG) for per-op auth — defaults are fine.
    }
    gen.init(builder.build())
    gen.generateKey()
  }

  private fun getSecretKey(): SecretKey {
    val entry = keystore.getEntry(alias, null) as? KeyStore.SecretKeyEntry
      ?: throw IllegalStateException("Keystore key '$alias' not found")
    return entry.secretKey
  }

  /** Returns nonce(12) || ciphertext(N) || tag(16). */
  fun wrap(plaintext: ByteArray): ByteArray {
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.ENCRYPT_MODE, getSecretKey())
    val nonce = cipher.iv // Keystore generates a fresh IV per init
    val combined = cipher.doFinal(plaintext) // ciphertext || tag
    return nonce + combined
  }

  fun unwrap(wrapped: ByteArray): ByteArray {
    if (wrapped.size < 12 + 16) throw IllegalArgumentException("wrapped too short")
    val nonce = wrapped.copyOfRange(0, 12)
    val combined = wrapped.copyOfRange(12, wrapped.size)
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.DECRYPT_MODE, getSecretKey(), GCMParameterSpec(128, nonce))
    return cipher.doFinal(combined)
  }
}
