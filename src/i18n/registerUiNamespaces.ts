/**
 * Register UI-layer i18n namespaces via addNamespace.
 * Call at app startup (after initI18n) and in jest.setup.ts.
 * Never edit initI18n to add these — keep the core namespace list stable.
 */
import { addNamespace } from './index';
import ptOnboarding from './locales/pt/onboarding.json';
import enOnboarding from './locales/en/onboarding.json';
import ptAuth from './locales/pt/auth.json';
import enAuth from './locales/en/auth.json';
import ptVault from './locales/pt/vault.json';
import enVault from './locales/en/vault.json';

export function registerUiNamespaces(): void {
  addNamespace('pt', 'onboarding', ptOnboarding);
  addNamespace('en', 'onboarding', enOnboarding);
  addNamespace('pt', 'auth', ptAuth);
  addNamespace('en', 'auth', enAuth);
  addNamespace('pt', 'vault', ptVault);
  addNamespace('en', 'vault', enVault);
}
