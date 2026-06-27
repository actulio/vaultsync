package expo.modules.vaultsyncnative

import android.content.Intent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise

class VaultsyncNativeModule : Module() {
  private val keystore = Keystore(alias = "vault_kek", requireUserAuth = true)

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

    // wrap and unwrap are added in this task, but in production they are
    // gated by a BiometricPrompt — the prompt activity is added in Plan 2.
    // Plan 1 exposes the raw operations so JS can integration-test in a
    // dev-build context. They will be wrapped by the biometric activity later.

    AsyncFunction("keystoreWrap") { plaintext: ByteArray, promise: Promise ->
      try {
        promise.resolve(keystore.wrap(plaintext))
      } catch (e: Exception) {
        promise.reject("E_KEYSTORE_WRAP", e.message ?: "wrap failed", e)
      }
    }

    AsyncFunction("keystoreUnwrap") { wrapped: ByteArray, promise: Promise ->
      try {
        promise.resolve(keystore.unwrap(wrapped))
      } catch (e: Exception) {
        promise.reject("E_KEYSTORE_UNWRAP", e.message ?: "unwrap failed", e)
      }
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

    OnActivityResult { _, payload ->
      biometric.onActivityResult(payload.requestCode, payload.resultCode, payload.data)
    }
  }

  fun startActivityForResult(intent: Intent, requestCode: Int) {
    appContext.currentActivity?.startActivityForResult(intent, requestCode)
  }
}
