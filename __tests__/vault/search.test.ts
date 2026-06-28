import { searchEntries } from '@/vault/search';
import type { VaultV1 } from '@/vault/types';

const sample: VaultV1 = {
  version: 1, updatedAt: '', deviceId: 'd',
  entries: [
    { id: '1', type: 'login', title: 'GitHub', username: 'me@x.com', password: 'p', url: 'github.com', createdAt: '', updatedAt: '' },
    { id: '2', type: 'login', title: 'Banco do Brasil', username: '12345', password: 'p', createdAt: '', updatedAt: '' },
    { id: '3', type: 'note', title: 'WiFi', body: 'casa wifi pass: abc', createdAt: '', updatedAt: '' },
  ],
};

describe('searchEntries', () => {
  it('returns all when query is empty', () => {
    expect(searchEntries(sample, '').length).toBe(3);
  });
  it('matches title case-insensitively', () => {
    expect(searchEntries(sample, 'github')[0]?.id).toBe('1');
  });
  it('matches username', () => {
    expect(searchEntries(sample, 'me@x').length).toBe(1);
  });
  it('matches URL', () => {
    expect(searchEntries(sample, 'github.com').length).toBe(1);
  });
  it('matches secure-note body', () => {
    expect(searchEntries(sample, 'casa').length).toBe(1);
  });
  it('filters by type', () => {
    expect(searchEntries(sample, '', 'note').length).toBe(1);
    expect(searchEntries(sample, '', 'login').length).toBe(2);
  });
});
