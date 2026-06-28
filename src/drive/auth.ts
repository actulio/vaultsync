import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';

const REFRESH_TOKEN_KEY = 'drive_refresh_token';
const ACCESS_TOKEN_KEY = 'drive_access_token';
const ACCESS_TOKEN_EXP_KEY = 'drive_access_token_exp';

export const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

/**
 * Sign in with Google and authorise Drive access via OAuth 2.0 PKCE flow.
 * Stores the refresh token and access token in expo-secure-store.
 * Returns true on success, false on cancellation or error.
 * Throws if EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID is not set.
 */
export async function signInWithGoogle(): Promise<boolean> {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID as string | undefined;
  if (!clientId) {
    throw new Error(
      'EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID is not set. ' +
        'Add it to your .env file. See README.md for setup instructions.',
    );
  }

  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'vaultsync' });
  const request = new AuthSession.AuthRequest({
    clientId,
    scopes: DRIVE_SCOPES,
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    extraParams: { access_type: 'offline', prompt: 'consent' },
  });
  await request.makeAuthUrlAsync(discovery);
  const result = await request.promptAsync(discovery);

  if (result.type !== 'success' || !result.params['code']) return false;

  const token = await AuthSession.exchangeCodeAsync(
    {
      clientId,
      code: result.params['code'],
      redirectUri,
      extraParams: { code_verifier: request.codeVerifier! },
    },
    discovery,
  );

  // Require a refresh token for successful sign-in (offline access).
  if (!token.refreshToken) {
    return false;
  }

  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token.refreshToken);
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token.accessToken);
  await SecureStore.setItemAsync(
    ACCESS_TOKEN_EXP_KEY,
    String(Date.now() + (token.expiresIn ?? 3600) * 1000),
  );
  return true;
}

/**
 * User chose to connect Drive later. No-op — Plan 4 gates sync on token presence.
 */
export function skipDriveForNow(): void {
  // No-op. Plan 4 will gate sync on hasDriveToken().
}

/**
 * Returns true if a Google Drive refresh token is stored (i.e. user has signed in).
 */
export async function hasDriveToken(): Promise<boolean> {
  return (await SecureStore.getItemAsync(REFRESH_TOKEN_KEY)) !== null;
}
