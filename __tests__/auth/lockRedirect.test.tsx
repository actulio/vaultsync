import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '@/theme';
import { DialogProvider } from '@/components/DialogProvider';

// Must be `mock`-prefixed: Jest's babel transform rejects any other out-of-scope
// variable referenced from inside a jest.mock factory.
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  Stack: Object.assign(({ children }: { children?: React.ReactNode }) => children ?? null, {
    Screen: () => null,
  }),
  router: { replace: (...a: unknown[]) => mockReplace(...a), push: jest.fn() },
  // These two must stay in the shapes expo-router really returns for
  // `app/(app)/entry/[id].tsx`. `usePathname()` is the normalized URL and group
  // folders are stripped from it by design, so it is `/entry/abc` — it can
  // never contain `(app)`. `useSegments()` is the unnormalized file path and
  // does keep the group. An earlier version of this mock returned
  // '/(app)/entry/abc' from usePathname, which is unreachable on device; it
  // made these tests pass against a restore path that never once fired.
  usePathname: () => '/entry/abc',
  useSegments: () => ['(app)', 'entry', '[id]'],
}));

jest.mock('@/auth/staleCleanup', () => ({ runStaleCleanup: jest.fn().mockResolvedValue(undefined) }));

jest.mock('@/auth/unlock', () => {
  class RecoverableError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.name = 'RecoverableError';
      this.code = code;
    }
  }
  return {
    unlockWithPassword: jest.fn(),
    unlockWithBiometric: jest.fn(),
    readVaultHint: jest.fn().mockResolvedValue(''),
    RecoverableError,
  };
});

// Severs the @/native/keystore import chain, which does not resolve under Jest.
jest.mock('@/auth/biometric', () => ({
  isBiometricEnabled: jest.fn().mockResolvedValue(true),
  enableBiometric: jest.fn(),
  disableBiometric: jest.fn(),
}));

import { useAuthStore } from '@/auth/store';
import { setPendingRoute, takePendingRoute } from '@/auth/lockRoute';
import { unlockWithPassword, unlockWithBiometric } from '@/auth/unlock';
import AppLayout from '../../app/(app)/_layout';
import Unlock from '../../app/unlock';

const VAULT = { version: 1, entries: [], updatedAt: '', deviceId: '' };

function wrap(ui: React.ReactElement): React.ReactElement {
  return (
    <ThemeProvider>
      <DialogProvider>{ui}</DialogProvider>
    </ThemeProvider>
  );
}

describe('lock redirect', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    takePendingRoute();
    useAuthStore.setState({ status: 'unlocked', masterKey: new Uint8Array(32), vault: null });
  });

  // `render` must be awaited: the tree mounts on a concurrent root, so a
  // synchronous call returns before the layout's effects have ever run.
  // This assertion is load-bearing beyond the redirect itself: `replace` tears
  // the locked screens out of the stack, which forces a fresh mount on restore.
  // That remount is what resets local component state — notably the entry-detail
  // password reveal (see __tests__/screens/entryReveal.test.tsx). Switching to
  // `push` would leave those screens mounted with their secrets still revealed.
  it('redirects to /unlock when the vault locks', async () => {
    await render(<AppLayout />);
    await act(async () => {
      useAuthStore.getState().lock();
    });
    expect(mockReplace).toHaveBeenCalledWith('/unlock');
  });

  it('remembers the route that was open at lock time', async () => {
    await render(<AppLayout />);
    await act(async () => {
      useAuthStore.getState().lock();
    });
    expect(takePendingRoute()).toBe('/entry/abc');
  });

  it('does not redirect while unlocked', async () => {
    await render(<AppLayout />);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

describe('route restore on unlock', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    takePendingRoute();
    (unlockWithPassword as jest.Mock).mockResolvedValue({
      masterKey: new Uint8Array(32),
      vault: VAULT,
    });
    (unlockWithBiometric as jest.Mock).mockResolvedValue({
      masterKey: new Uint8Array(32),
      vault: VAULT,
    });
  });

  it('restores the remembered route after a password unlock', async () => {
    setPendingRoute('/entry/abc', ['(app)', 'entry', '[id]']);

    const { findByLabelText, findByText } = await render(wrap(<Unlock />));
    const input = await findByLabelText('Senha mestre', { exact: false });
    void fireEvent.changeText(input, 'correct horse');
    void fireEvent.press(await findByText('Desbloquear'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/entry/abc'));
  });

  it('restores the remembered route after a biometric unlock', async () => {
    setPendingRoute('/entry/abc', ['(app)', 'entry', '[id]']);

    const { findByLabelText } = await render(wrap(<Unlock />));
    void fireEvent.press(await findByLabelText('Usar biometria'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/entry/abc'));
  });

  it('falls back to the tabs when no route was remembered', async () => {
    const { findByLabelText, findByText } = await render(wrap(<Unlock />));
    const input = await findByLabelText('Senha mestre', { exact: false });
    void fireEvent.changeText(input, 'correct horse');
    void fireEvent.press(await findByText('Desbloquear'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(app)/(tabs)'));
  });
});
