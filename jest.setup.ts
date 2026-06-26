import '@testing-library/jest-native/extend-expect';
import { initI18n, setLanguage } from '@/i18n';

beforeAll(async () => {
  await initI18n('pt');
});

beforeEach(async () => {
  await setLanguage('pt');
});
