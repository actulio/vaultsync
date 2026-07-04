package expo.modules.vaultsyncnative.autofill

import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import expo.modules.vaultsyncnative.Keystore
import expo.modules.vaultsyncnative.VaultIO
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Shared CryptoObject-bound unwrap of the biometric-gated `vault_kek` master key for the two
 * autofill activities. Mirrors [expo.modules.vaultsyncnative.VaultsyncNativeModule.authenticateCipher]
 * (I2a, commit 9ace557): the BiometricPrompt is bound to the exact decrypt Cipher via a
 * [BiometricPrompt.CryptoObject], so the biometric auth authorizes THIS unwrap — no separate,
 * un-authorized Keystore call that would throw UserNotAuthenticatedException on real API-30+ devices.
 *
 * The wrapped blob format is `nonce(12) || ciphertext(N) || tag(16)`, identical to
 * [Keystore.wrap]/[Keystore.unwrap].
 *
 * Contract:
 *  - [onSuccess] receives the raw 32-byte master key and OWNS zeroing it (`fill(0)`).
 *  - [onError] fires on cancel / auth error / biometric-unavailable / not-opted-in (no wrapped key).
 *  - A one-shot [AtomicBoolean] guard guarantees success and error can never both fire.
 *  - Called from an Activity's main thread, so no `runOnUiThread` is needed (unlike the Module,
 *    whose caller came off a JS thread).
 */
fun authenticateAndUnwrapMasterKey(
  activity: FragmentActivity,
  title: String,
  subtitle: String?,
  onSuccess: (ByteArray) -> Unit,
  onError: () -> Unit,
) {
  val settled = AtomicBoolean(false)

  // I2b-D2: autofill only works when the user opted into biometric — masterKey.wrapped exists ONLY
  // then. Check up front and cancel cleanly rather than relying on the read/decrypt throwing.
  val io = VaultIO(activity.applicationContext)
  if (!io.exists("masterKey.wrapped")) {
    if (settled.compareAndSet(false, true)) onError()
    return
  }

  val wrapped = io.read("masterKey.wrapped")
  val nonce = wrapped.copyOfRange(0, 12)
  val combined = wrapped.copyOfRange(12, wrapped.size)

  val cipher = try {
    Keystore(alias = "vault_kek", requireUserAuth = true).newDecryptCipher(nonce)
  } catch (e: Exception) {
    if (settled.compareAndSet(false, true)) onError()
    return
  }

  val canAuth = BiometricManager.from(activity)
    .canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)
  if (canAuth != BiometricManager.BIOMETRIC_SUCCESS) {
    if (settled.compareAndSet(false, true)) onError()
    return
  }

  val prompt = BiometricPrompt(
    activity,
    ContextCompat.getMainExecutor(activity),
    object : BiometricPrompt.AuthenticationCallback() {
      override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
        if (!settled.compareAndSet(false, true)) return
        val authed = result.cryptoObject?.cipher ?: return onError()
        val masterKey = try {
          authed.doFinal(combined)
        } catch (e: Exception) {
          onError()
          return
        }
        onSuccess(masterKey)
      }

      override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
        if (!settled.compareAndSet(false, true)) return
        onError()
      }

      override fun onAuthenticationFailed() {
        // A single non-matching attempt; BiometricPrompt keeps its own retry UI open.
      }
    },
  )

  val promptInfo = BiometricPrompt.PromptInfo.Builder()
    .setTitle(title)
    .apply { if (subtitle != null) setSubtitle(subtitle) }
    .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
    .setNegativeButtonText(activity.getString(android.R.string.cancel))
    .build()

  try {
    prompt.authenticate(promptInfo, BiometricPrompt.CryptoObject(cipher))
  } catch (e: Exception) {
    if (settled.compareAndSet(false, true)) onError()
  }
}
