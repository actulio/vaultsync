import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type * as CsvImporterModule from '@/import/csvImporter';
import ConfirmScreen from '../../app/(app)/import/confirm';

// -----------------------------------------------------------------------
// Mocks — factories must be self-contained (no out-of-scope references).
// -----------------------------------------------------------------------

const CSV_CONTENT =
  'Title,URL,Username,Password,Notes\n' +
  'GitHub,https://github.com,alice,hunter2,work account\n' +
  ',https://noname.com,bob,secret,no title here';

const MAPPING_PARAM = JSON.stringify({
  title: 'Title',
  url: 'URL',
  username: 'Username',
  password: 'Password',
  notes: 'Notes',
});

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

// executeImport/deleteTempFile are the two side-effecting calls the Import
// button triggers — mocked so the guard (`if (uri) await deleteTempFile(uri)`)
// can be exercised both with and without a uri param. buildPreview stays real
// (pure CSV parsing) via requireActual.
jest.mock('@/import/csvImporter', () => {
  const actual = jest.requireActual<typeof CsvImporterModule>('@/import/csvImporter');
  return {
    ...actual,
    executeImport: jest.fn(),
    deleteTempFile: jest.fn(),
  };
});

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

function getUseLocalSearchParams(): jest.Mock {
  return jest.requireMock<{ useLocalSearchParams: jest.Mock }>('expo-router').useLocalSearchParams;
}

function getCsvImporter(): { executeImport: jest.Mock; deleteTempFile: jest.Mock } {
  return jest.requireMock<{ executeImport: jest.Mock; deleteTempFile: jest.Mock }>(
    '@/import/csvImporter',
  );
}

function setParams(params: { content?: string; uri?: string; mapping?: string }): void {
  getUseLocalSearchParams().mockReturnValue(params);
}

beforeEach(() => {
  jest.clearAllMocks();
  getCsvImporter().executeImport.mockResolvedValue({ added: 1, skipped: 1 });
  getCsvImporter().deleteTempFile.mockResolvedValue(undefined);
  setParams({ content: CSV_CONTENT, uri: 'file:///tmp/import.csv', mapping: MAPPING_PARAM });
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// -----------------------------------------------------------------------
// Tests (Portuguese strings — default test locale is pt)
// -----------------------------------------------------------------------

describe('Import Confirm screen', () => {
  it('parses the mapping param and renders the split logins/notes/skipped preview text', async () => {
    await render(<ConfirmScreen />);

    // Fixture: 1 valid login row (GitHub), 1 skipped row (no title), 0 notes.
    expect(screen.getByText('Importar 1 logins, 0 notas seguras, ignorar 1 linhas')).toBeTruthy();
  });

  it('pressing Import deletes the temp file when uri is defined', async () => {
    await render(<ConfirmScreen />);

    await fireEvent.press(screen.getByText('Importar'));

    await waitFor(() => {
      expect(getCsvImporter().deleteTempFile).toHaveBeenCalledWith('file:///tmp/import.csv');
    });
  });

  it('pressing Import does NOT call deleteTempFile when uri is undefined', async () => {
    setParams({ content: CSV_CONTENT, mapping: MAPPING_PARAM });

    await render(<ConfirmScreen />);

    await fireEvent.press(screen.getByText('Importar'));

    await waitFor(() => {
      expect(getCsvImporter().executeImport).toHaveBeenCalled();
    });
    expect(getCsvImporter().deleteTempFile).not.toHaveBeenCalled();
  });

  it('shows an error alert and still deletes the temp file when executeImport rejects', async () => {
    getCsvImporter().executeImport.mockRejectedValue(new Error('cannot import: vault is locked'));

    await render(<ConfirmScreen />);

    await fireEvent.press(screen.getByText('Importar'));

    await waitFor(() => {
      expect(getCsvImporter().deleteTempFile).toHaveBeenCalledWith('file:///tmp/import.csv');
    });
    expect(Alert.alert).toHaveBeenCalledWith('Falha na importação. Seu cofre não foi alterado — tente novamente.');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('falls back to an empty mapping and does not throw when the mapping param is malformed', async () => {
    setParams({ content: CSV_CONTENT, uri: 'file:///tmp/import.csv', mapping: '{not json' });

    await render(<ConfirmScreen />);

    // With an empty mapping every row is unmapped, so all rows are skipped.
    expect(screen.getByText('Importar 0 logins, 0 notas seguras, ignorar 2 linhas')).toBeTruthy();
  });

  it('does not show a parse-errors line for a well-formed CSV', async () => {
    await render(<ConfirmScreen />);

    expect(screen.queryByText(/não puderam ser processadas/)).toBeNull();
  });

  it('shows a parse-errors line when the CSV has rows with a mismatched field count', async () => {
    // Header declares 5 fields; the appended row has 7 — papaparse flags
    // this as a row-level parse error (surfaced via ImportPreview.errorCount).
    const malformed = `${CSV_CONTENT}\nBroken,https://x.com,carol,secret,notes,extra,field`;
    setParams({ content: malformed, uri: 'file:///tmp/import.csv', mapping: MAPPING_PARAM });

    await render(<ConfirmScreen />);

    expect(screen.getByText('1 linha(s) não puderam ser processadas e foram ignoradas')).toBeTruthy();
  });
});
