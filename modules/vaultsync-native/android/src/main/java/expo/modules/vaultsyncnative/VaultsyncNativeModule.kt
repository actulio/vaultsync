package expo.modules.vaultsyncnative

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
      promise.resolve(keystore.keyExists())
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
  }
}
