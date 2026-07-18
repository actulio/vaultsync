import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useAuthStore } from '@/auth/store';
import type { VaultV1 } from '@/vault/types';
import { ThemeProvider } from '@/theme';
import { DialogProvider } from '@/components/DialogProvider';
import EntryDetail from '../../app/(app)/entry/[id]';

function wrap(ui: React.ReactElement): React.ReactElement {
  return (
    <ThemeProvider>
      <DialogProvider>{ui}</DialogProvider>
    </ThemeProvider>
  );
}

// -----------------------------------------------------------------------
// Mocks — factories must be self-contained (no out-of-scope references)
// -----------------------------------------------------------------------

jest.mock('@/native/clipboardWorker', () => ({
  copyAndScheduleClear: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/vault/persist', () => ({
  persistVault: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({ id: '1' }),
}));

// -----------------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------------

const testVault: VaultV1 = {
  version: 1,
  updatedAt: '',
  deviceId: 'd',
  entries: [
    {
      id: '1',
      type: 'login' as const,
      title: 'GitHub',
      username: 'me',
      password: 'hunter2',
      createdAt: '',
      updatedAt: '',
    },
  ],
};

const MASK = '••••••••';

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.getState().reset();
  useAuthStore.getState().unlock(new Uint8Array(32), testVault);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// -----------------------------------------------------------------------
// Tests (Portuguese strings — default test locale is pt)
// -----------------------------------------------------------------------

describe('EntryDetail password reveal', () => {
  it('masks the password on first mount', async () => {
    await render(wrap(<EntryDetail />));

    expect(screen.getByText(MASK)).toBeTruthy();
    expect(screen.queryByText('hunter2')).toBeNull();
    expect(screen.getByLabelText('Mostrar senha')).toBeTruthy();
  });

  it('reveals the real password when the toggle is pressed', async () => {
    await render(wrap(<EntryDetail />));

    await fireEvent.press(screen.getByLabelText('Mostrar senha'));

    expect(screen.getByText('hunter2')).toBeTruthy();
    expect(screen.queryByText(MASK)).toBeNull();
    // The toggle now offers the inverse action.
    expect(screen.getByLabelText('Ocultar senha')).toBeTruthy();
  });

  it('masks the password again on a fresh render after a previous reveal', async () => {
    const first = await render(wrap(<EntryDetail />));
    await fireEvent.press(screen.getByLabelText('Mostrar senha'));
    expect(screen.getByText('hunter2')).toBeTruthy();
    void first.unmount();

    // A lock/unlock cycle replaces the route, so the screen remounts and the
    // reveal flag returns to its declared default without any explicit reset.
    //
    // NOTE: this test simulates the remount rather than driving a real lock, so
    // on its own it would still pass if the mechanism were removed. What pins
    // the mechanism is `__tests__/auth/lockRedirect.test.tsx`, which asserts the
    // lock handler in app/(app)/_layout.tsx calls router.REPLACE (not push).
    // `replace` tears this screen out of the stack; `push` would leave it mounted
    // underneath the unlock screen with `revealed` still true, so the user would
    // unlock straight back into a visible password.
    // If you ever change that call, do NOT just update the assertion to match —
    // you would be silently removing this guarantee.
    await render(wrap(<EntryDetail />));

    expect(screen.getByText(MASK)).toBeTruthy();
    expect(screen.queryByText('hunter2')).toBeNull();
  });
});
