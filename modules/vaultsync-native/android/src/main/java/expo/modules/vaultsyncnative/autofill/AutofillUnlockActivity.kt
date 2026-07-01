package expo.modules.vaultsyncnative.autofill

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.service.autofill.FillResponse
import android.util.Log
import android.view.autofill.AutofillManager
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import expo.modules.vaultsyncnative.R

/**
 * Biometric-gated unlock triggered by [FillResponse.setAuthentication]. On success it decrypts the
 * vault, primes [VaultCacheHolder], and returns an (empty) authentication result so the platform
 * re-issues the fill request — which now hits the warm cache.
 *
 * Biometric contract mirrors the app's production hot-unlock path: a BARE BiometricPrompt (no
 * CryptoObject) followed by a SEPARATE Keystore unwrap inside [VaultDecryptor.decryptCurrent].
 * This is exactly what BiometricPromptActivity + unlockWithBiometric()/keystoreUnwrap do in the
 * main app. See task report — with the vault_kek key's setUserAuthenticationParameters(0, ...)
 * this decoupling is a pre-existing shared risk, not introduced here.
 */
class AutofillUnlockActivity : FragmentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    val canAuth = BiometricManager.from(this)
      .canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)
    if (canAuth != BiometricManager.BIOMETRIC_SUCCESS) {
      setResult(Activity.RESULT_CANCELED)
      finish()
      return
    }

    val exec = ContextCompat.getMainExecutor(this)
    val prompt = BiometricPrompt(this, exec, object : BiometricPrompt.AuthenticationCallback() {
      override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
        try {
          val view = VaultDecryptor(applicationContext).decryptCurrent()
          VaultCacheHolder.instance.put(view)
          val replyIntent = Intent().apply {
            putExtra(AutofillManager.EXTRA_AUTHENTICATION_RESULT, FillResponse.Builder().build())
          }
          setResult(Activity.RESULT_OK, replyIntent)
        } catch (e: Exception) {
          Log.w("VaultSync", "Autofill unlock failed", e)
          setResult(Activity.RESULT_CANCELED)
        }
        finish()
      }

      override fun onAuthenticationError(code: Int, msg: CharSequence) {
        setResult(Activity.RESULT_CANCELED)
        finish()
      }

      override fun onAuthenticationFailed() {
        // Single failed attempt; BiometricPrompt keeps its own retry UI open.
      }
    })

    prompt.authenticate(
      BiometricPrompt.PromptInfo.Builder()
        .setTitle(getString(R.string.autofill_unlock_title))
        .setSubtitle(getString(R.string.autofill_unlock_subtitle))
        .setNegativeButtonText(getString(android.R.string.cancel))
        .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
        .build(),
    )
  }
}
