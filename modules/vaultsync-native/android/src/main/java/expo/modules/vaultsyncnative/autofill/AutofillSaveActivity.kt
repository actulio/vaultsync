package expo.modules.vaultsyncnative.autofill

import android.app.Activity
import android.app.AlertDialog
import android.os.Bundle
import android.util.Log
import androidx.fragment.app.FragmentActivity
import expo.modules.vaultsyncnative.R
import expo.modules.vaultsyncnative.VaultIO
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.util.UUID

/**
 * The autofill "save" flow (spec §6.5), launched by [VaultAutofillService.onSaveRequest] after the
 * user submits credentials in another app. Enforces the no-silent-overwrite policy: the decision is
 * computed by the pure [SavePolicy] and NOTHING is written without explicit confirmation (the only
 * write-free branch is an exact-credential no-op).
 *
 * Biometric contract: a CryptoObject-bound BiometricPrompt via [authenticateAndUnwrapMasterKey],
 * mirroring VaultsyncNativeModule.authenticateCipher (I2a). The biometric auth authorizes the exact
 * `vault_kek` decrypt Cipher, so both the decrypt-to-decide and the re-encrypt-to-write run on the
 * unwrapped master key — no separate, un-authorized Keystore call.
 *
 * Flow: warm cache -> decide immediately. Cold/expired cache -> CryptoObject BiometricPrompt FIRST
 * (locked-vault rule), then fill the cache and decide. Per I2b-D1 the cold-save path prompts ONCE:
 * the unwrapped key is held across the confirm dialog ([heldMasterKey]) and reused for the write, so
 * the write does not re-prompt. In the warm path the write prompts on demand. After any successful
 * write we enqueue a sync push and invalidate the cache.
 *
 * The dialog/biometric UI is not instrumentable; the testable core is [SavePolicy] + [SyncQueue].
 */
class AutofillSaveActivity : FragmentActivity() {
  // I2b-D1: in the cold-save path we hold the unwrapped master key across the confirm dialog and
  // reuse it for the write (one prompt total). Zeroed in onDestroy.
  private var heldMasterKey: ByteArray? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val pkg = intent.getStringExtra("packageName")
    val web = intent.getStringExtra("webDomain")
    val username = intent.getStringExtra("usernameValue").orEmpty()
    val password = intent.getStringExtra("passwordValue").orEmpty()

    // Nothing to save without a password value.
    if (password.isEmpty()) {
      finish()
      return
    }

    val cache = VaultCacheHolder.instance.get()
    if (cache != null) {
      decide(pkg, web, username, password)
    } else {
      // Locked/expired vault: authenticate FIRST, then fill the cold cache like the unlock path.
      authenticateAndUnwrapMasterKey(
        activity = this,
        title = getString(R.string.autofill_save_title),
        subtitle = null,
        onSuccess = { mk ->
          heldMasterKey = mk // I2b-D1: keep it for the write; do NOT zero yet (onDestroy zeros it).
          try {
            val view = VaultDecryptor.decryptToView(
              VaultIO(applicationContext).read("vault.enc"),
              mk,
            )
            VaultCacheHolder.instance.put(view)
            decide(pkg, web, username, password)
          } catch (e: Exception) {
            // Only abort silently if the vault genuinely cannot be decrypted (and log it).
            Log.w("VaultSync", "Autofill save: vault decrypt failed", e)
            finish()
          }
        },
        onError = {
          setResult(Activity.RESULT_CANCELED)
          finish()
        },
      )
    }
  }

  override fun onDestroy() {
    heldMasterKey?.fill(0) // T4: zero the held master key.
    super.onDestroy()
  }

  /**
   * Runs [action] with the unwrapped master key. Cold path reuses [heldMasterKey] (no re-prompt,
   * per I2b-D1). Warm path prompts on demand and zeros the key after the action.
   */
  private fun withMasterKey(action: (ByteArray) -> Unit) {
    val held = heldMasterKey
    if (held != null) {
      action(held) // onDestroy owns zeroing the held key.
    } else {
      authenticateAndUnwrapMasterKey(
        activity = this,
        title = getString(R.string.autofill_save_title),
        subtitle = null,
        onSuccess = { mk ->
          try {
            action(mk)
          } finally {
            mk.fill(0) // T4: zero the unwrapped master key after use.
          }
        },
        onError = {
          setResult(Activity.RESULT_CANCELED)
          finish()
        },
      )
    }
  }

  private fun decide(pkg: String?, web: String?, username: String, password: String) {
    val cache = VaultCacheHolder.instance.get() ?: run {
      finish()
      return
    }
    val matches = Matcher().match(cache.entries, pkg, web)
    when (val decision = SavePolicy.decide(matches, username, password)) {
      is SaveDecision.NoOp -> finish()
      is SaveDecision.SaveNew -> confirm(
        title = web ?: pkg ?: "?",
        message = getString(R.string.autofill_save_message),
        actionLabel = getString(R.string.autofill_save_new),
      ) { saveNew(pkg, web, username, password) }
      is SaveDecision.SaveAsNew -> confirm(
        title = web ?: pkg ?: "?",
        message = getString(R.string.autofill_save_message),
        actionLabel = getString(R.string.autofill_save_as_new),
      ) { saveNew(pkg, web, username, password) }
      is SaveDecision.UpdatePassword -> confirm(
        title = decision.entry.title,
        message = getString(
          R.string.autofill_update_message,
          decision.entry.title,
          maskExceptLast4(decision.entry.password),
          password,
        ),
        actionLabel = getString(R.string.autofill_update_password),
      ) { updatePassword(decision.entry.id, password) }
    }
  }

  private fun confirm(title: String, message: String, actionLabel: String, onConfirm: () -> Unit) {
    // Framework AlertDialog (no appcompat dep). Compose polish is out of v1 scope.
    // The positive button only kicks off onConfirm — the write path owns finish() (the warm-save
    // write is async once it goes through a fresh biometric prompt, so finishing here would race).
    AlertDialog.Builder(this)
      .setTitle(title)
      .setMessage(message)
      .setPositiveButton(actionLabel) { _, _ -> onConfirm() }
      .setNegativeButton(android.R.string.cancel) { _, _ -> finish() }
      .setOnCancelListener { finish() }
      .show()
  }

  /** Masks all but the last 4 chars, e.g. "abcdwxyz" -> "••••wxyz" (spec §6.5). */
  private fun maskExceptLast4(pw: String): String =
    if (pw.length <= 4) "•".repeat(pw.length) else "•".repeat(pw.length - 4) + pw.takeLast(4)

  private fun saveNew(pkg: String?, web: String?, username: String, password: String) {
    val now = Instant.now().toString()
    val newEntry = JSONObject().apply {
      put("id", UUID.randomUUID().toString())
      put("type", "login")
      put("title", web ?: pkg ?: "Untitled")
      put("username", username)
      put("password", password)
      if (pkg != null) put("packageNames", JSONArray().put(pkg))
      if (web != null) put("url", web)
      put("createdAt", now)
      put("updatedAt", now)
    }
    withMasterKey { mk ->
      VaultEncryptor(applicationContext).updateCurrentWithKey(mk) { json ->
        VaultJson.reserialize(json) { root ->
          // APPEND — never put(0, ...), which would destroy an existing entry.
          root.getJSONArray("entries").put(newEntry)
          root.put("updatedAt", now)
        }
      }
      afterWrite()
      finish()
    }
  }

  private fun updatePassword(id: String, password: String) {
    val now = Instant.now().toString()
    withMasterKey { mk ->
      VaultEncryptor(applicationContext).updateCurrentWithKey(mk) { json ->
        VaultJson.reserialize(json) { root ->
          val arr = root.getJSONArray("entries")
          for (i in 0 until arr.length()) {
            val e = arr.getJSONObject(i)
            if (e.optString("id") == id) {
              // Shape mirrors the TS side (src/vault/mutations.ts clearStalePreviousPasswords): the
              // 7-day cleanup keys off `updatedAt` and only requires `previousPassword` to be present.
              e.put("previousPassword", e.optString("password"))
              e.put("password", password)
              e.put("updatedAt", now)
            }
          }
          root.put("updatedAt", now)
        }
      }
      afterWrite()
      finish()
    }
  }

  /** After ANY successful write: enqueue a sync push and drop the (now-stale) cache. */
  private fun afterWrite() {
    // The vault write is already durable. A failure here (e.g. SQLITE_BUSY from enqueue) must not
    // crash the activity — a lost push row is recovered on the next main-app persist.
    try {
      SyncQueue.enqueuePush(applicationContext)
    } catch (e: Exception) {
      Log.w("VaultSync", "Autofill save: enqueue push failed (recovered on next persist)", e)
    }
    try {
      VaultCacheHolder.instance.invalidate()
    } catch (e: Exception) {
      Log.w("VaultSync", "Autofill save: cache invalidate failed", e)
    }
  }
}
