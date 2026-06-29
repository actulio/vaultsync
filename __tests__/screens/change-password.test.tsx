import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import ChangePassword from '../../app/(app)/settings/change-password';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
}));

jest.mock('@/auth/store', () => ({
  useAuthStore: {
    getState: () => ({ vault: null, unlock: jest.fn() }),
  },
}));

jest.mock('@/settings/changePassword', () => ({
  changeMasterPassword: jest.fn(async () => ({
    newRecoveryCode: 'XXXX-YYYY-ZZZZ-1111-2222-3333',
    newMasterKey: new Uint8Array(32),
  })),
}));

jest.mock('@/crypto/argon2', () => ({
  deriveMasterKey: jest.fn(async () => new Uint8Array(32)),
}));

jest.mock('@/vault/format', () => ({
  decodeVaultFile: jest.fn(() => ({
    salt: new Uint8Array(16),
    argon2: {},
  })),
}));

jest.mock('@/native/keystore', () => ({
  VaultStore: {
    read: jest.fn(async () => new Uint8Array(64)),
  },
}));

function getReplace() {
  return jest.requireMock<{ router: { replace: jest.Mock } }>('expo-router').router.replace;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ChangePassword screen', () => {
  it('routes to recovery-code with from=settings on success', async () => {
    const { findByLabelText, findByText } = await render(<ChangePassword />);

    // Labels match the Portuguese translations for changePassword.*
    void fireEvent.changeText(await findByLabelText('Senha atual'), 'oldpassword1');
    void fireEvent.changeText(await findByLabelText('Nova senha'), 'newpassword1');
    void fireEvent.changeText(await findByLabelText('Confirme a nova senha'), 'newpassword1');

    void fireEvent.press(await findByText('Alterar senha'));

    await waitFor(() => {
      expect(getReplace()).toHaveBeenCalledWith({
        pathname: '/(onboarding)/recovery-code',
        params: { code: 'XXXX-YYYY-ZZZZ-1111-2222-3333', from: 'settings' },
      });
    });
  });

  it('does NOT route to biometric or drive-signin on success', async () => {
    const { findByLabelText, findByText } = await render(<ChangePassword />);

    void fireEvent.changeText(await findByLabelText('Senha atual'), 'oldpassword1');
    void fireEvent.changeText(await findByLabelText('Nova senha'), 'newpassword1');
    void fireEvent.changeText(await findByLabelText('Confirme a nova senha'), 'newpassword1');

    void fireEvent.press(await findByText('Alterar senha'));

    await waitFor(() => expect(getReplace()).toHaveBeenCalled());

    const [call] = getReplace().mock.calls;
    const firstArg = call[0] as { pathname?: string } | string;
    const pathname = typeof firstArg === 'string' ? firstArg : firstArg?.pathname ?? '';
    expect(pathname).not.toBe('/(onboarding)/biometric');
    expect(pathname).not.toBe('/(onboarding)/drive-signin');
  });
});
