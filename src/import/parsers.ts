import Papa from 'papaparse';
import type { Login, SecureNote } from '@/vault/types';
import { PRESETS, type Mapping } from './presets';

export type ParseResult = {
  rows: Array<Login | SecureNote>;
  skipped: number;
  inferredPreset?: string;
};

/** The mapping keys that name a CSV column (i.e. everything except the fixed `type` discriminant). */
const COLUMN_KEYS = ['title', 'url', 'username', 'password', 'notes'] as const;

/** The header names a preset's mapping actually uses, in preset-defined order. */
function mappedColumns(mapping: Mapping): string[] {
  return COLUMN_KEYS.map((k) => mapping[k]).filter((v): v is string => typeof v === 'string');
}

/**
 * Pick the best-fitting preset for a header row.
 *
 * A preset must first pass the gate: its title/username/password columns must
 * all be present in the header row. Among gate-passing presets, a "full
 * match" — every one of the preset's mapped columns present — beats a
 * partial match (some mapped column, e.g. LastPass's `extra`, missing).
 * Within the same match tier, the preset mapping the most columns wins
 * (most specific); ties fall back to `PRESETS` declaration order.
 */
export function detectPreset(headers: string[]): { name: string; mapping: Mapping } | null {
  const headerSet = new Set(headers);
  const required = ['title', 'username', 'password'] as const;

  const candidates = PRESETS.filter((p) =>
    required.every((k) => {
      const col = p.mapping[k];
      return col !== undefined && headerSet.has(col);
    }),
  ).map((p) => {
    const columns = mappedColumns(p.mapping);
    return {
      preset: p,
      columnCount: columns.length,
      isFullMatch: columns.every((c) => headerSet.has(c)),
    };
  });

  if (candidates.length === 0) return null;

  const fullMatches = candidates.filter((c) => c.isFullMatch);
  const pool = fullMatches.length > 0 ? fullMatches : candidates;

  let best = pool[0]!;
  for (const c of pool) {
    if (c.columnCount > best.columnCount) best = c;
  }
  return { name: best.preset.name, mapping: best.preset.mapping };
}

export function parseCsv(content: string): {
  headers: string[];
  rows: Record<string, string>[];
  errorCount: number;
} {
  const parsed = Papa.parse<Record<string, string>>(content, { header: true, skipEmptyLines: true });
  return { headers: parsed.meta.fields ?? [], rows: parsed.data, errorCount: parsed.errors.length };
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
