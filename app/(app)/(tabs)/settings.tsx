import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { JSX } from 'react';
import { useTheme } from '@/theme';

export default function SettingsScreen(): JSX.Element {
  const { t } = useTranslation('vault');
  const { colors, type } = useTheme();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      ...type.subhead,
      color: colors.textPrimary,
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('tabs.settings')}</Text>
    </View>
  );
}
