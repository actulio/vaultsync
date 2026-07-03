import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { PasswordGenerator } from '@/generator/PasswordGenerator';

// -----------------------------------------------------------------------
// Mocks — factories must be self-contained (no out-of-scope references)
// -----------------------------------------------------------------------

jest.mock('@react-native-community/slider', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const MockReact = require('react');
  return {
    __esModule: true,
    // Renders a host View with testID so tests can fire onValueChange events.
    // Native Slider cannot run in Jest; the View carries the prop for fireEvent.
    default: ({ onValueChange }: { onValueChange?: (v: number) => void }) =>
      // no-unsafe-call / no-unsafe-member-access are off for __tests__
      MockReact.createElement('View', { testID: 'length-slider', onValueChange }),
  };
});

jest.mock('@/generator/generate', () => ({
  generatePassword: jest.fn().mockResolvedValue('MockedPw-1234-AbCd'),
}));

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

function getGenerateMock(): jest.Mock {
  const { generatePassword } = jest.requireMock<{
    generatePassword: jest.Mock;
  }>('@/generator/generate');
  return generatePassword;
}

// -----------------------------------------------------------------------
// Setup / teardown
// -----------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  getGenerateMock().mockResolvedValue('MockedPw-1234-AbCd');
});

afterEach(() => {
  jest.restoreAllMocks();
});

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

describe('PasswordGenerator', () => {
  it('renders the five class toggles and the Generate button', async () => {
    await render(<PasswordGenerator onChange={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('MockedPw-1234-AbCd')).toBeTruthy();
    });

    expect(screen.getAllByRole('switch')).toHaveLength(5);
    expect(screen.getByText('Gerar')).toBeTruthy();
  });

  it('calls onChange with a non-empty string on mount', async () => {
    const onChange = jest.fn();
    await render(<PasswordGenerator onChange={onChange} />);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
    });
    const [lastArg] = onChange.mock.calls[onChange.mock.calls.length - 1] as [string];
    expect(typeof lastArg).toBe('string');
    expect(lastArg.length).toBeGreaterThan(0);
  });

  it('pressing Generate regenerates and calls onChange again', async () => {
    const onChange = jest.fn();
    await render(<PasswordGenerator onChange={onChange} />);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    getGenerateMock().mockResolvedValueOnce('AnotherMockedPw-5678');
    await fireEvent.press(screen.getByText('Gerar'));

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith('AnotherMockedPw-5678');
    });
  });

  it('toggling a class Switch regenerates the password (opts change)', async () => {
    const onChange = jest.fn();
    await render(<PasswordGenerator onChange={onChange} />);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    const switches = screen.getAllByRole('switch');
    const firstSwitch = switches[0];
    if (!firstSwitch) throw new Error('No switches found');

    await fireEvent(firstSwitch, 'valueChange', false);

    await waitFor(() => {
      expect(getGenerateMock().mock.calls.length).toBeGreaterThan(1);
    });
  });
});
