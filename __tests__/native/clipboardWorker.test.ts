jest.mock('../../modules/vaultsync-native/src', () => ({
  __esModule: true,
  default: {
    copyToClipboard: jest.fn().mockResolvedValue(undefined),
    scheduleClipboardClear: jest.fn().mockResolvedValue(undefined),
    cancelClipboardClear: jest.fn().mockResolvedValue(undefined),
    clearClipboard: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('expo-clipboard', () => ({
  getStringAsync: jest.fn().mockResolvedValue(''),
}));

import {
  copyAndScheduleClear,
  cancelPendingClear,
  clearClipboardIfDue,
  startClipboardClearOnForeground,
  __resetPendingClearForTests,
  CLIPBOARD_CLEAR_SECONDS,
} from '@/native/clipboardWorker';

import { AppState, type AppStateStatus } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import VaultsyncNative from '../../modules/vaultsync-native/src';

const getStringAsync = Clipboard.getStringAsync as unknown as jest.Mock;

const native = VaultsyncNative as unknown as {
  copyToClipboard: jest.Mock;
  clearClipboard: jest.Mock;
  scheduleClipboardClear: jest.Mock;
  cancelClipboardClear: jest.Mock;
};

describe('copyAndScheduleClear', () => {
  beforeEach(() => jest.clearAllMocks());

  it('defaults to a 2-minute retention window', () => {
    expect(CLIPBOARD_CLEAR_SECONDS).toBe(120);
  });

  it('writes via the native sensitive-marking path, not expo-clipboard', async () => {
    await copyAndScheduleClear('hunter2');
    expect(native.copyToClipboard).toHaveBeenCalledWith('hunter2');
  });

  it('schedules the clear with the default window', async () => {
    await copyAndScheduleClear('hunter2');
    expect(native.scheduleClipboardClear).toHaveBeenCalledWith('hunter2', 120);
  });

  it('honours an explicit override', async () => {
    await copyAndScheduleClear('hunter2', 30);
    expect(native.scheduleClipboardClear).toHaveBeenCalledWith('hunter2', 30);
  });

  it('copies before scheduling the clear', async () => {
    await copyAndScheduleClear('hunter2');

    const copyOrder = native.copyToClipboard.mock.invocationCallOrder[0] ?? 0;
    const scheduleOrder = native.scheduleClipboardClear.mock.invocationCallOrder[0] ?? 0;
    expect(copyOrder).toBeLessThan(scheduleOrder);
  });
});

describe('cancelPendingClear', () => {
  beforeEach(() => jest.clearAllMocks());

  it('cancels a pending clear', async () => {
    await cancelPendingClear();
    expect(native.cancelClipboardClear).toHaveBeenCalledTimes(1);
  });
});

describe('clearClipboardIfDue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // clearAllMocks does not drain queued mock*Once values; an unconsumed one
    // from a previous case would otherwise leak into the next.
    getStringAsync.mockReset();
    getStringAsync.mockResolvedValue('');
    __resetPendingClearForTests();
    jest.useRealTimers();
  });

  it('does nothing when there is no pending entry', async () => {
    await clearClipboardIfDue();
    expect(getStringAsync).not.toHaveBeenCalled();
    expect(native.clearClipboard).not.toHaveBeenCalled();
  });

  it('does not clear while the entry is not yet due', async () => {
    await copyAndScheduleClear('hunter2', 120);
    getStringAsync.mockResolvedValueOnce('hunter2');

    await clearClipboardIfDue();

    expect(native.clearClipboard).not.toHaveBeenCalled();
  });

  it('clears when due and the clipboard still holds the copied value', async () => {
    await copyAndScheduleClear('hunter2', 0);
    getStringAsync.mockResolvedValueOnce('hunter2');

    await clearClipboardIfDue();

    expect(native.clearClipboard).toHaveBeenCalledTimes(1);
  });

  it('does not clear when the clipboard has changed since the copy', async () => {
    await copyAndScheduleClear('hunter2', 0);
    getStringAsync.mockResolvedValueOnce('something the user copied later');

    await clearClipboardIfDue();

    expect(native.clearClipboard).not.toHaveBeenCalled();
  });

  it('drops the pending entry after a due check so it only runs once', async () => {
    await copyAndScheduleClear('hunter2', 0);
    getStringAsync.mockResolvedValueOnce('hunter2');
    await clearClipboardIfDue();
    native.clearClipboard.mockClear();
    getStringAsync.mockResolvedValueOnce('hunter2');

    await clearClipboardIfDue();

    expect(native.clearClipboard).not.toHaveBeenCalled();
  });

  it('leaves the entry pending when it is not yet due, so a later check still clears', async () => {
    await copyAndScheduleClear('hunter2', 120);
    await clearClipboardIfDue();

    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 200_000);
    getStringAsync.mockResolvedValueOnce('hunter2');
    await clearClipboardIfDue();

    expect(native.clearClipboard).toHaveBeenCalledTimes(1);
    jest.spyOn(Date, 'now').mockRestore();
  });

  it('swallows a clipboard read failure without throwing', async () => {
    await copyAndScheduleClear('hunter2', 0);
    getStringAsync.mockRejectedValueOnce(new Error('no focus'));

    await expect(clearClipboardIfDue()).resolves.toBeUndefined();
    expect(native.clearClipboard).not.toHaveBeenCalled();
  });

  it('cancelPendingClear drops the pending entry', async () => {
    await copyAndScheduleClear('hunter2', 0);
    await cancelPendingClear();
    getStringAsync.mockResolvedValueOnce('hunter2');

    await clearClipboardIfDue();

    expect(native.clearClipboard).not.toHaveBeenCalled();
  });
});

describe('startClipboardClearOnForeground', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // clearAllMocks does not drain queued mock*Once values; an unconsumed one
    // from a previous case would otherwise leak into the next.
    getStringAsync.mockReset();
    getStringAsync.mockResolvedValue('');
    __resetPendingClearForTests();
  });

  it('clears on an active transition and unsubscribes cleanly', async () => {
    const listeners: ((s: AppStateStatus) => void)[] = [];
    const remove = jest.fn();
    const spy = jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_evt, cb) => {
        listeners.push(cb);
        return { remove };
      });

    const stop = startClipboardClearOnForeground();
    await copyAndScheduleClear('hunter2', 0);
    getStringAsync.mockResolvedValueOnce('hunter2');

    listeners[0]?.('active');
    await Promise.resolve();
    await Promise.resolve();
    expect(native.clearClipboard).toHaveBeenCalledTimes(1);

    stop();
    expect(remove).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('ignores non-active transitions', async () => {
    const listeners: ((s: AppStateStatus) => void)[] = [];
    const spy = jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_evt, cb) => {
        listeners.push(cb);
        return { remove: jest.fn() };
      });

    startClipboardClearOnForeground();
    await copyAndScheduleClear('hunter2', 0);

    listeners[0]?.('background');
    await Promise.resolve();
    expect(native.clearClipboard).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
