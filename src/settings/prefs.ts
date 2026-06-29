import * as SecureStore from 'expo-secure-store';
import { setLanguage as setI18nLanguage, type SupportedLanguage } from '@/i18n';

const KEY_LANG = 'pref_language';
const KEY_AUTOLOCK = 'pref_autolock_ms';

const DEFAULT_LANGUAGE: SupportedLanguage = 'pt';
const DEFAULT_AUTOLOCK_MS = 5 * 60 * 1000;

export type Prefs = {
  language: SupportedLanguage;
  autoLockMs: number;
};

export async function loadPrefs(): Promise<Prefs> {
  const lang = (await SecureStore.getItemAsync(KEY_LANG)) as SupportedLanguage | null;
  const ms = await SecureStore.getItemAsync(KEY_AUTOLOCK);
  return {
    language: lang ?? DEFAULT_LANGUAGE,
    autoLockMs: ms ? Number(ms) : DEFAULT_AUTOLOCK_MS,
  };
}

export async function setLanguagePref(lang: SupportedLanguage): Promise<void> {
  await SecureStore.setItemAsync(KEY_LANG, lang);
  await setI18nLanguage(lang);
}

export async function setAutoLockPref(ms: number): Promise<void> {
  await SecureStore.setItemAsync(KEY_AUTOLOCK, String(ms));
}
