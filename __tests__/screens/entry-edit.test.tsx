import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuthStore } from '@/auth/store';
import type { VaultV1 } from '@/vault/types';
import NewEntry from '../../app/(app)/entry/new';
import EditEntry from '../../app/(app)/entry/edit/[id]';

// -----------------------------------------------------------------------
// Mocks — factories must be self-contained (no out-of-scope references)
// -----------------------------------------------------------------------

jest.mock('@/vault/persist', () => ({
  persistVault: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/generator/generate', () => ({
  generatePassword: jest.fn().mockResolvedValue('generated-pw-xyz'),
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
      username: 'octocat',
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

// -----------------------------------------------------------------------
// Tests (Portuguese strings — default test locale is pt)
// -----------------------------------------------------------------------

describe('NewEntry', () => {
  it('new login: fill fields, save → persistVault called with entry, router.back called', async () => {
    const { persistVault } = jest.requireMock<{ persistVault: jest.Mock }>('@/vault/persist');
    const { router } = jest.requireMock<{ router: { back: jest.Mock } }>('expo-router');

    await render(<NewEntry />);

    await fireEvent.changeText(screen.getByPlaceholderText('Título'), 'MyService');
    await fireEvent.changeText(screen.getByPlaceholderText('Usuário'), 'user@example.com');
    await fireEvent.changeText(screen.getByPlaceholderText('Senha'), 'mypassword');

    await fireEvent.press(screen.getByText('Salvar'));

    await waitFor(() => {
      expect(persistVault).toHaveBeenCalledTimes(1);
    });

    const [savedVault] = persistVault.mock.calls[0] as [VaultV1];
    expect(savedVault.entries.some((e) => e.title === 'MyService')).toBe(true);
    expect(router.back).toHaveBeenCalled();
  });

  it('generate: pressing Gerador de senha opens inline panel and fills password with generated value', async () => {
    await render(<NewEntry />);

    // Panel is closed initially; only the row-level "Gerador de senha" toggle exists.
    await fireEvent.press(screen.getByText('Gerador de senha'));

    await waitFor(() => {
      expect(screen.getByDisplayValue('generated-pw-xyz')).toBeTruthy();
    });
  });

  it('regression: closing then reopening the generator panel does not remount it or overwrite the password', async () => {
    await render(<NewEntry />);

    // Open the panel — mounts PasswordGenerator, which auto-generates once.
    await fireEvent.press(screen.getByText('Gerador de senha'));

    await waitFor(() => {
      expect(screen.getByDisplayValue('generated-pw-xyz')).toBeTruthy();
    });

    // User tweaks the password manually after generation.
    await fireEvent.changeText(
      screen.getByDisplayValue('generated-pw-xyz'),
      'user-edited-pw',
    );

    // Close the panel.
    await fireEvent.press(screen.getByText('Gerador de senha'));

    // Reopen the panel — must NOT remount PasswordGenerator (no re-generation).
    await fireEvent.press(screen.getByText('Gerador de senha'));

    expect(screen.getByDisplayValue('user-edited-pw')).toBeTruthy();
  });

  it('show/hide: toggling the eye flips secureTextEntry on the password input', async () => {
    await render(<NewEntry />);

    const passwordInput = screen.getByPlaceholderText('Senha');
    expect(passwordInput.props.secureTextEntry).toBe(true);

    await fireEvent.press(screen.getByLabelText('Mostrar senha'));

    expect(passwordInput.props.secureTextEntry).toBe(false);

    await fireEvent.press(screen.getByLabelText('Ocultar senha'));

    expect(passwordInput.props.secureTextEntry).toBe(true);
  });
});

describe('EditEntry', () => {
  it('edit: title prefilled; change + save → persistVault with updated entry, router.back called', async () => {
    const { persistVault } = jest.requireMock<{ persistVault: jest.Mock }>('@/vault/persist');
    const { router } = jest.requireMock<{ router: { back: jest.Mock } }>('expo-router');

    await render(<EditEntry />);

    // Assert title field is pre-filled with existing entry title
    expect(screen.getByDisplayValue('GitHub')).toBeTruthy();

    // Change the title
    await fireEvent.changeText(screen.getByDisplayValue('GitHub'), 'Updated Title');

    await fireEvent.press(screen.getByText('Salvar'));

    await waitFor(() => {
      expect(persistVault).toHaveBeenCalledTimes(1);
    });

    const [savedVault] = persistVault.mock.calls[0] as [VaultV1];
    const updated = savedVault.entries.find((e) => e.id === '1');
    expect(updated?.title).toBe('Updated Title');
    expect(router.back).toHaveBeenCalled();
  });

  it('renders type pills: Login and Nota segura visible', async () => {
    await render(<EditEntry />);
    expect(screen.getByText('Login')).toBeTruthy();
    expect(screen.getByText('Nota segura')).toBeTruthy();
  });

  it('save with empty title: shows validation error and does not call onSubmit (persistVault)', async () => {
    const { persistVault } = jest.requireMock<{ persistVault: jest.Mock }>('@/vault/persist');

    await render(<EditEntry />);

    await fireEvent.changeText(screen.getByDisplayValue('GitHub'), '');

    await fireEvent.press(screen.getByText('Salvar'));

    await waitFor(() => {
      expect(screen.getByText('O título é obrigatório')).toBeTruthy();
    });

    expect(persistVault).not.toHaveBeenCalled();
  });

  it('save after filling title: clears validation error and calls onSubmit (persistVault)', async () => {
    const { persistVault } = jest.requireMock<{ persistVault: jest.Mock }>('@/vault/persist');

    await render(<EditEntry />);

    await fireEvent.changeText(screen.getByDisplayValue('GitHub'), '');
    await fireEvent.press(screen.getByText('Salvar'));

    await waitFor(() => {
      expect(screen.getByText('O título é obrigatório')).toBeTruthy();
    });

    await fireEvent.changeText(screen.getByPlaceholderText('Título'), 'Updated Title');
    await fireEvent.press(screen.getByText('Salvar'));

    await waitFor(() => {
      expect(persistVault).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByText('O título é obrigatório')).toBeNull();
  });
});
