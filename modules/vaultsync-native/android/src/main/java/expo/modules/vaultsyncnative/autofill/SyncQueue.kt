package expo.modules.vaultsyncnative.autofill

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import java.io.File

/**
 * Kotlin-side writer for the sync push queue. Rows written here are drained by the JS layer
 * (src/sync/queue.ts) on the app's next foreground / cold-launch (shipped Plan 4 semantics).
 *
 * CRITICAL — file-path parity with expo-sqlite. A bare `SQLite.openDatabaseAsync('vaultsync.db')`
 * resolves to `${filesDir}/SQLite/vaultsync.db` — see expo-sqlite's SQLiteModule.kt, which builds
 * the dir as `context.filesDir.canonicalPath + File.separator + "SQLite"`. We MUST open that exact
 * file. Using `SQLiteOpenHelper(ctx, "vaultsync.db", ...)` would instead open `ctx.getDatabasePath`
 * (the `databases/` dir), so a row would land in the wrong file and never be drained.
 *
 * Schema mirrors src/sync/queue.ts column-for-column: sync_queue(id, kind, created_at).
 */
object SyncQueue {
  fun enqueuePush(ctx: Context) {
    val dir = File(ctx.filesDir, "SQLite")
    if (!dir.exists()) dir.mkdirs()
    val dbFile = File(dir, "vaultsync.db")
    val db = SQLiteDatabase.openOrCreateDatabase(dbFile, null)
    try {
      db.execSQL(
        "CREATE TABLE IF NOT EXISTS sync_queue (" +
          "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
          "kind TEXT NOT NULL, " +
          "created_at INTEGER NOT NULL)",
      )
      db.execSQL(
        "INSERT INTO sync_queue (kind, created_at) VALUES (?, ?)",
        arrayOf<Any>("push", System.currentTimeMillis()),
      )
    } finally {
      db.close()
    }
  }
}
