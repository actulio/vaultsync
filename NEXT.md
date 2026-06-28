# VaultSync — what's next

Plan 1 (crypto, vault format, native bindings, i18n) and **Plan 2 (onboarding & unlock)** are **complete** on `main`.
As of Plan 2: 18 commits ending at `0de87d1`. The app now boots through onboarding → unlock → a **stub** `(app)` home.

All gates green at Plan 2 close: `pnpm test` **83/83**, `pnpm run typecheck` clean, `pnpm run lint` **0 errors**,
`gradlew :app:assembleDebug` SUCCESSFUL, native `connectedAndroidTest` **9/9**.

Next up: **Plan 3 — Vault CRUD, UI Skeleton, Password Generator, Settings, Clipboard Worker**
(`docs/superpowers/plans/2026-06-25-plan-3-vault-crud-ui.md`, 11 tasks).

---

## How to start Plan 3 (paste this into a fresh Claude Code session)

```
Execute Plan 3 from /Users/work/personal/random/docs/superpowers/plans/2026-06-25-plan-3-vault-crud-ui.md
using superpowers:subagent-driven-development. The project already exists at
/Users/work/personal/random/vaultsync/ (its own git repo, branch `main`). Use context-mode for command
execution/analysis and the graphify graph (graphify-out/) for codebase context.

FIRST, read these to orient before dispatching any task:
- /Users/work/personal/random/vaultsync/.superpowers/sdd/progress.md  (Plan 1+2 ledger: decisions + carried items)
- /Users/work/personal/random/vaultsync/NEXT.md  (this file's binding context)
- /Users/work/personal/random/vaultsync/DESIGN.md  (the visual design system — every screen must follow it)
- the spec: /Users/work/personal/random/docs/superpowers/specs/2026-06-25-password-manager-design.md

PRE-FLIGHT DECISION (resolve before Task 1 — the plan predates Plan 2's UI decisions):
- STYLING CONFLICT: Plan 3's architecture says "NativeWind for styling," but Plan 2 already built a
  token-based design system at src/theme/ (useTheme() → { colors, spacing, radii, type }, materialized from
  DESIGN.md, light+dark via useColorScheme). `nativewind` is INSTALLED but UNUSED. Do NOT run two styling
  systems in parallel. Decide up front: (a) keep src/theme StyleSheet tokens (DESIGN.md says "target RN/Expo
  primitives" — this is the established, lint-clean path) and treat the plan's NativeWind mentions as stale, OR
  (b) wire NativeWind's tailwind.config to consume the SAME src/theme tokens so both agree. Recommend (a) unless
  you have a reason; flag this to the user as a batched pre-flight question.

Binding context from Plans 1-2 (do NOT contradict or re-derive):
- Package manager is pnpm (node-linker=hoisted). Use pnpm, never npm. Gates: `pnpm test`, `pnpm run typecheck`,
  `pnpm run lint`. RUN ALL THREE PER TASK — Plan 2's loop skipped lint and accumulated 82 errors. Lint is now a
  clean baseline; `.eslintrc.cjs` has a scoped `__tests__/**` override (type-aware no-unsafe-*/require-await off
  for jest mocks; no-floating-promises/no-misused-promises/no-unused-vars stay ON). Keep it; don't weaken source.
- Theme: `import { useTheme } from '@/theme'` → { colors, spacing, radii, type }. Components consume tokens —
  NO inline hex/sizes. Buttons h52/radius md (see app/(onboarding)/*.tsx for the established pattern).
- i18n: PT default + EN. Add new UI namespaces (vault, generator, settings) via `addNamespace` by EXTENDING
  src/i18n/registerUiNamespaces.ts (called in app/_layout.tsx + jest.setup.ts). Do NOT edit initI18n. Test
  screens with the longer Portuguese strings.
- Crypto/PERSISTENCE (Plan 3 Task 2 is the load-bearing one): the vault payload is encrypted with
  ChaCha20-Poly1305-IETF (`@/crypto/aead`: aeadEncrypt/aeadDecrypt take an `ad` param) AND the vault header is
  bound as AEAD associated-data. To PERSIST an edited vault you MUST re-encrypt with
  aad = serializeVaultHeader(headerFields) (from `@/vault/format`), using the in-memory masterKey from
  useAuthStore. Keep the existing salt/argon2/hint/recoveryWrappedKey from the on-disk header (password
  unchanged); only the vault payload + a NEW vaultNonce change; bump updatedAt. Mirror src/auth/recovery.ts
  (which does the FULL rotate) but WITHOUT rotating salt/masterKey/recovery-code. The change-master-password
  flow (settings) IS the rotating variant — reuse recovery.ts's pattern. There is NO @/crypto/aesGcm module.
- Auth store (`@/auth/store`): useAuthStore holds status + masterKey + vault in memory; `updateVault(vault)`
  THROWS if locked; `lock()` wipes keys (auto-lock timer runs from app/_layout). Vault mutations → updateVault
  THEN persist (re-encrypt + VaultStore.write). Vault types: VaultV1, Entry = Login | SecureNote from
  `@/vault/types` (Login: username/password/url/packageNames/notes/source/previousPassword; SecureNote: body).
- Native: Keystore/VaultStore from `@/native/keystore`, Biometric from `@/native/biometric`. Plan 3 adds a
  Kotlin ClipboardClearWorker (WorkManager) — add the WorkManager dep to modules/vaultsync-native/android/
  build.gradle, then it needs a gradle build + (after native changes) connectedAndroidTest.
- It's a custom Expo dev client (NOT Expo Go). expo-router file-based nav. The `(app)` group is a STUB
  (app/(app)/index.tsx) — Plan 3 replaces it with the real tab layout. expo-clipboard is installed.
- Tests: jest-expo + RNTL v14 (async `render`, use `findBy*`). 83-test baseline. KNOWN deferred: an `act()`
  console warning appears across screen tests (React 19/RNTL) — Plan 3 may adopt a userEvent/act convention.

Android toolchain is installed (JDK 17, SDK, NDK 27.1.12297006, AVD `vaultsync_test`). For gradle/emulator work:
  export JAVA_HOME=/opt/homebrew/opt/openjdk@17
  export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
  export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"
context-mode blocks `gradlew` via Bash — run gradle/adb/emulator through ctx_execute. react-native-worklets is
pinned to 0.10.0 (reanimated 4.5 peer); assembleDebug works. First-time gradle dep downloads can hit transient
TLS errors — just retry. Don't touch parent-level .claude/, .agents/, or CLAUDE.md.

Plan-2 deferred Minors to address when the relevant code lands in Plan 3: in any NEW deriveMasterKey call pass
DEFAULT_ARGON2 explicitly (don't rely on the default); the unlockWithPassword catch-all currently reports
genuine vault_corrupt as wrong_password (fix if you touch that path); apply the same header-AAD discipline to
every new re-encrypt path.
```

---

## Quick command reference

```bash
cd /Users/work/personal/random/vaultsync

# JS / logic
pnpm install
pnpm test              # 83 tests (crypto, vault, auth primitives, screens)
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
- ✅ Native Keystore (per-op biometric auth) + atomic VaultIO + BiometricPrompt module — instrumented 9/9
- ✅ Auth store, onboarding/unlock/recovery primitives + screens (PT/EN), AuthGate routing, auto-lock, Drive OAuth tokens
- ✅ Theme system (src/theme/) from DESIGN.md; i18n addNamespace registration
- ⬜ `(app)` is a STUB — vault tab, entry CRUD, generator, settings, clipboard-clear worker come in Plan 3
- ⬜ Drive file sync (push/pull) — Plan 4
