import type { JSX } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { pickCsv } from '@/import/csvImporter';
import { useTheme } from '@/theme';
import { useDialog } from '@/components/DialogProvider';

export default function Pick(): JSX.Element {
  const { t } = useTranslation('import');
  const { colors, spacing, radii, sizes, type } = useTheme();
  const dialog = useDialog();

  const onPick = async (): Promise<void> => {
    let r: Awaited<ReturnType<typeof pickCsv>>;
    try {
      r = await pickCsv();
    } catch {
      void dialog.alert({ title: t('importError') });
      return;
    }
    if (!r) return;
    router.push({ pathname: '/(app)/import/map', params: { uri: r.tmpUri, content: r.content } });
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    content: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    title: {
      ...type.title,
      color: colors.textPrimary,
      marginBottom: spacing['2xl'],
    },
    cta: {
      height: sizes.control,
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaLabel: {
      ...type.bodyStrong,
      color: colors.onPrimary,
    },
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('title')}</Text>
      <Pressable accessibilityRole="button" onPress={() => void onPick()} style={styles.cta}>
        <Text style={styles.ctaLabel}>{t('pick')}</Text>
      </Pressable>
    </ScrollView>
  );
}
