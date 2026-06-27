import '@testing-library/jest-native/extend-expect';
import { initI18n, setLanguage } from '@/i18n';
import { registerUiNamespaces } from '@/i18n/registerUiNamespaces';

beforeAll(async () => {
  await initI18n('pt');
  registerUiNamespaces();
});

beforeEach(async () => {
  await setLanguage('pt');
});
