import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '@/theme';
import { DialogProvider } from '@/components/DialogProvider';
import { useSyncStore } from '@/sync/store';
import { showToast } from '@/components/toast';
import SyncSettingsScreen from '../../app/(app)/settings/sync';

jest.mock('@/sync/orchestrator', () => ({
  syncOnce: jest.fn(async () => {}),
}));

jest.mock('@/drive/auth', () => ({
  signInWithGoogle: jest.fn(async () => true),
  hasDriveToken: jest.fn(async () => false),
  isDriveConfigured: jest.fn(() => true),
}));

jest.mock('@/components/toast', () => ({
  showToast: jest.fn(),
  VaultToast: () => null,
}));

function getSyncOnce() {
  return jest.requireMock<{ syncOnce: jest.Mock }>('@/sync/orchestrator').syncOnce;
}

function driveAuth() {
  return jest.requireMock<{
    signInWithGoogle: jest.Mock;
    hasDriveToken: jest.Mock;
    isDriveConfigured: jest.Mock;
  }>('@/drive/auth');
}

async function renderScreen() {
  return render(
    <ThemeProvider>
      <DialogProvider>
        <SyncSettingsScreen />
      </DialogProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  driveAuth().signInWithGoogle.mockResolvedValue(true);
  driveAuth().hasDriveToken.mockResolvedValue(false);
  driveAuth().isDriveConfigured.mockReturnValue(true);
  useSyncStore.setState({ status: 'paused_no_token', lastSyncedAt: null, queueDepth: 0 });
});

describe('SyncSettings screen', () => {
  it('shows Connect button with real PT string when status is paused_no_token', async () => {
    const { findByText } = await renderScreen();
    expect(await findByText('Conectar Google Drive')).toBeTruthy();
    expect(await findByText('Não conectado')).toBeTruthy();
  });

  it('calls signInWithGoogle when Connect is pressed', async () => {
    const { findByText } = await renderScreen();
    await fireEvent.press(await findByText('Conectar Google Drive'));
    await waitFor(() => {
      expect(driveAuth().signInWithGoogle).toHaveBeenCalledTimes(1);
    });
  });

  it('shows Sync-now button with real PT string when status is idle', async () => {
    driveAuth().hasDriveToken.mockResolvedValue(true);
    useSyncStore.setState({ status: 'idle', lastSyncedAt: Date.now(), queueDepth: 0 });
    const { findByText } = await renderScreen();
    expect(await findByText('Sincronizar agora')).toBeTruthy();
    expect(await findByText('Sincronizado')).toBeTruthy();
  });

  it('calls syncOnce when Sync-now is pressed', async () => {
    driveAuth().hasDriveToken.mockResolvedValue(true);
    useSyncStore.setState({ status: 'idle', lastSyncedAt: Date.now(), queueDepth: 0 });
    const { findByText } = await renderScreen();
    await fireEvent.press(await findByText('Sincronizar agora'));
    await waitFor(() => {
      expect(getSyncOnce()).toHaveBeenCalledTimes(1);
    });
  });

  it('offers Connect on first render when no token is stored, even though the store starts idle', async () => {
    useSyncStore.setState({ status: 'idle', lastSyncedAt: null, queueDepth: 0 });
    driveAuth().hasDriveToken.mockResolvedValue(false);
    const { findByText } = await renderScreen();
    expect(await findByText('Conectar Google Drive')).toBeTruthy();
  });

  it('labels a never-synced vault as never synced rather than Synced', async () => {
    driveAuth().hasDriveToken.mockResolvedValue(true);
    useSyncStore.setState({ status: 'idle', lastSyncedAt: null, queueDepth: 0 });
    const { findByText, queryByText } = await renderScreen();
    expect(await findByText('Nunca sincronizado')).toBeTruthy();
    expect(queryByText('Sincronizado')).toBeNull();
  });

  it('shows a dialog and records an error status when sign-in rejects', async () => {
    driveAuth().signInWithGoogle.mockRejectedValue(new Error('boom'));
    const { findByText } = await renderScreen();
    await fireEvent.press(await findByText('Conectar Google Drive'));
    expect(await findByText('Falha ao conectar ao Google Drive.')).toBeTruthy();
    expect(await findByText('Erro')).toBeTruthy();
    await waitFor(() => {
      expect(useSyncStore.getState().status).toBe('error');
    });
  });

  it('shows an actionable dialog and never calls sign-in when Drive is not configured', async () => {
    driveAuth().isDriveConfigured.mockReturnValue(false);
    const { findByText } = await renderScreen();
    await fireEvent.press(await findByText('Conectar Google Drive'));
    expect(await findByText('O Google Drive não está configurado neste app.')).toBeTruthy();
    expect(driveAuth().signInWithGoogle).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(useSyncStore.getState().status).toBe('error');
    });
  });

  it('gives visible feedback and keeps offering Connect when sign-in resolves false', async () => {
    // false = user cancelled the OAuth prompt, or Google returned no refresh
    // token. This used to be a silent no-op indistinguishable from the bug.
    driveAuth().signInWithGoogle.mockResolvedValue(false);
    driveAuth().hasDriveToken.mockResolvedValue(false);
    const { findByText } = await renderScreen();
    await fireEvent.press(await findByText('Conectar Google Drive'));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Conexão com o Google Drive não concluída.');
    });
    // The CTA must still offer Connect, and the status line must still say so.
    expect(await findByText('Conectar Google Drive')).toBeTruthy();
    expect(await findByText('Não conectado')).toBeTruthy();
    await waitFor(() => {
      expect(useSyncStore.getState().status).toBe('paused_no_token');
    });
  });

  it('does not raise the blocking error dialog when sign-in resolves false', async () => {
    driveAuth().signInWithGoogle.mockResolvedValue(false);
    const { findByText, queryByText } = await renderScreen();
    await fireEvent.press(await findByText('Conectar Google Drive'));
    await waitFor(() => {
      expect(showToast).toHaveBeenCalled();
    });
    expect(queryByText('Erro')).toBeNull();
    expect(queryByText('Falha ao conectar ao Google Drive.')).toBeNull();
  });

  it('visibly flips the CTA to Sync-now after a successful connect', async () => {
    // Mount probe resolves false (no token yet); the post-connect probe sees
    // the freshly stored refresh token.
    driveAuth().hasDriveToken.mockResolvedValueOnce(false).mockResolvedValue(true);
    driveAuth().signInWithGoogle.mockResolvedValue(true);
    const { findByText, queryByText } = await renderScreen();
    expect(await findByText('Conectar Google Drive')).toBeTruthy();

    await fireEvent.press(await findByText('Conectar Google Drive'));

    // The user-visible proof: the CTA changed and a confirmation was shown.
    expect(await findByText('Sincronizar agora')).toBeTruthy();
    expect(queryByText('Conectar Google Drive')).toBeNull();
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Google Drive conectado.');
    });
  });
});
