import React from 'react';
import { Button } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '@/theme';
import { DialogProvider, useDialog } from '@/components/DialogProvider';

function Harness({ onResult }: { onResult: (v: boolean) => void }): React.JSX.Element {
  const dialog = useDialog();
  return (
    <Button
      title="ask"
      onPress={() => {
        void dialog
          .confirm({ title: 'Excluir esta entrada?', confirmLabel: 'Excluir', destructive: true })
          .then(onResult);
      }}
    />
  );
}

function wrap(ui: React.ReactElement): React.ReactElement {
  return (
    <ThemeProvider>
      <DialogProvider>{ui}</DialogProvider>
    </ThemeProvider>
  );
}

describe('DialogProvider', () => {
  it('shows the dialog title when confirm is called', async () => {
    const { getByText, findByText } = await render(wrap(<Harness onResult={() => {}} />));
    void fireEvent.press(getByText('ask'));
    expect(await findByText('Excluir esta entrada?')).toBeTruthy();
  });

  it('resolves true when the confirm button is pressed', async () => {
    const onResult = jest.fn();
    const { getByText, findByText } = await render(wrap(<Harness onResult={onResult} />));
    void fireEvent.press(getByText('ask'));
    void fireEvent.press(await findByText('Excluir'));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
  });

  it('resolves false when the cancel button is pressed', async () => {
    const onResult = jest.fn();
    const { getByText, findByText } = await render(wrap(<Harness onResult={onResult} />));
    void fireEvent.press(getByText('ask'));
    void fireEvent.press(await findByText('Cancelar'));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });

  it('closes after resolving', async () => {
    const { getByText, findByText, queryByText } = await render(
      wrap(<Harness onResult={() => {}} />),
    );
    void fireEvent.press(getByText('ask'));
    void fireEvent.press(await findByText('Cancelar'));
    await waitFor(() => expect(queryByText('Excluir esta entrada?')).toBeNull());
  });
});
