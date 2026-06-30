import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import SyncSettingsScreen from '../../app/(app)/settings/sync';

jest.mock('@/sync/orchestrator', () => ({
  syncOnce: jest.fn(async () => {}),
}));

jest.mock('@/drive/auth', () => ({
  signInWithGoogle: jest.fn(async () => true),
}));

jest.mock('@/sync/store', () => ({
  useSyncStore: jest.fn(),
}));

function getSyncStore() {
  return jest.requireMock<{ useSyncStore: jest.Mock }>('@/sync/store').useSyncStore;
}

function getSyncOnce() {
  return jest.requireMock<{ syncOnce: jest.Mock }>('@/sync/orchestrator').syncOnce;
}

function getSignInWithGoogle() {
  return jest.requireMock<{ signInWithGoogle: jest.Mock }>('@/drive/auth').signInWithGoogle;
}

beforeEach(() => {
  jest.clearAllMocks();
  getSyncStore().mockReturnValue({
    status: 'paused_no_token',
    lastSyncedAt: null,
    queueDepth: 0,
  });
});

describe('SyncSettings screen', () => {
  it('shows Connect button with real PT string when status is paused_no_token', async () => {
    const { findByText } = await render(<SyncSettingsScreen />);
    expect(await findByText('Conectar Google Drive')).toBeTruthy();
    expect(await findByText('Não conectado')).toBeTruthy();
  });

  it('calls signInWithGoogle when Connect is pressed', async () => {
    const { findByText } = await render(<SyncSettingsScreen />);
    void fireEvent.press(await findByText('Conectar Google Drive'));
    await waitFor(() => {
      expect(getSignInWithGoogle()).toHaveBeenCalledTimes(1);
    });
  });

  it('shows Sync-now button with real PT string when status is idle', async () => {
    getSyncStore().mockReturnValue({
      status: 'idle',
      lastSyncedAt: null,
      queueDepth: 0,
    });
    const { findByText } = await render(<SyncSettingsScreen />);
    expect(await findByText('Sincronizar agora')).toBeTruthy();
    expect(await findByText('Sincronizado')).toBeTruthy();
  });

  it('calls syncOnce when Sync-now is pressed', async () => {
    getSyncStore().mockReturnValue({
      status: 'idle',
      lastSyncedAt: null,
      queueDepth: 0,
    });
    const { findByText } = await render(<SyncSettingsScreen />);
    void fireEvent.press(await findByText('Sincronizar agora'));
    await waitFor(() => {
      expect(getSyncOnce()).toHaveBeenCalledTimes(1);
    });
  });
});
