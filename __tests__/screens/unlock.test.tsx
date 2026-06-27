import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

// -----------------------------------------------------------------------
// Mocks — factories must be self-contained (no out-of-scope references)
// -----------------------------------------------------------------------

jest.mock('@/auth/unlock', () => {
  // Defined inside the factory so instanceof checks work end-to-end:
  // both the screen's import and the test's import resolve to this class.
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

jest.mock('@/native/biometric', () => ({
  Biometric: {
    prompt: jest.fn().mockResolvedValue('canceled'),
  },
}));

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
}));

jest.mock('@/auth/store', () => ({
  useAuthStore: {
    getState: () => ({ unlock: jest.fn() }),
  },
}));

// -----------------------------------------------------------------------
// Imports (after mocks so they receive the mocked modules)
// -----------------------------------------------------------------------
import { unlockWithPassword, RecoverableError } from '@/auth/unlock';
import Unlock from '../../app/unlock';

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------
describe('Unlock screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const mod = jest.requireMock('@/auth/unlock') as {
      readVaultHint: jest.Mock;
      unlockWithPassword: jest.Mock;
    };
    mod.readVaultHint.mockResolvedValue('');
    mod.unlockWithPassword.mockResolvedValue({
      masterKey: new Uint8Array(32),
      vault: { version: 1, entries: [], updatedAt: '', deviceId: '' },
    });
  });

  it('renders Portuguese title by default', async () => {
    const { findByText } = await render(<Unlock />);
    expect(await findByText('Desbloquear vaultsync')).toBeTruthy();
  });

  it('shows Portuguese wrong-password message on RecoverableError("wrong_password")', async () => {
    (unlockWithPassword as jest.Mock).mockRejectedValueOnce(
      new RecoverableError('wrong_password'),
    );

    const { findByLabelText, findByText } = await render(<Unlock />);

    const input = await findByLabelText('Senha mestre', { exact: false });
    fireEvent.changeText(input, 'badpassword');

    const submitBtn = await findByText('Desbloquear');
    fireEvent.press(submitBtn);

    expect(await findByText('Senha incorreta')).toBeTruthy();
  });

  it('renders the biometric CTA button', async () => {
    const { findByText } = await render(<Unlock />);
    expect(await findByText('Usar biometria')).toBeTruthy();
  });

  it('renders forgot password link', async () => {
    const { findByText } = await render(<Unlock />);
    expect(await findByText('Esqueci minha senha mestre')).toBeTruthy();
  });
});
