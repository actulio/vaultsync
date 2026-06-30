const tokens: Record<string, string> = {};
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => tokens[k] ?? null,
  setItemAsync: async (k: string, v: string) => { tokens[k] = v; },
  deleteItemAsync: async (k: string) => { delete tokens[k]; },
}));

process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID = 'test-client';
const fetchMock = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).fetch = fetchMock;

beforeEach(() => {
  Object.keys(tokens).forEach((k) => delete tokens[k]);
  fetchMock.mockReset();
});

import { driveFetch } from '@/drive/client';

test('refreshes access token when expired', async () => {
  tokens['drive_refresh_token'] = 'rt';
  tokens['drive_access_token'] = 'old';
  tokens['drive_access_token_exp'] = String(Date.now() - 1000);

  fetchMock.mockImplementation(async (url: string) => {
    if (url.endsWith('/token')) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { ok: true, json: async () => ({ access_token: 'new', expires_in: 3600 }) } as any;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { status: 200, ok: true, headers: new Map([['Authorization', 'Bearer new']]) } as any;
  });

  await driveFetch('https://example/test');
  const calls = fetchMock.mock.calls;
  expect(calls[0][0]).toContain('/token');
  expect(calls[1][1].headers.get('Authorization')).toBe('Bearer new');
});
