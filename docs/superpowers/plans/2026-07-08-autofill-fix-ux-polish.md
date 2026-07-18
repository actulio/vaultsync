# Autofill Fill Fix + UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the release-blocking autofill bug (biometric unlock succeeds but nothing fills) and clear a 4-item UX punch list from on-device testing.

**Architecture:** Task 1 is native Kotlin (the autofill authentication result must carry real datasets, not an empty FillResponse). Tasks 2–4 are React Native screens (copy feedback + a compact biometric control). Task 5 restyles a native confirmation dialog. All five are independent (different files).

**Tech Stack:** Expo dev-client (SDK 56), React Native New Architecture (Bridgeless), Kotlin autofill service (`modules/vaultsync-native`), jest-expo + RNTL for JS, connectedAndroidTest for native, `src/theme` tokens, i18n via `addNamespace` (PT default + EN).

## Global Constraints

- **Package manager: pnpm** (never npm). Gates, run ALL THREE per task: `pnpm test`, `pnpm run typecheck`, `pnpm run lint` (lint MUST be 0).
- **Styling:** `src/theme` tokens only (`useTheme()` → `{ colors, spacing, radii, sizes, type }`). NO NativeWind, NO `className`, NO inline hex/sizes.
- **i18n:** PT default + EN. New strings via existing namespaces (extend `src/i18n/registerUiNamespaces.ts`). Test screens with the longer PT strings. Do NOT edit `initI18n`.
- **Native:** changes under `modules/vaultsync-native` require a gradle build + `:vaultsync-native:connectedAndroidTest` on the running emulator (`emulator-5554`). Env: `JAVA_HOME=/opt/homebrew/opt/openjdk@17`, `ANDROID_HOME=/opt/homebrew/share/android-commandlinetools`. Run gradle/adb via context-mode `ctx_execute` (Bash blocks `gradlew`). Avoid `prebuild --clean`.
- **Commits:** commit directly to `main` (P2-D1). One commit per task minimum.
- **Crypto/AEAD parity:** do not alter the ChaCha20-Poly1305-IETF / header-AAD decrypt path; reuse `VaultDecryptor.decryptToView`.
- Baseline at plan start: 250 tests (48 suites), typecheck 0, lint 0, HEAD `370e5b2`.

---

### Task 1: Autofill returns real datasets after biometric unlock (RELEASE BLOCKER)

**Root cause:** `AutofillUnlockActivity.onSuccess` returns `FillResponse.Builder().build()` (empty). Android does NOT re-issue `onFillRequest` after authentication — it applies the returned FillResponse directly, so nothing fills. The activity must return a *populated* FillResponse built from the just-decrypted vault.

**Files:**
- Modify: `modules/vaultsync-native/android/src/main/java/expo/modules/vaultsyncnative/autofill/VaultAutofillService.kt` (`buildUnlockResponse`, and extract dataset building)
- Modify: `modules/vaultsync-native/android/src/main/java/expo/modules/vaultsyncnative/autofill/AutofillUnlockActivity.kt` (build populated response on success)
- Create: `modules/vaultsync-native/android/src/main/java/expo/modules/vaultsyncnative/autofill/AutofillResponses.kt` (shared dataset builder)
- Test: `modules/vaultsync-native/android/src/androidTest/java/expo/modules/vaultsyncnative/AutofillResponsesTest.kt`

**Interfaces:**
- Consumes: `Matcher().match(entries, packageName, webDomain): List<EntryView>`; `EntryView(id, title, username, password, ...)` (see `Matcher.kt:3`); `VaultDecryptor.decryptToView(bytes, masterKey): VaultJsonView` (`.entries`); `DetectedFields(usernameId: AutofillId?, passwordId: AutofillId)`; `VaultCacheHolder.instance`.
- Produces: `AutofillResponses.buildDatasets(context, detected, matches): FillResponse` — the single source of dataset construction used by BOTH the warm-cache service path and the post-unlock activity path.

- [ ] **Step 1: Extract the shared dataset builder (refactor, no behavior change yet).**
  Create `AutofillResponses.kt` with an `object AutofillResponses` exposing:
  ```kotlin
  fun buildDatasets(
    context: Context,
    detected: DetectedFields,
    matches: List<EntryView>,
    saveInfo: SaveInfo?,
  ): FillResponse
  ```
  Move the body of `VaultAutofillService.buildFillResponse` (lines ~139–154) into it verbatim (the `for (e in matches)` loop building `Dataset.Builder(RemoteViews(context.packageName, android.R.layout.simple_list_item_2))` with `ds.setValue(usernameId, forText(username))` guarded by `?.let`, `ds.setValue(passwordId, forText(password))`), taking `saveInfo` as a param instead of calling the private `buildSaveInfo`. Then change `VaultAutofillService.buildFillResponse` to delegate: `AutofillResponses.buildDatasets(this, detected, matches, buildSaveInfo(detected))`.

- [ ] **Step 2: Write the failing instrumented test.**
  In `AutofillResponsesTest.kt`, assert the builder produces one dataset per match. Since `FillResponse`/`Dataset` internals are opaque, extract and test the *pure* mapping the builder relies on — add `fun datasetValues(detected: DetectedFields, e: EntryView): List<Pair<AutofillId, String>>` to `AutofillResponses` (returns `[usernameId→username (if id != null), passwordId→password]`) and assert:
  ```kotlin
  @Test fun mapsUsernameAndPasswordWhenBothIdsPresent() {
    val u = AutofillId... ; val p = AutofillId...   // obtain via a test View in instrumentation
    val pairs = AutofillResponses.datasetValues(DetectedFields(u, p), entry("t","user","pw"))
    assertEquals(listOf(u to "user", p to "pw"), pairs)
  }
  @Test fun omitsUsernameWhenIdNull() {
    val p = ...
    val pairs = AutofillResponses.datasetValues(DetectedFields(null, p), entry("t","user","pw"))
    assertEquals(listOf(p to "pw"), pairs)
  }
  ```
  Have `buildDatasets` call `datasetValues` so the tested mapping is the real one.

- [ ] **Step 3: Run the test, verify it fails** (`datasetValues` undefined). Command via ctx_execute: `cd android && ./gradlew :vaultsync-native:connectedAndroidTest --tests '*AutofillResponsesTest*'`. Expected: compile error / FAIL.

- [ ] **Step 4: Implement `datasetValues` and wire `buildDatasets` to it.** Run the test → PASS.

- [ ] **Step 5: Pass field context into the unlock PendingIntent.**
  In `VaultAutofillService.buildUnlockResponse`, before creating the PendingIntent, attach extras to the intent (mirror the AutofillSaveActivity pattern at the bottom of `onSaveRequest`):
  ```kotlin
  val intent = Intent(this, AutofillUnlockActivity::class.java).apply {
    putExtra("usernameId", detected.usernameId)      // AutofillId is Parcelable
    putExtra("passwordId", detected.passwordId)
    putExtra("packageName", /* structure package */ pkgForUnlock)
    putExtra("webDomain", webDomainForUnlock)
  }
  ```
  `buildUnlockResponse` currently takes only `detected`; extend it to also accept `packageName: String?` and `webDomain: String?` and pass them from `onFillRequest` (both already computed there). Keep `FLAG_MUTABLE` (the platform adds `EXTRA_AUTHENTICATION_RESULT`).

- [ ] **Step 6: Build the populated response in the activity.**
  In `AutofillUnlockActivity.onSuccess`, after `VaultCacheHolder.instance.put(view)`:
  ```kotlin
  val detected = DetectedFields(
    intent.getParcelableExtra("usernameId"),
    intent.getParcelableExtra("passwordId")!!,
  )
  val matches = Matcher().match(view.entries, intent.getStringExtra("packageName"), intent.getStringExtra("webDomain"))
  val response = AutofillResponses.buildDatasets(applicationContext, detected, matches, null)
  val replyIntent = Intent().putExtra(AutofillManager.EXTRA_AUTHENTICATION_RESULT, response)
  setResult(Activity.RESULT_OK, replyIntent)
  ```
  If `matches` is empty, still return the (empty) response (nothing to fill is correct then) — but the warm cache is primed so a subsequent field tap works. Update the stale class KDoc (lines 13–16) to describe returning the real datasets, not relying on a re-issued request.

- [ ] **Step 7: Run the full native suite + build.** `./gradlew :vaultsync-native:connectedAndroidTest` (expect prior 95 + new pass) and `:app:assembleDebug` SUCCESSFUL. Run `pnpm test && pnpm run typecheck && pnpm run lint` (unchanged JS: 250/0/0).

- [ ] **Step 8: Commit** `fix(autofill): return populated datasets from unlock activity so fields fill after biometric`.

**On-device (deferred, not part of this task's gate):** cold unlock → fills; no `UserNotAuthenticatedException`.

---

### Task 2: Recovery-code copy actually copies + shows confirmation

**Files:**
- Modify: `app/(onboarding)/recovery-code.tsx` (copy handler + confirmation)
- Modify (if a recovery code is shown there too): `app/recovery-unlock.tsx` — only if it has a broken copy affordance; otherwise leave.
- Test: colocated screen test (mirror existing onboarding screen tests, e.g. `app/(onboarding)/__tests__/` if present, else the repo's screen-test location).

**Interfaces:**
- Consumes: `expo-clipboard` `setStringAsync`, `Alert` from `react-native`, `useTheme`, i18n `t`.

- [ ] **Step 1: Reproduce/confirm the bug** — read `recovery-code.tsx`; the copy `Pressable`/button's `onPress` is a no-op or missing the clipboard call. Note exact handler.
- [ ] **Step 2: Write the failing test** — render the screen, press the copy control (`getByRole('button', {name: <copy label>})`), assert `Clipboard.setStringAsync` was called with the recovery code and that the confirmation (`Alert.alert`) fired. Mock `expo-clipboard` and spy on `Alert.alert`.
- [ ] **Step 3: Run test, verify it fails.** `pnpm test -- recovery-code`.
- [ ] **Step 4: Implement** — `onPress={() => { void Clipboard.setStringAsync(code); Alert.alert(t('recovery.copied')); }}`. Recovery code is not auto-cleared (user must store it), so use `setStringAsync` directly, NOT `copyAndScheduleClear`. Add i18n `recovery.copied` (PT: "Código copiado" / EN: "Recovery code copied") in the recovery namespace in `registerUiNamespaces.ts`.
- [ ] **Step 5: Run test → PASS**, then `pnpm run typecheck && pnpm run lint`.
- [ ] **Step 6: Commit** `fix(recovery): copy recovery code to clipboard with confirmation`.

---

### Task 3: Generator copy — add copy icon + confirmation

**Files:**
- Modify: `app/(app)/(tabs)/generator.tsx` (copy button: add icon, add confirmation)
- Test: colocated generator screen test (mirror existing tabs tests).

**Interfaces:**
- Consumes: `copyAndScheduleClear` (already imported), `Alert`, `useTheme`, the app's icon approach (check imports across screens first — reuse whatever icon set/lib is already used; if none exists, use a minimal inline glyph consistent with theme, no new dependency).

- [ ] **Step 1: Read `generator.tsx`** — the copy `Pressable` (`styles.copyBtn`) currently copies via `copyAndScheduleClear` but gives no user feedback and has no icon.
- [ ] **Step 2: Write the failing test** — press Copy, assert `copyAndScheduleClear` called with the current password AND `Alert.alert` fired with the copied confirmation; assert the copy control renders its icon (by `accessibilityLabel` or testID).
- [ ] **Step 3: Run test, verify it fails.** `pnpm test -- generator`.
- [ ] **Step 4: Implement** — add `Alert.alert(t('generator.copied'))` after copy; add a copy icon inside the button (reuse existing icon set; give it `accessibilityLabel`). Add i18n `generator.copied` (PT: "Senha copiada" / EN: "Password copied"). Keep the 30s auto-clear (generator password IS sensitive).
- [ ] **Step 5: Run test → PASS**, then typecheck + lint.
- [ ] **Step 6: Commit** `feat(generator): copy icon + copied confirmation`.

---

### Task 4: Compact biometric control on the unlock screen

**Files:**
- Modify: `app/unlock.tsx` (replace the large "use biometrics" button with a small icon button beside the primary Unlock action)
- Test: `app/__tests__/unlock*` or the existing unlock screen test.

**Interfaces:**
- Consumes: the existing biometric trigger handler already wired in `unlock.tsx` (reuse it — do NOT change the biometric flow, only its presentation), `useTheme`, icon set.

- [ ] **Step 1: Read `unlock.tsx`** — locate the current biometric button and the primary Unlock button; note the biometric onPress handler and the condition gating biometric visibility (only shown when biometric enabled).
- [ ] **Step 2: Write the failing test** — when biometric is enabled, assert a compact icon button with `accessibilityLabel` (e.g. t('unlock.biometricA11y')) renders beside Unlock and pressing it invokes the same biometric handler; when biometric disabled, it is absent.
- [ ] **Step 3: Run test, verify it fails** (asserting the new accessibilityLabel/layout). `pnpm test -- unlock`.
- [ ] **Step 4: Implement** — render the two controls in a `flexDirection: 'row'` container: primary Unlock button takes remaining width (`flex: 1`), biometric becomes a square icon-only button (side ≈ `sizes` token matching the Unlock button height) with a fingerprint icon and `accessibilityLabel`. Remove the old full-width biometric button and its label text. Add i18n `unlock.biometricA11y` (PT: "Desbloquear com biometria" / EN: "Unlock with biometrics"). Use theme tokens only.
- [ ] **Step 5: Run test → PASS**, then typecheck + lint.
- [ ] **Step 6: Commit** `feat(unlock): compact biometric icon button beside Unlock`.

---

### Task 5: Restyle the autofill save confirmation dialog

**Files:**
- Modify: `modules/vaultsync-native/android/src/main/java/expo/modules/vaultsyncnative/autofill/AutofillSaveActivity.kt` (`confirm(...)`, lines ~158–168)
- Create (if needed): `modules/vaultsync-native/android/src/main/res/layout/autofill_save_dialog.xml` + theme colors under `res/values`
- Test: existing `AutofillSaveActivity` instrumented tests must still pass (behavior unchanged).

**Interfaces:**
- Consumes: same `onConfirm`/`finish()` contract (the positive button kicks off `onConfirm`; the write path owns `finish()`; negative → `finish()`). Do NOT change this timing (comment at lines 159–161 explains the async warm-save race).

- [ ] **Step 1: Read `confirm(...)`** — currently a bare framework `AlertDialog.Builder` (no appcompat). Note title/message/positive/negative wiring and the deliberate no-finish-on-positive.
- [ ] **Step 2: Design decision (record in commit body):** keep it dependency-free — style the framework `AlertDialog` via a custom `setView(...)` layout (`autofill_save_dialog.xml`) using VaultSync brand colors (mirror `DESIGN.md` / the values already in `res/values`), OR apply a dialog theme (`AlertDialog.Builder(this, R.style.VaultSyncDialog)`). Do NOT add appcompat/Material if it pulls a new dependency conflicting with the RN app; prefer a themed framework dialog. Preserve the exact button semantics.
- [ ] **Step 3: Implement** the themed/custom-view dialog; keep `onConfirm` on positive and `finish()` on negative/cancel unchanged. Keep all existing strings (`autofill_save_message`, `autofill_update_message`, `autofill_save_as_new`, `autofill_update_password`).
- [ ] **Step 4: Build + test** — `:app:assembleDebug` SUCCESSFUL, `:vaultsync-native:connectedAndroidTest` green (existing AutofillSaveActivity tests unchanged). `pnpm test` unaffected.
- [ ] **Step 5: Commit** `style(autofill): brand-themed save confirmation dialog`.

---

## Notes for the controller
- Tasks 1 & 5 are native → each needs a gradle build + connectedAndroidTest on `emulator-5554`. Group their builds if convenient, but review each task independently.
- On-device verification of Task 1 (the real fill) happens after the user installs the rebuilt APK (sideload via Files — MIUI blocks `adb install`).
- After all tasks: whole-branch review, then decide push per user.
