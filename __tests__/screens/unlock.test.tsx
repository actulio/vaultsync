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

// Mocking @/auth/biometric also severs the real @/native/keystore import chain
// (which would otherwise fail to resolve the native module under Jest). Biometric
// unlock is opt-in, so the CTA only renders when isBiometricEnabled resolves true.
jest.mock('@/auth/biometric', () => ({
  isBiometricEnabled: jest.fn().mockResolvedValue(true),
  enableBiometric: jest.fn(),
  disableBiometric: jest.fn(),
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

  it('renders the biometric icon button (by accessibilityLabel) when biometric unlock is enabled', async () => {
    const { findByLabelText, queryByText } = await render(<Unlock />);
    expect(await findByLabelText('Usar biometria')).toBeTruthy();
    // Icon-only: the biometric control must not render its label as visible text
    // (that would be the old full-width button, not the compact icon button).
    expect(queryByText('Usar biometria')).toBeNull();
  });

  it('hides the biometric icon button when biometric unlock is disabled (opt-in)', async () => {
    const bio = jest.requireMock<{ isBiometricEnabled: jest.Mock }>('@/auth/biometric');
    bio.isBiometricEnabled.mockResolvedValueOnce(false);

    const { queryByLabelText, findByText } = await render(<Unlock />);
    // Wait for the screen to settle (the password CTA is always present).
    await findByText('Desbloquear');
    expect(queryByLabelText('Usar biometria')).toBeNull();
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

    const { findByLabelText } = await render(<Unlock />);
    const biometricBtn = await findByLabelText('Usar biometria');
    void fireEvent.press(biometricBtn);

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
  });

  it('unlocks and navigates to the app when biometric prompt succeeds', async () => {
    (Biometric.prompt as jest.Mock).mockResolvedValueOnce('success');
    (unlockWithBiometric as jest.Mock).mockResolvedValueOnce({
      masterKey: new Uint8Array(32),
      vault: { version: 1, entries: [], updatedAt: '', deviceId: '' },
    });
    const { router } = jest.requireMock<{ router: { replace: jest.Mock } }>('expo-router');

    const { findByLabelText } = await render(<Unlock />);
    const biometricBtn = await findByLabelText('Usar biometria');
    void fireEvent.press(biometricBtn);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(app)/(tabs)'));
  });
});
