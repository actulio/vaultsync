package expo.modules.vaultsyncnative.autofill

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/**
 * Instrumented end-to-end test for [SyncQueue]. Proves a push enqueued from Kotlin lands in the
 * EXACT file expo-sqlite opens for `openDatabaseAsync('vaultsync.db')` — `${filesDir}/SQLite/
 * vaultsync.db` — with the schema src/sync/queue.ts expects, so the JS drain side will find it.
 */
@RunWith(AndroidJUnit4::class)
class SyncQueueTest {
  private lateinit var ctx: Context
  private lateinit var dbFile: File

  @Before
  fun setUp() {
    ctx = ApplicationProvider.getApplicationContext()
    dbFile = File(File(ctx.filesDir, "SQLite"), "vaultsync.db")
    dbFile.delete()
  }

  @After
  fun tearDown() {
    dbFile.delete()
  }

  @Test
  fun enqueuePush_writesRowAtExpoSqlitePath() {
    SyncQueue.enqueuePush(ctx)

    assertTrue("db must exist at filesDir/SQLite/vaultsync.db", dbFile.exists())

    val db = SQLiteDatabase.openOrCreateDatabase(dbFile, null)
    try {
      db.rawQuery("SELECT kind, created_at FROM sync_queue", null).use { c ->
        assertEquals(1, c.count)
        assertTrue(c.moveToFirst())
        assertEquals("push", c.getString(0))
        assertTrue("created_at should be positive epoch millis", c.getLong(1) > 0L)
      }
    } finally {
      db.close()
    }
  }

  @Test
  fun enqueuePush_isAdditiveAcrossCalls() {
    SyncQueue.enqueuePush(ctx)
    SyncQueue.enqueuePush(ctx)

    val db = SQLiteDatabase.openOrCreateDatabase(dbFile, null)
    try {
      db.rawQuery("SELECT COUNT(*) FROM sync_queue", null).use { c ->
        assertTrue(c.moveToFirst())
        assertEquals(2, c.getInt(0))
      }
    } finally {
      db.close()
    }
  }
}
