import {
  setPendingRoute,
  takePendingRoute,
  clearPendingRoute,
} from '@/auth/lockRoute';

describe('lockRoute', () => {
  beforeEach(() => clearPendingRoute());

  it('returns null when nothing is pending', () => {
    expect(takePendingRoute()).toBeNull();
  });

  it('round-trips an in-app route', () => {
    setPendingRoute('/(app)/entry/abc');
    expect(takePendingRoute()).toBe('/(app)/entry/abc');
  });

  it('clears on take so a route is never restored twice', () => {
    setPendingRoute('/(app)/entry/abc');
    takePendingRoute();
    expect(takePendingRoute()).toBeNull();
  });

  it('ignores routes outside the app group', () => {
    setPendingRoute('/unlock');
    expect(takePendingRoute()).toBeNull();
    setPendingRoute('/(onboarding)/welcome');
    expect(takePendingRoute()).toBeNull();
  });

  it('clearPendingRoute discards a stored route', () => {
    setPendingRoute('/(app)/(tabs)');
    clearPendingRoute();
    expect(takePendingRoute()).toBeNull();
  });
});
