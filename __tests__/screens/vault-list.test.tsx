import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useAuthStore } from '@/auth/store';
import type { VaultV1 } from '@/vault/types';
import VaultList from '../../app/(app)/(tabs)/index';

// -----------------------------------------------------------------------
// Mocks — factories must be self-contained (no out-of-scope references)
// -----------------------------------------------------------------------

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  Link: ({ children }: { children: React.ReactNode }) => children,
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
      username: 'me',
      password: 'p',
      createdAt: '',
      updatedAt: '',
    },
    {
      id: '2',
      type: 'note' as const,
      title: 'WiFi',
      body: 'pass',
      createdAt: '',
      updatedAt: '',
    },
  ],
};

beforeEach(() => {
  useAuthStore.getState().reset();
  useAuthStore.getState().unlock(new Uint8Array(32), testVault);
});

// -----------------------------------------------------------------------
// Tests (Portuguese strings — default test locale is pt)
// -----------------------------------------------------------------------

describe('VaultList', () => {
  it('renders all entries by default', async () => {
    await render(<VaultList />);
    expect(screen.getByText('GitHub')).toBeTruthy();
    expect(screen.getByText('WiFi')).toBeTruthy();
  });

  it('filters by note type', async () => {
    await render(<VaultList />);
    await fireEvent.press(screen.getByText('Notas'));
    expect(screen.queryByText('GitHub')).toBeNull();
    expect(screen.getByText('WiFi')).toBeTruthy();
  });

  it('searches by query', async () => {
    await render(<VaultList />);
    await fireEvent.changeText(screen.getByPlaceholderText('Buscar...'), 'wifi');
    expect(screen.queryByText('GitHub')).toBeNull();
  });
});
