import { StyleSheet, Text, View } from 'react-native';
import type { JSX } from 'react';
import { useTheme } from '@/theme';
import { useAuthStore } from '@/auth/store';

export default function Home(): JSX.Element {
  const { colors, spacing, type } = useTheme();
  const entries = useAuthStore((s) => s.vault?.entries ?? []);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
      paddingHorizontal: spacing.xl,
      justifyContent: 'center',
      alignItems: 'center',
    },
    placeholder: {
      ...type.body,
      color: colors.textPrimary,
      textAlign: 'center',
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>
        Vault unlocked — {entries.length} entries (Plan 3 builds the real UI)
      </Text>
    </View>
  );
}
