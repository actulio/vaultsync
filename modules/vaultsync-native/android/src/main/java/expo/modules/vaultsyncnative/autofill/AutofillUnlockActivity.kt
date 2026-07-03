package expo.modules.vaultsyncnative.autofill

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.service.autofill.FillResponse
import android.util.Log
import android.view.autofill.AutofillManager
import androidx.fragment.app.FragmentActivity
import expo.modules.vaultsyncnative.R
import expo.modules.vaultsyncnative.VaultIO

/**
 * Biometric-gated unlock triggered by [FillResponse.setAuthentication]. On success it decrypts the
 * vault, primes [VaultCacheHolder], and returns an (empty) authentication result so the platform
 * re-issues the fill request — which now hits the warm cache.
 *
 * Biometric contract: a CryptoObject-bound BiometricPrompt via [authenticateAndUnwrapMasterKey],
 * mirroring the app's production hot-unlock path (VaultsyncNativeModule.authenticateCipher, I2a).
 * The biometric auth authorizes the exact `vault_kek` decrypt Cipher, so the master-key unwrap is
 * done on the authorized Cipher — no separate, un-authorized Keystore call that would throw
 * UserNotAuthenticatedException on real API-30+ devices.
 */
class AutofillUnlockActivity : FragmentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    authenticateAndUnwrapMasterKey(
      activity = this,
      title = getString(R.string.autofill_unlock_title),
      subtitle = getString(R.string.autofill_unlock_subtitle),
      onSuccess = { masterKey ->
        try {
          val view = VaultDecryptor.decryptToView(
            VaultIO(applicationContext).read("vault.enc"),
            masterKey,
          )
          VaultCacheHolder.instance.put(view)
          val replyIntent = Intent().apply {
            putExtra(AutofillManager.EXTRA_AUTHENTICATION_RESULT, FillResponse.Builder().build())
          }
          setResult(Activity.RESULT_OK, replyIntent)
        } catch (e: Exception) {
          Log.w("VaultSync", "Autofill unlock failed", e)
          setResult(Activity.RESULT_CANCELED)
        } finally {
          masterKey.fill(0) // T4: zero the unwrapped master key after use.
        }
        finish()
      },
      onError = {
        setResult(Activity.RESULT_CANCELED)
        finish()
      },
    )
  }
}
