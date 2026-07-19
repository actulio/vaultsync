# On-Device Verification — UX polish, lock restore & Drive sync

**Plan:** `docs/superpowers/plans/2026-07-18-ux-polish-lock-drive.md`
**Covers commits:** `132eb98..8f232cc` (Tasks 1–9)
**Date written:** 2026-07-18

---

## Why this document exists

Tasks 1–9 are complete with **315 passing tests, clean typecheck, clean lint**. That is not evidence the reported bugs are fixed.

Three things in this work are **provably unverified** and can only be settled on a physical device:

1. **The blank screen** — tests prove the redirect fires in a mocked router. They do not prove the screen you saw is gone.
2. **Drive sync** — tests prove failures surface. No test has ever talked to Google.
3. **The clipboard sensitive flag** — the Kotlin compiles and the instrumented test was written, but **`connectedAndroidTest` has never run**. No emulator or device was reachable during the entire build. This is the weakest claim in the whole changeset.

Until this checklist passes, treat the work as "implemented", not "working".

---

## Build and install

```bash
cd /Users/work/personal/random/vaultsync/android
JAVA_HOME=/opt/homebrew/opt/openjdk@17 ./gradlew assembleRelease \
  -PabiFilter=arm64-v8a \
  -Dorg.gradle.java.installations.paths="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

> `EXPO_PUBLIC_*` values are inlined at **build** time. This build is what picks up your `.env` — an existing APK will not.

If the build fails with a foojay / `JvmVendorSpec.IBM_SEMERU` error, a stale daemon is the cause: `./gradlew --stop`, then retry.

---

## First — run the instrumented tests

This is the one gate that was never run. **Connect the device, then:**

```bash
cd /Users/work/personal/random/vaultsync/android
JAVA_HOME=/opt/homebrew/opt/openjdk@17 ./gradlew :vaultsync-native:connectedAndroidTest
```

- [ ] All pass, including `ClipboardSensitiveTest`

A failure here means `EXTRA_IS_SENSITIVE` is not actually being set, and the clipboard retention window was tripled (30s → 2min) **without** the mitigation that justified it. That would be a reason to revert the retention change, not to ship.

---

## 1. The blank screen (the primary reported bug)

Settings → Auto-lock → **1 minute**.

- [ ] Open an entry. Background the app. Wait **>1 min**. Return.
      → **Expected:** the unlock screen. **Not** a blank list.
- [ ] Unlock.
      → **Expected:** you land back on **that same entry**, not the vault list.
- [ ] Repeat, but background from the vault list.
      → **Expected:** unlock screen, then back to the list.
- [ ] Repeat using **biometric** unlock rather than the password.
      → **Expected:** identical behaviour. (Restore is wired into both paths; this is the one that would break independently.)

---

## 2. Password reveal toggle

- [ ] Open an entry with a password. → **Expected:** masked (`••••••••`), eye icon present.
- [ ] Tap the eye. → **Expected:** real password shown, icon switches to eye-off, label reads "Ocultar senha".
- [ ] **Reveal the password, then background >1 min, return, unlock.**
      → **Expected:** back on the entry with the password **masked again**.

That last step is the security property. If the password is still visible after unlocking, the remount guarantee has broken — report it, do not work around it.

---

## 3. Clipboard (2-minute window)

- [ ] Copy a password. → **Expected:** toast reads "Copiado! Será limpo em 2 min".
- [ ] Paste into another app **within** 2 minutes. → **Expected:** pastes correctly.
- [ ] **Android 13+:** open the clipboard preview / suggestion strip in another app.
      → **Expected:** the password is **not** shown in the preview. This is `EXTRA_IS_SENSITIVE` working.
- [ ] Copy a password, switch to another app, wait **>2 min**, return to VaultSync, then switch away and try to paste.
      → **Expected:** clipboard no longer holds the password.

> **Known limitation, do not report as a bug:** the clear runs when VaultSync regains focus. Android forbids background clipboard access from Android 10 onward, so the old WorkManager clear almost certainly never fired. If you copy and then kill the app without returning, this app will not clear it — Android 13+'s own auto-clear is the backstop.

- [ ] Copy a password, then copy something else yourself (a phone number). Wait past 2 min, return to VaultSync.
      → **Expected:** your phone number is **still on the clipboard**. The app must only clear its own value.

---

## 4. Drive sync (the second reported bug)

OAuth is configured; `.env` holds the client ID; SHA-1 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` from `android/app/debug.keystore`.

- [ ] Open Settings → Sync **on a fresh install**.
      → **Expected:** status reads **"Nunca sincronizado"** (not "Sincronizado"), CTA reads **"Conectar Google Drive"** on the **first** render.

      Previously the CTA read "Sincronizar agora" and the first tap silently did nothing.

- [ ] Tap Connect → complete Google sign-in.
      → **Expected:** toast "Google Drive conectado." **and** the CTA changes to "Sincronizar agora".
- [ ] Tap Connect and then **cancel** the Google prompt.
      → **Expected:** toast "Conexão com o Google Drive não concluída." **No silent tap.** This was the last silent path found in review.
- [ ] Edit an entry, then Sync. Check Drive for `VaultSync/vault.enc` updating.
- [ ] Enable airplane mode, tap Sync.
      → **Expected:** an honest status and/or a branded dialog — never nothing.

---

## 5. Dialogs and toasts (Tasks 1–4)

All 14 stock Android alerts were replaced.

- [ ] Delete an entry. → **Expected:** a **branded** confirmation dialog, not the stock Android one. Cancel works; confirm deletes.
- [ ] Tap outside the dialog. → **Expected:** dismisses (counts as cancel, nothing deleted).
- [ ] Android **back button** with a dialog open. → **Expected:** dismisses as cancel.
- [ ] Copy from the generator, and from an entry. → **Expected:** brief non-blocking toast, no dialog to dismiss.
- [ ] Trigger an error (e.g. wrong password on unlock, or import a malformed CSV).
      → **Expected:** dialog titled **"Erro"** — in Portuguese. It previously said "Error" in English.

---

## 6. No regression in autofill

Autofill was heavily reworked in the previous plan and this one touched shared screens.

- [ ] Run the checks in `docs/TESTING-autofill.md`.
- [ ] While testing: `adb logcat | grep -i VaultSync`
      → **Expected:** no `UserNotAuthenticatedException`. A single occurrence means the I2 keystore fix regressed.

---

## Recording the result

Update `NEXT.md` with what passed, what failed, and **what you did not get to**. An unrun check is not a passing check.

If `connectedAndroidTest` did not run, say so explicitly — the sensitive-flag claim stays unproven, and the clipboard retention change should be reconsidered on that basis.
