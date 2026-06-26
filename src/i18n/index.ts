import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import ptCommon from './locales/pt/common.json';
import ptErrors from './locales/pt/errors.json';
import enCommon from './locales/en/common.json';
import enErrors from './locales/en/errors.json';

export const SUPPORTED_LANGUAGES = ['pt', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'pt';

export function detectLanguageFromTag(tag: string | undefined | null): SupportedLanguage {
  if (typeof tag === 'string' && tag.toLowerCase().startsWith('en')) return 'en';
  return 'pt';
}

export async function initI18n(initialLanguage: SupportedLanguage = DEFAULT_LANGUAGE): Promise<void> {
  if (i18next.isInitialized) {
    await i18next.changeLanguage(initialLanguage);
    return;
  }
  await i18next.use(initReactI18next).init({
    lng: initialLanguage,
    fallbackLng: DEFAULT_LANGUAGE,
    ns: ['common', 'errors'],
    defaultNS: 'common',
    resources: {
      pt: { common: ptCommon, errors: ptErrors },
      en: { common: enCommon, errors: enErrors },
    },
    interpolation: { escapeValue: false },
    returnNull: false,
    returnEmptyString: false,
  });
}

/**
 * Translate a key. Namespaced keys use the `ns:key` format.
 * Missing keys return the full `ns:key` path (no silent empty strings).
 */
export function t(key: string, options?: Record<string, unknown>): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
  const result = i18next.t(key, options as any) as string;
  // Use i18next.exists() to detect missing keys — more robust than comparing the
  // translated result to the bare key (which would false-positive when a translation
  // value happens to equal its bare key path).
  if (key.includes(':') && !i18next.exists(key)) {
    return key;
  }
  return result;
}

export function getLanguage(): SupportedLanguage {
  const current = i18next.language as SupportedLanguage;
  return SUPPORTED_LANGUAGES.includes(current) ? current : DEFAULT_LANGUAGE;
}

export async function setLanguage(lang: string): Promise<void> {
  const target: SupportedLanguage = (SUPPORTED_LANGUAGES as readonly string[]).includes(lang)
    ? (lang as SupportedLanguage)
    : DEFAULT_LANGUAGE;
  await i18next.changeLanguage(target);
}

export function addNamespace(
  lang: SupportedLanguage,
  namespace: string,
  resources: Record<string, unknown>,
): void {
  i18next.addResourceBundle(lang, namespace, resources, true, true);
}
