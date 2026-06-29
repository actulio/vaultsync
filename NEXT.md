# VaultSync — what's next

Plan 1 (crypto, vault format, native bindings, i18n), **Plan 2 (onboarding & unlock)**, and
**Plan 3 (vault CRUD, UI, password generator, settings, clipboard worker)** are **complete** and
**pushed to `origin/main`** (HEAD `d89e804`). The app now boots onboarding → unlock → a real tab UI
(Vault list/search, entry detail with copy-and-clear, add/edit entry, generator, settings incl.
language / auto-lock / change-password).

All gates green at Plan 3 close: `pnpm test` **143/143** (32 suites), `pnpm run typecheck` clean,
`pnpm run lint` **0 errors**, native `connectedAndroidTest` **9/9** (unchanged since Plan 2/Task 5-6;
Plan 3's late fixes were JS-only). Final whole-branch review (opus): "Ready to merge WITH FIXES" — no
Critical; the 2 Important findings (change-password onboarding-chain, dead auto-lock control) were
FIXED and verified.

Next up: **Plan 4 — Google Drive file sync (push/pull)**
(`docs/superpowers/plans/2026-06-25-plan-4-drive-sync.md`). Plan 5 (autofill + save) follows.

---

## How to start Plan 4 (paste this into a fresh Claude Code session)

```
Execute Plan 4 from /Users/work/personal/random/docs/superpowers/plans/2026-06-25-plan-4-drive-sync.md
using superpowers:subagent-driven-development. The project already exists at
/Users/work/personal/random/vaultsync/ (its own git repo, branch `main`). Use context-mode for command
execution/analysis and the graphify graph (graphify-out/) for codebase context.

FIRST, read these to orient before dispatching any task:
- /Users/work/personal/random/vaultsync/.superpowers/sdd/progress.md  (Plan 1-3 ledger: decisions + carried/deferred items)
- /Users/work/personal/random/vaultsync/NEXT.md  (this file's binding context)
- /Users/work/personal/random/vaultsync/DESIGN.md  (the visual design system — every screen follows it)
- the spec: /Users/work/personal/random/docs/superpowers/specs/2026-06-25-password-manager-design.md

PRE-FLIGHT: scan Plan 4 for stale assumptions against what Plans 1-3 actually shipped (the plans predate
the as-built code in places — e.g. Plan 3 used @/crypto/aead not the stale @/crypto/aesGcm the plans
reference, and src/theme tokens not NativeWind per P3-D1). Batch any conflicts to the user before Task 1.

Binding context from Plans 1-3 (do NOT contradict or re-derive):
- Package manager is pnpm (node-linker=hoisted). Use pnpm, never npm. Gates: `pnpm test`, `pnpm run typecheck`,
  `pnpm run lint`. RUN ALL THREE PER TASK. Lint is a clean baseline (0); `.eslintrc.cjs` has a scoped
  `__tests__/**` override (type-aware no-unsafe-*/require-await off for jest mocks; no-floating-promises/
  no-misused-promises/no-unused-vars stay ON). Keep it; don't weaken source.
- Styling (P3-D1, USER-APPROVED): src/theme token system only — `import { useTheme } from '@/theme'` →
  { colors, spacing, radii, sizes, type }. NO NativeWind, NO className, NO inline hex/sizes. `nativewind` stays
  installed-but-unused; its migration is a deferred future phase. Mirror app/(app)/(tabs)/index.tsx + onboarding screens.
- i18n: PT default + EN. New UI namespaces via `addNamespace` by EXTENDING src/i18n/registerUiNamespaces.ts
  (called in app/_layout.tsx + jest.setup.ts). Do NOT edit initI18n. Test screens with the longer PT strings.
- Crypto/PERSISTENCE: vault payload = ChaCha20-Poly1305-IETF via `@/crypto/aead` (aeadEncrypt/aeadDecrypt take
  an `ad` param) with the vault header bound as AEAD associated-data. Re-encrypt MUST pass
  aad = serializeVaultHeader(headerFields) (from `@/vault/format`); recovery-wrap uses ad=null. NO @/crypto/aesGcm.
  persistVault(vault, masterKey) (src/vault/persist.ts) = no-rotate save; changeMasterPassword (src/settings/
  changePassword.ts) = the rotating variant (mirrors src/auth/recovery.ts). New deriveMasterKey calls pass
  DEFAULT_ARGON2 explicitly. The on-disk vault file is `vault.enc` via VaultStore (`@/native/keystore`).
- Auth store (`@/auth/store`): useAuthStore holds status + masterKey + vault in memory; updateVault THROWS if
  locked; lock() wipes keys (auto-lock timer in app/_layout, now wired to the saved pref via loadPrefs). Vault
  mutations → updateVault THEN persistVault(next, masterKey). Vault types VaultV1, Entry = Login | SecureNote
  from `@/vault/types`. Drive OAuth tokens already exist from Plan 2 (token storage + signInWithGoogle, PKCE).
- Native: it's a custom Expo dev client (NOT Expo Go), expo-router file-based nav. Adding/altering native Kotlin
  (modules/vaultsync-native) needs a gradle build + connectedAndroidTest. Avoid `prebuild --clean` (wipes app/android).
- Tests: jest-expo + RNTL v14 (async render, findBy*). 143-test baseline. Carried cross-cutting act() console
  warning (React 19/RNTL) — benign.

ACCEPTED FOLLOW-UPS carried from Plan 3 final review (none merge-blocking — fold in when relevant code lands):
- T5 native: ClipboardClearWorker.kt getItemAt(0) can throw if primaryClip non-null but itemCount==0 → add
  getItemCount()>0 guard + try/catch (needs a native build cycle — batch with other native work).
- Spec §3.1 (dormant): EntryForm never writes `previousPassword` on password change; clearStalePreviousPasswords
  has no caller (7-day previous-password retention unimplemented).
- Mem hygiene §4.7: changeMasterPassword doesn't zero old masterKey / re-derived candidate buffers on rotation.
- Cosmetic: entry/edit/[id].tsx dead ternary; onGenerate console.error not user-facing; filter pills lack
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
pnpm test              # 143 tests (crypto, vault, auth, generator, settings, screens)
pnpm run typecheck
pnpm run lint          # MUST be 0 — run every task

# Android (needs the env exported)
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"
emulator -avd vaultsync_test -no-window -no-audio &
adb wait-for-device
cd android && ./gradlew :app:assembleDebug                       # app build
cd android && ./gradlew :vaultsync-native:connectedAndroidTest   # 9 native tests (after native changes)
pnpm android           # run the app (custom dev client, NOT Expo Go)
```

## State today
- ✅ Crypto: Argon2id, ChaCha20-Poly1305-IETF AEAD (+ vault-header bound as associated-data), recovery codes — tested
- ✅ Vault binary format (serializeVaultHeader/encode/decode); single Argon2Params source
- ✅ Native Keystore (per-op biometric auth) + atomic VaultIO + BiometricPrompt + Kotlin ClipboardClearWorker — instrumented 9/9
- ✅ Auth store, onboarding/unlock/recovery + screens (PT/EN), AuthGate routing, auto-lock (pref-wired), Drive OAuth tokens
- ✅ Theme system (src/theme/) from DESIGN.md; i18n addNamespace registration
- ✅ `(app)` REAL tab UI: vault list/search/filter, entry detail (copy-and-clear), add/edit entry, password
     generator, settings (language / auto-lock / change-password) — Plan 3 complete
- ⬜ Google Drive file sync (push/pull) — Plan 4 (NEXT)
- ⬜ Autofill + save service — Plan 5
