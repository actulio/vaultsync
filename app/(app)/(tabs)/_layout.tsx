import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { JSX } from 'react';
import { useTheme } from '@/theme';

export default function TabsLayout(): JSX.Element {
  const { t } = useTranslation('vault');
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.vault') }} />
      <Tabs.Screen name="generator" options={{ title: t('tabs.generator') }} />
      <Tabs.Screen name="settings" options={{ title: t('tabs.settings') }} />
    </Tabs>
  );
}
