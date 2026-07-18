import type { JSX } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme';

export type DialogButtonVariant = 'default' | 'destructive' | 'cancel';

export type DialogButton = {
  label: string;
  variant: DialogButtonVariant;
  onPress: () => void;
};

export type DialogProps = {
  visible: boolean;
  title: string;
  message?: string | undefined;
  buttons: DialogButton[];
  /** Android hardware back / scrim tap. */
  onDismiss: () => void;
};

export function Dialog({
  visible,
  title,
  message,
  buttons,
  onDismiss,
}: DialogProps): JSX.Element {
  const { colors, spacing, radii, sizes, type } = useTheme();

  const styles = StyleSheet.create({
    scrim: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.xl,
    },
    title: { ...type.heading, color: colors.textPrimary },
    message: { ...type.body, color: colors.textSecondary, marginTop: spacing.sm },
    buttonRow: { marginTop: spacing['2xl'], gap: spacing.sm },
    button: {
      height: sizes.control,
      borderRadius: radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonDefault: { backgroundColor: colors.primary },
    buttonDestructive: { backgroundColor: colors.danger },
    buttonCancel: { backgroundColor: colors.surfaceAlt },
    labelOnColor: { ...type.bodyStrong, color: colors.onPrimary },
    labelCancel: { ...type.bodyStrong, color: colors.textPrimary },
  });

  const fillFor = (v: DialogButtonVariant): object => {
    if (v === 'destructive') return styles.buttonDestructive;
    if (v === 'cancel') return styles.buttonCancel;
    return styles.buttonDefault;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={styles.scrim}>
        <View style={styles.card} accessibilityViewIsModal accessibilityRole="alert">
          <Text style={styles.title}>{title}</Text>
          {message != null && message !== '' && <Text style={styles.message}>{message}</Text>}
          <View style={styles.buttonRow}>
            {buttons.map((b) => (
              <Pressable
                key={b.label}
                accessibilityRole="button"
                onPress={b.onPress}
                style={({ pressed }) => [
                  styles.button,
                  fillFor(b.variant),
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={b.variant === 'cancel' ? styles.labelCancel : styles.labelOnColor}>
                  {b.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}
