import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { JSX } from 'react';
import type { ColorValue } from 'react-native';
import { KeyRound, Settings, Vault } from 'lucide-react-native';
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
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.vault'),
          tabBarIcon: ({ color, size }: { focused: boolean; color: ColorValue; size: number }) => (
            <Vault color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="generator"
        options={{
          title: t('tabs.generator'),
          tabBarIcon: ({ color, size }: { focused: boolean; color: ColorValue; size: number }) => (
            <KeyRound color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color, size }: { focused: boolean; color: ColorValue; size: number }) => (
            <Settings color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
