import * as SQLite from 'expo-sqlite';

type Item = { id: number; kind: 'push'; createdAt: number };

let dbInstance: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync('vaultsync.db');
    await dbInstance.execAsync(
      `CREATE TABLE IF NOT EXISTS sync_queue (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         kind TEXT NOT NULL,
         created_at INTEGER NOT NULL
       );`,
    );
  }
  return dbInstance;
}

export async function enqueuePush(): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO sync_queue (kind, created_at) VALUES (?, ?)`,
    'push', Date.now(),
  );
}

export async function peek(): Promise<Item | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ id: number; kind: 'push'; created_at: number }>(
    `SELECT id, kind, created_at FROM sync_queue ORDER BY id LIMIT 1`,
  );
  return row ? { id: row.id, kind: row.kind, createdAt: row.created_at } : null;
}

export async function remove(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, id);
}

export async function clear(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`DELETE FROM sync_queue`);
}

export async function count(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>(`SELECT COUNT(*) as c FROM sync_queue`);
  return row?.c ?? 0;
}
