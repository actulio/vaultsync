import { detectPreset, parseCsv, rowsToEntries } from '@/import/parsers';
import type { Login, SecureNote } from '@/vault/types';

describe('detectPreset', () => {
  it('detects 1Password from its header row', () => {
    const preset = detectPreset(['Title', 'URL', 'Username', 'Password', 'Notes']);
    expect(preset?.name).toBe('1Password');
  });

  it('detects LastPass from its header row', () => {
    const preset = detectPreset(['url', 'username', 'password', 'extra', 'name', 'grouping', 'fav']);
    expect(preset?.name).toBe('LastPass');
  });

  it('returns null for an unrecognized header row', () => {
    const preset = detectPreset(['foo', 'bar', 'baz']);
    expect(preset).toBeNull();
  });

  it('detects Chrome (not LastPass) from a header row lacking `extra` — regression for the mislabel', () => {
    // Chrome and LastPass both gate on name/url/username/password. Without an
    // `extra` column, LastPass is only a partial match (5 mapped columns, 1
    // missing) while Chrome is a full match (4/4) — Chrome must win.
    const preset = detectPreset(['name', 'url', 'username', 'password']);
    expect(preset?.name).toBe('Chrome');
  });

  it('detects LastPass (not Chrome) from a header row that includes `extra`', () => {
    // Both Chrome and LastPass are full matches here, but LastPass maps more
    // columns (5 vs 4) so it is more specific and must win.
    const preset = detectPreset(['name', 'url', 'username', 'password', 'extra']);
    expect(preset?.name).toBe('LastPass');
  });

  it('detects Bitwarden from its header row', () => {
    const preset = detectPreset(['name', 'login_uri', 'login_username', 'login_password', 'notes']);
    expect(preset?.name).toBe('Bitwarden');
  });
});

describe('parseCsv', () => {
  it('returns the header list, parsed rows, and a zero error count for a well-formed CSV string', () => {
    const content = 'a,b\n1,2\n3,4\n';
    const { headers, rows, errorCount } = parseCsv(content);
    expect(headers).toEqual(['a', 'b']);
    expect(rows).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ]);
    expect(errorCount).toBe(0);
  });

  it('surfaces a positive error count for malformed rows instead of silently dropping them', () => {
    // Header declares 2 fields; the second data row has 4 — a mismatched
    // field count papaparse flags as a row-level error.
    const content = 'a,b\n1,2\n3,4,5,6\n';
    const { errorCount } = parseCsv(content);
    expect(errorCount).toBeGreaterThan(0);
  });
});

describe('rowsToEntries', () => {
  const now = new Date('2026-06-25T12:00:00Z');

  it('maps a 1Password sample into logins, skipping rows with no title or no password', () => {
    const csv = [
      'Title,URL,Username,Password,Notes',
      'GitHub,https://github.com,alice,hunter2,work account',
      ',https://noname.com,bob,secret,no title here',
      'Empty Pass,https://x.com,carol,,missing password',
    ].join('\n');
    const { headers, rows } = parseCsv(csv);
    const preset = detectPreset(headers);
    expect(preset?.name).toBe('1Password');

    const result = rowsToEntries(rows, preset!.mapping, now);

    expect(result.rows.length).toBe(1);
    expect(result.skipped).toBe(2);

    const entry = result.rows[0] as Login;
    expect(entry.type).toBe('login');
    expect(entry.title).toBe('GitHub');
    expect(entry.username).toBe('alice');
    expect(entry.password).toBe('hunter2');
    expect(entry.url).toBe('https://github.com');
    expect(entry.source).toBe('import-2026-06-25');
  });

  it('builds a SecureNote from a note-type mapping', () => {
    const rows = [{ Title: 'WiFi', Body: 'ssid=home;pass=abc123' }];
    const mapping = { title: 'Title', notes: 'Body', type: 'note' as const };

    const result = rowsToEntries(rows, mapping, now);

    expect(result.skipped).toBe(0);
    expect(result.rows.length).toBe(1);
    const note = result.rows[0] as SecureNote;
    expect(note.type).toBe('note');
    expect(note.title).toBe('WiFi');
    expect(note.body).toBe('ssid=home;pass=abc123');
  });
});
