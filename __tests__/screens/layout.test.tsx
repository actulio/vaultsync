import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import RootLayout from '../../app/_layout';

jest.mock('@/auth/autoLock', () => ({
  startAutoLock: jest.fn(() => () => {}),
}));

jest.mock('@/settings/prefs', () => ({
  loadPrefs: jest.fn(async () => ({ language: 'pt' as const, autoLockMs: 15 * 60 * 1000 })),
}));

jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  return {
    Stack: () => React.createElement('View', null),
  };
});

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'pt-BR' }],
}));

function getStartAutoLock() {
  return jest.requireMock<{ startAutoLock: jest.Mock }>('@/auth/autoLock').startAutoLock;
}

function getLoadPrefs() {
  return jest.requireMock<{ loadPrefs: jest.Mock }>('@/settings/prefs').loadPrefs;
}

beforeEach(() => {
  jest.clearAllMocks();
  getLoadPrefs().mockResolvedValue({ language: 'pt' as const, autoLockMs: 15 * 60 * 1000 });
  getStartAutoLock().mockReturnValue(() => {});
});

describe('RootLayout', () => {
  it('calls startAutoLock with the saved autoLockMs pref on mount', async () => {
    getLoadPrefs().mockResolvedValueOnce({ language: 'pt' as const, autoLockMs: 15 * 60 * 1000 });

    await render(<RootLayout />);

    await waitFor(() => {
      expect(getStartAutoLock()).toHaveBeenCalledWith(15 * 60 * 1000);
    });
  });

  it('uses the pref value rather than a hardcoded default', async () => {
    getLoadPrefs().mockResolvedValueOnce({ language: 'pt' as const, autoLockMs: 1 * 60 * 1000 });

    await render(<RootLayout />);

    await waitFor(() => expect(getStartAutoLock()).toHaveBeenCalled());
    expect(getStartAutoLock()).not.toHaveBeenCalledWith(5 * 60 * 1000);
    expect(getStartAutoLock()).toHaveBeenCalledWith(1 * 60 * 1000);
  });
});
