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

Next up: **Plan 5 — Autofill + save service**
(`docs/superpowers/plans/2026-06-25-plan-5-autofill-save.md`). Plan 6 (fallback import) follows.

---

## How to start Plan 5 (canonical kickoff — a fresh session reads this)

> To begin, just tell a fresh session: **"Read vaultsync/NEXT.md and start Plan 5."** Everything below is
> the binding context that instruction resolves to — do not re-derive it.

```
Execute Plan 5 from /Users/work/personal/random/docs/superpowers/plans/2026-06-25-plan-5-autofill-save.md
using superpowers:subagent-driven-development. The project already exists at
/Users/work/personal/random/vaultsync/ (its own git repo, branch `main`). Use context-mode for command
execution/analysis and the graphify graph (graphify-out/) for codebase context.

FIRST, read these to orient before dispatching any task:
- /Users/work/personal/random/vaultsync/.superpowers/sdd/progress.md  (Plan 1-4 ledger: decisions + carried/deferred items)
- /Users/work/personal/random/vaultsync/NEXT.md  (this file's binding context)
- /Users/work/personal/random/vaultsync/DESIGN.md  (the visual design system — every screen follows it)
- the spec: /Users/work/personal/random/docs/superpowers/specs/2026-06-25-password-manager-design.md

PRE-FLIGHT: scan Plan 5 for stale assumptions against what Plans 1-4 actually shipped (the plans predate
the as-built code in places — e.g. plans reference the stale @/crypto/aesGcm not @/crypto/aead, "npm" not
pnpm, NativeWind/className not src/theme tokens, and "edit initI18n" not the addNamespace extension point).
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
  expo-network (autolinked). Adding/altering native Kotlin (modules/vaultsync-native) needs a gradle build +
  connectedAndroidTest. Avoid `prebuild --clean` (wipes app/android). android/ is gitignored (Expo CNG).
- Tests: jest-expo + RNTL v14 (async render, findBy*). 185-test baseline (38 suites). Carried cross-cutting act()
  console warning (React 19/RNTL) — benign.

ACCEPTED FOLLOW-UPS carried into Plan 5 (none merge-blocking — fold in when relevant code lands):
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
- Spec §3.1 (dormant, Plan 3): EntryForm never writes `previousPassword` on password change;
  clearStalePreviousPasswords has no caller (7-day previous-password retention unimplemented).
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
pnpm test              # 185 tests (crypto, vault, auth, generator, settings, drive, sync, screens)
pnpm run typecheck
pnpm run lint          # MUST be 0 — run every task

# Android (needs the env exported)
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"
emulator -avd vaultsync_test -no-window -no-audio &
adb wait-for-device
cd android && ./gradlew :app:assembleDebug                       # app build (autolinks expo-sqlite/expo-network)
cd android && ./gradlew :vaultsync-native:connectedAndroidTest   # 9 native tests (after native changes)
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
- ⬜ Autofill + save service — Plan 5 (NEXT)
- ⬜ Fallback import — Plan 6
