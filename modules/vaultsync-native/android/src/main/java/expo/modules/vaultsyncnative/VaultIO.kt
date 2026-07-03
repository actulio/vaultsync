package expo.modules.vaultsyncnative

import android.content.Context
import android.system.Os
import android.system.OsConstants
import java.io.File
import java.io.FileNotFoundException
import java.io.FileOutputStream
import java.util.concurrent.atomic.AtomicLong

class VaultIO(private val ctx: Context) {
  private fun fileFor(name: String): File = File(ctx.filesDir, name)
  // Unique-per-write tmp name (nanoTime + counter): even an unsynchronized writer cannot collide
  // on the shared tmp inode and rename a torn file over the target.
  private fun tmpFor(name: String): File =
    File(ctx.filesDir, "$name.${System.nanoTime()}.${TMP_SEQ.incrementAndGet()}.tmp")

  fun exists(name: String): Boolean = fileFor(name).exists()

  fun read(name: String): ByteArray {
    val f = fileFor(name)
    if (!f.exists()) throw FileNotFoundException(name)
    return f.readBytes()
  }

  // Serialize all writes on a process-wide monitor so the two in-process read-modify-write paths
  // (JS persistVault -> VaultIO and VaultEncryptor.updateCurrentWithKey) cannot interleave. The monitor is
  // reentrant, so VaultEncryptor can hold WRITE_LOCK across its full read->modify->write and this
  // nested writeAtomic call re-enters harmlessly. (Cross-runtime JS<->Kotlin locking is out of scope.)
  fun writeAtomic(name: String, bytes: ByteArray) {
    synchronized(WRITE_LOCK) {
      val tmp = tmpFor(name)
      try {
        FileOutputStream(tmp).use { out ->
          out.write(bytes)
          out.fd.sync() // fsync
        }
        val target = fileFor(name)
        if (!tmp.renameTo(target)) {
          // POSIX rename should be atomic on same filesystem; this branch is a safety net.
          target.delete()
          if (!tmp.renameTo(target)) throw java.io.IOException("rename failed for $name")
        }
        // fsync the directory so the rename (a directory metadata op) is durable
        // across a crash — the file content fsync above does not cover the rename.
        fsyncDir(ctx.filesDir)
      } finally {
        if (tmp.exists()) tmp.delete()
      }
    }
  }

  private fun fsyncDir(dir: File) {
    val fd = Os.open(dir.absolutePath, OsConstants.O_RDONLY, 0)
    try {
      Os.fsync(fd)
    } finally {
      Os.close(fd)
    }
  }

  fun delete(name: String) {
    fileFor(name).delete()
    // Sweep any leftover unique tmp files ("$name.<nanos>.<seq>.tmp"). Unique naming means the
    // legacy fixed "$name.tmp" is never produced, so match by prefix/suffix instead.
    ctx.filesDir.listFiles { f -> f.name.startsWith("$name.") && f.name.endsWith(".tmp") }
      ?.forEach { it.delete() }
  }

  companion object {
    /** Process-wide monitor serializing vault.enc read-modify-write across VaultIO + VaultEncryptor. */
    val WRITE_LOCK = Any()
    private val TMP_SEQ = AtomicLong(0)
  }
}
