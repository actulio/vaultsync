import * as SecureStore from 'expo-secure-store';

const ACCESS = 'drive_access_token';
const ACCESS_EXP = 'drive_access_token_exp';
const REFRESH = 'drive_refresh_token';

async function refresh(): Promise<string> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH);
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;
  if (!refreshToken || !clientId) throw new Error('no refresh token');
  const body = new URLSearchParams({
    client_id: clientId,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body });
  if (!res.ok) throw new Error(`token refresh failed: ${res.status}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  await SecureStore.setItemAsync(ACCESS, j.access_token);
  await SecureStore.setItemAsync(ACCESS_EXP, String(Date.now() + j.expires_in * 1000));
  return j.access_token;
}

async function getAccessToken(): Promise<string> {
  const t = await SecureStore.getItemAsync(ACCESS);
  const exp = await SecureStore.getItemAsync(ACCESS_EXP);
  if (t && exp && Number(exp) - 60_000 > Date.now()) return t;
  return refresh();
}

export class DriveError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function driveFetch(input: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(input, { ...init, headers });
  if (res.status === 401 && retry) {
    await SecureStore.deleteItemAsync(ACCESS);
    return driveFetch(input, init, false);
  }
  return res;
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS);
  await SecureStore.deleteItemAsync(ACCESS_EXP);
  await SecureStore.deleteItemAsync(REFRESH);
}
