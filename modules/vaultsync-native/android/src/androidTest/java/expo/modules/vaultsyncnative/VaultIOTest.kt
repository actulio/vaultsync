package expo.modules.vaultsyncnative

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

@RunWith(AndroidJUnit4::class)
class VaultIOTest {
  private lateinit var ctx: Context
  private lateinit var io: VaultIO
  private val name = "vault_test.enc"

  @Before
  fun setUp() {
    ctx = ApplicationProvider.getApplicationContext()
    io = VaultIO(ctx)
    io.delete(name)
  }

  @After
  fun tearDown() {
    io.delete(name)
  }

  @Test
  fun writeThenReadRoundTrip() {
    val data = ByteArray(1024) { it.toByte() }
    io.writeAtomic(name, data)
    val read = io.read(name)
    assertArrayEquals(data, read)
  }

  @Test
  fun overwriteReplaces() {
    io.writeAtomic(name, byteArrayOf(1, 2, 3))
    io.writeAtomic(name, byteArrayOf(9, 9, 9, 9))
    assertArrayEquals(byteArrayOf(9, 9, 9, 9), io.read(name))
  }

  @Test
  fun atomicWriteLeavesNoTempFile() {
    io.writeAtomic(name, byteArrayOf(1, 2, 3))
    val tmp = File(ctx.filesDir, "$name.tmp")
    assertFalse(tmp.exists())
  }

  @Test
  fun concurrentWritesDoNotCorrupt() {
    // I4a: with the process-wide write lock + unique tmp names, concurrent writers can never rename
    // a torn tmp over the target. Each writer uses a homogeneous payload, so a torn/mixed file would
    // not equal ANY writer's payload. The final file must be exactly one writer's bytes.
    val payloads = (0 until 8).map { idx -> ByteArray(64 * 1024) { idx.toByte() } }
    val threads = payloads.map { p -> Thread { repeat(10) { io.writeAtomic(name, p) } } }
    threads.forEach { it.start() }
    threads.forEach { it.join() }
    val read = io.read(name)
    assertTrue(payloads.any { it.contentEquals(read) })
    // No tmp residue after concurrent writes.
    val stale = ctx.filesDir.listFiles { f -> f.name.startsWith("$name.") && f.name.endsWith(".tmp") }
    assertTrue(stale == null || stale.isEmpty())
  }

  @Test
  fun readMissingFileThrows() {
    io.delete(name)
    assertThrows(java.io.FileNotFoundException::class.java) { io.read(name) }
  }

  @Test
  fun existsReturnsCorrectStatus() {
    io.delete(name)
    assertFalse(io.exists(name))
    io.writeAtomic(name, byteArrayOf(1))
    assertTrue(io.exists(name))
  }
}
