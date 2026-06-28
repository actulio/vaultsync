import * as Clipboard from 'expo-clipboard';

import { copyAndScheduleClear, cancelPendingClear } from '@/native/clipboardWorker';
import VaultsyncNative from '../../modules/vaultsync-native/src';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));

jest.mock('../../modules/vaultsync-native/src', () => ({
  __esModule: true,
  default: {
    scheduleClipboardClear: jest.fn(async () => {}),
    cancelClipboardClear: jest.fn(async () => {}),
  },
}));

const setStringAsync = Clipboard.setStringAsync as jest.Mock;
const native = VaultsyncNative as unknown as {
  scheduleClipboardClear: jest.Mock;
  cancelClipboardClear: jest.Mock;
};

describe('clipboardWorker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('copies text then schedules clear with default 30s', async () => {
    await copyAndScheduleClear('s3cret');

    expect(setStringAsync).toHaveBeenCalledWith('s3cret');
    expect(native.scheduleClipboardClear).toHaveBeenCalledWith('s3cret', 30);

    const copyOrder = setStringAsync.mock.invocationCallOrder[0] ?? 0;
    const scheduleOrder = native.scheduleClipboardClear.mock.invocationCallOrder[0] ?? 0;
    expect(copyOrder).toBeLessThan(scheduleOrder);
  });

  it('uses the provided delay in seconds', async () => {
    await copyAndScheduleClear('pw', 10);

    expect(setStringAsync).toHaveBeenCalledWith('pw');
    expect(native.scheduleClipboardClear).toHaveBeenCalledWith('pw', 10);
  });

  it('cancels a pending clear', async () => {
    await cancelPendingClear();

    expect(native.cancelClipboardClear).toHaveBeenCalledTimes(1);
  });
});
