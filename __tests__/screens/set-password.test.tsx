import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import SetPassword from '../../app/(onboarding)/set-password';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('@/auth/onboarding', () => ({
  createVault: jest.fn(async () => ({
    recoveryCode: 'AAAA-BBBB-CCCC-DDDD-EEEE-FFFF',
    masterKey: new Uint8Array(32),
    vault: { version: 1, entries: [], updatedAt: '', deviceId: '' },
  })),
}));

jest.mock('@/auth/store', () => ({
  useAuthStore: {
    getState: () => ({ unlock: jest.fn() }),
  },
}));

describe('SetPassword', () => {
  it('rejects passwords shorter than 8 chars', async () => {
    const { findByLabelText, findByText } = await render(<SetPassword />);
    fireEvent.changeText(await findByLabelText('Senha mestre', { exact: false }), 'short');
    fireEvent.changeText(await findByLabelText('Confirme a senha', { exact: false }), 'short');
    fireEvent.press(await findByText('Continuar'));
    expect(await findByText(/8 caracteres/)).toBeTruthy();
  });

  it('shows mismatch error when passwords differ', async () => {
    const { findByLabelText, findByText } = await render(<SetPassword />);
    fireEvent.changeText(await findByLabelText('Senha mestre', { exact: false }), 'longpassword1');
    fireEvent.changeText(await findByLabelText('Confirme a senha', { exact: false }), 'longpassword2');
    fireEvent.press(await findByText('Continuar'));
    expect(await findByText(/coincidem/)).toBeTruthy();
  });
});
