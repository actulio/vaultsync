import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import RecoveryCode from '../../app/(onboarding)/recovery-code';

let mockParams: Record<string, string> = { code: 'AAAA-BBBB-CCCC-DDDD-EEEE-FFFF' };

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));

function getRouter() {
  return jest.requireMock<{ router: { push: jest.Mock; replace: jest.Mock } }>('expo-router').router;
}

function getClipboard() {
  return jest.requireMock<{ setStringAsync: jest.Mock }>('expo-clipboard');
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { code: 'AAAA-BBBB-CCCC-DDDD-EEEE-FFFF' };
});

describe('RecoveryCode', () => {
  it('disables continue until checkbox is confirmed', async () => {
    const { getByRole } = await render(<RecoveryCode />);
    expect(getByRole('button', { name: 'Continuar' }).props.accessibilityState?.disabled).toBeTruthy();
    void fireEvent.press(getByRole('checkbox'));
    await waitFor(() => {
      expect(getByRole('button', { name: 'Continuar' }).props.accessibilityState?.disabled).toBeFalsy();
    });
  });

  it('shows the code', async () => {
    const { getByText } = await render(<RecoveryCode />);
    expect(getByText('AAAA-BBBB-CCCC-DDDD-EEEE-FFFF')).toBeTruthy();
  });

  it('copy control: copies the code to clipboard and shows a confirmation alert', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { getByRole } = await render(<RecoveryCode />);

    await fireEvent.press(getByRole('button', { name: 'Copiar' }));

    await waitFor(() => {
      expect(getClipboard().setStringAsync).toHaveBeenCalledWith('AAAA-BBBB-CCCC-DDDD-EEEE-FFFF');
      expect(alertSpy).toHaveBeenCalledWith('Código de recuperação copiado');
    });

    alertSpy.mockRestore();
  });

  it('copy control: does nothing when there is no code', async () => {
    mockParams = {};
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { getByRole } = await render(<RecoveryCode />);

    await fireEvent.press(getByRole('button', { name: 'Copiar' }));

    expect(getClipboard().setStringAsync).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('onboarding path: CTA pushes to biometric (no from param)', async () => {
    mockParams = { code: 'AAAA-BBBB-CCCC-DDDD-EEEE-FFFF' };
    const { getByRole } = await render(<RecoveryCode />);
    void fireEvent.press(getByRole('checkbox'));
    await waitFor(() =>
      expect(getByRole('button', { name: 'Continuar' }).props.accessibilityState?.disabled).toBeFalsy(),
    );
    void fireEvent.press(getByRole('button', { name: 'Continuar' }));
    expect(getRouter().push).toHaveBeenCalledWith('/(onboarding)/biometric');
    expect(getRouter().replace).not.toHaveBeenCalled();
  });

  it('settings path: CTA replaces to /(app)/(tabs) when from=settings', async () => {
    mockParams = { code: 'AAAA-BBBB-CCCC-DDDD-EEEE-FFFF', from: 'settings' };
    const { getByRole } = await render(<RecoveryCode />);
    void fireEvent.press(getByRole('checkbox'));
    await waitFor(() =>
      expect(getByRole('button', { name: 'Continuar' }).props.accessibilityState?.disabled).toBeFalsy(),
    );
    void fireEvent.press(getByRole('button', { name: 'Continuar' }));
    expect(getRouter().replace).toHaveBeenCalledWith('/(app)/(tabs)');
    expect(getRouter().push).not.toHaveBeenCalledWith('/(onboarding)/biometric');
  });
});
