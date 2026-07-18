# UX Polish, Lock Restore & Drive Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace stock Android alerts with a branded toast/dialog system, extend clipboard retention to 2 minutes with native sensitive-content marking, fix the blank-screen-on-foreground bug via lock-route restore, add a password reveal toggle, and make Drive sync report its failures.

**Architecture:** A new `src/components/` layer provides two notification surfaces — a toast (thin wrapper over `react-native-toast-message`, custom-rendered from theme tokens) and a hand-built modal dialog with an imperative promise-based API. Navigation gains a module-level pending-route store so that locking resets the stack and unlocking restores the prior screen via a fresh mount. Drive gains a configuration probe and error surfacing at both call sites.

**Tech Stack:** Expo 56 / RN 0.85 / React 19.2, expo-router, zustand, i18next (PT default + EN), `src/theme` design tokens, Jest + @testing-library/react-native, Kotlin/Expo Modules for native.

**Source spec:** `docs/superpowers/specs/2026-07-18-ux-polish-lock-drive-design.md`

---

## Global Constraints

These apply to **every** task. Requirements below are implicitly part of each task's definition of done.

- **Package manager is pnpm.** Never npm. Lockfile is `pnpm-lock.yaml`.
- **Gates, run after every task:** `pnpm test`, `pnpm run typecheck`, `pnpm run lint`. All three must pass. Lint baseline is **0** errors — do not add any.
- **Baseline at plan start (verified by controller 2026-07-18):** **260 tests / 49 suites**, typecheck 0, lint 0, HEAD `32f662d`.
- **Styling:** consume `useTheme()` tokens only — `colors`, `spacing`, `radii`, `sizes`, `type`. **No** NativeWind, **no** `className`, **no** inline hex, **no** magic numbers.
- **i18n:** PT is the default, EN required. Every user-visible string goes through a namespace. Extend namespaces via `src/i18n/registerUiNamespaces.ts` — **never** edit `initI18n`. Test with the longer PT strings.
- **Commits:** commit directly to `main` (project convention P2-D1). One commit per task minimum.
- **Crypto:** do not touch the AEAD / ChaCha20-Poly1305-IETF path.
- **Native changes** (Task 5 only) require a gradle build. Env: `JAVA_HOME=/opt/homebrew/opt/openjdk@17`, `ANDROID_HOME=/opt/homebrew/share/android-commandlinetools`. Run gradle via context-mode `ctx_execute` (Bash blocks `gradlew`). If the foojay / `JvmVendorSpec.IBM_SEMERU` error appears, run `./gradlew --stop` first. Avoid `prebuild --clean`.
- **Test file location:** `__tests__/**/*.test.{ts,tsx}` — this is the only path Jest matches.

### Spec deviation (approved during planning)

Spec §3 specifies setting `ClipDescription.EXTRA_IS_SENSITIVE` "on the ClipData written by the clipboard path". **That path is `expo-clipboard`, not our code**, and expo-clipboard exposes no sensitive-flag option. Task 5 therefore adds a native `copyToClipboard` function that writes the ClipData itself, replacing `expo-clipboard` for the secret-copy path. This is a mechanism change, not a scope change.

---

## File Structure

**Created:**
| File | Responsibility |
|---|---|
| `src/components/toast.tsx` | Toast wrapper (`showToast`) + token-styled render config + `<VaultToast />` host |
| `src/components/Dialog.tsx` | Presentational modal — title, message, 1–2 buttons |
| `src/components/DialogProvider.tsx` | Dialog state + imperative `useDialog()` API |
| `src/auth/lockRoute.ts` | Module-level pending-route store |
| `src/i18n/locales/{pt,en}/common.json` | Shared strings: error titles, OK/Cancel |

**Modified:** `app/_layout.tsx`, `app/(app)/_layout.tsx`, `app/unlock.tsx`, `app/(app)/entry/[id].tsx`, `app/(app)/(tabs)/generator.tsx`, `app/(onboarding)/recovery-code.tsx`, `app/(onboarding)/set-password.tsx`, `app/recovery-unlock.tsx`, `app/(app)/settings/biometric.tsx`, `app/(onboarding)/biometric.tsx`, `app/(app)/import/{pick,confirm}.tsx`, `app/(app)/settings/sync.tsx`, `app/(onboarding)/drive-signin.tsx`, `src/native/clipboardWorker.ts`, `src/drive/auth.ts`, `src/i18n/registerUiNamespaces.ts`, `src/i18n/locales/{pt,en}/{vault,sync}.json`, `modules/vaultsync-native/.../ClipboardModule.kt`, `modules/vaultsync-native/.../VaultsyncNativeModule.kt`, `modules/vaultsync-native/src/index.ts`

---

## Task 1: Toast infrastructure

**Files:**
- Create: `src/components/toast.tsx`
- Create: `src/i18n/locales/pt/common.json`, `src/i18n/locales/en/common.json`
- Modify: `src/i18n/registerUiNamespaces.ts`
- Modify: `app/_layout.tsx`
- Modify: `jest.config.js` (transformIgnorePatterns)
- Test: `__tests__/components/toast.test.tsx`

**Interfaces:**
- Consumes: `useTheme()` from `@/theme`
- Produces:
  - `showToast(message: string): void`
  - `<VaultToast />` — host component, mount once inside `ThemeProvider`
  - i18n namespace `common` with keys `errorTitle`, `ok`, `cancel`

- [ ] **Step 1: Install the library**

```bash
cd /Users/work/personal/random/vaultsync
pnpm add react-native-toast-message
```

Expected: adds `react-native-toast-message` ^2.4.0 to `dependencies`. No native rebuild — it uses RN's `Animated`.

- [ ] **Step 2: Allow the library through Jest's transform ignore**

In `jest.config.js`, change the `transformIgnorePatterns` entry to include the library:

```js
  transformIgnorePatterns: [
    'node_modules/(?!(.pnpm|expo|expo-modules-core|@expo|expo-router|react-native|@react-native|react-native-toast-message|lucide-react-native|libsodium-wrappers-sumo|@noble))',
  ],
```

- [ ] **Step 3: Write the failing test**

Create `__tests__/components/toast.test.tsx`:

```tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import Toast from 'react-native-toast-message';
import { ThemeProvider } from '@/theme';
import { VaultToast, showToast } from '@/components/toast';

jest.mock('react-native-toast-message', () => {
  const React = require('react');
  const show = jest.fn();
  const Mock = (props: unknown) => React.createElement('VaultToastHost', props as object);
  Mock.show = show;
  return { __esModule: true, default: Mock };
});

describe('toast', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders a host component', () => {
    const { UNSAFE_getByType } = render(
      <ThemeProvider>
        <VaultToast />
      </ThemeProvider>,
    );
    expect(UNSAFE_getByType(Toast as never)).toBeTruthy();
  });

  it('showToast forwards the message to the library', () => {
    showToast('Copiado!');
    expect((Toast as unknown as { show: jest.Mock }).show).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'vaultToast', text1: 'Copiado!' }),
    );
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `pnpm test __tests__/components/toast.test.tsx`
Expected: FAIL — `Cannot find module '@/components/toast'`

- [ ] **Step 5: Implement the toast module**

Create `src/components/toast.tsx`:

```tsx
import type { JSX } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useTheme } from '@/theme';

/** Auto-dismiss duration for transient confirmations. */
const TOAST_VISIBILITY_MS = 2000;

/** Custom renderer — DESIGN.md tokens only, no library default styling. */
function VaultToastBody({ text1 }: { text1?: string }): JSX.Element {
  const { colors, spacing, radii, type } = useTheme();
  const styles = StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      marginHorizontal: spacing.lg,
    },
    label: {
      ...type.body,
      color: colors.textPrimary,
      textAlign: 'center',
    },
  });

  return (
    <View style={styles.card} accessibilityRole="alert">
      <Text style={styles.label}>{text1}</Text>
    </View>
  );
}

const config = {
  vaultToast: ({ text1 }: { text1?: string }) => <VaultToastBody text1={text1} />,
};

/**
 * Toast host. Mount ONCE, inside ThemeProvider (the renderer reads tokens) and
 * as the last child (so it layers above every screen).
 */
export function VaultToast(): JSX.Element {
  return <Toast config={config} position="bottom" bottomOffset={40} />;
}

/**
 * Show a transient, non-blocking confirmation.
 *
 * Call sites MUST use this rather than importing react-native-toast-message
 * directly — it is the seam that keeps swapping to sonner-native (spec D8) a
 * one-file change.
 */
export function showToast(message: string): void {
  Toast.show({
    type: 'vaultToast',
    text1: message,
    visibilityTime: TOAST_VISIBILITY_MS,
    autoHide: true,
  });
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm test __tests__/components/toast.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 7: Add the shared error/action keys to the existing `common` namespace**

> **CORRECTED 2026-07-18 (controller).** An earlier draft of this step said to *create* these files and register them via `registerUiNamespaces`. Both are wrong: `src/i18n/locales/{pt,en}/common.json` **already exist**, and `common` is a **core** namespace loaded directly by `initI18n` (`src/i18n/index.ts:27` — `ns: ['common','errors'], defaultNS: 'common'`). Registering it again through `registerUiNamespaces` would be a duplicate registration.

**Merge** the needed keys into the existing `src/i18n/locales/pt/common.json` and `.../en/common.json`, preserving everything already there. Before adding a key, check whether an equivalent already exists — the file already carries an `actions` block containing `cancel`, `confirm`, `save`, `delete`, `back`, `next`, and `copy`. **Reuse `actions.cancel` rather than adding a second top-level `cancel`.**

Required after this step: an error-dialog title key (PT `"Erro"` / EN `"Error"`) and an OK-button key, plus a cancel label sourced from the existing `actions.cancel`.

- [ ] **Step 8: Leave `registerUiNamespaces.ts` unchanged**

`common` is a core namespace — no registration needed. Do not edit `initI18n` either (global constraint).

- [ ] **Step 9: Mount the host in the root layout**

In `app/_layout.tsx`, import the host:

```ts
import { VaultToast } from '@/components/toast';
```

and change `ThemedRoot` so the host is the last child inside the themed tree:

```tsx
  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <Stack screenOptions={{ headerShown: false }} />
      <VaultToast />
    </SafeAreaView>
  );
```

- [ ] **Step 10: Run all gates**

```bash
pnpm test && pnpm run typecheck && pnpm run lint
```
Expected: all green; test count 262 (260 + 2).

- [ ] **Step 11: Commit**

```bash
git add src/components/toast.tsx src/i18n/locales/pt/common.json src/i18n/locales/en/common.json \
        src/i18n/registerUiNamespaces.ts app/_layout.tsx jest.config.js package.json pnpm-lock.yaml \
        __tests__/components/toast.test.tsx
git commit -m "feat(ui): branded toast host and showToast wrapper"
```

---

## Task 2: Dialog component and provider

**Files:**
- Create: `src/components/Dialog.tsx`, `src/components/DialogProvider.tsx`
- Modify: `app/_layout.tsx`
- Test: `__tests__/components/dialog.test.tsx`

**Interfaces:**
- Consumes: `useTheme()`; the **core** i18n `common` namespace (loaded by `initI18n`, no registration needed). Available keys: `errorTitle`, `ok`, and `actions.cancel`. **Use `t('actions.cancel')`** — a top-level `cancel` was added in Task 1 and removed as a duplicate during its review.
- Produces:
  - `type DialogButtonVariant = 'default' | 'destructive' | 'cancel'`
  - `<DialogProvider>{children}</DialogProvider>`
  - `useDialog(): { alert(o: AlertOptions): Promise<void>; confirm(o: ConfirmOptions): Promise<boolean> }`
  - `type AlertOptions = { title: string; message?: string; okLabel?: string }`
  - `type ConfirmOptions = { title: string; message?: string; confirmLabel?: string; cancelLabel?: string; destructive?: boolean }`

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/dialog.test.tsx`:

```tsx
import React from 'react';
import { Button, Text } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '@/theme';
import { DialogProvider, useDialog } from '@/components/DialogProvider';

function Harness({ onResult }: { onResult: (v: boolean) => void }): React.JSX.Element {
  const dialog = useDialog();
  return (
    <Button
      title="ask"
      onPress={() => {
        void dialog
          .confirm({ title: 'Excluir esta entrada?', confirmLabel: 'Excluir', destructive: true })
          .then(onResult);
      }}
    />
  );
}

function wrap(ui: React.ReactElement): React.ReactElement {
  return (
    <ThemeProvider>
      <DialogProvider>{ui}</DialogProvider>
    </ThemeProvider>
  );
}

describe('DialogProvider', () => {
  it('shows the dialog title when confirm is called', async () => {
    const { getByText, findByText } = render(wrap(<Harness onResult={() => {}} />));
    fireEvent.press(getByText('ask'));
    expect(await findByText('Excluir esta entrada?')).toBeTruthy();
  });

  it('resolves true when the confirm button is pressed', async () => {
    const onResult = jest.fn();
    const { getByText, findByText } = render(wrap(<Harness onResult={onResult} />));
    fireEvent.press(getByText('ask'));
    fireEvent.press(await findByText('Excluir'));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
  });

  it('resolves false when the cancel button is pressed', async () => {
    const onResult = jest.fn();
    const { getByText, findByText } = render(wrap(<Harness onResult={onResult} />));
    fireEvent.press(getByText('ask'));
    fireEvent.press(await findByText('Cancelar'));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });

  it('closes after resolving', async () => {
    const { getByText, findByText, queryByText } = render(wrap(<Harness onResult={() => {}} />));
    fireEvent.press(getByText('ask'));
    fireEvent.press(await findByText('Cancelar'));
    await waitFor(() => expect(queryByText('Excluir esta entrada?')).toBeNull());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test __tests__/components/dialog.test.tsx`
Expected: FAIL — `Cannot find module '@/components/DialogProvider'`

- [ ] **Step 3: Implement the presentational Dialog**

Create `src/components/Dialog.tsx`:

```tsx
import type { JSX } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme';

export type DialogButtonVariant = 'default' | 'destructive' | 'cancel';

export type DialogButton = {
  label: string;
  variant: DialogButtonVariant;
  onPress: () => void;
};

export type DialogProps = {
  visible: boolean;
  title: string;
  message?: string | undefined;
  buttons: DialogButton[];
  /** Android hardware back / scrim tap. */
  onDismiss: () => void;
};

export function Dialog({
  visible,
  title,
  message,
  buttons,
  onDismiss,
}: DialogProps): JSX.Element {
  const { colors, spacing, radii, sizes, type } = useTheme();

  const styles = StyleSheet.create({
    scrim: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.xl,
    },
    title: { ...type.heading, color: colors.textPrimary },
    message: { ...type.body, color: colors.textSecondary, marginTop: spacing.sm },
    buttonRow: { marginTop: spacing['2xl'], gap: spacing.sm },
    button: {
      height: sizes.control,
      borderRadius: radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonDefault: { backgroundColor: colors.primary },
    buttonDestructive: { backgroundColor: colors.danger },
    buttonCancel: { backgroundColor: colors.surfaceAlt },
    labelOnColor: { ...type.bodyStrong, color: colors.onPrimary },
    labelCancel: { ...type.bodyStrong, color: colors.textPrimary },
  });

  const fillFor = (v: DialogButtonVariant): object => {
    if (v === 'destructive') return styles.buttonDestructive;
    if (v === 'cancel') return styles.buttonCancel;
    return styles.buttonDefault;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={styles.scrim}>
        <View style={styles.card} accessibilityViewIsModal accessibilityRole="alert">
          <Text style={styles.title}>{title}</Text>
          {message != null && message !== '' && <Text style={styles.message}>{message}</Text>}
          <View style={styles.buttonRow}>
            {buttons.map((b) => (
              <Pressable
                key={b.label}
                accessibilityRole="button"
                onPress={b.onPress}
                style={({ pressed }) => [
                  styles.button,
                  fillFor(b.variant),
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={b.variant === 'cancel' ? styles.labelCancel : styles.labelOnColor}>
                  {b.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 4: Implement the provider**

> ⚠️ **The reference code below has TWO KNOWN PROMISE LEAKS.** They were found in review during execution and fixed in commit `5b7e7e4` — **use the committed implementation in `src/components/DialogProvider.tsx`, not this snippet**, if you are re-running this task.
>
> 1. **Concurrent-call leak.** `pending` is a single slot. Calling `confirm()`/`alert()` again before the first settles overwrites `pending.current`, orphaning the first resolver — that promise hangs forever, never resolved and never rejected. Fix: settle any pending resolver as `false` **before** storing the new one (order matters — reversing it orphans the *new* resolver instead).
> 2. **Unmount leak.** Unmounting with a dialog open discards the pending resolver. Fix: a `useEffect(() => () => { ... }, [])` cleanup that resolves the pending promise via the ref directly — it must **not** call `settle()`, which would trigger `setState` on an unmounted component.
>
> Also: the `Dialog` scrim below is a plain `View`, so its documented "scrim tap" dismissal does not work. The fix makes the scrim a `Pressable` with the card as a nested `Pressable` carrying a no-op `onPress`.
>
> With 11 call sites wired onto this API, a hung promise means a handler that silently never continues — no crash, no error, effectively undebuggable. Do not reintroduce these.

Create `src/components/DialogProvider.tsx`:

```tsx
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, type DialogButton } from './Dialog';

export type AlertOptions = {
  title: string;
  message?: string | undefined;
  okLabel?: string | undefined;
};

export type ConfirmOptions = {
  title: string;
  message?: string | undefined;
  confirmLabel?: string | undefined;
  cancelLabel?: string | undefined;
  destructive?: boolean | undefined;
};

export type DialogApi = {
  alert: (o: AlertOptions) => Promise<void>;
  confirm: (o: ConfirmOptions) => Promise<boolean>;
};

const DialogContext = createContext<DialogApi | null>(null);

type State = {
  visible: boolean;
  title: string;
  message?: string | undefined;
  buttons: DialogButton[];
};

const CLOSED: State = { visible: false, title: '', buttons: [] };

export function DialogProvider({ children }: { children: ReactNode }): JSX.Element {
  const { t } = useTranslation('common');
  const [state, setState] = useState<State>(CLOSED);

  // Holds the resolver of the currently-open dialog so an unmount or a scrim
  // dismiss can settle it instead of leaking a forever-pending promise.
  const pending = useRef<((v: boolean) => void) | null>(null);

  const settle = useCallback((value: boolean) => {
    const resolve = pending.current;
    pending.current = null;
    setState(CLOSED);
    resolve?.(value);
  }, []);

  const alert = useCallback(
    (o: AlertOptions): Promise<void> =>
      new Promise<void>((resolve) => {
        pending.current = () => resolve();
        setState({
          visible: true,
          title: o.title,
          message: o.message,
          buttons: [
            { label: o.okLabel ?? t('ok'), variant: 'default', onPress: () => settle(true) },
          ],
        });
      }),
    [settle, t],
  );

  const confirm = useCallback(
    (o: ConfirmOptions): Promise<boolean> =>
      new Promise<boolean>((resolve) => {
        pending.current = resolve;
        setState({
          visible: true,
          title: o.title,
          message: o.message,
          buttons: [
            {
              label: o.confirmLabel ?? t('ok'),
              variant: o.destructive === true ? 'destructive' : 'default',
              onPress: () => settle(true),
            },
            {
              label: o.cancelLabel ?? t('actions.cancel'),
              variant: 'cancel',
              onPress: () => settle(false),
            },
          ],
        });
      }),
    [settle, t],
  );

  const api = useMemo<DialogApi>(() => ({ alert, confirm }), [alert, confirm]);

  return (
    <DialogContext.Provider value={api}>
      {children}
      <Dialog
        visible={state.visible}
        title={state.title}
        message={state.message}
        buttons={state.buttons}
        onDismiss={() => settle(false)}
      />
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  if (ctx == null) throw new Error('useDialog must be used within a DialogProvider');
  return ctx;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test __tests__/components/dialog.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 6: Mount the provider in the root layout**

In `app/_layout.tsx`, import it:

```ts
import { DialogProvider } from '@/components/DialogProvider';
```

and wrap the themed root so every screen can reach it:

```tsx
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <DialogProvider>
          <ThemedRoot />
        </DialogProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
```

- [ ] **Step 7: Run all gates**

```bash
pnpm test && pnpm run typecheck && pnpm run lint
```
Expected: all green; 266 tests.

- [ ] **Step 8: Commit**

```bash
git add src/components/Dialog.tsx src/components/DialogProvider.tsx app/_layout.tsx \
        __tests__/components/dialog.test.tsx
git commit -m "feat(ui): branded modal dialog with imperative useDialog API"
```

---

## Task 3: Migrate transient confirmations to toast

Three call sites that currently block with an `Alert` for a message that should not block.

**Files:**
- Modify: `app/(app)/entry/[id].tsx:148`, `app/(app)/(tabs)/generator.tsx:52`, `app/(onboarding)/recovery-code.tsx:17`
- Test: `__tests__/screens/toastMigration.test.tsx`

**Interfaces:**
- Consumes: `showToast(message: string): void` from `@/components/toast` (Task 1)

- [ ] **Step 1: Write the failing test**

Create `__tests__/screens/toastMigration.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('@/components/toast', () => ({
  showToast: jest.fn(),
  VaultToast: () => null,
}));

jest.mock('@/native/clipboardWorker', () => ({
  copyAndScheduleClear: jest.fn().mockResolvedValue(undefined),
  cancelPendingClear: jest.fn().mockResolvedValue(undefined),
}));

import { showToast } from '@/components/toast';
import Generator from '../../app/(app)/(tabs)/generator';

describe('transient confirmations use the toast', () => {
  beforeEach(() => jest.clearAllMocks());

  it('generator copy shows a toast, not an Alert', async () => {
    const { getByText } = render(<Generator />);
    fireEvent.press(getByText('Copiar'));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Senha copiada'));
  });
});
```

> If the generator's copy control is an icon button rather than text labelled `Copiar`, locate it with `getByLabelText` using the existing `accessibilityLabel` instead. Read the file before writing the query.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test __tests__/screens/toastMigration.test.tsx`
Expected: FAIL — `showToast` not called (the screen still calls `Alert.alert`).

- [ ] **Step 3: Migrate `app/(app)/(tabs)/generator.tsx`**

Remove `Alert` from the `react-native` import on line 3. Add:

```ts
import { showToast } from '@/components/toast';
```

Replace line 52 `Alert.alert(t('generator.copied'));` with:

```ts
    showToast(t('generator.copied'));
```

- [ ] **Step 4: Migrate `app/(app)/entry/[id].tsx`**

Add the import:

```ts
import { showToast } from '@/components/toast';
```

Replace line 148 `Alert.alert(t('detail.copied'));` with:

```ts
    showToast(t('detail.copied'));
```

Keep the `Alert` import for now — line 159's confirm-delete still uses it until Task 4.

- [ ] **Step 5: Migrate `app/(onboarding)/recovery-code.tsx`**

Remove `Alert` from the `react-native` import on line 2. Add:

```ts
import { showToast } from '@/components/toast';
```

Replace line 17 `Alert.alert(t('recoveryCode.copied'));` with:

```ts
    showToast(t('recoveryCode.copied'));
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm test __tests__/screens/toastMigration.test.tsx`
Expected: PASS.

- [ ] **Step 7: Run all gates**

```bash
pnpm test && pnpm run typecheck && pnpm run lint
```
Expected: all green. Existing tests that asserted on `Alert.alert` for these three sites will fail — update them to assert on `showToast` instead. Do **not** delete coverage.

- [ ] **Step 8: Commit**

```bash
git add app/ __tests__/
git commit -m "refactor(ui): transient copy confirmations use toast instead of Alert"
```

---

## Task 4: Migrate blocking alerts to the dialog

Eleven call sites. Also fixes the hardcoded English `'Error'` title (spec §2.3).

**Files:**
- Modify: `app/(app)/entry/[id].tsx:159`, `app/(app)/settings/biometric.tsx:30,39`, `app/(onboarding)/biometric.tsx:28`, `app/(app)/import/pick.tsx:17`, `app/(app)/import/confirm.tsx:38,41`, `app/recovery-unlock.tsx:40`, `app/(onboarding)/set-password.tsx:49`, `app/unlock.tsx:52,66`
- Test: `__tests__/screens/dialogMigration.test.tsx`

**Interfaces:**
- Consumes: `useDialog()` from `@/components/DialogProvider` (Task 2); i18n `common.errorTitle`

**Important:** `useDialog()` is a hook — it must be called at component top level, not inside the async handler. Capture it once:

```ts
const dialog = useDialog();
```

then use `dialog.alert(...)` / `dialog.confirm(...)` inside handlers.

- [ ] **Step 1: Write the failing test**

Create `__tests__/screens/dialogMigration.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { ThemeProvider } from '@/theme';
import { DialogProvider } from '@/components/DialogProvider';

jest.mock('@/native/clipboardWorker', () => ({
  copyAndScheduleClear: jest.fn().mockResolvedValue(undefined),
  cancelPendingClear: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/components/toast', () => ({ showToast: jest.fn(), VaultToast: () => null }));

import EntryDetail from '../../app/(app)/entry/[id]';

describe('blocking confirmations use the dialog', () => {
  it('delete asks for confirmation via the dialog, not Alert', async () => {
    const spy = jest.spyOn(Alert, 'alert');
    const { getByText, findByText } = render(
      <ThemeProvider>
        <DialogProvider>
          <EntryDetail />
        </DialogProvider>
      </ThemeProvider>,
    );
    fireEvent.press(getByText('Excluir'));
    expect(await findByText('Excluir esta entrada?')).toBeTruthy();
    await waitFor(() => expect(spy).not.toHaveBeenCalled());
    spy.mockRestore();
  });
});
```

> This test requires an unlocked store with a seeded entry. Follow the seeding pattern already used in `__tests__/screens/` for entry-detail tests — read a neighbouring test first and reuse its setup rather than inventing one.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test __tests__/screens/dialogMigration.test.tsx`
Expected: FAIL — the dialog title never appears; `Alert.alert` was called.

- [ ] **Step 3: Migrate the confirm-delete in `app/(app)/entry/[id].tsx`**

Add at the top of the component body:

```ts
  const dialog = useDialog();
```

with the import:

```ts
import { useDialog } from '@/components/DialogProvider';
```

Replace the `remove` function (lines 158–167) with:

```ts
  const remove = (): void => {
    void dialog
      .confirm({
        title: t('detail.confirmDelete'),
        confirmLabel: t('detail.delete'),
        cancelLabel: t('detail.cancel'),
        destructive: true,
      })
      .then((ok) => {
        if (ok) void doDelete();
      });
  };
```

Now remove `Alert` from the `react-native` import on line 2 — this file no longer uses it.

- [ ] **Step 4: Migrate the two alerts in `app/(app)/settings/biometric.tsx`**

Add `const dialog = useDialog();` at component top level and the import. Replace:

- line 30 → `void dialog.alert({ title: t('biometric.title'), message: t('biometric.locked') });`
- line 39 → `void dialog.alert({ title: t('biometric.title'), message: t('biometric.unavailable') });`

Remove `Alert` from the `react-native` import.

- [ ] **Step 5: Migrate `app/(onboarding)/biometric.tsx`**

Same pattern. Replace line 28 with:

```ts
          void dialog.alert({ title: t('biometric.title'), message: t('biometric.unavailable') });
```

Remove `Alert` from the import, keeping `PermissionsAndroid` and `Platform`.

- [ ] **Step 6: Migrate the import screens**

`app/(app)/import/pick.tsx` line 17:

```ts
      void dialog.alert({ title: t('importError') });
```

`app/(app)/import/confirm.tsx` lines 38 and 41:

```ts
      void dialog.alert({
        title: t('preview', { logins, notes, skipped: sim.skipped }),
        message: t('deleteReminder'),
      });
```

```ts
      void dialog.alert({ title: t('importError') });
```

Remove `Alert` from both files' imports.

- [ ] **Step 7: Migrate the three error sites and fix the hardcoded English**

These currently pass a literal `'Error'` title, violating the i18n rule. In each file add:

```ts
import { useTranslation } from 'react-i18next'; // already present in all three
import { useDialog } from '@/components/DialogProvider';
```

and inside the component:

```ts
  const { t: tCommon } = useTranslation('common');
  const dialog = useDialog();
```

Then replace each `Alert.alert('Error', (e as Error).message);` with:

```ts
        void dialog.alert({ title: tCommon('errorTitle'), message: (e as Error).message });
```

Sites: `app/recovery-unlock.tsx:40`, `app/(onboarding)/set-password.tsx:49`, `app/unlock.tsx:52` and `:66`. Remove `Alert` from all three `react-native` imports.

- [ ] **Step 8: Verify no `Alert` usage remains**

```bash
grep -rn "Alert" app src --include='*.tsx' --include='*.ts' | grep -v __tests__
```
Expected: **no output**. Any remaining hit is an unmigrated site.

- [ ] **Step 9: Run all gates**

```bash
pnpm test && pnpm run typecheck && pnpm run lint
```
Expected: all green. Update any existing test that asserted on `Alert.alert` for these sites.

- [ ] **Step 10: Commit**

```bash
git add app/ __tests__/
git commit -m "refactor(ui): blocking alerts use branded dialog; i18n error titles"
```

---

## Task 5: Clipboard — 2 minutes and native sensitive marking

**Files:**
- Modify: `modules/vaultsync-native/android/src/main/java/expo/modules/vaultsyncnative/ClipboardModule.kt`
- Modify: `modules/vaultsync-native/android/src/main/java/expo/modules/vaultsyncnative/VaultsyncNativeModule.kt:211-221`
- Modify: `modules/vaultsync-native/src/index.ts`
- Modify: `src/native/clipboardWorker.ts`
- Modify: `app/(app)/entry/[id].tsx:147`
- Modify: `src/i18n/locales/pt/vault.json:17`, `src/i18n/locales/en/vault.json:17`
- Test: `__tests__/native/clipboardWorker.test.ts`
- Test: `modules/vaultsync-native/android/src/androidTest/java/expo/modules/vaultsyncnative/ClipboardSensitiveTest.kt`

**Interfaces:**
- Produces:
  - Kotlin `ClipboardModule.copySensitive(text: String)`
  - Native binding `VaultsyncNative.copyToClipboard(text: string): Promise<void>`
  - `CLIPBOARD_CLEAR_SECONDS: number` (= 120) exported from `src/native/clipboardWorker.ts`
  - `copyAndScheduleClear(text: string, seconds?: number): Promise<void>` — signature unchanged

- [ ] **Step 1: Write the failing JS test**

Create/extend `__tests__/native/clipboardWorker.test.ts`:

```ts
jest.mock('../../modules/vaultsync-native/src', () => ({
  __esModule: true,
  default: {
    copyToClipboard: jest.fn().mockResolvedValue(undefined),
    scheduleClipboardClear: jest.fn().mockResolvedValue(undefined),
    cancelClipboardClear: jest.fn().mockResolvedValue(undefined),
  },
}));

import VaultsyncNative from '../../modules/vaultsync-native/src';
import { copyAndScheduleClear, CLIPBOARD_CLEAR_SECONDS } from '@/native/clipboardWorker';

const native = VaultsyncNative as unknown as {
  copyToClipboard: jest.Mock;
  scheduleClipboardClear: jest.Mock;
};

describe('copyAndScheduleClear', () => {
  beforeEach(() => jest.clearAllMocks());

  it('defaults to a 2-minute retention window', () => {
    expect(CLIPBOARD_CLEAR_SECONDS).toBe(120);
  });

  it('writes via the native sensitive-marking path, not expo-clipboard', async () => {
    await copyAndScheduleClear('hunter2');
    expect(native.copyToClipboard).toHaveBeenCalledWith('hunter2');
  });

  it('schedules the clear with the default window', async () => {
    await copyAndScheduleClear('hunter2');
    expect(native.scheduleClipboardClear).toHaveBeenCalledWith('hunter2', 120);
  });

  it('honours an explicit override', async () => {
    await copyAndScheduleClear('hunter2', 30);
    expect(native.scheduleClipboardClear).toHaveBeenCalledWith('hunter2', 30);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test __tests__/native/clipboardWorker.test.ts`
Expected: FAIL — `CLIPBOARD_CLEAR_SECONDS` is not exported; `copyToClipboard` is not called.

- [ ] **Step 3: Add the native sensitive-copy to `ClipboardModule.kt`**

Add these imports at the top of the file:

```kotlin
import android.content.ClipData
import android.content.ClipDescription
import android.content.ClipboardManager
import android.os.Build
import android.os.PersistableBundle
```

Add this method to the `ClipboardModule` class, alongside `scheduleClear`:

```kotlin
  /**
   * Write [text] to the clipboard marked as sensitive.
   *
   * EXTRA_IS_SENSITIVE keeps the value out of the Android 13+ clipboard preview
   * popup. The extra is set unconditionally (some OEM builds honour the same key
   * before API 33); the constant is only referenced on API 33+ where it exists.
   */
  fun copySensitive(text: String) {
    val cm = ctx.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    val clip = ClipData.newPlainText("", text)
    val extras = PersistableBundle()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      extras.putBoolean(ClipDescription.EXTRA_IS_SENSITIVE, true)
    } else {
      extras.putBoolean("android.content.extra.IS_SENSITIVE", true)
    }
    clip.description.extras = extras
    cm.setPrimaryClip(clip)
  }
```

- [ ] **Step 4: Expose it in `VaultsyncNativeModule.kt`**

After the existing `cancelClipboardClear` block (line 221), add:

```kotlin
    AsyncFunction("copyToClipboard") { text: String, promise: Promise ->
      clipboard.copySensitive(text)
      promise.resolve(null)
    }
```

- [ ] **Step 5: Add the TypeScript binding**

In `modules/vaultsync-native/src/index.ts`, add `copyToClipboard` to the module's type declaration alongside `scheduleClipboardClear`:

```ts
  copyToClipboard(text: string): Promise<void>;
```

Read the file first and match its existing declaration style exactly.

- [ ] **Step 6: Update the JS worker**

Replace the whole of `src/native/clipboardWorker.ts` with:

```ts
import VaultsyncNative from '../../modules/vaultsync-native/src';

/**
 * How long a copied secret survives on the clipboard.
 *
 * Raised from 30s to 2min for usability. The exposure cost is offset by
 * marking the clip sensitive natively (EXTRA_IS_SENSITIVE), which keeps the
 * value out of the Android 13+ clipboard preview.
 *
 * Locale strings name this duration — keep `vault.detail.copied` in pt and en
 * in sync with any change here.
 */
export const CLIPBOARD_CLEAR_SECONDS = 120;

export async function copyAndScheduleClear(
  text: string,
  seconds: number = CLIPBOARD_CLEAR_SECONDS,
): Promise<void> {
  // Native write rather than expo-clipboard: only the native path can mark the
  // clip sensitive. expo-clipboard exposes no such option.
  await VaultsyncNative.copyToClipboard(text);
  await VaultsyncNative.scheduleClipboardClear(text, seconds);
}

export async function cancelPendingClear(): Promise<void> {
  await VaultsyncNative.cancelClipboardClear();
}
```

Note the removed `import * as Clipboard from 'expo-clipboard'` — it is no longer used here.

- [ ] **Step 7: Drop the hardcoded literal at the call site**

In `app/(app)/entry/[id].tsx` line 147, change:

```ts
    await copyAndScheduleClear(text, 30);
```

to:

```ts
    await copyAndScheduleClear(text);
```

- [ ] **Step 8: Update the two locale strings**

`src/i18n/locales/pt/vault.json` → `detail.copied`:

```json
    "copied": "Copiado! Será limpo em 2 min",
```

`src/i18n/locales/en/vault.json` → `detail.copied`:

```json
    "copied": "Copied! Will clear in 2 min",
```

- [ ] **Step 9: Run the JS test to verify it passes**

Run: `pnpm test __tests__/native/clipboardWorker.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 10: Write the instrumented Kotlin test**

Create `modules/vaultsync-native/android/src/androidTest/java/expo/modules/vaultsyncnative/ClipboardSensitiveTest.kt`:

```kotlin
package expo.modules.vaultsyncnative

import android.content.ClipDescription
import android.content.ClipboardManager
import android.content.Context
import android.os.Build
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ClipboardSensitiveTest {
  @Test
  fun copySensitive_writesTextAndMarksItSensitive() {
    val ctx = ApplicationProvider.getApplicationContext<Context>()
    ClipboardModule(ctx).copySensitive("hunter2")

    val cm = ctx.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    val clip = cm.primaryClip!!
    assertEquals("hunter2", clip.getItemAt(0).text.toString())

    val key =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        ClipDescription.EXTRA_IS_SENSITIVE
      } else {
        "android.content.extra.IS_SENSITIVE"
      }
    assertTrue(clip.description.extras!!.getBoolean(key))
  }
}
```

> ⚠️ **Step 1 of this task replaces `__tests__/native/clipboardWorker.test.ts` wholesale. The replacement shown ABOVE DROPS TWO EXISTING TESTS** — `cancelPendingClear` and the copy-before-schedule ordering check. **Keep them.** Merge the new cases into the existing file rather than overwriting it; the file should end with 6 tests, not 4. (Caught in execution 2026-07-18.)
>
> ⚠️ **Step 7 removes the `30` literal from `entry/[id].tsx`, which `__tests__/screens/entry-detail.test.tsx` asserts on.** That file is not in this task's file list and Step 9's targeted test run will not catch it. Update it in the same commit.

- [ ] **Step 11: Build the native module**

Via context-mode `ctx_execute` (Bash blocks `gradlew`):

```bash
cd /Users/work/personal/random/vaultsync/android && \
JAVA_HOME=/opt/homebrew/opt/openjdk@17 ./gradlew :vaultsync-native:assembleDebug
```
Expected: `BUILD SUCCESSFUL`. On a foojay / `JvmVendorSpec.IBM_SEMERU` error, run `./gradlew --stop` and retry.

**Then also build the androidTest source set:**

```bash
cd /Users/work/personal/random/vaultsync/android && \
JAVA_HOME=/opt/homebrew/opt/openjdk@17 ./gradlew :vaultsync-native:assembleDebugAndroidTest
```

`assembleDebug` does **not** compile `src/androidTest`, so without this the instrumented Kotlin test written in Step 10 ships entirely unchecked — including whether `ApplicationProvider` even resolves (`androidx.test:core` is only a transitive dependency here). This proves it compiles and packages. It is **not** evidence that it passes.

- [ ] **Step 12: Run the instrumented test (requires emulator or device)**

```bash
cd /Users/work/personal/random/vaultsync/android && \
JAVA_HOME=/opt/homebrew/opt/openjdk@17 ./gradlew :vaultsync-native:connectedAndroidTest
```
Expected: all pass, including `ClipboardSensitiveTest`. **If no device is reachable, record this as unrun — do not report it as passing.**

- [ ] **Step 13: Run all gates**

```bash
pnpm test && pnpm run typecheck && pnpm run lint
```

- [ ] **Step 14: Commit**

```bash
git add modules/ src/native/clipboardWorker.ts app/ src/i18n/locales/ __tests__/
git commit -m "feat(clipboard): 2-minute retention with native sensitive-content marking"
```

---

## Task 6: Pending-route store

**Files:**
- Create: `src/auth/lockRoute.ts`
- Test: `__tests__/auth/lockRoute.test.ts`

**Interfaces:**
- Produces:
  - `setPendingRoute(path: string): void`
  - `takePendingRoute(): string | null`
  - `clearPendingRoute(): void`

- [ ] **Step 1: Write the failing test**

Create `__tests__/auth/lockRoute.test.ts`:

```ts
import {
  setPendingRoute,
  takePendingRoute,
  clearPendingRoute,
} from '@/auth/lockRoute';

describe('lockRoute', () => {
  beforeEach(() => clearPendingRoute());

  it('returns null when nothing is pending', () => {
    expect(takePendingRoute()).toBeNull();
  });

  it('round-trips an in-app route', () => {
    setPendingRoute('/(app)/entry/abc');
    expect(takePendingRoute()).toBe('/(app)/entry/abc');
  });

  it('clears on take so a route is never restored twice', () => {
    setPendingRoute('/(app)/entry/abc');
    takePendingRoute();
    expect(takePendingRoute()).toBeNull();
  });

  it('ignores routes outside the app group', () => {
    setPendingRoute('/unlock');
    expect(takePendingRoute()).toBeNull();
    setPendingRoute('/(onboarding)/welcome');
    expect(takePendingRoute()).toBeNull();
  });

  it('clearPendingRoute discards a stored route', () => {
    setPendingRoute('/(app)/(tabs)');
    clearPendingRoute();
    expect(takePendingRoute()).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test __tests__/auth/lockRoute.test.ts`
Expected: FAIL — `Cannot find module '@/auth/lockRoute'`

- [ ] **Step 3: Implement the store**

Create `src/auth/lockRoute.ts`:

```ts
/**
 * Where to send the user after they re-unlock.
 *
 * Deliberately module-level rather than zustand: this value must survive the
 * unmount of every React tree between lock and unlock. Locking resets the
 * navigation stack, so the restored screen remounts from scratch and all local
 * component state (notably the entry-detail password reveal) returns to its
 * default — hidden-by-default is therefore structural, not conventional.
 */
let pendingRoute: string | null = null;

/** Only in-app routes are restorable; unlock/onboarding paths are ignored. */
function isRestorable(path: string): boolean {
  return path.startsWith('/(app)/');
}

export function setPendingRoute(path: string): void {
  pendingRoute = isRestorable(path) ? path : null;
}

/** Returns the pending route and clears it, so it can never be restored twice. */
export function takePendingRoute(): string | null {
  const route = pendingRoute;
  pendingRoute = null;
  return route;
}

export function clearPendingRoute(): void {
  pendingRoute = null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test __tests__/auth/lockRoute.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Run all gates and commit**

```bash
pnpm test && pnpm run typecheck && pnpm run lint
git add src/auth/lockRoute.ts __tests__/auth/lockRoute.test.ts
git commit -m "feat(auth): pending-route store for post-unlock restore"
```

---

## Task 7: Redirect on lock and restore on unlock — the blank-screen fix

This is the release-blocking defect. Currently `lock()` nulls the vault but nothing navigates, so `(tabs)/index.tsx:24` renders an empty `<View />`.

**Files:**
- Modify: `app/(app)/_layout.tsx`
- Modify: `app/unlock.tsx` (both unlock paths)
- Test: `__tests__/auth/lockRedirect.test.tsx`

**Interfaces:**
- Consumes: `setPendingRoute`, `takePendingRoute` from `@/auth/lockRoute` (Task 6); `useAuthStore` from `@/auth/store`

- [ ] **Step 1: Write the failing test**

Create `__tests__/auth/lockRedirect.test.tsx`:

```tsx
import React from 'react';
import { act, render } from '@testing-library/react-native';

const replace = jest.fn();
jest.mock('expo-router', () => ({
  Stack: Object.assign(({ children }: { children?: React.ReactNode }) => children ?? null, {
    Screen: () => null,
  }),
  router: { replace: (...a: unknown[]) => replace(...a) },
  usePathname: () => '/(app)/entry/abc',
}));

jest.mock('@/auth/staleCleanup', () => ({ runStaleCleanup: jest.fn().mockResolvedValue(undefined) }));

import { useAuthStore } from '@/auth/store';
import { takePendingRoute } from '@/auth/lockRoute';
import AppLayout from '../../app/(app)/_layout';

describe('lock redirect', () => {
  beforeEach(() => {
    replace.mockClear();
    takePendingRoute();
    useAuthStore.setState({ status: 'unlocked', masterKey: new Uint8Array(32), vault: null });
  });

  it('redirects to /unlock when the vault locks', () => {
    render(<AppLayout />);
    act(() => {
      useAuthStore.getState().lock();
    });
    expect(replace).toHaveBeenCalledWith('/unlock');
  });

  it('remembers the route that was open at lock time', () => {
    render(<AppLayout />);
    act(() => {
      useAuthStore.getState().lock();
    });
    expect(takePendingRoute()).toBe('/(app)/entry/abc');
  });

  it('does not redirect while unlocked', () => {
    render(<AppLayout />);
    expect(replace).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test __tests__/auth/lockRedirect.test.tsx`
Expected: FAIL — `replace` never called. **This failure is the reported bug.**

- [ ] **Step 3: Implement the redirect**

Replace the body of `app/(app)/_layout.tsx` above the `return` with:

```tsx
import { Stack, router, usePathname } from 'expo-router';
import { useEffect, useRef, type JSX } from 'react';
import { useAuthStore } from '@/auth/store';
import { runStaleCleanup } from '@/auth/staleCleanup';
import { setPendingRoute } from '@/auth/lockRoute';

export default function AppLayout(): JSX.Element {
  // Depend on `status` (not a one-shot `[]` effect): this layout can survive
  // a lock -> unlock cycle without unmounting, so a mount-only effect would
  // miss re-unlocks. Re-running on every transition into 'unlocked' covers
  // both a fresh mount and a layout that stayed alive across a re-lock.
  const status = useAuthStore((s) => s.status);
  const pathname = usePathname();

  // Track the live pathname without making the lock effect depend on it —
  // re-running that effect on every navigation would be wrong.
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    if (status === 'unlocked') void runStaleCleanup();
  }, [status]);

  // Leaving 'unlocked' (auto-lock, manual lock) nulls the vault. Without this
  // redirect the tab screens stay mounted with a null vault and render blank.
  // `replace` — not `push` — so the locked screens leave the stack entirely,
  // which also guarantees a fresh mount (and hidden secrets) on restore.
  useEffect(() => {
    if (status === 'locked') {
      setPendingRoute(pathRef.current);
      router.replace('/unlock');
    }
  }, [status]);
```

Leave the returned `<Stack>` block exactly as it is.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test __tests__/auth/lockRedirect.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Restore the route on unlock**

In `app/unlock.tsx`, add the import:

```ts
import { takePendingRoute } from '@/auth/lockRoute';
```

In **both** `onBiometric` (line ~50) and `onPasswordSubmit` (line ~61), replace:

```ts
      router.replace('/(app)/(tabs)');
```

with:

```ts
      router.replace(takePendingRoute() ?? '/(app)/(tabs)');
```

- [ ] **Step 6: Add the restore test**

Append to `__tests__/auth/lockRedirect.test.tsx` a case asserting that after `setPendingRoute('/(app)/entry/abc')`, a successful unlock calls `router.replace('/(app)/entry/abc')`. Mock `@/auth/unlock`'s `unlockWithPassword` to resolve with `{ masterKey: new Uint8Array(32), vault: {...} }`, following the mocking style of the neighbouring unlock-screen tests.

- [ ] **Step 7: Run all gates**

```bash
pnpm test && pnpm run typecheck && pnpm run lint
```

- [ ] **Step 8: Commit**

```bash
git add app/ __tests__/
git commit -m "fix(auth): redirect to unlock on lock, restoring the prior route

Locking nulled the vault but never navigated, leaving the tab screens
mounted with a null vault and rendering a blank list. Redirect on the
status transition and restore the remembered route after unlock."
```

---

## Task 8: Password reveal toggle

**Files:**
- Modify: `app/(app)/entry/[id].tsx` (`FieldProps`, `Field`, password `Field` usage at line ~181)
- Modify: `src/i18n/locales/pt/vault.json`, `src/i18n/locales/en/vault.json`
- Test: `__tests__/screens/entryReveal.test.tsx`

**Interfaces:**
- Consumes: existing `vault.edit.showPassword` / `vault.edit.hidePassword` keys — **already present in both locales**, reuse them rather than adding new keys.

- [ ] **Step 1: Write the failing test**

Create `__tests__/screens/entryReveal.test.tsx` with three cases:
1. the password renders masked (`••••••••`) on first mount;
2. pressing the toggle (found by `getByLabelText('Mostrar senha')`) reveals the real value;
3. **a fresh `render()` of the same screen is masked again** — the remount guarantee from Task 7.

Seed the auth store with an unlocked vault containing a login entry whose password is `hunter2`, following the setup used by the neighbouring entry-detail tests.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test __tests__/screens/entryReveal.test.tsx`
Expected: FAIL — no element labelled `Mostrar senha`.

- [ ] **Step 3: Extend `FieldProps` and `Field`**

In `app/(app)/entry/[id].tsx`, change the type to:

```ts
type FieldProps = {
  label: string;
  value: string;
  onCopy: () => void;
  copyLabel: string;
  reveal?:
    | {
        revealed: boolean;
        onToggle: () => void;
        showLabel: string;
        hideLabel: string;
      }
    | undefined;
};
```

Add to the imports:

```ts
import { Eye, EyeOff } from 'lucide-react-native';
```

Inside `Field`, render the toggle before the copy button when `reveal` is provided:

```tsx
        {reveal != null && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={reveal.revealed ? reveal.hideLabel : reveal.showLabel}
            onPress={reveal.onToggle}
            style={fieldStyles.copyBtn}
          >
            {reveal.revealed ? (
              <EyeOff size={18} color={colors.textPrimary} />
            ) : (
              <Eye size={18} color={colors.textPrimary} />
            )}
          </Pressable>
        )}
```

Add `reveal` to the destructured props.

- [ ] **Step 4: Wire the state into the screen**

Add to the imports:

```ts
import { useState } from 'react';
```

Add at component top level:

```ts
  // Defaults hidden. Lock resets the nav stack, so this screen remounts on
  // restore and the password is masked again without an explicit reset.
  const [revealed, setRevealed] = useState(false);
```

Replace the password `Field` (lines ~181–186) with:

```tsx
          <Field
            label={t('detail.password')}
            value={revealed ? entry.password : '••••••••'}
            onCopy={() => void copy(entry.password)}
            copyLabel={copyLabel}
            reveal={{
              revealed,
              onToggle: () => setRevealed((v) => !v),
              showLabel: t('edit.showPassword'),
              hideLabel: t('edit.hidePassword'),
            }}
          />
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test __tests__/screens/entryReveal.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 6: Run all gates and commit**

```bash
pnpm test && pnpm run typecheck && pnpm run lint
git add app/ __tests__/
git commit -m "feat(vault): reveal toggle on the entry detail password field"
```

---

## Task 9: Drive configuration probe, error surfacing, and button state

**Files:**
- Modify: `src/drive/auth.ts`
- Modify: `app/(app)/settings/sync.tsx`
- Modify: `app/(onboarding)/drive-signin.tsx`
- Modify: `src/i18n/locales/pt/sync.json`, `src/i18n/locales/en/sync.json`
- Test: `__tests__/drive/auth.test.ts`, `__tests__/screens/syncSettings.test.tsx`

**Interfaces:**
- Consumes: `useDialog()` (Task 2); `hasDriveToken` (existing)
- Produces: `isDriveConfigured(): boolean` exported from `src/drive/auth.ts`

- [ ] **Step 1: Write the failing tests**

Add to `__tests__/drive/auth.test.ts`:

```ts
import { isDriveConfigured } from '@/drive/auth';

describe('isDriveConfigured', () => {
  const original = process.env['EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID'];
  afterEach(() => {
    process.env['EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID'] = original;
  });

  it('is false when the client id is absent', () => {
    delete process.env['EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID'];
    expect(isDriveConfigured()).toBe(false);
  });

  it('is false when the client id is blank', () => {
    process.env['EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID'] = '   ';
    expect(isDriveConfigured()).toBe(false);
  });

  it('is true when the client id is set', () => {
    process.env['EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID'] = 'x.apps.googleusercontent.com';
    expect(isDriveConfigured()).toBe(true);
  });
});
```

Create `__tests__/screens/syncSettings.test.tsx` with cases:
1. with **no** stored token, the CTA reads `Conectar Google Drive` **on first render** (the current bug: it reads `Sincronizar agora` because status starts `idle`);
2. `lastSyncedAt === null` and status `idle` renders the never-synced label, not `Sincronizado`;
3. when `signInWithGoogle` rejects, a dialog appears and sync status becomes `error` — the tap is never a silent no-op.

Mock `@/drive/auth` and `@/sync/orchestrator`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test __tests__/drive/auth.test.ts __tests__/screens/syncSettings.test.tsx`
Expected: FAIL — `isDriveConfigured` not exported; CTA shows the wrong label.

- [ ] **Step 3: Add `isDriveConfigured`**

In `src/drive/auth.ts`, add after the `discovery` constant:

```ts
/**
 * Whether an OAuth client id is present. Lets the UI distinguish "never set up"
 * from "sign-in failed" and show an actionable message instead of a raw throw.
 */
export function isDriveConfigured(): boolean {
  const id = process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;
  return typeof id === 'string' && id.trim() !== '';
}
```

- [ ] **Step 4: Add the locale strings**

Add to both `src/i18n/locales/pt/sync.json` and `.../en/sync.json`:

PT:
```json
  "neverSynced": "Nunca sincronizado",
  "notConfigured": "Google Drive não configurado neste app.",
  "signInFailed": "Falha ao conectar ao Google Drive.",
```

EN:
```json
  "neverSynced": "Never synced",
  "notConfigured": "Google Drive is not configured in this build.",
  "signInFailed": "Could not connect to Google Drive.",
```

- [ ] **Step 5: Fix the sync settings screen**

In `app/(app)/settings/sync.tsx`:

Add imports:

```ts
import { useEffect, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { hasDriveToken, isDriveConfigured, signInWithGoogle } from '@/drive/auth';
import { useDialog } from '@/components/DialogProvider';
import { useSyncStore } from '@/sync/store';
```

Inside the component, before `styles`:

```ts
  const dialog = useDialog();
  const { t: tCommon } = useTranslation('common');

  // The store initialises to 'idle', which rendered "Sync now" even with no
  // token — the first tap then ran syncOnce() and appeared to do nothing.
  // Resolve token presence on mount so the CTA is correct from first paint.
  useEffect(() => {
    void hasDriveToken().then((has) => {
      if (!has) useSyncStore.getState().setStatus('paused_no_token');
    });
  }, []);

  const connect = async (): Promise<void> => {
    if (!isDriveConfigured()) {
      useSyncStore.getState().setStatus('error', 'not_configured');
      await dialog.alert({ title: tCommon('errorTitle'), message: t('notConfigured') });
      return;
    }
    try {
      await signInWithGoogle();
    } catch (e) {
      useSyncStore.getState().setStatus('error', (e as Error).message);
      await dialog.alert({ title: tCommon('errorTitle'), message: t('signInFailed') });
    }
  };
```

Change the status line so a never-synced vault is not labelled "Synced":

```tsx
      <Text style={styles.status}>
        {s.status === 'idle' && s.lastSyncedAt === null
          ? t('neverSynced')
          : t(`status.${s.status}`)}
      </Text>
```

Change the CTA's `onPress` to use the guarded handler:

```tsx
        onPress={() => {
          if (isNoToken) {
            void connect();
          } else {
            void syncOnce();
          }
        }}
```

- [ ] **Step 6: Fix the onboarding sign-in screen**

In `app/(onboarding)/drive-signin.tsx`, add the same imports (`useDialog`, `isDriveConfigured`, `useTranslation` for `common`) and replace `connect`:

```ts
  const connect = async (): Promise<void> => {
    if (!isDriveConfigured()) {
      await dialog.alert({ title: tCommon('errorTitle'), message: tSync('notConfigured') });
      return;
    }
    try {
      const ok = await signInWithGoogle();
      if (ok) router.replace('/(app)/(tabs)');
    } catch (e) {
      await dialog.alert({ title: tCommon('errorTitle'), message: (e as Error).message });
    }
  };
```

Add `const { t: tSync } = useTranslation('sync');` alongside the existing `onboarding` translation hook.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm test __tests__/drive/auth.test.ts __tests__/screens/syncSettings.test.tsx`
Expected: PASS.

- [ ] **Step 8: Run all gates and commit**

```bash
pnpm test && pnpm run typecheck && pnpm run lint
git add src/drive/auth.ts app/ src/i18n/locales/ __tests__/
git commit -m "fix(drive): surface sign-in failures and correct the connect CTA state"
```

---

## Task 10: On-device verification

No code. This is the gate that decides whether the work is actually done — several items here are **not provable by any automated test**.

**Prerequisite:** a physical API-30+ device with enrolled biometrics and a screen lock. OAuth is configured (`.env` present, client ID ending `.apps.googleusercontent.com`, SHA-1 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` from `android/app/debug.keystore`).

- [ ] **Step 1: Build and install a release APK**

```bash
cd /Users/work/personal/random/vaultsync/android && \
JAVA_HOME=/opt/homebrew/opt/openjdk@17 ./gradlew assembleRelease \
  -PabiFilter=arm64-v8a \
  -Dorg.gradle.java.installations.paths="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
```
Output: `android/app/build/outputs/apk/release/app-release.apk`

> `EXPO_PUBLIC_*` is inlined at build time — this build is what picks up `.env`.

- [ ] **Step 2: Verify the blank-screen fix**

Set auto-lock to 1 minute. Open an entry, background the app, wait >1 min, return.
Expected: the **unlock screen**, not a blank list. After unlocking, you land back on that entry.

- [ ] **Step 3: Verify the reveal toggle resets**

Reveal a password, background >1 min, return, unlock.
Expected: back on the entry with the password **masked**.

- [ ] **Step 4: Verify clipboard behaviour**

Copy a password. Confirm the toast reads "2 min". Paste within 2 min → succeeds. Wait >2 min, paste → cleared.
On Android 13+, confirm the clipboard preview does **not** show the password.

- [ ] **Step 5: Verify Drive end-to-end**

Settings → Sync. Expected: CTA reads **Conectar Google Drive** on first open, status reads **Nunca sincronizado**. Tap → Google account picker → grant → returns. Edit an entry, sync, confirm `VaultSync/vault.enc` updates in Drive.

- [ ] **Step 6: Verify error surfacing**

Enable airplane mode, tap sync. Expected: a **branded dialog** and an honest status — never a silent no-op.

- [ ] **Step 7: Confirm no autofill regression**

Run the I2b checklist in `docs/TESTING-autofill.md`. Watch for `UserNotAuthenticatedException`:

```bash
adb logcat | grep -i VaultSync
```
Expected: none. A single occurrence means I2 regressed.

- [ ] **Step 8: Record the outcome**

Update `NEXT.md` with what passed, what failed, and anything unrun. **Do not mark this plan complete on the strength of green unit tests** — Steps 2–7 are the only evidence that matters for the two reported bugs.

---

## Plan Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| §2.1 Toast | 1 |
| §2.2 Dialog | 2 |
| §2.3 Migration map (14 sites) | 3 (toast ×3), 4 (dialog ×11) |
| §2.3 i18n error-title defect | 4 step 7 |
| §3 Clipboard 2 min | 5 |
| §3 EXTRA_IS_SENSITIVE | 5 (mechanism corrected — see deviation note) |
| §4.1 lockRoute | 6 |
| §4.2 Redirect on lock | 7 |
| §4.3 Restore on unlock | 7 step 5 |
| §4.4 Remount guarantee | 7 (mechanism) + 8 step 1 case 3 (asserted) |
| §5 Reveal toggle | 8 |
| §6.1 OAuth config | Done by user pre-plan; verified Task 10 |
| §6.2 Error surfacing, isDriveConfigured, button state | 9 |
| §6.3 Never-synced label | 9 steps 4–5 |
| §7 Testing | every task; native in 5, on-device in 10 |

No spec requirement is unmapped.

**Type consistency:** `showToast` (1) → used in 3. `useDialog().alert/confirm` (2) → used in 4, 9. `CLIPBOARD_CLEAR_SECONDS`, `copyToClipboard` (5) → consistent across Kotlin, binding, and JS. `setPendingRoute`/`takePendingRoute` (6) → used in 7. `isDriveConfigured` (9) → used in both screens. Names match across every task.

**Known soft spots**, flagged rather than hidden:
- Task 3 step 1 and Task 4 step 1 tell the implementer to read a neighbouring test for store-seeding and query selectors rather than inlining a guess. That is deliberate — inventing a seeding helper that does not match the existing pattern would be worse than the indirection.
- Task 8 step 1 describes its three test cases instead of showing full code, because the seeding setup must be copied from existing entry-detail tests.
