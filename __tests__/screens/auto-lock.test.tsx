import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import AutoLockScreen from '../../app/(app)/settings/auto-lock';

jest.mock('@/settings/prefs', () => ({
  loadPrefs: jest.fn(async () => ({ language: 'pt' as const, autoLockMs: 5 * 60 * 1000 })),
  setAutoLockPref: jest.fn(async () => {}),
}));

jest.mock('@/auth/autoLock', () => ({
  startAutoLock: jest.fn(),
}));

function getStartAutoLock() {
  return jest.requireMock<{ startAutoLock: jest.Mock }>('@/auth/autoLock').startAutoLock;
}

function getSetAutoLockPref() {
  return jest.requireMock<{ setAutoLockPref: jest.Mock }>('@/settings/prefs').setAutoLockPref;
}

function getLoadPrefs() {
  return jest.requireMock<{ loadPrefs: jest.Mock }>('@/settings/prefs').loadPrefs;
}

beforeEach(() => {
  jest.clearAllMocks();
  getLoadPrefs().mockResolvedValue({
    language: 'pt' as const,
    autoLockMs: 5 * 60 * 1000,
  });
});

describe('AutoLock screen', () => {
  it('calls startAutoLock with selected value when a radio is pressed', async () => {
    const { findByText } = await render(<AutoLockScreen />);

    void fireEvent.press(await findByText('1 minuto'));

    await waitFor(() => {
      expect(getStartAutoLock()).toHaveBeenCalledWith(1 * 60 * 1000);
    });
  });

  it('persists the pref via setAutoLockPref before calling startAutoLock', async () => {
    const callOrder: string[] = [];
    getSetAutoLockPref().mockImplementation(async () => { callOrder.push('set'); });
    getStartAutoLock().mockImplementation(() => { callOrder.push('start'); });

    const { findByText } = await render(<AutoLockScreen />);
    void fireEvent.press(await findByText('1 hora'));

    await waitFor(() => expect(getStartAutoLock()).toHaveBeenCalled());
    expect(callOrder).toEqual(['set', 'start']);
  });

  it('calls startAutoLock with NEVER_MS when "Nunca" is selected', async () => {
    const { findByText } = await render(<AutoLockScreen />);
    void fireEvent.press(await findByText('Nunca'));

    await waitFor(() => {
      expect(getStartAutoLock()).toHaveBeenCalledWith(Number.MAX_SAFE_INTEGER);
    });
  });
});
