# Autofill "Enable" entry point — design

**Date:** 2026-07-04
**Status:** Approved (brainstorm)
**Depends on:** shipped Autofill Framework service (`VaultAutofillService`), I2b CryptoObject fix.

## Problem

VaultSync registers an Android Autofill Framework service, but there is no in-app way to turn it
on — the user must find it in system Settings. Android intentionally has no runtime-permission
dialog for this (and does NOT use an accessibility grant); the only sanctioned in-app affordance
is deep-linking to the OS autofill picker via `Settings.ACTION_REQUEST_SET_AUTOFILL_SERVICE`.
Add that affordance in two places: a Settings row (with live status) and an onboarding step.

## Goals

- Settings screen: a row showing live autofill status (**Active** / **Not set up**) and a button
  that opens the OS autofill picker for VaultSync.
- Onboarding: a skippable step (between biometric and Drive sign-in) nudging the user to enable autofill.
- Graceful degradation on devices without autofill support (or API < 26).
- pt (default) + en strings.

## Non-goals (YAGNI)

- Home-screen banner / dismiss-state persistence.
- Detecting or naming *which* other app is the current autofill service.
- iOS (this is Android-only; the service is Android-only).

## Native API (Kotlin `VaultsyncNativeModule` + JS wrapper)

All three are guarded by `Build.VERSION.SDK_INT >= 26` (AutofillManager is API 26+); below that,
`isAutofillSupported` returns `false` and the others are no-ops / return `false`.

| JS (`src/native/autofill.ts`) | Native function | Backing call |
|---|---|---|
| `Autofill.isSupported(): Promise<boolean>` | `isAutofillSupported()` | `AutofillManager.isAutofillSupported()` |
| `Autofill.isEnabled(): Promise<boolean>` | `isAutofillServiceEnabled()` | `AutofillManager.hasEnabledAutofillServices()` (true iff **this** app is the active service) |
| `Autofill.requestEnable(): Promise<void>` | `requestSetAutofillService()` | `startActivity(Intent(ACTION_REQUEST_SET_AUTOFILL_SERVICE).setData(Uri.parse("package:$packageName")))` on the current activity |

- `AutofillManager` obtained via `appContext.reactContext?.getSystemService(AutofillManager::class.java)`.
- `requestSetAutofillService`: use `appContext.currentActivity` (reject/no-op if null); the intent shows
  the system confirmation dialog. It does not report success — status is re-read on return (see below).
- Expose in the module's `AsyncFunction` definitions, mirroring the existing keystore/vault wrappers.
  The JS surface is a new `src/native/autofill.ts` exporting an `Autofill` object over `VaultsyncNative`,
  exactly mirroring how `src/native/keystore.ts` wraps `Keystore` / `VaultStore`.

## Settings row + screen

- `app/(app)/(tabs)/settings.tsx`: add `{ label: t('rows.autofill'), path: '/(app)/settings/autofill' }`
  to the `rows` array (after `biometric`).
- New `app/(app)/settings/autofill.tsx`, mirroring `app/(app)/settings/biometric.tsx` structure/theming:
  - On mount and on screen focus / `AppState` → `'active'`, call `Autofill.isSupported()` then, if supported,
    `Autofill.isEnabled()`; hold in state.
  - Render:
    - Not supported → disabled state, body copy "autofill not supported on this device".
    - Supported + enabled → status **Active**; button re-opens the picker (to change/confirm).
    - Supported + not enabled → status **Not set up**; primary button "Enable autofill" → `Autofill.requestEnable()`.
  - Re-checking on `AppState 'active'` reflects the new state after the user returns from the OS dialog.

## Onboarding step

- New `app/(onboarding)/autofill.tsx`, mirroring `app/(onboarding)/biometric.tsx` (Enable / Skip, theming, copy).
  - On mount, `Autofill.isSupported()`; if unsupported, immediately `router.replace('/(onboarding)/drive-signin')`
    (auto-skip, no empty screen).
  - "Enable autofill" → `Autofill.requestEnable()` then advance to `/(onboarding)/drive-signin`.
    (We advance regardless of the dialog outcome — enabling is optional and can be done later in Settings.)
  - "Skip" → `router.push('/(onboarding)/drive-signin')`.
- Reroute the previous step: in `app/(onboarding)/biometric.tsx`, change BOTH `router.push('/(onboarding)/drive-signin')`
  occurrences (the enable path and the skip path) to `'/(onboarding)/autofill'`. New order:
  welcome → set-password → recovery-code → **biometric → autofill → drive-signin** → app.

## i18n

- `settings.json` (pt + en): `rows.autofill`, and an `autofill.*` block (title, body, statusActive,
  statusNotSet, ctaEnable, notSupported).
- `onboarding.json` (pt + en): `autofill.*` block (title, body, ctaEnable, ctaSkip).

## Error handling

- Native calls never throw for "unsupported" — they return `false` / no-op. A missing current activity
  in `requestSetAutofillService` is a silent no-op (the button simply does nothing; extremely unlikely
  from a foreground screen). No user-facing error dialogs needed; this is a convenience affordance.

## Testing

Device-independent gates (run now):
- JS (jest-expo + RNTL), mocking the native `Autofill` module:
  - Settings screen: renders each of the three states (unsupported / enabled / not-enabled); "Enable"
    button calls `Autofill.requestEnable()`; status refreshes on `AppState 'active'`.
  - Onboarding screen: unsupported → auto-advances to drive-signin; Enable calls `requestEnable()` then
    advances; Skip advances; biometric screen now routes to `/(onboarding)/autofill`.
  - Keep the existing onboarding/unlock suites green (biometric reroute must not break them).
- Native: `:vaultsync-native:assembleDebug` compiles clean. The `AutofillManager` calls are thin and only
  meaningfully exercised on-device (covered by the separate manual device checklist), so no instrumented test.
- Gates: `pnpm test`, `pnpm run typecheck` (0), `pnpm run lint` (0). Strict lint (no-floating-promises,
  no-explicit-any — including tests). src/theme tokens only (no NativeWind/className) per project convention.

## Verification of "done"

JS suite green (with new tests), typecheck 0, lint 0, `assembleDebug` SUCCESSFUL. On-device confirmation
(row shows Active after enabling; onboarding step opens the picker) folds into the existing autofill device
checklist — not a merge blocker.
