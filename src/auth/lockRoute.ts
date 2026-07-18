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
 */
function isRestorable(path: string): boolean {
  return path.startsWith('/(app)/');
}

export function setPendingRoute(path: string): void {
  pendingRoute = isRestorable(path) ? path : null;
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
