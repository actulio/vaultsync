import React from 'react';
import type { JSX } from 'react';
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
    const tree = toJSON() as unknown as {
      type: string;
      props: { config: { vaultToast: (props: { text1?: string }) => JSX.Element } };
    };
    expect(tree).toMatchObject({ type: 'VaultToastHost' });
    expect(typeof tree.props.config.vaultToast).toBe('function');
  });

  it('the vaultToast renderer produces the alert body with the message text', async () => {
    const { toJSON: hostToJSON } = await render(
      <ThemeProvider>
        <VaultToast />
      </ThemeProvider>,
    );
    const tree = hostToJSON() as unknown as {
      props: { config: { vaultToast: (props: { text1?: string }) => JSX.Element } };
    };
    const { vaultToast } = tree.props.config;

    const { findByText, toJSON: bodyToJSON } = await render(
      <ThemeProvider>{vaultToast({ text1: 'Copiado!' })}</ThemeProvider>,
    );

    expect(await findByText('Copiado!')).toBeTruthy();
    expect(bodyToJSON()).toMatchObject({ props: { accessibilityRole: 'alert' } });
  });

  it('showToast forwards the message to the library', () => {
    showToast('Copiado!');
    expect((Toast as unknown as { show: jest.Mock }).show).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'vaultToast', text1: 'Copiado!' }),
    );
  });
});
