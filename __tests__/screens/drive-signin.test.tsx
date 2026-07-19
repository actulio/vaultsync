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

import { router } from 'expo-router';
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

  it('shows an actionable dialog and never calls sign-in when Drive is not configured', async () => {
    driveAuth().isDriveConfigured.mockReturnValue(false);
    const { findByText } = await renderScreen();
    await fireEvent.press(await findByText('Conectar Drive'));
    expect(await findByText('Google Drive não configurado neste app.')).toBeTruthy();
    expect(driveAuth().signInWithGoogle).not.toHaveBeenCalled();
  });
});
