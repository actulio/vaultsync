import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuthStore } from '@/auth/store';
import type { VaultV1 } from '@/vault/types';
import QuickSearch from '../../app/search';

// -----------------------------------------------------------------------
// Mocks — factories must be self-contained (no out-of-scope references)
// -----------------------------------------------------------------------

jest.mock('@/native/clipboardWorker', () => ({
  copyAndScheduleClear: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

function getUseLocalSearchParams(): jest.Mock {
  return jest.requireMock<{ useLocalSearchParams: jest.Mock }>('expo-router').useLocalSearchParams;
}

function getRouter(): { push: jest.Mock; replace: jest.Mock; back: jest.Mock } {
  return jest.requireMock<{ router: { push: jest.Mock; replace: jest.Mock; back: jest.Mock } }>(
    'expo-router',
  ).router;
}

function getCopyAndScheduleClear(): jest.Mock {
  return jest.requireMock<{ copyAndScheduleClear: jest.Mock }>('@/native/clipboardWorker')
    .copyAndScheduleClear;
}

function setParams(params: { domain?: string; package?: string }): void {
  getUseLocalSearchParams().mockReturnValue(params);
}

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
      username: 'octocat',
      password: 'secret1',
      url: 'https://github.com/login',
      createdAt: '',
      updatedAt: '',
    },
    {
      id: '2',
      type: 'login' as const,
      title: 'Example Bank',
      username: 'jane',
      password: 'secret2',
      packageNames: ['com.example.bank'],
      createdAt: '',
      updatedAt: '',
    },
    {
      id: '3',
      type: 'note' as const,
      title: 'WiFi',
      body: 'pass',
      createdAt: '',
      updatedAt: '',
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.getState().reset();
  useAuthStore.getState().unlock(new Uint8Array(32), testVault);
  setParams({ domain: '', package: '' });
});

// -----------------------------------------------------------------------
// Tests (Portuguese strings — default test locale is pt)
// -----------------------------------------------------------------------

describe('QuickSearch', () => {
  it('filters to logins matching a domain term (title/url match)', async () => {
    setParams({ domain: 'github', package: '' });

    await render(<QuickSearch />);

    expect(await screen.findByText('GitHub')).toBeTruthy();
    expect(screen.queryByText('Example Bank')).toBeNull();
    expect(screen.queryByText('WiFi')).toBeNull();
  });

  it('filters by package via packageNames', async () => {
    setParams({ domain: '', package: 'com.example.bank' });

    await render(<QuickSearch />);

    expect(await screen.findByText('Example Bank')).toBeTruthy();
    expect(screen.queryByText('GitHub')).toBeNull();
  });

  it('renders the empty state when both params are empty', async () => {
    setParams({ domain: '', package: '' });

    await render(<QuickSearch />);

    expect(await screen.findByText('VaultSync vazio. Toque em + para adicionar.')).toBeTruthy();
  });

  it('renders the empty state when the term matches nothing', async () => {
    setParams({ domain: 'no-such-entry', package: '' });

    await render(<QuickSearch />);

    expect(await screen.findByText('VaultSync vazio. Toque em + para adicionar.')).toBeTruthy();
  });

  it('pressing the password button calls copyAndScheduleClear with the password and 30', async () => {
    setParams({ domain: 'github', package: '' });

    await render(<QuickSearch />);

    const passwordBtn = await screen.findByText('Senha');
    await fireEvent.press(passwordBtn);

    await waitFor(() => {
      expect(getCopyAndScheduleClear()).toHaveBeenCalledWith('secret1', 30);
    });
  });

  it('pressing the username button calls copyAndScheduleClear with the username and 30', async () => {
    setParams({ domain: 'github', package: '' });

    await render(<QuickSearch />);

    const usernameBtn = await screen.findByText('Usuário');
    await fireEvent.press(usernameBtn);

    await waitFor(() => {
      expect(getCopyAndScheduleClear()).toHaveBeenCalledWith('octocat', 30);
    });
  });

  it('redirects to /unlock when the vault is locked', async () => {
    setParams({ domain: '', package: '' });
    useAuthStore.getState().setLocked();

    await render(<QuickSearch />);

    await waitFor(() => {
      expect(getRouter().replace).toHaveBeenCalledWith('/unlock');
    });
  });
});
