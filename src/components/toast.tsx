import type { JSX } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useTheme } from '@/theme';

/** Auto-dismiss duration for transient confirmations. */
const TOAST_VISIBILITY_MS = 2000;

/** Custom renderer — DESIGN.md tokens only, no library default styling. */
function VaultToastBody({ text1 }: { text1?: string | undefined }): JSX.Element {
  const { colors, spacing, radii, type } = useTheme();
  const styles = StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      marginHorizontal: spacing.lg,
    },
    label: {
      ...type.body,
      color: colors.textPrimary,
      textAlign: 'center',
    },
  });

  return (
    <View style={styles.card} accessibilityRole="alert">
      <Text style={styles.label}>{text1}</Text>
    </View>
  );
}

const config = {
  vaultToast: ({ text1 }: { text1?: string | undefined }) => <VaultToastBody text1={text1} />,
};

/**
 * Toast host. Mount ONCE, inside ThemeProvider (the renderer reads tokens) and
 * as the last child (so it layers above every screen).
 */
export function VaultToast(): JSX.Element {
  return <Toast config={config} position="bottom" bottomOffset={40} />;
}

/**
 * Show a transient, non-blocking confirmation.
 *
 * Call sites MUST use this rather than importing react-native-toast-message
 * directly — it is the seam that keeps swapping to sonner-native (spec D8) a
 * one-file change.
 */
export function showToast(message: string): void {
  Toast.show({
    type: 'vaultToast',
    text1: message,
    visibilityTime: TOAST_VISIBILITY_MS,
    autoHide: true,
  });
}
