import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

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
import { unlockWithPassword, unlockWithBiometric, RecoverableError } from '@/auth/unlock';
import { Biometric } from '@/native/biometric';
import Unlock from '../../app/unlock';

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------
describe('Unlock screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const mod = jest.requireMock<{
      readVaultHint: jest.Mock;
      unlockWithPassword: jest.Mock;
    }>('@/auth/unlock');
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
    void fireEvent.changeText(input, 'badpassword');

    const submitBtn = await findByText('Desbloquear');
    void fireEvent.press(submitBtn);

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

  it('shows Alert when unlockWithBiometric throws after a successful prompt', async () => {
    (Biometric.prompt as jest.Mock).mockResolvedValueOnce('success');
    (unlockWithBiometric as jest.Mock).mockRejectedValueOnce(
      new RecoverableError('vault_corrupt'),
    );
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    const { findByText } = await render(<Unlock />);
    const biometricBtn = await findByText('Usar biometria');
    void fireEvent.press(biometricBtn);

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
  });
});
