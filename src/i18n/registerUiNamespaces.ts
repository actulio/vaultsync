/**
 * Register UI-layer i18n namespaces via addNamespace.
 * Call at app startup (after initI18n) and in jest.setup.ts.
 * Never edit initI18n to add these — keep the core namespace list stable.
 */
import { addNamespace } from './index';
import ptOnboarding from './locales/pt/onboarding.json';
import enOnboarding from './locales/en/onboarding.json';

export function registerUiNamespaces(): void {
  addNamespace('pt', 'onboarding', ptOnboarding);
  addNamespace('en', 'onboarding', enOnboarding);
}
