# UX Polish, Lock Restore & Drive Sync — Design Spec

**Date:** 2026-07-18
**Status:** Approved (pending user review of this document)
**Scope:** Four user-reported items, specified together as one coherent change.

---

## 1. Context

Four issues were reported from on-device use of VaultSync:

1. Action confirmations render as stock Android `Alert` dialogs — unbranded and heavyweight for transient messages.
2. Copied passwords clear from the clipboard after 30s, which is too short in practice.
3. Backgrounding the app for ~1 minute and returning shows a **blank screen** on the vault list.
4. Tapping the Drive sync/connect button does nothing at all.

Items 3 and 4 are release-blocking defects. Items 1 and 2 are polish. All four are specified here because they overlap in the same files (`app/(app)/entry/[id].tsx` is touched by three of them).

### Root causes (established by code inspection)

| # | Root cause |
|---|---|
| 3 | `lock()` (`src/auth/store.ts:26`) sets `status: 'locked', vault: null`, but **nothing navigates away from `/(app)/(tabs)`**. `app/index.tsx` is the only status→route mapper and is not mounted at that point. `(tabs)/index.tsx:24` then hits `if (!vault) return <View />` → blank screen. Auto-lock offers a 1-minute option (`settings/auto-lock.tsx:16`), matching the reported timing. |
| 4 | **No `.env` file exists** — only `.env.example`. `EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID` is therefore undefined, so `signInWithGoogle()` throws at `src/drive/auth.ts:25` before doing any work. Both call sites (`settings/sync.tsx:69`, `(onboarding)/drive-signin.tsx:15`) invoke it via `void` with no `.catch()`, so the rejection is swallowed silently. |

A secondary defect found in the same area: `settings/sync.tsx:60` only offers "Connect" when sync status is `paused_no_token`, but the store initialises to `idle` (`src/sync/store.ts:19`). The first tap therefore runs `syncOnce()` and appears to do nothing, even once OAuth is configured.

### Non-goals

- LWW / in-session live-reload (deferred by design, P4-D1/P5-D2).
- Any change to the AEAD/crypto path.
- iOS-specific work.
- The remaining NEXT.md backlog beyond the two items explicitly folded in below.

---

## 2. Notification system

Replaces all 14 `Alert.alert` call sites with two purpose-built surfaces.

### 2.1 Toast — transient, non-blocking

**Library: `react-native-toast-message` (^2.4.0).**

Chosen over `sonner-native` for a project-specific reason: sonner-native requires `react-native-gesture-handler >=2.28.0`, which this project does not currently depend on. Every one of its other peers is already satisfied (reanimated 4.5, worklets 0.10, safe-area-context 5.8, screens 4.25, svg 15.15), but gesture-handler is a **native** dependency requiring a rebuild, and this project's native toolchain is documented as fragile (exact JDK 17, previously-corrupt NDK, gradle daemon/foojay issues — see README). `react-native-toast-message` uses RN's built-in `Animated`, adds **zero native dependencies**, and its peer ranges (`react: *`, `react-native: *`) carry no bleeding-edge risk.

> **Fallback (approved):** if `react-native-toast-message` proves unsatisfactory in practice — animation quality, queue behaviour, or styling friction — switch to `sonner-native` and accept the gesture-handler native dependency plus rebuild. The `useToast()` wrapper below exists partly to make that swap a one-file change.

**Design:**
- A custom `config` renderer built entirely from theme tokens (`colors`, `spacing`, `radii`, `type`) — no library default styling, no inline hex. DESIGN.md compliance is unchanged from a hand-built component; only queueing, timers, and lifecycle are delegated.
- `<Toast />` mounted in `app/_layout.tsx` **inside** `ThemeProvider` (so the renderer can read tokens) and as the last child (so it layers above all screens).
- A thin `src/components/toast.ts` wrapper exposing `showToast(message: string)`. Call sites never import the library directly — this is what makes the sonner-native fallback cheap.
- Auto-dismiss ~2s, bottom-anchored, single-line.

### 2.2 Dialog — blocking, branded

**Hand-built.** No library matches DESIGN.md, and RN's `Modal` is a sound base.

- `src/components/Dialog.tsx` — presentational modal: title, optional message, 1–2 buttons with `default | destructive | cancel` variants mapping to `colors.primary` / `colors.danger` / `colors.textSecondary`.
- `src/components/DialogProvider.tsx` — holds dialog state, exposes an **imperative** API via `useDialog()`: `alert({ title, message })` and `confirm({ title, message, confirmLabel, cancelLabel, destructive })` returning `Promise<boolean>`.
- Imperative rather than declarative because all existing call sites are inside `async` handlers, not render — this keeps the migration a near drop-in and minimises the diff across 9 files.
- Must handle: Android hardware back button (resolves as cancel), and unmount-while-open without leaking the pending promise.

### 2.3 Migration map

**→ Toast** (transient confirmations):
| File | Line | Current |
|---|---|---|
| `app/(app)/entry/[id].tsx` | 148 | `Alert.alert(t('detail.copied'))` |
| `app/(app)/(tabs)/generator.tsx` | 52 | `Alert.alert(t('generator.copied'))` |
| `app/(onboarding)/recovery-code.tsx` | 17 | `Alert.alert(t('recoveryCode.copied'))` |

**→ Dialog** (blocking):
| File | Line(s) | Kind |
|---|---|---|
| `app/(app)/entry/[id].tsx` | 159 | confirm delete (destructive) |
| `app/(app)/settings/biometric.tsx` | 30, 39 | alert |
| `app/(onboarding)/biometric.tsx` | 28 | alert |
| `app/(app)/import/pick.tsx` | 17 | alert |
| `app/(app)/import/confirm.tsx` | 38, 41 | alert |
| `app/recovery-unlock.tsx` | 40 | error |
| `app/(onboarding)/set-password.tsx` | 49 | error |
| `app/unlock.tsx` | 52, 66 | error |

**i18n defect folded in:** `unlock.tsx:52,66`, `set-password.tsx:49`, and `recovery-unlock.tsx:40` pass a hardcoded English `'Error'` title, violating the PT-default/EN i18n rule. These get proper namespaced keys in PT and EN as part of the migration.

---

## 3. Clipboard retention → 2 minutes

- Introduce `export const CLIPBOARD_CLEAR_SECONDS = 120;` in `src/native/clipboardWorker.ts`; use it as the default parameter of `copyAndScheduleClear`.
- Remove the hardcoded `30` at `app/(app)/entry/[id].tsx:147` so the call site inherits the constant.
- Update the two strings that reference the duration to reflect 2 minutes:
  - `src/i18n/locales/pt/vault.json:17` — `"Copiado! Será limpo em 30s"`
  - `src/i18n/locales/en/vault.json:17` — `"Copied! Will clear in 30s"`
  These are the only locale strings naming the duration; they must be kept in sync with `CLIPBOARD_CLEAR_SECONDS`.

**Native hardening (same change):** set `ClipDescription.EXTRA_IS_SENSITIVE` on the `ClipData` written by the clipboard path. On Android 13+ this keeps the password out of the system clipboard preview popup. This partly offsets the security cost of the longer retention window and should not be split out.

**Accepted tradeoff:** a longer window means longer exposure to any app that reads the clipboard. 2 minutes was chosen deliberately over 5 as the balance point.

---

## 4. Lock → unlock → route restore

**This section contains the blank-screen fix.**

### 4.1 Pending-route store

New `src/auth/lockRoute.ts`:
- Module-level `pendingRoute: string | null`.
- `setPendingRoute(path: string): void` — stores only paths under `/(app)/`; anything else is ignored.
- `takePendingRoute(): string | null` — returns and **clears** in one call, so a route can never be restored twice.
- `clearPendingRoute(): void` — used on explicit sign-out/reset.

Module-level state (not zustand) is deliberate: this value must survive the unmount of every React tree between lock and unlock.

### 4.2 Redirect on lock

In `app/(app)/_layout.tsx`:
- Subscribe to `useAuthStore(s => s.status)`.
- On a transition **out of** `'unlocked'`, capture the current path (`usePathname()`), pass it to `setPendingRoute`, and `router.replace('/unlock')`.
- `replace` (not `push`) so the locked screens are torn out of the stack rather than left behind it.

This is the fix for the reported blank screen: the vault was locking correctly, the app just never navigated.

### 4.3 Restore on unlock

In `app/unlock.tsx`, on successful unlock (both password and biometric paths):
- `const next = takePendingRoute(); router.replace(next ?? '/(app)/(tabs)');`

### 4.4 Why this makes secrets safe by construction

Because lock resets the navigation stack, the restored screen **remounts from scratch**. All local component state returns to its declared default — including the reveal toggle in §5. Nothing has to explicitly reset the reveal state, and the guarantee survives future screens that add their own local secret state. This is a structural property, not a convention to be maintained.

---

## 5. Password reveal toggle

Currently `app/(app)/entry/[id].tsx:182` hardcodes `value="••••••••"`; the real password is only ever passed to `onCopy`. There is no way to look at a stored password — only copy it.

- `FieldProps` gains `secret?: boolean` and, when set, renders an Eye/EyeOff toggle (lucide-react-native, consistent with the existing icon usage).
- Entry detail holds `const [revealed, setRevealed] = useState(false)`; the password `Field` receives the real value when revealed and the mask otherwise.
- **Defaults to hidden.** Per §4.4, remount-on-unlock resets it automatically.
- Toggle needs an `accessibilityLabel`, translated in PT and EN.

---

## 6. Google Drive sync

Two independent problems: missing configuration (user-side) and swallowed errors (code-side). Both must be addressed or the symptom persists.

### 6.1 Configuration — user action required

The user has confirmed no OAuth client was ever created, so **this feature has never worked**. Required steps, to be documented in the README:

1. Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID → **Android**.
2. Package name: `com.vaultsync.app` (per `app.json`).
3. SHA-1 fingerprint: **`5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`**

   This comes from **`android/app/debug.keystore`**, *not* `~/.android/debug.keystore`. `android/app/build.gradle:111` declares `storeFile file('debug.keystore')`, which resolves relative to the app module, and **both** the `debug` and `release` buildTypes use that config (lines 119, 124). Both keystores exist on the dev machine and yield different fingerprints (`5E:8F:…` vs `55:83:…`). A mismatched SHA-1 makes the OAuth flow fail **silently** — no error, it simply never completes — which is indistinguishable from the bug being fixed here. Verify with:
   ```
   /opt/homebrew/opt/openjdk@17/bin/keytool -list -v \
     -keystore android/app/debug.keystore \
     -alias androiddebugkey -storepass android -keypass android
   ```
4. Enable the **Google Drive API** (APIs & Services → Library) — a separate step from creating the credential.
5. Add the developer's Google account as a **test user** on the OAuth consent screen, or an unverified app will block sign-in.
6. `cp .env.example .env` and set `EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID`.
7. Rebuild — `EXPO_PUBLIC_*` vars are inlined at **build** time, so an existing APK will not pick up a new `.env`.

> **Security note (not blocking, do not lose):** the fingerprint above belongs to the stock React Native template debug keystore — valid from 2013, committed to this repo, and byte-identical across thousands of RN projects. It is not unique to this app, so anyone can sign an APK with the same key and package name. Acceptable for sideloading a personal build; **a real keystore must be generated before any public distribution.** The README already flags this for the Play Store; for a password manager it is a genuine prerequisite rather than a formality.

### 6.2 Code fixes

- **Surface errors.** Wrap both call sites (`settings/sync.tsx:69`, `(onboarding)/drive-signin.tsx:15`) so a rejection sets an error status **and** raises the §2.2 dialog. No tap may ever be a silent no-op.
- **Add `isDriveConfigured()`** to `src/drive/auth.ts` returning whether the client ID is present, so the UI can distinguish "not set up" from "sign-in failed" and show an actionable message rather than a raw exception string.
- **Fix the button-state defect.** Resolve `hasDriveToken()` on mount in `settings/sync.tsx` and set sync status accordingly, so "Connect" is offered from the first render instead of requiring a wasted tap.
- **i18n** all new error copy in PT and EN.

### 6.3 Folded-in backlog item

`settings/sync.tsx` currently shows "Synced" before any sync has occurred. Add a distinct "never synced" label for `status === 'idle' && lastSyncedAt === null`. This is an existing NEXT.md backlog item in a file this spec already modifies.

---

## 7. Testing

Gates remain `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, all of which must stay green. Baseline: 250 tests / 48 suites.

| Area | Coverage |
|---|---|
| Toast | Wrapper calls through with the right message; custom renderer uses theme tokens |
| Dialog | Renders title/message/buttons; `confirm` resolves true/false; back button cancels; destructive variant styling |
| Migration | Each migrated screen shows the new surface instead of `Alert` |
| **Lock redirect** | **Auto-lock while on a tabs route redirects to `/unlock` — the actual reported regression** |
| `lockRoute` | Capture/restore round-trip; `take` clears; non-`/(app)/` paths rejected |
| Reveal toggle | Defaults hidden; toggles; **a fresh mount is hidden again** |
| Clipboard | `copyAndScheduleClear` defaults to 120s; call site passes no literal |
| Drive | Missing client ID surfaces an error rather than an unhandled rejection; `isDriveConfigured` both ways; button offers Connect when no token |
| Sync label | "never synced" vs "Synced" |
| Native | `EXTRA_IS_SENSITIVE` set — `:vaultsync-native:connectedAndroidTest` (requires emulator/device) |

---

## 8. Risks

- **Native rebuild required** for the `EXTRA_IS_SENSITIVE` change. Documented toolchain constraints apply: `JAVA_HOME=/opt/homebrew/opt/openjdk@17`, run gradle via context-mode, `./gradlew --stop` first if the foojay error appears.
- **Drive remains unverifiable** until the user completes §6.1. The code fixes are testable in isolation; the end-to-end flow is not, and this should not be reported as working until exercised on-device.
- **Toast library swap** is a live possibility (§2.1). The `showToast` wrapper is the mitigation; call sites must not import the library directly.
- **On-device verification still outstanding** from prior work (`docs/TESTING-autofill.md`) and is not superseded by this spec.

---

## 9. Decisions

| ID | Decision | Rationale |
|---|---|---|
| D1 | One spec for all four items | Overlapping files; `entry/[id].tsx` touched by three |
| D2 | `react-native-toast-message`, not sonner-native | Zero native deps; sonner-native needs gesture-handler + rebuild on a fragile toolchain |
| D3 | Hand-built Dialog | No library matches DESIGN.md; RN `Modal` sufficient |
| D4 | Clipboard 2 min, not 5 | Balance of usability against exposure window |
| D5 | Restore route after unlock | Remount makes hidden-by-default structural (§4.4) |
| D6 | Add reveal toggle | Passwords are currently copy-only and can never be viewed |
| D7 | Imperative dialog API | Call sites are async handlers, not render — minimises diff |
| D8 | sonner-native retained as documented fallback | User-approved escape hatch if D2 disappoints |
