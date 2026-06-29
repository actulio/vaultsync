import type { JSX } from 'react';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { generatePassword } from '@/generator/generate';
import { DEFAULT_OPTIONS } from '@/generator/presets';
import { useTheme } from '@/theme';
import type { Login, SecureNote } from '@/vault/types';

// ---------------------------------------------------------------------------
// Public type
// ---------------------------------------------------------------------------

export type EntryFormResult =
  | { type: 'login'; data: Omit<Login, 'id' | 'type' | 'createdAt' | 'updatedAt'> }
  | { type: 'note'; data: Omit<SecureNote, 'id' | 'type' | 'createdAt' | 'updatedAt'> };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EntryForm({
  initial,
  onSubmit,
}: {
  initial?: Login | SecureNote;
  onSubmit: (r: EntryFormResult) => Promise<void>;
}): JSX.Element {
  const { t } = useTranslation('vault');
  const { colors, spacing, radii, sizes, type } = useTheme();

  const [kind, setKind] = useState<'login' | 'note'>(initial?.type ?? 'login');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [username, setUsername] = useState(
    initial?.type === 'login' ? initial.username : '',
  );
  const [password, setPassword] = useState(
    initial?.type === 'login' ? initial.password : '',
  );
  const [url, setUrl] = useState(
    initial?.type === 'login' ? (initial.url ?? '') : '',
  );
  const [notes, setNotes] = useState(
    initial?.type === 'login' ? (initial.notes ?? '') : '',
  );
  const [body, setBody] = useState(
    initial?.type === 'note' ? initial.body : '',
  );

  const onGenerate = async (): Promise<void> => {
    try {
      setPassword(await generatePassword(DEFAULT_OPTIONS));
    } catch (e) {
      // DEFAULT_OPTIONS always has a character class; this branch is unreachable.
      // Log without surfacing a hardcoded English string to users.
      console.error('generatePassword failed:', e);
    }
  };

  const submit = async (): Promise<void> => {
    if (title.trim() === '') return;
    if (kind === 'login') {
      const data: Omit<Login, 'id' | 'type' | 'createdAt' | 'updatedAt'> = {
        title,
        username,
        password,
        ...(url ? { url } : {}),
        ...(notes ? { notes } : {}),
      };
      await onSubmit({ type: 'login', data });
    } else {
      const data: Omit<SecureNote, 'id' | 'type' | 'createdAt' | 'updatedAt'> = {
        title,
        body,
      };
      await onSubmit({ type: 'note', data });
    }
  };

  const styles = StyleSheet.create({
    scroll: { flex: 1, backgroundColor: colors.bg },
    container: { padding: spacing.lg },
    pillRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    pillActive: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: radii.pill,
      paddingVertical: spacing.sm,
      alignItems: 'center',
    },
    pillInactive: {
      flex: 1,
      backgroundColor: colors.surfaceAlt,
      borderRadius: radii.pill,
      paddingVertical: spacing.sm,
      alignItems: 'center',
    },
    pillTextActive: {
      ...type.subhead,
      color: colors.onPrimary,
    },
    pillTextInactive: {
      ...type.subhead,
      color: colors.textPrimary,
    },
    fieldGap: { gap: spacing.md },
    label: {
      ...type.caption,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      padding: spacing.md,
      ...type.body,
      color: colors.textPrimary,
    },
    passwordRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      alignItems: 'center',
    },
    passwordInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      padding: spacing.md,
      ...type.body,
      color: colors.textPrimary,
    },
    generateBtn: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    generateBtnText: {
      ...type.subhead,
      color: colors.textPrimary,
    },
    notesInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      padding: spacing.md,
      ...type.body,
      color: colors.textPrimary,
      minHeight: sizes.notesField,
      textAlignVertical: 'top',
    },
    bodyInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      padding: spacing.md,
      ...type.body,
      color: colors.textPrimary,
      minHeight: sizes.bodyField,
      textAlignVertical: 'top',
    },
    saveBtn: {
      height: sizes.control,
      backgroundColor: colors.primary,
      borderRadius: radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing['2xl'],
    },
    saveBtnText: {
      ...type.bodyStrong,
      color: colors.onPrimary,
    },
  });

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      {/* Type toggle */}
      <View style={styles.pillRow}>
        <Pressable
          accessibilityRole="button"
          onPress={() => { setKind('login'); }}
          style={kind === 'login' ? styles.pillActive : styles.pillInactive}
        >
          <Text style={kind === 'login' ? styles.pillTextActive : styles.pillTextInactive}>
            {t('edit.titleLogin')}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => { setKind('note'); }}
          style={kind === 'note' ? styles.pillActive : styles.pillInactive}
        >
          <Text style={kind === 'note' ? styles.pillTextActive : styles.pillTextInactive}>
            {t('edit.titleNote')}
          </Text>
        </Pressable>
      </View>

      <View style={styles.fieldGap}>
        {/* Title */}
        <View>
          <Text style={styles.label}>{t('edit.fields.title')}</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder={t('edit.fields.title')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {kind === 'login' ? (
          <>
            {/* Username */}
            <View>
              <Text style={styles.label}>{t('edit.fields.username')}</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder={t('edit.fields.username')}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Password + Generate */}
            <View>
              <Text style={styles.label}>{t('edit.fields.password')}</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t('edit.fields.password')}
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => { void onGenerate(); }}
                  style={styles.generateBtn}
                >
                  <Text style={styles.generateBtnText}>{t('edit.generate')}</Text>
                </Pressable>
              </View>
            </View>

            {/* URL */}
            <View>
              <Text style={styles.label}>{t('edit.fields.url')}</Text>
              <TextInput
                style={styles.input}
                value={url}
                onChangeText={setUrl}
                placeholder={t('edit.fields.url')}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </View>

            {/* Notes (login) */}
            <View>
              <Text style={styles.label}>{t('edit.fields.notes')}</Text>
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder={t('edit.fields.notes')}
                placeholderTextColor={colors.textMuted}
                multiline
              />
            </View>
          </>
        ) : (
          /* Body (note) */
          <View>
            <Text style={styles.label}>{t('edit.fields.body')}</Text>
            <TextInput
              style={styles.bodyInput}
              value={body}
              onChangeText={setBody}
              placeholder={t('edit.fields.body')}
              placeholderTextColor={colors.textMuted}
              multiline
            />
          </View>
        )}
      </View>

      {/* Save */}
      <Pressable
        accessibilityRole="button"
        onPress={() => { void submit(); }}
        style={styles.saveBtn}
      >
        <Text style={styles.saveBtnText}>{t('edit.save')}</Text>
      </Pressable>
    </ScrollView>
  );
}
