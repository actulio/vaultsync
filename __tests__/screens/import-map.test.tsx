import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import MapScreen from '../../app/(app)/import/map';

// -----------------------------------------------------------------------
// Mocks — factories must be self-contained (no out-of-scope references).
// Regression guard for the map→confirm hand-off: this screen must forward
// the picked file's `uri` alongside `content`/`mapping` when it navigates
// to /(app)/import/confirm, otherwise the auto-delete of the temp CSV
// (which holds plaintext passwords) never runs on the confirm screen.
// -----------------------------------------------------------------------

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

// map.tsx statically imports '@/import/csvImporter', which transitively
// imports '@/vault/persist' -> the native keystore module. Mock it so this
// suite doesn't need a real native binding — buildPreview (the only
// csvImporter export map.tsx actually calls) never touches persistence.
jest.mock('@/vault/persist', () => ({
  persistVault: jest.fn().mockResolvedValue(undefined),
}));

function getUseLocalSearchParams(): jest.Mock {
  return jest.requireMock<{ useLocalSearchParams: jest.Mock }>('expo-router').useLocalSearchParams;
}

function getRouter(): { push: jest.Mock; replace: jest.Mock; back: jest.Mock } {
  return jest.requireMock<{ router: { push: jest.Mock; replace: jest.Mock; back: jest.Mock } }>(
    'expo-router',
  ).router;
}

function setParams(params: { content?: string; uri?: string }): void {
  getUseLocalSearchParams().mockReturnValue(params);
}

const CSV =
  'Title,URL,Username,Password,Notes\n' +
  'GitHub,https://github.com,alice,hunter2,work account\n';

beforeEach(() => {
  jest.clearAllMocks();
  setParams({ content: CSV, uri: 'file:///tmp/import.csv' });
});

describe('Import Map screen', () => {
  it('forwards the temp-file uri (alongside content and mapping) when navigating to confirm', async () => {
    await render(<MapScreen />);

    await fireEvent.press(screen.getByText('Avançar'));

    expect(getRouter().push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/(app)/import/confirm',
        params: expect.objectContaining({
          content: CSV,
          uri: 'file:///tmp/import.csv',
        }),
      }),
    );
  });
});
