const mockMemory: { id: number; kind: string; created_at: number }[] = [];
let mockNextId = 1;

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: async () => ({
    execAsync: async (sql: string) => {
      if (/DELETE FROM sync_queue\s*$/.test(sql)) mockMemory.length = 0;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    runAsync: async (sql: string, ...args: any[]) => {
      if (sql.startsWith('INSERT')) mockMemory.push({ id: mockNextId++, kind: args[0], created_at: args[1] });
      else if (sql.startsWith('DELETE')) {
        const i = mockMemory.findIndex((m) => m.id === args[0]);
        if (i >= 0) mockMemory.splice(i, 1);
      }
    },
    getFirstAsync: async (sql: string) => {
      if (sql.startsWith('SELECT id')) return mockMemory[0] ?? null;
      if (sql.startsWith('SELECT COUNT')) return { c: mockMemory.length };
      return null;
    },
  }),
}));

import { enqueuePush, peek, remove, count, clear } from '@/sync/queue';

beforeEach(async () => { mockMemory.length = 0; mockNextId = 1; await clear(); });

test('enqueue + peek + remove FIFO', async () => {
  await enqueuePush();
  await enqueuePush();
  const head = await peek();
  expect(head?.id).toBe(1);
  await remove(head!.id);
  expect((await peek())?.id).toBe(2);
  expect(await count()).toBe(1);
});
