import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
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
      password: 'secret',
      createdAt: '',
      updatedAt: '',
    },
  ],
};

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

describe('EntryDetail', () => {
  it('renders title and login fields', async () => {
    await render(wrap(<EntryDetail />));
    expect(screen.getByText('GitHub')).toBeTruthy();
    expect(screen.getByText('Usuário')).toBeTruthy();
    expect(screen.getByText('Senha')).toBeTruthy();
    expect(screen.getByText('me')).toBeTruthy();
    expect(screen.getByText('••••••••')).toBeTruthy();
  });

  it('copies username via copyAndScheduleClear', async () => {
    await render(wrap(<EntryDetail />));

    // First "Copiar" button belongs to the username field
    const copyButtons = screen.getAllByText('Copiar');
    const firstCopyBtn = copyButtons[0];
    if (!firstCopyBtn) throw new Error('No copy button found');
    await fireEvent.press(firstCopyBtn);

    const { copyAndScheduleClear } = jest.requireMock<{
      copyAndScheduleClear: jest.Mock;
    }>('@/native/clipboardWorker');

    await waitFor(() => {
      expect(copyAndScheduleClear).toHaveBeenCalledWith('me', 30);
    });
  });

  it('deletes entry: persists vault without entry and calls router.back', async () => {
    const { persistVault } = jest.requireMock<{
      persistVault: jest.Mock;
    }>('@/vault/persist');
    const { router } = jest.requireMock<{ router: { back: jest.Mock } }>('expo-router');

    await render(wrap(<EntryDetail />));
    const deleteBtn = screen.getByText('Excluir');
    await fireEvent.press(deleteBtn);

    // Confirm via the dialog's destructive button (also labeled "Excluir").
    const confirmBtns = await screen.findAllByText('Excluir');
    const confirmBtn = confirmBtns[confirmBtns.length - 1];
    if (!confirmBtn) throw new Error('No confirm button found');
    await fireEvent.press(confirmBtn);

    await waitFor(() => {
      expect(persistVault).toHaveBeenCalledTimes(1);
    });

    const [savedVault] = persistVault.mock.calls[0] as [VaultV1];
    expect(savedVault.entries.find((e) => e.id === '1')).toBeUndefined();
    expect(router.back).toHaveBeenCalled();
  });
});
