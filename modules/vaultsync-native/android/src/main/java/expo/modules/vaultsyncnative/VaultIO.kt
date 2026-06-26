package expo.modules.vaultsyncnative

import android.content.Context
import android.system.Os
import android.system.OsConstants
import java.io.File
import java.io.FileNotFoundException
import java.io.FileOutputStream

class VaultIO(private val ctx: Context) {
  private fun fileFor(name: String): File = File(ctx.filesDir, name)
  private fun tmpFor(name: String): File = File(ctx.filesDir, "$name.tmp")

  fun exists(name: String): Boolean = fileFor(name).exists()

  fun read(name: String): ByteArray {
    val f = fileFor(name)
    if (!f.exists()) throw FileNotFoundException(name)
    return f.readBytes()
  }

  fun writeAtomic(name: String, bytes: ByteArray) {
    val tmp = tmpFor(name)
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
    tmpFor(name).delete()
  }
}
