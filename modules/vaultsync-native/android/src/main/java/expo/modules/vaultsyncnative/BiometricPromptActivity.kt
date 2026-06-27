package expo.modules.vaultsyncnative

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity

class BiometricPromptActivity : FragmentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val title = intent.getStringExtra(EXTRA_TITLE) ?: "Authenticate"
    val subtitle = intent.getStringExtra(EXTRA_SUBTITLE) ?: ""

    val canAuth = BiometricManager.from(this)
      .canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)
    if (canAuth != BiometricManager.BIOMETRIC_SUCCESS) {
      setResult(RESULT_UNAVAILABLE)
      finish()
      return
    }

    val executor = ContextCompat.getMainExecutor(this)
    val prompt = BiometricPrompt(this, executor, object : BiometricPrompt.AuthenticationCallback() {
      override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
        setResult(Activity.RESULT_OK)
        finish()
      }
      override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
        val result = if (errorCode == BiometricPrompt.ERROR_USER_CANCELED ||
                        errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON) Activity.RESULT_CANCELED
                     else RESULT_FAILED
        setResult(result, Intent().putExtra(EXTRA_ERROR_CODE, errorCode))
        finish()
      }
      override fun onAuthenticationFailed() {
        // Failed single attempt; keep prompt open — BiometricPrompt handles retry UI.
      }
    })

    val promptInfo = BiometricPrompt.PromptInfo.Builder()
      .setTitle(title)
      .setSubtitle(subtitle)
      .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
      .setNegativeButtonText(getString(android.R.string.cancel))
      .build()
    prompt.authenticate(promptInfo)
  }

  companion object {
    const val EXTRA_TITLE = "biometric_title"
    const val EXTRA_SUBTITLE = "biometric_subtitle"
    const val EXTRA_ERROR_CODE = "biometric_error_code"
    const val RESULT_FAILED = Activity.RESULT_FIRST_USER + 1
    const val RESULT_UNAVAILABLE = Activity.RESULT_FIRST_USER + 2
  }
}
