import React from 'react';
import { AppState } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('@/native/autofill', () => ({
  Autofill: {
    isSupported: jest.fn().mockResolvedValue(true),
    isEnabled: jest.fn().mockResolvedValue(false),
    requestEnable: jest.fn().mockResolvedValue(undefined),
  },
}));

import { Autofill } from '@/native/autofill';
import AutofillSettings from '../../app/(app)/settings/autofill';

const mocked = Autofill as unknown as {
  isSupported: jest.Mock;
  isEnabled: jest.Mock;
  requestEnable: jest.Mock;
};

describe('Autofill settings screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mocked.isSupported.mockResolvedValue(true);
    mocked.isEnabled.mockResolvedValue(false);
    mocked.requestEnable.mockResolvedValue(undefined);
  });

  it('shows "Não configurado" + an enable button when supported and not enabled', async () => {
    const { findByText } = await render(<AutofillSettings />);
    expect(await findByText('Não configurado')).toBeTruthy();
    expect(await findByText('Ativar autopreenchimento')).toBeTruthy();
  });

  it('shows "Ativo" when VaultSync is the active service', async () => {
    mocked.isEnabled.mockResolvedValue(true);
    const { findByText } = await render(<AutofillSettings />);
    expect(await findByText('Ativo')).toBeTruthy();
  });

  it('shows the not-supported message and no enable button when unsupported', async () => {
    mocked.isSupported.mockResolvedValue(false);
    const { findByText, queryByText } = await render(<AutofillSettings />);
    expect(await findByText('O autopreenchimento não é compatível com este dispositivo.')).toBeTruthy();
    expect(queryByText('Ativar autopreenchimento')).toBeNull();
  });

  it('calls Autofill.requestEnable when the enable button is pressed', async () => {
    const { findByText } = await render(<AutofillSettings />);
    const btn = await findByText('Ativar autopreenchimento');
    void fireEvent.press(btn);
    expect(mocked.requestEnable).toHaveBeenCalledTimes(1);
  });

  it('re-checks status on AppState "active" (flips to Ativo after enabling)', async () => {
    const addSpy = jest.spyOn(AppState, 'addEventListener');
    const { findByText } = await render(<AutofillSettings />);
    await findByText('Não configurado');
    mocked.isEnabled.mockResolvedValue(true);
    const call = addSpy.mock.calls[0];
    if (call === undefined) throw new Error('expected AppState.addEventListener to have been called');
    const cb = call[1] as (s: string) => void;
    await act(async () => { cb('active'); });
    expect(await findByText('Ativo')).toBeTruthy();
  });
});
