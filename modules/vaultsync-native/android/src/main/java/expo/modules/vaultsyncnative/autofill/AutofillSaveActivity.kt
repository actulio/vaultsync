package expo.modules.vaultsyncnative.autofill

import android.app.Activity
import android.app.AlertDialog
import android.os.Bundle
import android.util.Log
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import expo.modules.vaultsyncnative.R
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
 * Flow: warm cache -> decide immediately. Cold/expired cache -> BiometricPrompt FIRST (locked-vault
 * rule), then fill the cache exactly like [AutofillUnlockActivity] (decryptCurrent -> cache.put,
 * same try/catch + Log.w contract), then decide. After any successful write we enqueue a sync push
 * and invalidate the cache.
 *
 * The dialog/biometric UI is not instrumentable; the testable core is [SavePolicy] + [SyncQueue].
 */
class AutofillSaveActivity : FragmentActivity() {
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
      authenticateThen {
        try {
          val view = VaultDecryptor(applicationContext).decryptCurrent()
          VaultCacheHolder.instance.put(view)
          decide(pkg, web, username, password)
        } catch (e: Exception) {
          // Only abort silently if the vault genuinely cannot be decrypted (and log it).
          Log.w("VaultSync", "Autofill save: vault decrypt failed", e)
          finish()
        }
      }
    }
  }

  private fun authenticateThen(action: () -> Unit) {
    val canAuth = BiometricManager.from(this)
      .canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)
    if (canAuth != BiometricManager.BIOMETRIC_SUCCESS) {
      setResult(Activity.RESULT_CANCELED)
      finish()
      return
    }
    val prompt = BiometricPrompt(this, ContextCompat.getMainExecutor(this),
      object : BiometricPrompt.AuthenticationCallback() {
        override fun onAuthenticationSucceeded(r: BiometricPrompt.AuthenticationResult) {
          action()
        }

        override fun onAuthenticationError(code: Int, msg: CharSequence) {
          setResult(Activity.RESULT_CANCELED)
          finish()
        }
      })
    prompt.authenticate(
      BiometricPrompt.PromptInfo.Builder()
        .setTitle(getString(R.string.autofill_save_title))
        .setNegativeButtonText(getString(android.R.string.cancel))
        .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
        .build(),
    )
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
    AlertDialog.Builder(this)
      .setTitle(title)
      .setMessage(message)
      .setPositiveButton(actionLabel) { _, _ -> onConfirm(); finish() }
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
    VaultEncryptor(applicationContext).updateCurrent { json ->
      VaultJson.reserialize(json) { root ->
        // APPEND — never put(0, ...), which would destroy an existing entry.
        root.getJSONArray("entries").put(newEntry)
        root.put("updatedAt", now)
      }
    }
    afterWrite()
  }

  private fun updatePassword(id: String, password: String) {
    val now = Instant.now().toString()
    VaultEncryptor(applicationContext).updateCurrent { json ->
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
  }

  /** After ANY successful write: enqueue a sync push and drop the (now-stale) cache. */
  private fun afterWrite() {
    SyncQueue.enqueuePush(applicationContext)
    VaultCacheHolder.instance.invalidate()
  }
}
