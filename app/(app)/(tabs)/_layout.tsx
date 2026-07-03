import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { JSX } from 'react';
import type { ColorValue } from 'react-native';
import { KeyRound, Settings, Vault } from 'lucide-react-native';
import { useTheme } from '@/theme';

type TabIconProps = { focused: boolean; color: ColorValue; size: number };

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
          tabBarIcon: ({ color, size }: TabIconProps) => (
            <Vault color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="generator"
        options={{
          title: t('tabs.generator'),
          tabBarIcon: ({ color, size }: TabIconProps) => (
            <KeyRound color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color, size }: TabIconProps) => (
            <Settings color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
