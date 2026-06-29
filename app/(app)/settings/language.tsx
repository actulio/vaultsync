import { useEffect, useState, type JSX } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { getLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n';
import { setLanguagePref } from '@/settings/prefs';
import { useTheme } from '@/theme';

export default function LanguageScreen(): JSX.Element {
  const { t } = useTranslation('settings');
  const { colors, spacing, radii, type } = useTheme();
  const [current, setCurrent] = useState<SupportedLanguage>(getLanguage());

  useEffect(() => {
    setCurrent(getLanguage());
  }, []);

  const choose = async (lang: SupportedLanguage): Promise<void> => {
    await setLanguagePref(lang);
    setCurrent(lang);
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    content: {
      paddingTop: spacing['3xl'],
    },
    title: {
      ...type.title,
      color: colors.textPrimary,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    radioOuter: {
      width: 22,
      height: 22,
      borderRadius: radii.pill,
      borderWidth: 2,
      borderColor: colors.primary,
      marginRight: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioInner: {
      width: 12,
      height: 12,
      borderRadius: radii.pill,
      backgroundColor: colors.primary,
    },
    rowLabel: {
      ...type.body,
      color: colors.textPrimary,
    },
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('language.title')}</Text>
      {SUPPORTED_LANGUAGES.map((lang) => {
        const selected = current === lang;
        return (
          <Pressable
            key={lang}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => void choose(lang)}
            style={styles.row}
          >
            <View style={styles.radioOuter}>{selected && <View style={styles.radioInner} />}</View>
            <Text style={styles.rowLabel}>{t(`language.${lang}`)}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
