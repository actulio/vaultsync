import { useAuthStore } from '@/auth/store';
import { _setLastBackgroundedAt, _setTimeoutMs, _triggerStateChange } from '@/auth/autoLock';

describe('autoLock', () => {
  beforeEach(() => {
    useAuthStore.getState().reset();
    useAuthStore.getState().unlock(new Uint8Array(32).fill(1), {
      version: 1, entries: [], updatedAt: '', deviceId: '',
    });
    _setTimeoutMs(1000);
  });

  it('locks the vault if backgrounded longer than timeout', () => {
    _setLastBackgroundedAt(Date.now() - 2000);
    _triggerStateChange('active');
    expect(useAuthStore.getState().status).toBe('locked');
  });

  it('does not lock if backgrounded shorter than timeout', () => {
    _setLastBackgroundedAt(Date.now() - 100);
    _triggerStateChange('active');
    expect(useAuthStore.getState().status).toBe('unlocked');
  });

  it('does nothing if the vault is already locked', () => {
    useAuthStore.getState().lock();
    _setLastBackgroundedAt(Date.now() - 5000);
    _triggerStateChange('active');
    expect(useAuthStore.getState().status).toBe('locked');
  });
});
