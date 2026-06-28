import type { Entry, VaultV1 } from './types';

export type EntryTypeFilter = 'all' | 'login' | 'note';

export function searchEntries(vault: VaultV1, query: string, type: EntryTypeFilter = 'all'): Entry[] {
  const q = query.trim().toLowerCase();
  const byType = type === 'all' ? vault.entries : vault.entries.filter((e) => e.type === type);
  if (q === '') return byType;
  return byType.filter((e) => matches(e, q));
}

function matches(e: Entry, q: string): boolean {
  const haystacks: string[] = [e.title];
  if (e.type === 'login') haystacks.push(e.username, e.url ?? '', e.notes ?? '');
  else haystacks.push(e.body);
  return haystacks.some((s) => s.toLowerCase().includes(q));
}
