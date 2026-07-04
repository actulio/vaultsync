import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('@/native/autofill', () => ({
  Autofill: {
    isSupported: jest.fn().mockResolvedValue(true),
    isEnabled: jest.fn().mockResolvedValue(false),
    requestEnable: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
}));

import { Autofill } from '@/native/autofill';
import { router } from 'expo-router';
import AutofillOnboarding from '../../app/(onboarding)/autofill';

const mocked = Autofill as unknown as { isSupported: jest.Mock; requestEnable: jest.Mock };

describe('Autofill onboarding step', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mocked.isSupported.mockResolvedValue(true);
    mocked.requestEnable.mockResolvedValue(undefined);
  });

  it('renders title + Enable/Skip when supported', async () => {
    const { findByText } = await render(<AutofillOnboarding />);
    expect(await findByText('Ativar autopreenchimento')).toBeTruthy();
    expect(await findByText('Ativar')).toBeTruthy();
    expect(await findByText('Agora não')).toBeTruthy();
  });

  it('Enable calls requestEnable then advances to drive-signin', async () => {
    const { findByText } = await render(<AutofillOnboarding />);
    void fireEvent.press(await findByText('Ativar'));
    await waitFor(() => expect(mocked.requestEnable).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/(onboarding)/drive-signin'));
  });

  it('Skip advances to drive-signin without requesting', async () => {
    const { findByText } = await render(<AutofillOnboarding />);
    void fireEvent.press(await findByText('Agora não'));
    expect(router.push).toHaveBeenCalledWith('/(onboarding)/drive-signin');
    expect(mocked.requestEnable).not.toHaveBeenCalled();
  });

  it('auto-skips (router.replace) when autofill is unsupported', async () => {
    mocked.isSupported.mockResolvedValue(false);
    await render(<AutofillOnboarding />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(onboarding)/drive-signin'));
  });
});
