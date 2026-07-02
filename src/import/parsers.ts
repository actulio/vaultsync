import Papa from 'papaparse';
import type { Login, SecureNote } from '@/vault/types';
import { PRESETS, type Mapping } from './presets';

export type ParseResult = {
  rows: Array<Login | SecureNote>;
  skipped: number;
  inferredPreset?: string;
};

export function detectPreset(headers: string[]): { name: string; mapping: Mapping } | null {
  for (const p of PRESETS) {
    const required = ['title', 'username', 'password'] as const;
    const found = required.every((k) => headers.includes(p.mapping[k]!));
    if (found) return p;
  }
  return null;
}

export function parseCsv(content: string): { headers: string[]; rows: Record<string, string>[] } {
  const parsed = Papa.parse<Record<string, string>>(content, { header: true, skipEmptyLines: true });
  return { headers: parsed.meta.fields ?? [], rows: parsed.data };
}

export function rowsToEntries(
  rows: Record<string, string>[],
  mapping: Mapping,
  now: Date = new Date(),
): ParseResult {
  let skipped = 0;
  const entries: (Login | SecureNote)[] = [];
  const dateTag = now.toISOString().slice(0, 10);
  for (const r of rows) {
    const title = (mapping.title && r[mapping.title]) || r['title'] || '';
    if (!title) {
      skipped++;
      continue;
    }
    const password = (mapping.password && r[mapping.password]) || '';
    if (mapping.type === 'note' || !password) {
      if (mapping.type === 'note') {
        const body = (mapping.notes && r[mapping.notes]) || '';
        entries.push({
          id: '',
          type: 'note',
          title,
          body,
          createdAt: '',
          updatedAt: '',
        });
      } else {
        skipped++;
      }
      continue;
    }
    entries.push({
      id: '',
      type: 'login',
      title,
      username: (mapping.username && r[mapping.username]) || '',
      password,
      url: (mapping.url && r[mapping.url]) || undefined,
      notes: (mapping.notes && r[mapping.notes]) || undefined,
      createdAt: '',
      updatedAt: '',
      source: `import-${dateTag}`,
    } as Login);
  }
  return { rows: entries, skipped };
}
