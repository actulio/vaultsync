jest.mock('../../modules/vaultsync-native/src', () => ({
  __esModule: true,
  default: {
    copyToClipboard: jest.fn().mockResolvedValue(undefined),
    scheduleClipboardClear: jest.fn().mockResolvedValue(undefined),
    cancelClipboardClear: jest.fn().mockResolvedValue(undefined),
  },
}));

import {
  copyAndScheduleClear,
  cancelPendingClear,
  CLIPBOARD_CLEAR_SECONDS,
} from '@/native/clipboardWorker';

import VaultsyncNative from '../../modules/vaultsync-native/src';

const native = VaultsyncNative as unknown as {
  copyToClipboard: jest.Mock;
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
