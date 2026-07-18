import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ThemeProvider } from '@/theme';
import { DialogProvider } from '@/components/DialogProvider';
import SetPassword from '../../app/(onboarding)/set-password';

function wrap(ui: React.ReactElement): React.ReactElement {
  return (
    <ThemeProvider>
      <DialogProvider>{ui}</DialogProvider>
    </ThemeProvider>
  );
}

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
    const { findByLabelText, findByText } = await render(wrap(<SetPassword />));
    void fireEvent.changeText(await findByLabelText('Senha mestre', { exact: false }), 'short');
    void fireEvent.changeText(await findByLabelText('Confirme a senha', { exact: false }), 'short');
    void fireEvent.press(await findByText('Continuar'));
    expect(await findByText(/8 caracteres/)).toBeTruthy();
  });

  it('shows mismatch error when passwords differ', async () => {
    const { findByLabelText, findByText } = await render(wrap(<SetPassword />));
    void fireEvent.changeText(await findByLabelText('Senha mestre', { exact: false }), 'longpassword1');
    void fireEvent.changeText(await findByLabelText('Confirme a senha', { exact: false }), 'longpassword2');
    void fireEvent.press(await findByText('Continuar'));
    expect(await findByText(/coincidem/)).toBeTruthy();
  });
});
