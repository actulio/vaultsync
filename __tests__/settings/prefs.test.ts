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

import { loadPrefs, setLanguagePref, setAutoLockPref } from '@/settings/prefs';
import { getLanguage } from '@/i18n';

beforeEach(() => {
  for (const key of Object.keys(secureStoreMap)) delete secureStoreMap[key];
  jest.clearAllMocks();
});

describe('prefs', () => {
  it('returns defaults when nothing is stored (pt, 5 minutes)', async () => {
    const prefs = await loadPrefs();
    expect(prefs.language).toBe('pt');
    expect(prefs.autoLockMs).toBe(5 * 60 * 1000);
  });

  it('persists the language preference and updates i18n', async () => {
    await setLanguagePref('en');
    const prefs = await loadPrefs();
    expect(prefs.language).toBe('en');
    expect(getLanguage()).toBe('en');
  });

  it('persists the auto-lock preference', async () => {
    await setAutoLockPref(60_000);
    const prefs = await loadPrefs();
    expect(prefs.autoLockMs).toBe(60_000);
  });
});
