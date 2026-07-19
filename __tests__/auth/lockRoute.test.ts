import {
  setPendingRoute,
  takePendingRoute,
  clearPendingRoute,
} from '@/auth/lockRoute';

// Route shapes here mirror what expo-router actually hands the layout:
// `usePathname()` is group-free (`/entry/abc`), `useSegments()` is the raw file
// path and keeps the group (`['(app)', 'entry', '[id]']`).
describe('lockRoute', () => {
  beforeEach(() => clearPendingRoute());

  it('returns null when nothing is pending', () => {
    expect(takePendingRoute()).toBeNull();
  });

  it('round-trips an in-app route', () => {
    setPendingRoute('/entry/abc', ['(app)', 'entry', '[id]']);
    expect(takePendingRoute()).toBe('/entry/abc');
  });

  // The regression guard. A real in-app pathname carries no `(app)` prefix, so
  // the old `path.startsWith('/(app)/')` test made every route non-restorable
  // and the whole feature silently no-opped. Restorability must come from the
  // segments, and the stored value must stay the navigable pathname.
  it('treats a group-free in-app pathname as restorable', () => {
    setPendingRoute('/entry/abc', ['(app)', 'entry', '[id]']);
    expect(takePendingRoute()).toBe('/entry/abc');

    setPendingRoute('/settings/sync', ['(app)', 'settings', 'sync']);
    expect(takePendingRoute()).toBe('/settings/sync');

    setPendingRoute('/', ['(app)', '(tabs)']);
    expect(takePendingRoute()).toBe('/');
  });

  it('clears on take so a route is never restored twice', () => {
    setPendingRoute('/entry/abc', ['(app)', 'entry', '[id]']);
    takePendingRoute();
    expect(takePendingRoute()).toBeNull();
  });

  it('ignores routes outside the app group', () => {
    setPendingRoute('/unlock', ['unlock']);
    expect(takePendingRoute()).toBeNull();
    setPendingRoute('/welcome', ['(onboarding)', 'welcome']);
    expect(takePendingRoute()).toBeNull();
  });

  it('ignores an empty segment list', () => {
    setPendingRoute('/entry/abc', []);
    expect(takePendingRoute()).toBeNull();
  });

  it('clearPendingRoute discards a stored route', () => {
    setPendingRoute('/', ['(app)', '(tabs)']);
    clearPendingRoute();
    expect(takePendingRoute()).toBeNull();
  });
});
