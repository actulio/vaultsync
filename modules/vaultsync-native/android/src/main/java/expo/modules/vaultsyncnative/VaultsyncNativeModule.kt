package expo.modules.vaultsyncnative

import android.content.Intent
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import java.util.concurrent.atomic.AtomicBoolean
import javax.crypto.Cipher

class VaultsyncNativeModule : Module() {
  private val keystore = Keystore(alias = "vault_kek", requireUserAuth = true)

  /**
   * Run a Keystore crypto op behind a CryptoObject-bound BiometricPrompt.
   * The biometric auth authorizes this exact Cipher; [onSuccess] receives the
   * authorized Cipher and must perform doFinal on it. The prompt is created and
   * shown on the UI thread (required by BiometricPrompt); the callback runs on
   * the main executor, so resolving/rejecting the Expo promise from there is
   * safe. A one-shot guard prevents resolving/rejecting the promise twice.
   */
  private fun authenticateCipher(
    activity: FragmentActivity,
    cipher: Cipher,
    onSuccess: (Cipher) -> Unit,
    onError: (code: String, message: String) -> Unit,
  ) {
    val settled = AtomicBoolean(false)
    activity.runOnUiThread {
      val canAuth = BiometricManager.from(activity)
        .canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)
      if (canAuth != BiometricManager.BIOMETRIC_SUCCESS) {
        if (settled.compareAndSet(false, true)) {
          onError("E_KEYSTORE_BIOMETRIC_UNAVAILABLE", "Biometric authentication unavailable (status $canAuth)")
        }
        return@runOnUiThread
      }
      val executor = ContextCompat.getMainExecutor(activity)
      val prompt = BiometricPrompt(activity, executor, object : BiometricPrompt.AuthenticationCallback() {
        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
          if (!settled.compareAndSet(false, true)) return
          val authed = result.cryptoObject?.cipher
          if (authed == null) {
            onError("E_KEYSTORE_NO_CIPHER", "Authenticated result had no cipher")
            return
          }
          try {
            onSuccess(authed)
          } catch (e: Exception) {
            onError("E_KEYSTORE_CRYPTO", e.message ?: "crypto operation failed")
          }
        }

        override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
          if (!settled.compareAndSet(false, true)) return
          val code = if (errorCode == BiometricPrompt.ERROR_USER_CANCELED ||
                         errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON) {
            "E_KEYSTORE_CANCELED"
          } else {
            "E_KEYSTORE_AUTH"
          }
          onError(code, errString.toString())
        }

        override fun onAuthenticationFailed() {
          // A single non-matching attempt; keep the prompt open for retry.
        }
      })
      val promptInfo = BiometricPrompt.PromptInfo.Builder()
        .setTitle("Unlock VaultSync")
        .setSubtitle("Confirm it's you")
        .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
        .setNegativeButtonText(activity.getString(android.R.string.cancel))
        .build()
      try {
        prompt.authenticate(promptInfo, BiometricPrompt.CryptoObject(cipher))
      } catch (e: Exception) {
        if (settled.compareAndSet(false, true)) {
          onError("E_KEYSTORE_AUTH", e.message ?: "failed to start biometric prompt")
        }
      }
    }
  }

  override fun definition() = ModuleDefinition {
    Name("VaultsyncNative")

    AsyncFunction("generateKeystoreKeyIfMissing") { promise: Promise ->
      try {
        keystore.generateKeyIfMissing()
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("E_KEYSTORE_GEN", e.message ?: "keystore key generation failed", e)
      }
    }

    AsyncFunction("keystoreKeyExists") { promise: Promise ->
      try {
        promise.resolve(keystore.keyExists())
      } catch (e: Exception) {
        promise.reject("E_KEYSTORE_EXISTS", e.message ?: "keystore check failed", e)
      }
    }

    AsyncFunction("deleteKeystoreKey") { promise: Promise ->
      try {
        keystore.deleteKey()
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("E_KEYSTORE_DEL", e.message ?: "delete failed", e)
      }
    }

    // vault_kek is an auth-per-use AndroidKeyStore key: each crypto op must be
    // authorized by a fresh BIOMETRIC_STRONG auth bound via a CryptoObject.
    // wrap/unwrap therefore show a system BiometricPrompt and finish the op on
    // the authorized Cipher. The wrapped-blob format stays identical to the raw
    // Keystore.wrap()/unwrap(): nonce(12) || ciphertext(N) || tag(16).

    AsyncFunction("keystoreWrap") { plaintext: ByteArray, promise: Promise ->
      val activity = appContext.currentActivity as? FragmentActivity
      if (activity == null) {
        promise.reject("E_KEYSTORE_NO_ACTIVITY", "No foreground FragmentActivity for biometric prompt", null)
        return@AsyncFunction
      }
      val cipher = try {
        keystore.newEncryptCipher()
      } catch (e: Exception) {
        promise.reject("E_KEYSTORE_WRAP", e.message ?: "wrap init failed", e)
        return@AsyncFunction
      }
      authenticateCipher(
        activity,
        cipher,
        onSuccess = { authed -> promise.resolve(keystore.finishWrap(authed, plaintext)) },
        onError = { code, message -> promise.reject(code, message, null) },
      )
    }

    AsyncFunction("keystoreUnwrap") { wrapped: ByteArray, promise: Promise ->
      val activity = appContext.currentActivity as? FragmentActivity
      if (activity == null) {
        promise.reject("E_KEYSTORE_NO_ACTIVITY", "No foreground FragmentActivity for biometric prompt", null)
        return@AsyncFunction
      }
      if (wrapped.size < 12 + 16) {
        promise.reject("E_KEYSTORE_UNWRAP", "wrapped too short", null)
        return@AsyncFunction
      }
      val nonce = wrapped.copyOfRange(0, 12)
      val combined = wrapped.copyOfRange(12, wrapped.size)
      val cipher = try {
        keystore.newDecryptCipher(nonce)
      } catch (e: Exception) {
        promise.reject("E_KEYSTORE_UNWRAP", e.message ?: "unwrap init failed", e)
        return@AsyncFunction
      }
      authenticateCipher(
        activity,
        cipher,
        onSuccess = { authed -> promise.resolve(authed.doFinal(combined)) },
        onError = { code, message -> promise.reject(code, message, null) },
      )
    }

    val vaultIO = VaultIO(appContext.reactContext!!)

    AsyncFunction("vaultRead") { name: String, promise: Promise ->
      try {
        promise.resolve(vaultIO.read(name))
      } catch (e: Exception) {
        promise.reject("E_VAULT_READ", e.message ?: "read failed", e)
      }
    }

    AsyncFunction("vaultWrite") { name: String, bytes: ByteArray, promise: Promise ->
      try {
        vaultIO.writeAtomic(name, bytes)
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("E_VAULT_WRITE", e.message ?: "write failed", e)
      }
    }

    AsyncFunction("vaultExists") { name: String, promise: Promise ->
      try {
        promise.resolve(vaultIO.exists(name))
      } catch (e: Exception) {
        promise.reject("E_VAULT_EXISTS", e.message ?: "exists check failed", e)
      }
    }

    AsyncFunction("vaultDelete") { name: String, promise: Promise ->
      try {
        vaultIO.delete(name)
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("E_VAULT_DELETE", e.message ?: "delete failed", e)
      }
    }

    val biometric = BiometricModule(this@VaultsyncNativeModule)

    AsyncFunction("promptBiometric") { title: String, subtitle: String, promise: Promise ->
      biometric.prompt(title, subtitle, promise)
    }

    val clipboard = ClipboardModule(appContext.reactContext!!)

    AsyncFunction("scheduleClipboardClear") { expected: String, delaySeconds: Double, promise: Promise ->
      clipboard.scheduleClear(expected, delaySeconds.toLong())
      promise.resolve(null)
    }

    AsyncFunction("cancelClipboardClear") { promise: Promise ->
      clipboard.cancelPending()
      promise.resolve(null)
    }

    AsyncFunction("copyToClipboard") { text: String, promise: Promise ->
      clipboard.copySensitive(text)
      promise.resolve(null)
    }

    val autofill = AutofillEnabler(appContext.reactContext!!)

    AsyncFunction("isAutofillSupported") { promise: Promise ->
      promise.resolve(autofill.isSupported())
    }

    AsyncFunction("isAutofillServiceEnabled") { promise: Promise ->
      promise.resolve(autofill.isEnabled())
    }

    AsyncFunction("requestSetAutofillService") { promise: Promise ->
      autofill.requestEnable(appContext.currentActivity)
      promise.resolve(null)
    }

    OnActivityResult { _, payload ->
      biometric.onActivityResult(payload.requestCode, payload.resultCode, payload.data)
    }
  }
}
