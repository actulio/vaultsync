import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import RecoveryCode from '../../app/(onboarding)/recovery-code';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: () => ({ code: 'AAAA-BBBB-CCCC-DDDD-EEEE-FFFF' }),
}));

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));

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
});
