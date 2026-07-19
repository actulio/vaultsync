import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '@/theme';
import { DialogProvider } from '@/components/DialogProvider';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));

jest.mock('@/drive/auth', () => ({
  signInWithGoogle: jest.fn(async () => true),
  skipDriveForNow: jest.fn(),
  isDriveConfigured: jest.fn(() => true),
}));

jest.mock('@/components/toast', () => ({
  showToast: jest.fn(),
  VaultToast: () => null,
}));

import { router } from 'expo-router';
import { showToast } from '@/components/toast';
import DriveSignin from '../../app/(onboarding)/drive-signin';

function driveAuth() {
  return jest.requireMock<{
    signInWithGoogle: jest.Mock;
    skipDriveForNow: jest.Mock;
    isDriveConfigured: jest.Mock;
  }>('@/drive/auth');
}

async function renderScreen() {
  return render(
    <ThemeProvider>
      <DialogProvider>
        <DriveSignin />
      </DialogProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  driveAuth().signInWithGoogle.mockResolvedValue(true);
  driveAuth().isDriveConfigured.mockReturnValue(true);
});

describe('Drive sign-in onboarding screen', () => {
  it('routes into the app when sign-in succeeds', async () => {
    const { findByText } = await renderScreen();
    await fireEvent.press(await findByText('Conectar Drive'));
    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/(app)/(tabs)');
    });
  });

  it('shows a dialog instead of failing silently when sign-in rejects', async () => {
    driveAuth().signInWithGoogle.mockRejectedValue(new Error('boom'));
    const { findByText } = await renderScreen();
    await fireEvent.press(await findByText('Conectar Drive'));
    expect(await findByText('Erro')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('shows the translated message, never the raw exception, when sign-in rejects', async () => {
    // exchangeCodeAsync messages can embed the token endpoint URL and OAuth
    // error payloads — they must never reach a PT-BR user's screen.
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    driveAuth().signInWithGoogle.mockRejectedValue(
      new Error('invalid_grant at https://oauth2.googleapis.com/token'),
    );
    const { findByText, queryByText } = await renderScreen();
    await fireEvent.press(await findByText('Conectar Drive'));

    expect(await findByText('Falha ao conectar ao Google Drive.')).toBeTruthy();
    expect(queryByText('invalid_grant at https://oauth2.googleapis.com/token')).toBeNull();
    warn.mockRestore();
  });

  it('gives visible feedback and stays put when sign-in resolves false', async () => {
    // false = cancelled prompt or no refresh token. Previously a silent no-op.
    driveAuth().signInWithGoogle.mockResolvedValue(false);
    const { findByText, queryByText } = await renderScreen();
    await fireEvent.press(await findByText('Conectar Drive'));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Conexão com o Google Drive não concluída.');
    });
    expect(router.replace).not.toHaveBeenCalled();
    // Cancellation is not an error — no blocking dialog, and the CTA remains.
    expect(queryByText('Erro')).toBeNull();
    expect(await findByText('Conectar Drive')).toBeTruthy();
  });

  it('shows an actionable dialog and never calls sign-in when Drive is not configured', async () => {
    driveAuth().isDriveConfigured.mockReturnValue(false);
    const { findByText } = await renderScreen();
    await fireEvent.press(await findByText('Conectar Drive'));
    expect(await findByText('O Google Drive não está configurado neste app.')).toBeTruthy();
    expect(driveAuth().signInWithGoogle).not.toHaveBeenCalled();
  });
});
