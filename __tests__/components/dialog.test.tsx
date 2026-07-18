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

  it('settles the first promise as false when a second confirm supersedes it before it settles', async () => {
    function TwoConfirms(): React.JSX.Element {
      const dialog = useDialog();
      return (
        <Button
          title="ask-twice"
          onPress={() => {
            const first = dialog.confirm({ title: 'First?' });
            const second = dialog.confirm({ title: 'Second?' });
            void first.then((v) => firstResult(v));
            void second.then((v) => secondResult(v));
          }}
        />
      );
    }
    const firstResult = jest.fn();
    const secondResult = jest.fn();
    const { getByText, findByText } = await render(wrap(<TwoConfirms />));
    void fireEvent.press(getByText('ask-twice'));

    // The second dialog is the one left on screen.
    expect(await findByText('Second?')).toBeTruthy();
    // The first call's promise must not hang — it settles as cancelled.
    await waitFor(() => expect(firstResult).toHaveBeenCalledWith(false));
    expect(secondResult).not.toHaveBeenCalled();
  });

  it('settles the pending promise as false when the provider unmounts with a dialog open', async () => {
    const onResult = jest.fn();
    const { getByText, findByText, unmount } = await render(wrap(<Harness onResult={onResult} />));
    void fireEvent.press(getByText('ask'));
    await findByText('Excluir esta entrada?');

    await unmount();

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });

  it('dismisses and resolves false when the scrim is pressed', async () => {
    const onResult = jest.fn();
    const { getByText, findByText, getByTestId } = await render(
      wrap(<Harness onResult={onResult} />),
    );
    void fireEvent.press(getByText('ask'));
    await findByText('Excluir esta entrada?');

    void fireEvent.press(getByTestId('dialog-scrim'));

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });

  it('does not dismiss when the card itself is pressed', async () => {
    const onResult = jest.fn();
    const { getByText, findByText, getByTestId } = await render(
      wrap(<Harness onResult={onResult} />),
    );
    void fireEvent.press(getByText('ask'));
    await findByText('Excluir esta entrada?');

    void fireEvent.press(getByTestId('dialog-card'));

    await waitFor(() => expect(getByText('Excluir esta entrada?')).toBeTruthy());
    expect(onResult).not.toHaveBeenCalled();
  });
});
