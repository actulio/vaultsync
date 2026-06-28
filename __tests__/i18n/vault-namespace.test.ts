import i18next from 'i18next';
import { initI18n, setLanguage } from '@/i18n';
import { registerUiNamespaces } from '@/i18n/registerUiNamespaces';

beforeAll(async () => {
  await initI18n('pt');
  registerUiNamespaces();
});

beforeEach(async () => {
  await setLanguage('pt');
});

describe('vault namespace', () => {
  test('vault:tabs.vault exists in pt', () => {
    expect(i18next.exists('vault:tabs.vault')).toBe(true);
  });

  test('pt: tabs.vault = "VaultSync"', () => {
    expect(i18next.t('tabs.vault', { ns: 'vault' })).toBe('VaultSync');
  });

  test('pt: tabs.generator = "Gerador"', () => {
    expect(i18next.t('tabs.generator', { ns: 'vault' })).toBe('Gerador');
  });

  test('pt: tabs.settings = "Ajustes"', () => {
    expect(i18next.t('tabs.settings', { ns: 'vault' })).toBe('Ajustes');
  });

  test('en: tabs.vault = "Vault"', async () => {
    await setLanguage('en');
    expect(i18next.t('tabs.vault', { ns: 'vault' })).toBe('Vault');
  });

  test('en: tabs.generator = "Generator"', async () => {
    await setLanguage('en');
    expect(i18next.t('tabs.generator', { ns: 'vault' })).toBe('Generator');
  });

  test('en: tabs.settings = "Settings"', async () => {
    await setLanguage('en');
    expect(i18next.t('tabs.settings', { ns: 'vault' })).toBe('Settings');
  });
});
