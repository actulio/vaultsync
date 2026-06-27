import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { ThemeProvider, useTheme } from '../../src/theme';
import { lightColors } from '../../src/theme/tokens';

function ThemeColorReader(): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <>
      <Text testID="primary">{colors.primary}</Text>
      <Text testID="danger">{colors.danger}</Text>
      <Text testID="onPrimary">{colors.onPrimary}</Text>
    </>
  );
}

function ThemeSpacingReader(): React.JSX.Element {
  const { spacing } = useTheme();
  return (
    <>
      <Text testID="xs">{String(spacing.xs)}</Text>
      <Text testID="xl">{String(spacing.xl)}</Text>
      <Text testID="2xl">{String(spacing['2xl'])}</Text>
      <Text testID="5xl">{String(spacing['5xl'])}</Text>
    </>
  );
}

function ThemeRadiiReader(): React.JSX.Element {
  const { radii } = useTheme();
  return <Text testID="md">{String(radii.md)}</Text>;
}

function ThemeTypeReader(): React.JSX.Element {
  const { type } = useTheme();
  return (
    <>
      <Text testID="displaySize">{String(type.display.fontSize)}</Text>
      <Text testID="displayWeight">{type.display.fontWeight}</Text>
      <Text testID="bodyStrongWeight">{type.bodyStrong.fontWeight}</Text>
    </>
  );
}

describe('useTheme', () => {
  it('returns expected color tokens under ThemeProvider', async () => {
    const { getByTestId } = await render(
      <ThemeProvider>
        <ThemeColorReader />
      </ThemeProvider>,
    );
    expect(getByTestId('primary').props.children).toBe(lightColors.primary);
    expect(getByTestId('danger').props.children).toBe(lightColors.danger);
    expect(getByTestId('onPrimary').props.children).toBe(lightColors.onPrimary);
  });

  it('spacing scale has 4pt-grid values', async () => {
    const { getByTestId } = await render(
      <ThemeProvider>
        <ThemeSpacingReader />
      </ThemeProvider>,
    );
    expect(Number(getByTestId('xs').props.children)).toBe(4);
    expect(Number(getByTestId('xl').props.children)).toBe(20);
    expect(Number(getByTestId('2xl').props.children)).toBe(24);
    expect(Number(getByTestId('5xl').props.children)).toBe(48);
  });

  it('button radius (md) = 12', async () => {
    const { getByTestId } = await render(
      <ThemeProvider>
        <ThemeRadiiReader />
      </ThemeProvider>,
    );
    expect(Number(getByTestId('md').props.children)).toBe(12);
  });

  it('display typography has correct size and weight', async () => {
    const { getByTestId } = await render(
      <ThemeProvider>
        <ThemeTypeReader />
      </ThemeProvider>,
    );
    expect(Number(getByTestId('displaySize').props.children)).toBe(32);
    expect(getByTestId('displayWeight').props.children).toBe('700');
    expect(getByTestId('bodyStrongWeight').props.children).toBe('600');
  });
});
