import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, type DialogButton } from './Dialog';

export type AlertOptions = {
  title: string;
  message?: string | undefined;
  okLabel?: string | undefined;
};

export type ConfirmOptions = {
  title: string;
  message?: string | undefined;
  confirmLabel?: string | undefined;
  cancelLabel?: string | undefined;
  destructive?: boolean | undefined;
};

export type DialogApi = {
  alert: (o: AlertOptions) => Promise<void>;
  confirm: (o: ConfirmOptions) => Promise<boolean>;
};

const DialogContext = createContext<DialogApi | null>(null);

type State = {
  visible: boolean;
  title: string;
  message?: string | undefined;
  buttons: DialogButton[];
};

const CLOSED: State = { visible: false, title: '', buttons: [] };

export function DialogProvider({ children }: { children: ReactNode }): JSX.Element {
  const { t } = useTranslation('common');
  const [state, setState] = useState<State>(CLOSED);

  // Holds the resolver of the currently-open dialog so an unmount or a scrim
  // dismiss can settle it instead of leaking a forever-pending promise.
  const pending = useRef<((v: boolean) => void) | null>(null);

  const settle = useCallback((value: boolean) => {
    const resolve = pending.current;
    pending.current = null;
    setState(CLOSED);
    resolve?.(value);
  }, []);

  // Settle any resolver left over from a still-open dialog before opening a
  // new one — otherwise the earlier caller's promise would never resolve.
  const settlePendingAsCancelled = useCallback(() => {
    const resolve = pending.current;
    pending.current = null;
    resolve?.(false);
  }, []);

  // If the provider unmounts while a dialog is open, resolve its promise
  // instead of leaking it — without touching state on an unmounted component.
  useEffect(() => {
    return () => {
      const resolve = pending.current;
      pending.current = null;
      resolve?.(false);
    };
  }, []);

  const alert = useCallback(
    (o: AlertOptions): Promise<void> =>
      new Promise<void>((resolve) => {
        settlePendingAsCancelled();
        pending.current = () => resolve();
        setState({
          visible: true,
          title: o.title,
          message: o.message,
          buttons: [
            { label: o.okLabel ?? t('ok'), variant: 'default', onPress: () => settle(true) },
          ],
        });
      }),
    [settle, settlePendingAsCancelled, t],
  );

  const confirm = useCallback(
    (o: ConfirmOptions): Promise<boolean> =>
      new Promise<boolean>((resolve) => {
        settlePendingAsCancelled();
        pending.current = resolve;
        setState({
          visible: true,
          title: o.title,
          message: o.message,
          buttons: [
            {
              label: o.confirmLabel ?? t('ok'),
              variant: o.destructive === true ? 'destructive' : 'default',
              onPress: () => settle(true),
            },
            {
              label: o.cancelLabel ?? t('actions.cancel'),
              variant: 'cancel',
              onPress: () => settle(false),
            },
          ],
        });
      }),
    [settle, settlePendingAsCancelled, t],
  );

  const api = useMemo<DialogApi>(() => ({ alert, confirm }), [alert, confirm]);

  return (
    <DialogContext.Provider value={api}>
      {children}
      <Dialog
        visible={state.visible}
        title={state.title}
        message={state.message}
        buttons={state.buttons}
        onDismiss={() => settle(false)}
      />
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  if (ctx == null) throw new Error('useDialog must be used within a DialogProvider');
  return ctx;
}
