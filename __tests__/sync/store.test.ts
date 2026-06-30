import { useSyncStore } from '@/sync/store';

describe('sync store', () => {
  beforeEach(() => {
    // Reset store state between tests
    useSyncStore.setState({
      status: 'idle',
      lastSyncedAt: null,
      queueDepth: 0,
    } as Parameters<typeof useSyncStore.setState>[0]);
  });

  describe('initial state', () => {
    test('should have status idle', () => {
      const state = useSyncStore.getState();
      expect(state.status).toBe('idle');
    });

    test('should have lastSyncedAt null', () => {
      const state = useSyncStore.getState();
      expect(state.lastSyncedAt).toBe(null);
    });

    test('should have queueDepth 0', () => {
      const state = useSyncStore.getState();
      expect(state.queueDepth).toBe(0);
    });
  });

  describe('setStatus', () => {
    test('should change status to syncing', () => {
      useSyncStore.getState().setStatus('syncing');
      const state = useSyncStore.getState();
      expect(state.status).toBe('syncing');
    });

    test('should change status to paused_no_token', () => {
      useSyncStore.getState().setStatus('paused_no_token');
      const state = useSyncStore.getState();
      expect(state.status).toBe('paused_no_token');
    });

    test('should change status to paused_offline', () => {
      useSyncStore.getState().setStatus('paused_offline');
      const state = useSyncStore.getState();
      expect(state.status).toBe('paused_offline');
    });

    test('should set error status with message', () => {
      useSyncStore.getState().setStatus('error', 'Network timeout');
      const state = useSyncStore.getState();
      expect(state.status).toBe('error');
      if (state.status === 'error') {
        expect(state.message).toBe('Network timeout');
      }
    });

    test('should preserve other state when changing status', () => {
      useSyncStore.getState().setQueueDepth(5);
      useSyncStore.getState().setStatus('syncing');
      const state = useSyncStore.getState();
      expect(state.status).toBe('syncing');
      expect(state.queueDepth).toBe(5);
      expect(state.lastSyncedAt).toBe(null);
    });

    test('should return to idle status', () => {
      useSyncStore.getState().setStatus('syncing');
      useSyncStore.getState().setStatus('idle');
      const state = useSyncStore.getState();
      expect(state.status).toBe('idle');
    });
  });

  describe('setQueueDepth', () => {
    test('should set queue depth to 0', () => {
      useSyncStore.getState().setQueueDepth(0);
      const state = useSyncStore.getState();
      expect(state.queueDepth).toBe(0);
    });

    test('should set queue depth to positive number', () => {
      useSyncStore.getState().setQueueDepth(10);
      const state = useSyncStore.getState();
      expect(state.queueDepth).toBe(10);
    });

    test('should update queue depth when status changes', () => {
      useSyncStore.getState().setStatus('syncing');
      useSyncStore.getState().setQueueDepth(3);
      const state = useSyncStore.getState();
      expect(state.status).toBe('syncing');
      expect(state.queueDepth).toBe(3);
    });

    test('should allow queue depth to increase and decrease', () => {
      useSyncStore.getState().setQueueDepth(5);
      expect(useSyncStore.getState().queueDepth).toBe(5);
      useSyncStore.getState().setQueueDepth(2);
      expect(useSyncStore.getState().queueDepth).toBe(2);
      useSyncStore.getState().setQueueDepth(8);
      expect(useSyncStore.getState().queueDepth).toBe(8);
    });
  });

  describe('setSyncedNow', () => {
    test('should set status to idle', () => {
      useSyncStore.getState().setStatus('syncing');
      useSyncStore.getState().setSyncedNow();
      const state = useSyncStore.getState();
      expect(state.status).toBe('idle');
    });

    test('should set lastSyncedAt to a non-null timestamp', () => {
      useSyncStore.getState().setSyncedNow();
      const state = useSyncStore.getState();
      expect(state.lastSyncedAt).not.toBe(null);
      expect(typeof state.lastSyncedAt).toBe('number');
      expect(state.lastSyncedAt).toBeGreaterThan(0);
    });

    test('should set lastSyncedAt to a reasonable current timestamp', () => {
      const before = Date.now();
      useSyncStore.getState().setSyncedNow();
      const after = Date.now();
      const state = useSyncStore.getState();
      expect(state.lastSyncedAt!).toBeGreaterThanOrEqual(before);
      expect(state.lastSyncedAt!).toBeLessThanOrEqual(after + 10); // small buffer for test execution
    });

    test('should preserve queue depth when synced', () => {
      useSyncStore.getState().setQueueDepth(5);
      useSyncStore.getState().setStatus('syncing');
      useSyncStore.getState().setSyncedNow();
      const state = useSyncStore.getState();
      expect(state.status).toBe('idle');
      expect(state.queueDepth).toBe(5);
    });

    test('should update lastSyncedAt on each call', () => {
      useSyncStore.getState().setSyncedNow();
      const firstSync = useSyncStore.getState().lastSyncedAt;

      // Small delay to ensure timestamps differ
      const startTime = Date.now();
      while (Date.now() - startTime < 5) {
        // busy wait a few ms
      }

      useSyncStore.getState().setSyncedNow();
      const secondSync = useSyncStore.getState().lastSyncedAt;

      expect(secondSync!).toBeGreaterThan(firstSync!);
    });
  });

  describe('complex state transitions', () => {
    test('should handle idle -> syncing -> error -> idle flow', () => {
      const store = useSyncStore.getState();

      expect(store.status).toBe('idle');

      store.setStatus('syncing');
      expect(useSyncStore.getState().status).toBe('syncing');

      store.setStatus('error', 'Sync failed');
      const errorState = useSyncStore.getState();
      expect(errorState.status).toBe('error');
      if (errorState.status === 'error') {
        expect(errorState.message).toBe('Sync failed');
      }

      store.setSyncedNow();
      const finalState = useSyncStore.getState();
      expect(finalState.status).toBe('idle');
      expect(finalState.lastSyncedAt).not.toBe(null);
    });

    test('should handle paused offline -> syncing -> idle with queue management', () => {
      const store = useSyncStore.getState();

      store.setStatus('paused_offline');
      store.setQueueDepth(7);
      expect(useSyncStore.getState().queueDepth).toBe(7);

      store.setStatus('syncing');
      expect(useSyncStore.getState().status).toBe('syncing');

      store.setQueueDepth(3);
      store.setSyncedNow();

      const finalState = useSyncStore.getState();
      expect(finalState.status).toBe('idle');
      expect(finalState.queueDepth).toBe(3);
      expect(finalState.lastSyncedAt).not.toBe(null);
    });

    test('should handle multiple error messages', () => {
      const store = useSyncStore.getState();

      store.setStatus('error', 'First error');
      let currentState = useSyncStore.getState();
      if (currentState.status === 'error') {
        expect(currentState.message).toBe('First error');
      }

      store.setStatus('error', 'Second error');
      currentState = useSyncStore.getState();
      if (currentState.status === 'error') {
        expect(currentState.message).toBe('Second error');
      }

      store.setSyncedNow();
      const state = useSyncStore.getState();
      expect(state.status).toBe('idle');
    });
  });
});
