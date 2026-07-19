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
import { hasDriveToken, isDriveConfigured, skipDriveForNow, signInWithGoogle } from '@/drive/auth';

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

describe('isDriveConfigured', () => {
  const originalEnv = process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;
    } else {
      process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID = originalEnv;
    }
  });

  it('is false when the client id is absent', () => {
    delete process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;
    expect(isDriveConfigured()).toBe(false);
  });

  it('is false when the client id is blank', () => {
    process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID = '   ';
    expect(isDriveConfigured()).toBe(false);
  });

  it('is true when the client id is set', () => {
    process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID = 'x.apps.googleusercontent.com';
    expect(isDriveConfigured()).toBe(true);
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

describe('signInWithGoogle — token exchange', () => {
  const originalEnv = process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID = 'test-client-id';
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;
    } else {
      process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID = originalEnv;
    }
  });

  it('returns false and does not persist refresh token when exchangeCodeAsync returns no refreshToken', async () => {
    const AuthSession = jest.requireMock('expo-auth-session');

    // Mock AuthRequest to simulate successful OAuth code flow
    AuthSession.AuthRequest.mockImplementationOnce(() => ({
      makeAuthUrlAsync: jest.fn(async () => {}),
      promptAsync: jest.fn(async () => ({
        type: 'success',
        params: { code: 'test-code' },
      })),
      codeVerifier: 'test-verifier',
    }));

    // Mock exchangeCodeAsync to return token WITHOUT refreshToken
    AuthSession.exchangeCodeAsync.mockResolvedValueOnce({
      accessToken: 'test-access-token',
      expiresIn: 3600,
      // Note: no refreshToken
    });

    const result = await signInWithGoogle();

    expect(result).toBe(false);
    // Verify refresh token was NOT persisted
    expect(SecureStore.setItemAsync).not.toHaveBeenCalledWith(
      'drive_refresh_token',
      expect.anything(),
    );
    // Verify no tokens were persisted at all
    expect(secureStoreMap['drive_refresh_token']).toBeUndefined();
  });

  it('returns true and persists refresh token when exchangeCodeAsync returns a refreshToken', async () => {
    const AuthSession = jest.requireMock('expo-auth-session');

    // Mock AuthRequest to simulate successful OAuth code flow
    AuthSession.AuthRequest.mockImplementationOnce(() => ({
      makeAuthUrlAsync: jest.fn(async () => {}),
      promptAsync: jest.fn(async () => ({
        type: 'success',
        params: { code: 'test-code' },
      })),
      codeVerifier: 'test-verifier',
    }));

    // Mock exchangeCodeAsync to return token WITH refreshToken
    AuthSession.exchangeCodeAsync.mockResolvedValueOnce({
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresIn: 3600,
    });

    const result = await signInWithGoogle();

    expect(result).toBe(true);
    // Verify refresh token WAS persisted
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'drive_refresh_token',
      'test-refresh-token',
    );
    expect(secureStoreMap['drive_refresh_token']).toBe('test-refresh-token');
    // Verify access token was also persisted
    expect(secureStoreMap['drive_access_token']).toBe('test-access-token');
  });

  it('returns false when user cancels OAuth prompt', async () => {
    const AuthSession = jest.requireMock('expo-auth-session');

    // Mock AuthRequest to simulate user cancellation
    AuthSession.AuthRequest.mockImplementationOnce(() => ({
      makeAuthUrlAsync: jest.fn(async () => {}),
      promptAsync: jest.fn(async () => ({
        type: 'dismiss',
      })),
      codeVerifier: 'test-verifier',
    }));

    const result = await signInWithGoogle();

    expect(result).toBe(false);
    // Verify no storage operations occurred
    expect(Object.keys(secureStoreMap).length).toBe(0);
  });
});
