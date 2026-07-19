/**
 * Where to send the user after they re-unlock.
 *
 * Deliberately module-level rather than zustand: this value must survive the
 * unmount of every React tree between lock and unlock. Locking resets the
 * navigation stack, so the restored screen remounts from scratch and all local
 * component state — notably the entry-detail password reveal — returns to its
 * default. Hidden-by-default is therefore structural, not a convention someone
 * has to remember to maintain.
 */
let pendingRoute: string | null = null;

/**
 * Only in-app routes are restorable.
 *
 * Storing `/unlock` would bounce a freshly-unlocked user straight back to the
 * unlock screen; storing an onboarding route would drop them into a flow they
 * already completed.
 *
 * The decision is made on `useSegments()` output, never on the pathname. Group
 * folders like `(app)` are organizational: expo-router strips them from the URL
 * by design, so `usePathname()` on `app/(app)/entry/[id].tsx` is `/entry/abc`
 * and can never contain `(app)`. Segments are documented as "not normalized, so
 * they will be the same as the file path" and therefore do carry the group:
 * `['(app)', 'entry', '[id]']`. Testing the pathname for a group prefix would
 * be false for every route in the app.
 */
function isRestorable(segments: readonly string[]): boolean {
  return segments[0] === '(app)';
}

/**
 * `pathname` is stored (not the segments) because that is what is navigable:
 * `router.replace('/entry/abc')` works, a file-segment array does not.
 */
export function setPendingRoute(pathname: string, segments: readonly string[]): void {
  pendingRoute = isRestorable(segments) ? pathname : null;
}

/** Returns the pending route and clears it, so it can never be restored twice. */
export function takePendingRoute(): string | null {
  const route = pendingRoute;
  pendingRoute = null;
  return route;
}

export function clearPendingRoute(): void {
  pendingRoute = null;
}
