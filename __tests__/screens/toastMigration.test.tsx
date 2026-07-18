import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('@/components/toast', () => ({
  showToast: jest.fn(),
  VaultToast: () => null,
}));

jest.mock('@/native/clipboardWorker', () => ({
  copyAndScheduleClear: jest.fn().mockResolvedValue(undefined),
  cancelPendingClear: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@react-native-community/slider', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const MockReact = require('react');
  return {
    __esModule: true,
    default: ({ onValueChange }: { onValueChange?: (v: number) => void }) =>
      MockReact.createElement('View', { testID: 'length-slider', onValueChange }),
  };
});

jest.mock('@/generator/generate', () => ({
  generatePassword: jest.fn().mockResolvedValue('MockedPw-1234-AbCd'),
}));

import { showToast } from '@/components/toast';
import Generator from '../../app/(app)/(tabs)/generator';

describe('transient confirmations use the toast', () => {
  beforeEach(() => jest.clearAllMocks());

  it('generator copy shows a toast, not an Alert', async () => {
    const { getByText } = await render(<Generator />);
    await waitFor(() => expect(getByText('MockedPw-1234-AbCd')).toBeTruthy());
    await fireEvent.press(getByText('Copiar'));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Senha copiada'));
  });
});
