# VaultSync — what's next

Plan 1 (foundation, crypto, vault format, native bindings, i18n) is **complete** — 15+ commits on `main`,
all tests green. There is **no UI yet**; the app boots to the blank Expo template screen.

Next up: **Plan 2 — Onboarding & Unlock** (`docs/superpowers/plans/2026-06-25-plan-2-onboarding-unlock.md`).

---

## How to start Plan 2 (paste this into a fresh Claude Code session)

```
Execute Plan 2 from /Users/work/personal/random/docs/superpowers/plans/2026-06-25-plan-2-onboarding-unlock.md
using superpowers:subagent-driven-development. The project already exists at
/Users/work/personal/random/vaultsync/ (its own git repo, branch `main`).

FIRST, read these to orient before dispatching any task:
- /Users/work/personal/random/vaultsync/.superpowers/sdd/progress.md  (Plan 1 ledger: decisions + carried-forward items)
- /Users/work/personal/random/vaultsync/NEXT.md  (this file's binding context)
- the spec: /Users/work/personal/random/docs/superpowers/specs/2026-06-25-password-manager-design.md

Binding context from Plan 1 (do NOT contradict or re-derive):
- Package manager is pnpm (node-linker=hoisted in .npmrc). Use pnpm, never npm. Gates: `pnpm test`,
  `pnpm run typecheck`, `pnpm run lint`.
- JS vault cipher is ChaCha20-Poly1305-IETF (NOT AES-GCM) in src/crypto/aead.ts (aeadEncrypt/aeadDecrypt).
  All crypto uses libsodium-wrappers-sumo. Crypto layer is done + tested: src/crypto/{argon2,aead,recoveryCode}.ts,
  vault format src/vault/format.ts.
- Native bindings exist: src/native/keystore.ts exports `Keystore` (generateKeyIfMissing/keyExists/deleteKey/
  wrap/unwrap) and `VaultStore` (read/write/exists/delete), backed by the Kotlin module modules/vaultsync-native.
  Note: the production Keystore key uses requireUserAuth=true, so wrap/unwrap require a BiometricPrompt — Plan 2
  is where that biometric activity gets wired.
- i18n is bootstrapped (src/i18n, PT default + EN). Add new UI namespaces via the `addNamespace(lang, ns, resources)`
  helper — do not edit the central init for each screen.
- It's a custom Expo dev client (NOT Expo Go) because of native code. App entry is still the blank template (no UI yet).

Android toolchain is already installed (JDK 17, SDK 34/35/36, NDK 27.1.12297006, cmake, AVD `vaultsync_test`).
For any gradle/emulator work, export:
  JAVA_HOME=/opt/homebrew/opt/openjdk@17
  ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
context-mode blocks `gradlew` via Bash — run gradle/adb/emulator through ctx_execute. First-time gradle dep
downloads can hit transient TLS errors; just retry the build (deps cache cumulatively). Don't touch parent-level
.claude/, .agents/, or CLAUDE.md.

Plan-1 items the final review asked to address when the relevant code lands in Plan 2: bind the vault header as
AEAD associated-data when wiring vault-level encryption; consolidate the duplicated Argon2Params type; harden the
i18n missing-key handling (prefer !i18next.exists(key)) and add per-test i18n state reset.
```

---

## Quick command reference

```bash
cd /Users/work/personal/random/vaultsync

# JS / logic
pnpm install
pnpm test              # 32 tests: crypto, vault format, i18n
pnpm run typecheck
pnpm run lint

# Android (needs the env exported)
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"
emulator -avd vaultsync_test -no-window &        # boot the emulator
adb wait-for-device
cd android && ./gradlew :vaultsync-native:connectedAndroidTest   # 9 native tests
# Or run the app (custom dev client, NOT Expo Go):
pnpm android           # = expo run:android
```

## State today
- ✅ Crypto: Argon2id, ChaCha20-Poly1305-IETF AEAD, recovery codes + HKDF — tested
- ✅ Vault binary format — tested
- ✅ Native Keystore (AES-256-GCM wrap/unwrap) + atomic VaultIO — instrumented-tested on emulator
- ✅ TypeScript native bindings; i18n (PT default + EN)
- ⬜ No screens yet — onboarding, unlock, vault UI come in Plans 2–3
