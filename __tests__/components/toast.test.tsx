import React from 'react';
import { render } from '@testing-library/react-native';
import Toast from 'react-native-toast-message';
import { ThemeProvider } from '@/theme';
import { VaultToast, showToast } from '@/components/toast';

jest.mock('react-native-toast-message', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  const show = jest.fn();
  const Mock = (props: unknown) => React.createElement('VaultToastHost', props);
  Mock.show = show;
  return { __esModule: true, default: Mock };
});

describe('toast', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders a host component', async () => {
    const { toJSON } = await render(
      <ThemeProvider>
        <VaultToast />
      </ThemeProvider>,
    );
    expect(toJSON()).toMatchObject({ type: 'VaultToastHost' });
  });

  it('showToast forwards the message to the library', () => {
    showToast('Copiado!');
    expect((Toast as unknown as { show: jest.Mock }).show).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'vaultToast', text1: 'Copiado!' }),
    );
  });
});
