/**
 * Task 9 — Drive auth primitives (light coverage).
 *
 * Tests focus on the three behaviors that can be exercised without a browser:
 *  1. hasDriveToken() reads from SecureStore correctly.
 *  2. skipDriveForNow() does not throw.
 *  3. signInWithGoogle() throws early when the env var is unset.
 *
 * The interactive OAuth browser flow (AuthRequest.promptAsync + exchangeCodeAsync)
 * is deferred to Plan 4 integration tests or a manual smoke test.
 */

// ── Mock expo-secure-store ────────────────────────────────────────────────────

const secureStoreMap: Record<string, string> = {};

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => secureStoreMap[key] ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    secureStoreMap[key] = value;
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    delete secureStoreMap[key];
  }),
}));

// ── Mock expo-auth-session (not exercised in these tests but required to import) ──

jest.mock('expo-auth-session', () => ({
  makeRedirectUri: jest.fn(() => 'vaultsync://redirect'),
  AuthRequest: jest.fn().mockImplementation(() => ({
    makeAuthUrlAsync: jest.fn(async () => 'https://accounts.google.com/o/oauth2/v2/auth?...'),
    promptAsync: jest.fn(async () => ({ type: 'dismiss' })),
    codeVerifier: 'mock-verifier',
  })),
  ResponseType: { Code: 'code' },
  exchangeCodeAsync: jest.fn(async () => ({
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    expiresIn: 3600,
  })),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

import * as SecureStore from 'expo-secure-store';
import { hasDriveToken, skipDriveForNow, signInWithGoogle } from '@/drive/auth';

beforeEach(() => {
  // Clear the in-memory store and reset mocks between tests.
  for (const key of Object.keys(secureStoreMap)) {
    delete secureStoreMap[key];
  }
  jest.clearAllMocks();
});

describe('hasDriveToken', () => {
  it('returns false when no refresh token is stored', async () => {
    // SecureStore is empty — getItemAsync returns null.
    const result = await hasDriveToken();
    expect(result).toBe(false);
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('drive_refresh_token');
  });

  it('returns true when a refresh token is stored', async () => {
    secureStoreMap['drive_refresh_token'] = 'some-refresh-token';
    const result = await hasDriveToken();
    expect(result).toBe(true);
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('drive_refresh_token');
  });
});

describe('skipDriveForNow', () => {
  it('is a no-op and does not throw', () => {
    expect(() => skipDriveForNow()).not.toThrow();
  });

  it('does not write anything to SecureStore', () => {
    skipDriveForNow();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });
});

describe('signInWithGoogle — env guard', () => {
  const originalEnv = process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;

  afterEach(() => {
    // Restore env var after each test in this suite.
    if (originalEnv === undefined) {
      delete process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;
    } else {
      process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID = originalEnv;
    }
  });

  it('throws a clear error when EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID is unset', async () => {
    delete process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;
    await expect(signInWithGoogle()).rejects.toThrow(
      'EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID is not set',
    );
  });

  it('does not call SecureStore when env var is missing', async () => {
    delete process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;
    await signInWithGoogle().catch(() => {});
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });
});
