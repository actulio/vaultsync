# Autofill "Enable" Entry Point Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give users an in-app way to turn on Android autofill — a Settings row with live status and a skippable onboarding step — via the OS autofill picker.

**Architecture:** Three thin Kotlin wrappers over the platform `AutofillManager` (API 26+), exposed to JS as `Autofill.{isSupported,isEnabled,requestEnable}`. Two React screens consume them: a Settings screen (live status + enable button, refreshed on `AppState 'active'`) and an onboarding step inserted between the biometric and Drive-sign-in steps.

**Tech Stack:** Expo modules (Kotlin), React Native + expo-router, i18next (pt/en), jest-expo + React Native Testing Library.

## Global Constraints

- Package manager is **pnpm** (never npm). Gates for JS-touching tasks: `pnpm test`, `pnpm run typecheck` (0 errors), `pnpm run lint` (0 errors).
- Strict lint: `no-floating-promises` and `no-explicit-any` are ON **including in tests** — `void` floating promises, no `any`.
- Styling: **`src/theme` tokens only** (no NativeWind / `className`).
- Every user-facing string ships in **both** `pt` (default) and `en` JSON.
- Native autofill APIs are **API 26+** — guard every call with `Build.VERSION.SDK_INT >= Build.VERSION_CODES.O`.
- App id `com.vaultsync.app`; autofill service `expo.modules.vaultsyncnative.autofill.VaultAutofillService`.
- Commit directly to `main` (project convention). Do NOT touch `.claude/settings.json` or `CLAUDE.md`.
- Onboarding order after this plan: welcome → set-password → recovery-code → **biometric → autofill → drive-signin**.

---

## File Structure

- `modules/vaultsync-native/android/src/main/java/expo/modules/vaultsyncnative/AutofillEnabler.kt` — **new** Kotlin helper over `AutofillManager`.
- `modules/vaultsync-native/android/src/main/java/expo/modules/vaultsyncnative/VaultsyncNativeModule.kt` — **modify**: 3 new `AsyncFunction`s.
- `modules/vaultsync-native/src/index.ts` — **modify**: 3 new method types.
- `src/native/autofill.ts` — **new** JS wrapper (`Autofill` object).
- `app/(app)/settings/autofill.tsx` — **new** Settings screen.
- `app/(app)/(tabs)/settings.tsx` — **modify**: add the row.
- `app/(onboarding)/autofill.tsx` — **new** onboarding step.
- `app/(onboarding)/biometric.tsx` — **modify**: reroute to the autofill step.
- `src/i18n/locales/{pt,en}/settings.json`, `src/i18n/locales/{pt,en}/onboarding.json` — **modify**: strings.
- `__tests__/screens/settings-autofill.test.tsx`, `__tests__/screens/onboarding-autofill.test.tsx` — **new** tests.

---

## Task 1: Native autofill bridge + JS wrapper

**Files:**
- Create: `modules/vaultsync-native/android/src/main/java/expo/modules/vaultsyncnative/AutofillEnabler.kt`
- Modify: `modules/vaultsync-native/android/src/main/java/expo/modules/vaultsyncnative/VaultsyncNativeModule.kt` (add functions after the `cancelClipboardClear` block, before `OnActivityResult`)
- Modify: `modules/vaultsync-native/src/index.ts`
- Create: `src/native/autofill.ts`

**Interfaces:**
- Produces (JS, consumed by Tasks 2 & 3):
  - `Autofill.isSupported(): Promise<boolean>`
  - `Autofill.isEnabled(): Promise<boolean>` — true iff **VaultSync** is the active autofill service
  - `Autofill.requestEnable(): Promise<void>` — opens the OS autofill picker

There is no JS unit test for this task — the wrapper is pure forwarding (exactly like `src/native/keystore.ts`, which has none) and the `AutofillManager` calls are only meaningfully exercised on-device. Verification is compile + typecheck + lint.

- [ ] **Step 1: Create the Kotlin helper**

`AutofillEnabler.kt`:
```kotlin
package expo.modules.vaultsyncnative

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.view.autofill.AutofillManager

/**
 * Thin wrapper over the platform AutofillManager for the in-app "enable autofill"
 * affordance. All calls are no-ops / false below API 26 (AutofillManager is API 26+).
 */
class AutofillEnabler(private val context: Context) {
  private fun manager(): AutofillManager? =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.getSystemService(AutofillManager::class.java)
    } else {
      null
    }

  /** Whether this device supports the Autofill Framework. */
  fun isSupported(): Boolean = manager()?.isAutofillSupported == true

  /** Whether THIS app is the currently-selected autofill service. */
  fun isEnabled(): Boolean = manager()?.hasEnabledAutofillServices() == true

  /**
   * Open the OS autofill picker for this app (a system confirmation dialog).
   * Returns false if unsupported or there is no foreground activity.
   */
  fun requestEnable(activity: Activity?): Boolean {
    if (activity == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false
    val intent = Intent(Settings.ACTION_REQUEST_SET_AUTOFILL_SERVICE)
      .setData(Uri.parse("package:${activity.packageName}"))
    return try {
      activity.startActivity(intent)
      true
    } catch (e: Exception) {
      false
    }
  }
}
```

- [ ] **Step 2: Add the three AsyncFunctions to the module**

In `VaultsyncNativeModule.kt`, inside `definition() = ModuleDefinition { ... }`, add after the `cancelClipboardClear` `AsyncFunction` block and before `OnActivityResult`:
```kotlin
    val autofill = AutofillEnabler(appContext.reactContext!!)

    AsyncFunction("isAutofillSupported") { promise: Promise ->
      promise.resolve(autofill.isSupported())
    }

    AsyncFunction("isAutofillServiceEnabled") { promise: Promise ->
      promise.resolve(autofill.isEnabled())
    }

    AsyncFunction("requestSetAutofillService") { promise: Promise ->
      autofill.requestEnable(appContext.currentActivity)
      promise.resolve(null)
    }
```

- [ ] **Step 3: Extend the native TS interface**

In `modules/vaultsync-native/src/index.ts`, add these three lines to the `VaultsyncNativeModule` type (e.g. after `cancelClipboardClear(): Promise<void>;`):
```ts
  isAutofillSupported(): Promise<boolean>;
  isAutofillServiceEnabled(): Promise<boolean>;
  requestSetAutofillService(): Promise<void>;
```

- [ ] **Step 4: Create the JS wrapper**

`src/native/autofill.ts`:
```ts
import VaultsyncNative from '../../modules/vaultsync-native/src';

export const Autofill = {
  /** Whether this device supports the Android Autofill Framework. */
  isSupported: (): Promise<boolean> => VaultsyncNative.isAutofillSupported(),
  /** Whether VaultSync is the currently-selected autofill service. */
  isEnabled: (): Promise<boolean> => VaultsyncNative.isAutofillServiceEnabled(),
  /** Open the OS autofill picker so the user can select VaultSync. */
  requestEnable: (): Promise<void> => VaultsyncNative.requestSetAutofillService(),
};
```

- [ ] **Step 5: Compile the native module**

Run (context-mode sandbox `ctx_execute` shell):
```
cd /Users/work/personal/random/vaultsync/android && \
  JAVA_HOME="$(/usr/libexec/java_home -v 17 2>/dev/null || echo /opt/homebrew/opt/openjdk@17)" \
  ANDROID_HOME="$HOME/Library/Android/sdk" ./gradlew :vaultsync-native:assembleDebug --console=plain
```
Expected: `BUILD SUCCESSFUL`, zero Kotlin errors. (Pre-existing `CXX5101` NDK warnings are unrelated env noise.)

- [ ] **Step 6: Typecheck + lint**

Run: `cd /Users/work/personal/random/vaultsync && pnpm run typecheck && pnpm run lint`
Expected: 0 errors both.

- [ ] **Step 7: Commit**

```bash
git add modules/vaultsync-native/android/src/main/java/expo/modules/vaultsyncnative/AutofillEnabler.kt \
        modules/vaultsync-native/android/src/main/java/expo/modules/vaultsyncnative/VaultsyncNativeModule.kt \
        modules/vaultsync-native/src/index.ts src/native/autofill.ts
git commit -m "feat(autofill): native bridge to query + request the OS autofill service

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Settings autofill screen + row + strings

**Files:**
- Create: `app/(app)/settings/autofill.tsx`
- Modify: `app/(app)/(tabs)/settings.tsx`
- Modify: `src/i18n/locales/pt/settings.json`, `src/i18n/locales/en/settings.json`
- Test: `__tests__/screens/settings-autofill.test.tsx`

**Interfaces:**
- Consumes: `Autofill.isSupported()`, `Autofill.isEnabled()`, `Autofill.requestEnable()` from Task 1.
- Produces: route `/(app)/settings/autofill`.

- [ ] **Step 1: Add strings (both locales)**

Merge into `src/i18n/locales/pt/settings.json` — add `"autofill"` inside the existing `rows` object, and a top-level `autofill` block:
```json
"rows": { "autofill": "Autopreenchimento" },
"autofill": {
  "title": "Autopreenchimento",
  "body": "Preencha logins salvos em outros apps e sites. Requer definir o VaultSync como serviço de autopreenchimento do Android.",
  "statusActive": "Ativo",
  "statusNotSet": "Não configurado",
  "ctaEnable": "Ativar autopreenchimento",
  "notSupported": "O autopreenchimento não é compatível com este dispositivo."
}
```
(The `rows` object already exists — add only the `autofill` key to it, do not overwrite siblings.)

`src/i18n/locales/en/settings.json` — same shape:
```json
"rows": { "autofill": "Autofill" },
"autofill": {
  "title": "Autofill",
  "body": "Fill saved logins in other apps and websites. Requires setting VaultSync as Android's autofill service.",
  "statusActive": "Active",
  "statusNotSet": "Not set up",
  "ctaEnable": "Enable autofill",
  "notSupported": "Autofill isn't supported on this device."
}
```

- [ ] **Step 2: Write the failing test**

`__tests__/screens/settings-autofill.test.tsx`:
```tsx
import React from 'react';
import { AppState } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('@/native/autofill', () => ({
  Autofill: {
    isSupported: jest.fn().mockResolvedValue(true),
    isEnabled: jest.fn().mockResolvedValue(false),
    requestEnable: jest.fn().mockResolvedValue(undefined),
  },
}));

import { Autofill } from '@/native/autofill';
import AutofillSettings from '../../app/(app)/settings/autofill';

const mocked = Autofill as unknown as {
  isSupported: jest.Mock;
  isEnabled: jest.Mock;
  requestEnable: jest.Mock;
};

describe('Autofill settings screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mocked.isSupported.mockResolvedValue(true);
    mocked.isEnabled.mockResolvedValue(false);
    mocked.requestEnable.mockResolvedValue(undefined);
  });

  it('shows "Não configurado" + an enable button when supported and not enabled', async () => {
    const { findByText } = render(<AutofillSettings />);
    expect(await findByText('Não configurado')).toBeTruthy();
    expect(await findByText('Ativar autopreenchimento')).toBeTruthy();
  });

  it('shows "Ativo" when VaultSync is the active service', async () => {
    mocked.isEnabled.mockResolvedValue(true);
    const { findByText } = render(<AutofillSettings />);
    expect(await findByText('Ativo')).toBeTruthy();
  });

  it('shows the not-supported message and no enable button when unsupported', async () => {
    mocked.isSupported.mockResolvedValue(false);
    const { findByText, queryByText } = render(<AutofillSettings />);
    expect(await findByText('O autopreenchimento não é compatível com este dispositivo.')).toBeTruthy();
    expect(queryByText('Ativar autopreenchimento')).toBeNull();
  });

  it('calls Autofill.requestEnable when the enable button is pressed', async () => {
    const { findByText } = render(<AutofillSettings />);
    const btn = await findByText('Ativar autopreenchimento');
    void fireEvent.press(btn);
    expect(mocked.requestEnable).toHaveBeenCalledTimes(1);
  });

  it('re-checks status on AppState "active" (flips to Ativo after enabling)', async () => {
    const addSpy = jest.spyOn(AppState, 'addEventListener');
    const { findByText } = render(<AutofillSettings />);
    await findByText('Não configurado');
    mocked.isEnabled.mockResolvedValue(true);
    const cb = addSpy.mock.calls[0][1] as (s: string) => void;
    await act(async () => { cb('active'); });
    expect(await findByText('Ativo')).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm test -- settings-autofill`
Expected: FAIL — cannot resolve `../../app/(app)/settings/autofill`.

- [ ] **Step 4: Implement the screen**

`app/(app)/settings/autofill.tsx`:
```tsx
import { useCallback, useEffect, useState, type JSX } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Autofill } from '@/native/autofill';
import { useTheme } from '@/theme';

export default function AutofillSettings(): JSX.Element {
  const { t } = useTranslation('settings');
  const { colors, spacing, radii, type } = useTheme();
  // null = still loading; avoids a flash of the wrong state.
  const [supported, setSupported] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(false);

  const check = useCallback(async (): Promise<void> => {
    const s = await Autofill.isSupported();
    setSupported(s);
    setEnabled(s ? await Autofill.isEnabled() : false);
  }, []);

  useEffect(() => {
    void check();
    // Returning from the OS autofill picker fires AppState 'active' — re-read status then.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => sub.remove();
  }, [check]);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    content: { paddingHorizontal: spacing.lg, paddingTop: spacing['3xl'] },
    title: { ...type.title, color: colors.textPrimary, marginBottom: spacing.sm },
    status: { ...type.bodyStrong, color: colors.textSecondary, marginBottom: spacing.md },
    body: { ...type.body, color: colors.textSecondary, marginBottom: spacing['2xl'] },
    cta: {
      height: 52,
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      justifyContent: 'center',
      alignItems: 'center',
    },
    ctaLabel: { ...type.bodyStrong, color: colors.onPrimary },
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('autofill.title')}</Text>
      {supported === false ? (
        <Text style={styles.body}>{t('autofill.notSupported')}</Text>
      ) : supported === true ? (
        <>
          <Text style={styles.status}>
            {enabled ? t('autofill.statusActive') : t('autofill.statusNotSet')}
          </Text>
          <Text style={styles.body}>{t('autofill.body')}</Text>
          {!enabled && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('autofill.ctaEnable')}
              onPress={() => { void Autofill.requestEnable(); }}
              style={({ pressed }) => [styles.cta, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={styles.ctaLabel}>{t('autofill.ctaEnable')}</Text>
            </Pressable>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}
```

- [ ] **Step 5: Add the Settings row**

In `app/(app)/(tabs)/settings.tsx`, add to the `rows` array after the `biometric` entry:
```tsx
    { label: t('rows.autofill'), path: '/(app)/settings/autofill' },
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm test -- settings-autofill`
Expected: PASS (5/5).

- [ ] **Step 7: Full gates**

Run: `pnpm test && pnpm run typecheck && pnpm run lint`
Expected: suite green, typecheck 0, lint 0.

- [ ] **Step 8: Commit**

```bash
git add "app/(app)/settings/autofill.tsx" "app/(app)/(tabs)/settings.tsx" \
        src/i18n/locales/pt/settings.json src/i18n/locales/en/settings.json \
        "__tests__/screens/settings-autofill.test.tsx"
git commit -m "feat(autofill): Settings row + screen to enable autofill with live status

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Onboarding autofill step + biometric reroute

**Files:**
- Create: `app/(onboarding)/autofill.tsx`
- Modify: `app/(onboarding)/biometric.tsx`
- Modify: `src/i18n/locales/pt/onboarding.json`, `src/i18n/locales/en/onboarding.json`
- Test: `__tests__/screens/onboarding-autofill.test.tsx`

**Interfaces:**
- Consumes: `Autofill.isSupported()`, `Autofill.requestEnable()` from Task 1.
- Produces: route `/(onboarding)/autofill`; new flow order biometric → autofill → drive-signin.

- [ ] **Step 1: Add strings (both locales)**

Add a top-level `autofill` block to `src/i18n/locales/pt/onboarding.json`:
```json
"autofill": {
  "title": "Ativar autopreenchimento",
  "body": "Deixe o VaultSync preencher seus logins em outros apps e sites. Você pode ativar agora ou depois nas Configurações.",
  "ctaEnable": "Ativar",
  "ctaSkip": "Agora não"
}
```
`src/i18n/locales/en/onboarding.json`:
```json
"autofill": {
  "title": "Enable autofill",
  "body": "Let VaultSync fill your logins in other apps and websites. You can enable it now or later in Settings.",
  "ctaEnable": "Enable",
  "ctaSkip": "Not now"
}
```

- [ ] **Step 2: Write the failing test**

`__tests__/screens/onboarding-autofill.test.tsx`:
```tsx
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('@/native/autofill', () => ({
  Autofill: {
    isSupported: jest.fn().mockResolvedValue(true),
    isEnabled: jest.fn().mockResolvedValue(false),
    requestEnable: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
}));

import { Autofill } from '@/native/autofill';
import { router } from 'expo-router';
import AutofillOnboarding from '../../app/(onboarding)/autofill';

const mocked = Autofill as unknown as { isSupported: jest.Mock; requestEnable: jest.Mock };

describe('Autofill onboarding step', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mocked.isSupported.mockResolvedValue(true);
    mocked.requestEnable.mockResolvedValue(undefined);
  });

  it('renders title + Enable/Skip when supported', async () => {
    const { findByText } = render(<AutofillOnboarding />);
    expect(await findByText('Ativar autopreenchimento')).toBeTruthy();
    expect(await findByText('Ativar')).toBeTruthy();
    expect(await findByText('Agora não')).toBeTruthy();
  });

  it('Enable calls requestEnable then advances to drive-signin', async () => {
    const { findByText } = render(<AutofillOnboarding />);
    void fireEvent.press(await findByText('Ativar'));
    await waitFor(() => expect(mocked.requestEnable).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/(onboarding)/drive-signin'));
  });

  it('Skip advances to drive-signin without requesting', async () => {
    const { findByText } = render(<AutofillOnboarding />);
    void fireEvent.press(await findByText('Agora não'));
    expect(router.push).toHaveBeenCalledWith('/(onboarding)/drive-signin');
    expect(mocked.requestEnable).not.toHaveBeenCalled();
  });

  it('auto-skips (router.replace) when autofill is unsupported', async () => {
    mocked.isSupported.mockResolvedValue(false);
    render(<AutofillOnboarding />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(onboarding)/drive-signin'));
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm test -- onboarding-autofill`
Expected: FAIL — cannot resolve `../../app/(onboarding)/autofill`.

- [ ] **Step 4: Implement the onboarding screen**

`app/(onboarding)/autofill.tsx`:
```tsx
import { useEffect, type JSX } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Autofill } from '@/native/autofill';
import { useTheme } from '@/theme';

const NEXT = '/(onboarding)/drive-signin';

export default function AutofillOnboarding(): JSX.Element {
  const { t } = useTranslation('onboarding');
  const { colors, spacing, radii, type } = useTheme();

  useEffect(() => {
    // Nothing to offer on unsupported devices — skip straight past this step.
    void Autofill.isSupported().then((s) => {
      if (!s) router.replace(NEXT);
    });
  }, []);

  const onEnable = async (): Promise<void> => {
    // Fire the OS picker; advance regardless of outcome (enabling is optional
    // and can be done later in Settings).
    await Autofill.requestEnable();
    router.push(NEXT);
  };

  const styles = StyleSheet.create({
    scroll: { flex: 1, backgroundColor: colors.bg },
    container: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing['5xl'],
      paddingBottom: spacing['3xl'],
      justifyContent: 'center',
      flex: 1,
    },
    title: { ...type.title, color: colors.textPrimary, marginBottom: spacing.md },
    body: { ...type.body, color: colors.textSecondary, marginBottom: spacing['2xl'] },
    ctaEnable: {
      height: 52,
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      justifyContent: 'center',
      alignItems: 'center',
    },
    ctaEnableLabel: { ...type.bodyStrong, color: colors.onPrimary },
    ctaSkip: {
      height: 52,
      borderRadius: radii.md,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: spacing.md,
    },
    ctaSkipLabel: { ...type.bodyStrong, color: colors.primary },
  });

  return (
    <View style={styles.scroll}>
      <View style={styles.container}>
        <Text style={styles.title}>{t('autofill.title')}</Text>
        <Text style={styles.body}>{t('autofill.body')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('autofill.ctaEnable')}
          onPress={() => { void onEnable(); }}
          style={({ pressed }) => [styles.ctaEnable, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={styles.ctaEnableLabel}>{t('autofill.ctaEnable')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('autofill.ctaSkip')}
          onPress={() => router.push(NEXT)}
          style={({ pressed }) => [styles.ctaSkip, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={styles.ctaSkipLabel}>{t('autofill.ctaSkip')}</Text>
        </Pressable>
      </View>
    </View>
  );
}
```

(`type.title` is the same token `app/(onboarding)/biometric.tsx` uses for its screen title — the theme type scale is `display` / `title` / `body` / `bodyStrong`; there is no `headline`.)

- [ ] **Step 5: Reroute the biometric step to the autofill step**

In `app/(onboarding)/biometric.tsx`, change BOTH occurrences of `router.push('/(onboarding)/drive-signin')` (the end of the `enable` function, and the Skip `Pressable`'s `onPress`) to:
```tsx
router.push('/(onboarding)/autofill')
```

- [ ] **Step 6: Update any existing test asserting biometric → drive-signin**

Run: `cd /Users/work/personal/random/vaultsync && grep -rn "onboarding)/drive-signin" __tests__`
For any assertion that the **biometric** screen/flow navigates to `drive-signin`, update the expected target to `'/(onboarding)/autofill'`. (Do not change unrelated assertions — the autofill and drive-signin screens still legitimately navigate to `drive-signin`.)

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm test -- onboarding-autofill` then `pnpm test`
Expected: new file 4/4 PASS; full suite green (including any updated biometric-reroute assertion).

- [ ] **Step 8: Full gates**

Run: `pnpm run typecheck && pnpm run lint`
Expected: 0 errors both.

- [ ] **Step 9: Commit**

```bash
git add "app/(onboarding)/autofill.tsx" "app/(onboarding)/biometric.tsx" \
        src/i18n/locales/pt/onboarding.json src/i18n/locales/en/onboarding.json \
        "__tests__/screens/onboarding-autofill.test.tsx"
# also add any onboarding test file you edited in Step 6
git commit -m "feat(autofill): skippable onboarding step to enable autofill after biometric

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Done criteria

- `pnpm test` green (with new settings + onboarding autofill suites), `pnpm run typecheck` 0, `pnpm run lint` 0.
- `:vaultsync-native:assembleDebug` BUILD SUCCESSFUL.
- On-device confirmation (Settings row shows Active after enabling; onboarding step opens the picker) folds into `docs/TESTING-autofill.md` — not a merge blocker.
