import { AppState, type AppStateStatus } from 'react-native';
import { useAuthStore } from './store';

export const DEFAULT_AUTO_LOCK_MS = 5 * 60 * 1000;

let lastBackgroundedAt: number | null = null;
let configuredTimeoutMs = DEFAULT_AUTO_LOCK_MS;
let subscription: { remove(): void } | null = null;

function onChange(state: AppStateStatus): void {
  if (state === 'background' || state === 'inactive') {
    lastBackgroundedAt = Date.now();
  } else if (state === 'active') {
    if (lastBackgroundedAt !== null) {
      const elapsed = Date.now() - lastBackgroundedAt;
      if (elapsed >= configuredTimeoutMs && useAuthStore.getState().status === 'unlocked') {
        useAuthStore.getState().lock();
      }
      lastBackgroundedAt = null;
    }
  }
}

export function startAutoLock(timeoutMs: number = DEFAULT_AUTO_LOCK_MS): () => void {
  subscription?.remove(); // guard against a leaked listener on double-registration
  configuredTimeoutMs = timeoutMs;
  subscription = AppState.addEventListener('change', onChange);
  return stopAutoLock;
}

export function stopAutoLock(): void {
  subscription?.remove();
  subscription = null;
  lastBackgroundedAt = null;
}

// Test hooks
export function _setLastBackgroundedAt(ts: number | null): void { lastBackgroundedAt = ts; }
export function _setTimeoutMs(ms: number): void { configuredTimeoutMs = ms; }
export function _triggerStateChange(state: AppStateStatus): void { onChange(state); }
