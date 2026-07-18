import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { ThemeProvider } from '@/theme';
import { DialogProvider } from '@/components/DialogProvider';
import { useAuthStore } from '@/auth/store';
import type { VaultV1 } from '@/vault/types';

jest.mock('@/native/clipboardWorker', () => ({
  copyAndScheduleClear: jest.fn().mockResolvedValue(undefined),
  cancelPendingClear: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/components/toast', () => ({ showToast: jest.fn(), VaultToast: () => null }));

jest.mock('@/vault/persist', () => ({
  persistVault: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({ id: '1' }),
}));

import EntryDetail from '../../app/(app)/entry/[id]';

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
      password: 'secret',
      createdAt: '',
      updatedAt: '',
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.getState().reset();
  useAuthStore.getState().unlock(new Uint8Array(32), testVault);
});

describe('blocking confirmations use the dialog', () => {
  it('delete asks for confirmation via the dialog, not Alert', async () => {
    const spy = jest.spyOn(Alert, 'alert');
    const { getByText, findByText } = await render(
      <ThemeProvider>
        <DialogProvider>
          <EntryDetail />
        </DialogProvider>
      </ThemeProvider>,
    );
    void fireEvent.press(getByText('Excluir'));
    expect(await findByText('Excluir esta entrada?')).toBeTruthy();
    await waitFor(() => expect(spy).not.toHaveBeenCalled());
    spy.mockRestore();
  });
});
