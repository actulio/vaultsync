# VaultSync — what's next

Plan 1 (crypto, vault format, native bindings, i18n), **Plan 2 (onboarding & unlock)**,
**Plan 3 (vault CRUD, UI, password generator, settings, clipboard worker)**, and
**Plan 4 (Google Drive file sync — push/pull)** are **complete** and **pushed to `origin/main`**
(HEAD `9bef00c`). The app boots onboarding → unlock → a real tab UI (Vault list/search, entry detail
with copy-and-clear, add/edit entry, generator, settings incl. language / auto-lock / change-password),
and now syncs the encrypted `vault.enc` to Google Drive (`VaultSync/vault.enc`): push after every edit,
cold-path pull on launch/foreground, an offline FIFO queue, and a Settings sync row.

All gates green at Plan 4 close: `pnpm test` **185/185** (38 suites), `pnpm run typecheck` clean,
`pnpm run lint` **0 errors**, native `:app:assembleDebug` SUCCESSFUL (expo-sqlite + expo-network
autolinked) + `:vaultsync-native:connectedAndroidTest` **9/9** (Android-14 emulator, after the
ClipboardClearWorker hardening). Final whole-branch review (opus): "Ready to merge WITH FIXES" — no
Critical; data-safety core (cold-path pull, validate-before-overwrite, no-clobber ordering, at-least-once
queue) verified sound; the 1 Important (enqueueSync swallowing enqueuePush rejection) + 3 same-file Minors
were FIXED and re-reviewed clean (commit `9bef00c`).

**Plan 5 (Android Autofill + save service)** shipped 2026-07-02 (origin/main `986c9e9..b7392bf`), and
**Plan 6 (Notification fallback + CSV import)** is now **CODE-COMPLETE & MERGE-READY on local `main`**
(HEAD `db2e212`, commits `bba85f4..db2e212`, **not yet pushed**). This **completes the six-plan VaultSync v1 series.**

## Plan 6 — DONE (2026-07-02, local main, unpushed)

Autofill misses now post a rate-limited (once/(package|domain)/hour) notification on channel `vault_fallback`
("No saved login for … — tap to search vault") whose tap deep-links `vaultsync://search?domain=&package=` into a
quick-copy screen (`app/search.tsx`, copy-and-clear). CSV import (Settings → Import CSV) auto-detects
1Password/LastPass/Bitwarden/Chrome, offers manual column mapping, previews logins/notes/skipped, **appends** (never
replaces) with each entry tagged `source:"import-YYYY-MM-DD"`, then auto-deletes the plaintext temp CSV and reminds
the user to delete the original. Plus `docs/manual-test-matrix.md` (21 on-device scenarios).

Gates at close (`db2e212`, controller-verified via ctx_execute): `pnpm test` **212/212** (44 suites),
`pnpm run typecheck` **0**, `pnpm run lint` **0**, `:app:assembleDebug` SUCCESSFUL, `:vaultsync-native:connectedAndroidTest`
**94/94** (Android-14 emulator). Executed via subagent-driven-development (5 tasks, per-task spec+quality review each).
Final whole-branch review (opus): "merge WITH FIXES" — no Critical; verified I5 not reintroduced, append-not-replace,
Drive enqueue, deep-link/i18n integration all sound. **2 Important FIXED** (`db2e212`): (I1) plaintext temp CSV survived
cancel/back/error paths + silent locked-vault-import failure → now deleted right after read on every path + import-error
alert; (I2) autofill miss-notify could throw and skip `cb.onSuccess` → wrapped in try/catch. Deferred Minors (backlog,
non-blocking): Chrome-vs-LastPass detect label; no Secure-Note import in UI (by-design v1); `parseCsv` drops papaparse
errors; CSV plaintext through nav params; Fallback `SharedPreferences` timestamps unpruned; `key.hashCode()` id collision;
`rowsToEntries` computed twice on confirm. (Full ledger: `.superpowers/sdd/progress.md`.)

**Before RELEASE (not merge — carried from Plan 5, unchanged by Plan 6):** the I2 keystore CryptoObject ship-blocker
(TOP, needs USER UX sign-off + a physical device), the pre-ship device checklist, and the LWW/in-session live-reload
phase all still stand. See "Release-blockers carried out of Plan 5" below.

---

## How Plan 6 was executed (HISTORICAL — Plan 6 is DONE; kept for provenance)

> Plan 6 is complete (see above). This block was the kickoff a fresh session resolved when told
> **"Read vaultsync/NEXT.md and start Plan 6."** — retained for reference only. (Plan 5 / Android Autofill SHIPPED
> 2026-07-02, pushed to origin/main, commits 9d1aae8..82aa03d — see "State today" + "Release-blockers carried
> out of Plan 5" before any release; the I2 keystore fix + on-device verification are release-gated follow-ups,
> independent of Plan 6 feature work.)

```
Execute Plan 6 from /Users/work/personal/random/docs/superpowers/plans/2026-06-25-plan-6-fallback-import.md
using superpowers:subagent-driven-development. The project already exists at
/Users/work/personal/random/vaultsync/ (its own git repo, branch `main`; commit directly per P2-D1). Use
context-mode for command execution/analysis and the graphify graph (graphify-out/) for codebase context.

Plan 6 scope (spec §6.6 + §8): notification fallback when autofill misses (channel `vault_fallback`,
"No saved login for <app/site> — tap to search vault", one-per-(package,hour) rate limit, QuickCopyActivity
deep-link target) + CSV import (1Password/LastPass/Chrome parsers, preview/confirm, append-not-replace,
each imported entry tagged source:"import-YYYY-MM-DD"). The Plan-5 autofill service currently logs a miss via
Log.i("VaultSync","Autofill miss…") in VaultAutofillService — Plan 6 replaces that stub with the real notification.

FIRST, read these to orient before dispatching any task:
- /Users/work/personal/random/vaultsync/.superpowers/sdd/progress.md  (Plan 1-5 ledger: decisions + carried/deferred items + Plan-5 release-blockers)
- /Users/work/personal/random/vaultsync/NEXT.md  (this file's binding context)
- /Users/work/personal/random/vaultsync/DESIGN.md  (the visual design system — every screen follows it)
- the spec: /Users/work/personal/random/docs/superpowers/specs/2026-06-25-password-manager-design.md (§6.6, §8)

PRE-FLIGHT: scan Plan 6 for stale assumptions against what Plans 1-5 actually shipped (the plans predate
the as-built code — e.g. @/crypto/aesGcm→@/crypto/aead, npm→pnpm, NativeWind/className→src/theme tokens,
initI18n→registerUiNamespaces addNamespace, and any Tink reference→BouncyCastle for native crypto).
Batch any conflicts to the user before Task 1.

Binding context from Plans 1-4 (do NOT contradict or re-derive):
- Package manager is pnpm (node-linker=hoisted). Use pnpm, never npm (lockfile = pnpm-lock.yaml, NOT
  package-lock.json). Gates: `pnpm test`, `pnpm run typecheck`, `pnpm run lint`. RUN ALL THREE PER TASK.
  Lint is a clean baseline (0); `.eslintrc.cjs` has a scoped `__tests__/**` override (type-aware
  no-unsafe-*/require-await off for jest mocks; no-floating-promises/no-misused-promises/no-unused-vars
  stay ON — and no-explicit-any stays ON even in tests, use jest.mocked()/scoped disables). Keep it; don't weaken source.
- Styling (P3-D1, USER-APPROVED): src/theme token system only — `import { useTheme } from '@/theme'` →
  { colors, spacing, radii, sizes, type }. NO NativeWind, NO className, NO inline hex/sizes. `nativewind` stays
  installed-but-unused; its migration is a deferred future phase. Mirror app/(app)/(tabs)/*.tsx + settings screens.
- i18n: PT default + EN. New UI namespaces via `addNamespace` by EXTENDING src/i18n/registerUiNamespaces.ts
  (called in app/_layout.tsx + jest.setup.ts). Do NOT edit initI18n. Test screens with the longer PT strings.
- Crypto/PERSISTENCE: vault payload = ChaCha20-Poly1305-IETF via `@/crypto/aead` (aeadEncrypt/aeadDecrypt take
  an `ad` param) with the vault header bound as AEAD associated-data. Re-encrypt MUST pass
  aad = serializeVaultHeader(headerFields) (from `@/vault/format`); recovery-wrap uses ad=null. NO @/crypto/aesGcm.
  persistVault(vault, masterKey) (src/vault/persist.ts) = no-rotate save (now also enqueues a Drive push);
  changeMasterPassword (src/settings/changePassword.ts) = the rotating variant (mirrors src/auth/recovery.ts).
  New deriveMasterKey calls pass DEFAULT_ARGON2 explicitly. On-disk vault file is `vault.enc` via VaultStore (`@/native/keystore`).
- Auth store (`@/auth/store`): useAuthStore holds status (bootstrapping|no_vault|locked|unlocked) + masterKey +
  vault in memory; updateVault THROWS if locked; lock() wipes keys (auto-lock timer in app/_layout, wired to the
  saved pref via loadPrefs). Vault mutations → updateVault THEN persistVault(next, masterKey). Vault types VaultV1,
  Entry = Login | SecureNote from `@/vault/types`.
- SYNC layer (Plan 4, present now): src/drive/{auth,client,files}.ts + src/sync/{queue,store,orchestrator,hooks}.ts.
  Drive OAuth (PKCE) tokens in expo-secure-store (drive_refresh_token/_access_token/_exp). syncOnce() = single entry
  (inFlight-guarded): drains the SQLite push queue then pulls. PULL IS COLD-PATH ONLY (P4-D1): it overwrites local
  vault.enc only when status !== 'unlocked' (no in-session reload — overwriting an unlocked vault = data loss).
  VALIDATE-BEFORE-OVERWRITE (P4-D2): decodeVaultFile(bytes) must succeed before any write over local. enqueueSync in
  persist.ts fires enqueuePush + syncOnce (fire-and-forget, errors surfaced to useSyncStore). Foreground hook in
  app/_layout (3rd useEffect). hasDriveToken() gates sync. Settings has a 'sync' row + screen (sync i18n ns).
- Native: custom Expo dev client (NOT Expo Go), expo-router file-based nav. Native deps now incl. expo-sqlite +
  expo-network + BouncyCastle bcprov-jdk18on:1.78.1 (autolinked/declared). Adding/altering native Kotlin
  (modules/vaultsync-native) needs a gradle build + connectedAndroidTest. Avoid `prebuild --clean` (wipes app/android).
  android/ is gitignored (Expo CNG).
- AUTOFILL LAYER (Plan 5, present now): modules/vaultsync-native/android/.../autofill/ = FieldDetector, Matcher
  (eTLD+1 + multi-label PSL + brand fallback), VaultJson/VaultDecryptor/VaultEncryptor (BouncyCastle ChaCha20-
  Poly1305-IETF, header-AAD, JS-parity proven), VaultCache (TTL), VaultAutofillService (fill/save/no-match+SaveInfo),
  AutofillUnlockActivity + AutofillSaveActivity (biometric, no-silent-overwrite SavePolicy), SyncQueue (writes
  filesDir/SQLite/vaultsync.db, drained by src/sync/queue.ts). TS: src/auth/staleCleanup.ts runs the 7-day
  previousPassword cleanup on unlock. >> RELEASE-BLOCKER I2: vault_kek is auth-per-use but ALL unlock paths do a
  bare BiometricPrompt + separate Keystore.unwrap (NO CryptoObject) → throws on API-30+ devices; do NOT build
  Plan-6 features that assume biometric unwrap succeeds on-device until I2 is fixed.
- Tests: jest-expo + RNTL v14 (async render, findBy*). 188-test JS baseline (39 suites). Native: connectedAndroidTest
  89-test baseline on emulator vaultsync_test (Android 14). Carried cross-cutting act() console warning (React 19/RNTL) — benign.

ACCEPTED FOLLOW-UPS carried into Plan 6 (none merge-blocking — fold in when relevant code lands; the full
Plan-5 release-blocker + device-checklist list is in the "Release-blockers carried out of Plan 5" section below):
- SYNC (Plan 4): true updatedAt-based last-write-wins + in-session live vault reload are DEFERRED-BY-DESIGN
  (P4-D1). Until they land, concurrent multi-device edits resolve only via cold-path pull-on-launch, and an
  unlocked device ignores newer remote for the session. drive_last_upload_iso is now written after a push (clean-LWW prerequisite).
- SYNC runtime smoke (needs real device): the multipart `new Blob([head, Uint8Array, tail])` upload in
  src/drive/files.ts is only build-smoke-covered — do a real-device upload/download round-trip (re-decode the
  re-downloaded vault.enc) before shipping to users. RN Blob binary-part handling is the risk.
- SYNC coverage (deferrable): 401-retry path untested (correct by inspection); no concurrent inFlight test;
  store.test.ts over-built; layout test doesn't assert startSyncOnForeground wiring; no instrumented empty-clip test.
- SYNC UX (Minor): show a distinct "never synced" label when status==='idle' && lastSyncedAt===null
  (currently renders "Synced" before the first sync).
- Spec §3.1 (Plan 5 CLOSED the retention gap): the Kotlin autofill save writes `previousPassword`+`updatedAt`, and
  src/auth/staleCleanup.ts clears entries older than 7 days on unlock. STILL OPEN: the in-app EntryForm
  password-change path doesn't write `previousPassword` (only the autofill save does).
- Mem hygiene §4.7 (Plan 3): changeMasterPassword doesn't zero old masterKey / re-derived candidate buffers on rotation.
- Cosmetic (Plan 3): entry/edit/[id].tsx dead ternary; onGenerate console.error not user-facing; filter pills lack
  distinct a11y label; cancelPendingClear has no caller (foreground-cancel not wired).

Android toolchain is installed (JDK 17, SDK, NDK 27.1.12297006, AVD `vaultsync_test`). For gradle/emulator work:
  export JAVA_HOME=/opt/homebrew/opt/openjdk@17
  export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
  export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"
context-mode blocks `gradlew` via Bash — run gradle/adb/emulator through ctx_execute. First-time gradle dep
downloads can hit transient TLS errors — just retry. Don't touch parent-level .claude/, .agents/, or CLAUDE.md.
```

---

## Quick command reference

```bash
cd /Users/work/personal/random/vaultsync

# JS / logic
pnpm install
pnpm test              # 188 tests (crypto, vault, auth, generator, settings, drive, sync, screens, staleCleanup)
pnpm run typecheck
pnpm run lint          # MUST be 0 — run every task

# Android (needs the env exported)
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"
emulator -avd vaultsync_test -no-window -no-audio &
adb wait-for-device
cd android && ./gradlew :app:assembleDebug                       # app build (autolinks expo-sqlite/expo-network)
cd android && ./gradlew :vaultsync-native:connectedAndroidTest   # 89 native tests (autofill: detector/matcher/crypto/cache/IO; after native changes)
pnpm android           # run the app (custom dev client, NOT Expo Go)
```

## State today
- ✅ Crypto: Argon2id, ChaCha20-Poly1305-IETF AEAD (+ vault-header bound as associated-data), recovery codes — tested
- ✅ Vault binary format (serializeVaultHeader/encode/decode); single Argon2Params source
- ✅ Native Keystore (per-op biometric auth) + atomic VaultIO + BiometricPrompt + Kotlin ClipboardClearWorker (hardened) — instrumented 9/9
- ✅ Auth store, onboarding/unlock/recovery + screens (PT/EN), AuthGate routing, auto-lock (pref-wired), Drive OAuth tokens
- ✅ Theme system (src/theme/) from DESIGN.md; i18n addNamespace registration
- ✅ `(app)` REAL tab UI: vault list/search/filter, entry detail (copy-and-clear), add/edit entry, password
     generator, settings (language / auto-lock / change-password) — Plan 3 complete
- ✅ Google Drive file sync (push/pull): SQLite queue, Drive REST client (refresh + 401 retry), folder/file
     discovery + multipart up/download, orchestrator (cold-path validated pull), foreground hook, settings sync row,
     bootstrap pull-on-launch — Plan 4 complete
- ✅ Android Autofill + save service — Plan 5 complete (CODE-COMPLETE, pushed to origin/main): AutofillService
     (fill/save/no-match), FieldDetector, Matcher (eTLD+1 + multi-label PSL + brand fallback), in-service vault
     crypto (BouncyCastle ChaCha20-Poly1305, header-AAD, JS↔Kotlin parity proven), VaultCache TTL, biometric
     unlock activity, save activity (no-silent-overwrite SavePolicy), Kotlin sync_queue enqueue, TS previousPassword
     7-day cleanup on unlock. Gates: assembleDebug OK, connectedAndroidTest 89/89, pnpm test 188/188, typecheck 0, lint 0.
- ⬜ Fallback import — Plan 6 (+ spec §6.6 notification-fallback, currently a logcat stub)

## ⚠️ Release-blockers carried out of Plan 5 (code-complete ≠ ship-ready)
- **I2 — keystore CryptoObject (TOP ship-blocker, NEEDS USER SIGN-OFF).** `vault_kek` is auth-per-use
  (`setUserAuthenticationParameters(0, BIOMETRIC_STRONG)`) but production unlock AND both autofill activities do a
  bare `BiometricPrompt` + a *separate* `Keystore.unwrap` with NO `CryptoObject`. On real API-30+ devices `unwrap`
  throws `UserNotAuthenticatedException`, so the ENTIRE biometric surface (incl. the shipped main-app unlock) is dead
  on first device run; the warm-cache autofill save does no prompt at all before unwrap. Pre-existing since Plan 2,
  unverifiable on the emulator, and the fix (additive Keystore method exposing an init-ed Cipher for
  `BiometricPrompt(CryptoObject(cipher))`) makes the warm-cache save require a biometric tap — a UX change to confirm.
- **Pre-ship device checklist (needs a physical device w/ enrolled biometrics):** (1) biometric unlock e2e after the
  I2 fix; (2) real third-party-app fill (dataset popup, unlock-then-fill, TTL expiry); (3) save flow e2e — new /
  update-password / save-as-new, PT strings; (4) autofill save → sync_queue row → JS foreground drain → Drive push →
  re-decode round-trip; (5) Plan-4 multipart Blob upload smoke; (6) autofill settings-gear entry point.
- **LWW / in-session live-reload = the next planned phase (P4-D1/P5-D2 deferred-by-design).** Until it lands, an
  autofill save while the main app stays unlocked is reverted by any later in-session persist (bounded by 5-min
  auto-lock; unlock re-reads disk). Interim hardening idea: `persistVault` compares on-disk `updatedAt` vs its load
  baseline and reloads/merges on mismatch.
- Minor (backlog): `autofill_service.xml` settingsActivity points at a non-exported activity; demote the miss-log
  `Log.i` (records visited package/domain) to `Log.d` before ship; spec §6.5 "don't ask for this app again" blocklist.
