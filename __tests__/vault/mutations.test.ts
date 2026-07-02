import {
  addLogin,
  updateEntry,
  deleteEntry,
  clearStalePreviousPasswords,
  addNote,
  withPreviousPassword,
} from '@/vault/mutations';
import type { Login, SecureNote, VaultV1 } from '@/vault/types';

const empty = (): VaultV1 => ({ version: 1, entries: [], updatedAt: '', deviceId: 'd' });

describe('vault mutations', () => {
  it('addLogin prepends a new login with id/timestamps', () => {
    const v = addLogin(empty(), { title: 'GitHub', username: 'me', password: 'x', notes: '' });
    expect(v.entries[0]!.type).toBe('login');
    expect((v.entries[0] as Login).title).toBe('GitHub');
    expect(v.entries[0]!.id).toMatch(/-/);
  });

  it('addNote prepends a secure note', () => {
    const v = addNote(empty(), { title: 'WiFi', body: 'pass=abc' });
    expect(v.entries[0]!.type).toBe('note');
  });

  it('updateEntry replaces matching entry fields', () => {
    const v = addLogin(empty(), { title: 'GH', username: 'me', password: 'x' });
    const id = v.entries[0]!.id;
    const u = updateEntry(v, id, { title: 'GitHub' });
    expect((u.entries[0] as Login).title).toBe('GitHub');
  });

  it('deleteEntry removes the entry', () => {
    const v = addLogin(empty(), { title: 'GH', username: 'me', password: 'x' });
    const id = v.entries[0]!.id;
    expect(deleteEntry(v, id).entries.length).toBe(0);
  });

  it('clearStalePreviousPasswords drops previousPassword older than 7 days', () => {
    const old = '2020-01-01T00:00:00.000Z';
    const v: VaultV1 = {
      version: 1, entries: [
        { id: '1', type: 'login', title: 'a', username: '', password: 'new',
          previousPassword: 'old', createdAt: old, updatedAt: old },
      ], updatedAt: old, deviceId: 'd',
    };
    const out = clearStalePreviousPasswords(v);
    expect((out.entries[0] as Login).previousPassword).toBeUndefined();
  });
});

describe('withPreviousPassword', () => {
  const login: Login = {
    id: '1',
    type: 'login',
    title: 'GH',
    username: 'me',
    password: 'old-pass',
    createdAt: '',
    updatedAt: '',
  };

  const note: SecureNote = {
    id: '2',
    type: 'note',
    title: 'WiFi',
    body: 'pass',
    createdAt: '',
    updatedAt: '',
  };

  it('sets previousPassword to the old password when a login password changes', () => {
    const patch = withPreviousPassword(login, { title: 'GH', username: 'me', password: 'new-pass' });
    expect(patch.previousPassword).toBe('old-pass');
    expect(patch.password).toBe('new-pass');
  });

  it('does not set previousPassword when the password is unchanged', () => {
    const patch = withPreviousPassword(login, { title: 'GH', username: 'me', password: 'old-pass' });
    expect(patch.previousPassword).toBeUndefined();
  });

  it('does not set previousPassword when the new password is empty', () => {
    const patch = withPreviousPassword(login, { title: 'GH', username: 'me', password: '' });
    expect(patch.previousPassword).toBeUndefined();
  });

  it('is a no-op for notes', () => {
    const patch = withPreviousPassword(note, { title: 'GH', username: 'me', password: 'new-pass' });
    expect(patch.previousPassword).toBeUndefined();
  });
});
