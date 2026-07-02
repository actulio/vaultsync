import React from 'react';
import { render, screen } from '@testing-library/react-native';
import ConfirmScreen from '../../app/(app)/import/confirm';

// -----------------------------------------------------------------------
// Mocks — factories must be self-contained (no out-of-scope references).
// This is a render-only smoke test (the Import button is never pressed),
// so persistVault/native modules are mocked purely to keep the import
// chain from touching real native bindings.
// -----------------------------------------------------------------------

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({
    content:
      'Title,URL,Username,Password,Notes\n' +
      'GitHub,https://github.com,alice,hunter2,work account\n' +
      ',https://noname.com,bob,secret,no title here',
    uri: 'file:///tmp/import.csv',
    mapping: JSON.stringify({
      title: 'Title',
      url: 'URL',
      username: 'Username',
      password: 'Password',
      notes: 'Notes',
    }),
  }),
}));

jest.mock('@/vault/persist', () => ({
  persistVault: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
}));

describe('Import Confirm screen', () => {
  it('parses the mapping param and renders the split logins/notes/skipped preview text', async () => {
    await render(<ConfirmScreen />);

    // Fixture: 1 valid login row (GitHub), 1 skipped row (no title), 0 notes.
    expect(screen.getByText('Importar 1 logins, 0 notas seguras, ignorar 1 linhas')).toBeTruthy();
  });
});
