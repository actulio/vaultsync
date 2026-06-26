import { initI18n, t, setLanguage, getLanguage } from '@/i18n';

beforeAll(async () => {
  await initI18n('pt');
});

describe('i18n', () => {
  test('defaults to Portuguese', () => {
    expect(getLanguage()).toBe('pt');
    expect(t('common:app.name')).toBe('VaultSync');
  });

  test('can switch to English', async () => {
    await setLanguage('en');
    expect(getLanguage()).toBe('en');
    expect(t('common:app.name')).toBe('VaultSync');
    expect(t('errors:wrong_password')).toBe('Wrong master password');
  });

  test('falls back to Portuguese for unknown languages', async () => {
    await setLanguage('fr');
    expect(getLanguage()).toBe('pt');
  });

  test('missing keys return the key path (no silent empty strings)', async () => {
    await setLanguage('pt');
    expect(t('common:nonexistent.key')).toBe('common:nonexistent.key');
  });
});
