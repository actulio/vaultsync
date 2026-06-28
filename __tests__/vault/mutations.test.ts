import { addLogin, updateEntry, deleteEntry, clearStalePreviousPasswords, addNote } from '@/vault/mutations';
import type { Login, VaultV1 } from '@/vault/types';

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
