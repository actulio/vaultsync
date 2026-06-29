import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import GeneratorScreen from '../../app/(app)/(tabs)/generator';

// -----------------------------------------------------------------------
// Mocks — factories must be self-contained (no out-of-scope references)
// -----------------------------------------------------------------------

jest.mock('@react-native-community/slider', () => ({
  __esModule: true,
  // Stub the native Slider with a no-op component (native module — cannot run in Jest).
  default: () => null,
}));

jest.mock('@/generator/generate', () => ({
  generatePassword: jest.fn().mockResolvedValue('MockedPw-1234-AbCd'),
}));

jest.mock('@/generator/presets', () => ({
  DEFAULT_OPTIONS: {
    length: 20,
    lower: true,
    upper: true,
    digits: true,
    symbols: true,
    avoidAmbiguous: false,
  },
}));

jest.mock('@/native/clipboardWorker', () => ({
  copyAndScheduleClear: jest.fn().mockResolvedValue(undefined),
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

function getCopyMock(): jest.Mock {
  const { copyAndScheduleClear } = jest.requireMock<{
    copyAndScheduleClear: jest.Mock;
  }>('@/native/clipboardWorker');
  return copyAndScheduleClear;
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
// Tests (Portuguese strings — default test locale is pt)
// -----------------------------------------------------------------------

describe('GeneratorScreen', () => {
  it('displays the generated password on mount', async () => {
    await render(<GeneratorScreen />);
    await waitFor(() => {
      expect(screen.getByText('MockedPw-1234-AbCd')).toBeTruthy();
    });
  });

  it('pressing Gerar calls generatePassword again', async () => {
    await render(<GeneratorScreen />);
    // Wait for initial generation
    await waitFor(() => {
      expect(screen.getByText('MockedPw-1234-AbCd')).toBeTruthy();
    });

    const generateMock = getGenerateMock();
    const callsBefore = generateMock.mock.calls.length;

    const generateBtn = screen.getByText('Gerar');
    await fireEvent.press(generateBtn);

    await waitFor(() => {
      expect(generateMock.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  it('pressing Copiar calls copyAndScheduleClear with the displayed password and 30', async () => {
    await render(<GeneratorScreen />);
    await waitFor(() => {
      expect(screen.getByText('MockedPw-1234-AbCd')).toBeTruthy();
    });

    const copyBtn = screen.getByText('Copiar');
    await fireEvent.press(copyBtn);

    await waitFor(() => {
      expect(getCopyMock()).toHaveBeenCalledWith('MockedPw-1234-AbCd', 30);
    });
  });

  it('toggling a class Switch triggers generatePassword again (opts change)', async () => {
    await render(<GeneratorScreen />);
    await waitFor(() => {
      expect(screen.getByText('MockedPw-1234-AbCd')).toBeTruthy();
    });

    const generateMock = getGenerateMock();
    const callsBefore = generateMock.mock.calls.length;

    // Toggle the 'a–z' (lower) switch — label comes from generator.lower i18n key
    const switches = screen.getAllByRole('switch');
    const firstSwitch = switches[0];
    if (!firstSwitch) throw new Error('No switches found');

    await fireEvent(firstSwitch, 'valueChange', false);

    await waitFor(() => {
      expect(generateMock.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });
});
