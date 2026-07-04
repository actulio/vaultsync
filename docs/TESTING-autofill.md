# On-device autofill test checklist (I2b + general flow)

Verifies the Android Autofill Framework flow and the **I2b** CryptoObject biometric fix.
The I2b fix (binding the `vault_kek` unwrap to `BiometricPrompt.CryptoObject`) **only proves out on a
physical API-30+ device with enrolled biometrics** — an emulator does not enforce the auth-per-use key,
so it exercises the flow but cannot prove the `UserNotAuthenticatedException` fix.

Component under test: service `com.vaultsync.app/expo.modules.vaultsyncnative.autofill.VaultAutofillService`.

## 0. Prep

- [ ] Device: physical, API 30+, with a screen lock (PIN/pattern) **and** an enrolled fingerprint/face.
- [ ] Install debug build:
  ```
  cd android && JAVA_HOME="$(/usr/libexec/java_home -v 17 2>/dev/null || echo /opt/homebrew/opt/openjdk@17)" \
    ANDROID_HOME="$HOME/Library/Android/sdk" ./gradlew installDebug
  ```
  (or `npx expo run:android`)
- [ ] Open VaultSync → complete onboarding (create a vault with a password).
- [ ] **Enable biometric unlock** (onboarding biometric screen, or Settings → biometric). REQUIRED —
      autofill only works when `masterKey.wrapped` exists (I2b-D2). Confirm a system biometric prompt appears here.
- [ ] Add ≥1 login entry (username + password) for a site/app you can reach (e.g. a test login page).
- [ ] Start a logcat tail in a second terminal: `adb logcat | grep -i VaultSync`
      — watch for `UserNotAuthenticatedException` (must NOT appear) and `Autofill unlock failed` / `Autofill save:` lines.

## 1. Select VaultSync as the autofill service

There is (currently) no in-app shortcut — do it manually or via adb:
- UI: Settings → *Passwords, passkeys & accounts* → *Autofill service* (OEM wording varies) → **VaultSync**.
- adb: `adb shell settings put secure autofill_service com.vaultsync.app/expo.modules.vaultsyncnative.autofill.VaultAutofillService`
- [ ] Confirm active: `adb shell settings get secure autofill_service` → prints the component above.

## 2. FILL — unlock path (AutofillUnlockActivity)

- [ ] Cold vault (kill/relock the app first): open a login form in another app/Chrome → tap the username field →
      a "VaultSync / Unlock" suggestion appears → tap it → **biometric prompt** → on success the username/password fill.
      **PASS = fields fill, no `UserNotAuthenticatedException` in logcat.**
- [ ] Warm vault (repeat within 5 min): tapping the field fills **without** a prompt (warm cache hit).
- [ ] logcat shows no `Autofill unlock failed`.

## 3. SAVE — save path (AutofillSaveActivity)

- [ ] Cold vault: in a target app/site, type a **new** login (not in the vault) and submit → "Save to VaultSync?" →
      **exactly ONE biometric prompt** (I2b-D1) → save-confirm dialog → Confirm → entry appears in the vault.
- [ ] Warm vault: same, but the biometric prompt comes at the write step (still exactly one). Entry appears.
- [ ] Update case: submit a login whose username matches an existing entry but with a new password →
      the confirm dialog shows the "update password" message (masked old + new) → Confirm → entry's password updated,
      `previousPassword` recorded.
- [ ] No-op case: submit credentials identical to an existing entry → no dialog, nothing written (silent no-op).

## 4. Opt-in guard (I2b-D2)

- [ ] Disable biometric (Settings → biometric → disable) **or** use a fresh password-only vault (never enabled biometric).
- [ ] Trigger autofill on a login field → VaultSync must **cancel cleanly** (no fill offered / no unlock) — **no crash**.
      logcat shows no unhandled exception.

## 5. Regression sanity (optional, not I2b-specific)

- [ ] Fallback notification: focus a field for an app/site with no saved login → a "No saved login…" notification fires
      (once per app per hour), tapping it deep-links into vault search.

## Result

- Date / device / Android version: __________
- FILL cold ⬜ / warm ⬜  · SAVE cold-1-prompt ⬜ / warm-1-prompt ⬜ / update ⬜ / no-op ⬜  · opt-in guard ⬜
- `UserNotAuthenticatedException` seen? **NO** ⬜  (any YES = I2b fix regressed)
- Notes:
