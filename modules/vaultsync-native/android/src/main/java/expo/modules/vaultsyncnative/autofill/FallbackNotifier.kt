package expo.modules.vaultsyncnative.autofill

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import expo.modules.vaultsyncnative.R

/**
 * Posts a rate-limited local notification when autofill detects login fields but finds no
 * matching vault entry (spec §6.6). Tapping the notification deep-links into the app's vault
 * search screen via `vaultsync://search?domain=<...>&package=<...>`.
 */
class FallbackNotifier(private val ctx: Context) {
  private val channelId = "vault_fallback"
  private val prefs: SharedPreferences = ctx.getSharedPreferences("vaultsync_fallback", Context.MODE_PRIVATE)

  /**
   * Once-per-hour-per-key rate-limit decision, extracted so it is directly unit-testable against
   * an explicit [now] instead of the real clock. Returns `true` (and records [now] as the new
   * "last shown" time for [key]) the first time a key is seen, or once at least [RATE_LIMIT_MS]
   * has elapsed since the last allowed call for that key. Returns `false` — without mutating
   * state — while still inside the rate-limit window.
   *
   * Also prunes stale `last_*` entries (see [pruneStaleEntries]) in the same batch as the new
   * write, so the SharedPreferences file stays bounded instead of accumulating one entry per
   * app/site ever seen.
   */
  fun shouldNotify(key: String, now: Long): Boolean {
    val prefKey = lastShownPrefKey(key)
    val lastShown = prefs.getLong(prefKey, 0L)
    if (now - lastShown < RATE_LIMIT_MS) return false

    val editor = prefs.edit()
    pruneStaleEntries(editor, now)
    editor.putLong(prefKey, now)
    editor.apply()
    return true
  }

  /**
   * Queues removal (on [editor], not yet applied) of every `last_*` key whose recorded epoch is
   * older than the rate-limit window as of [now]. Such an entry is, by definition, already past
   * [RATE_LIMIT_MS] and can never again suppress a future [shouldNotify] call for its key — so
   * dropping it is behavior-preserving and simply keeps the map from growing unbounded as more
   * apps/sites are seen over time.
   */
  private fun pruneStaleEntries(editor: SharedPreferences.Editor, now: Long) {
    val staleBefore = now - RATE_LIMIT_MS
    for ((storedKey, storedValue) in prefs.all) {
      if (storedKey.startsWith(LAST_SHOWN_PREFIX) && storedValue is Long && storedValue < staleBefore) {
        editor.remove(storedKey)
      }
    }
  }

  private fun lastShownPrefKey(key: String) = "$LAST_SHOWN_PREFIX$key"

  fun ensureChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val mgr = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (mgr.getNotificationChannel(channelId) == null) {
        mgr.createNotificationChannel(
          NotificationChannel(channelId, ctx.getString(R.string.fallback_channel_name), NotificationManager.IMPORTANCE_DEFAULT).apply {
            description = ctx.getString(R.string.fallback_channel_desc)
            setSound(null, null)
          },
        )
      }
    }
  }

  /**
   * Posts the fallback notification for a no-match autofill miss, subject to the once-per-hour
   * rate limit keyed on [packageName] (falling back to [webDomain]). No-ops if both are null.
   */
  fun notifyMiss(packageName: String?, webDomain: String?, now: Long = System.currentTimeMillis()) {
    val key = packageName ?: webDomain ?: return
    if (!shouldNotify(key, now)) return

    ensureChannel()

    val deepLink = Uri.Builder()
      .scheme("vaultsync")
      .authority("search")
      .appendQueryParameter("domain", webDomain ?: "")
      .appendQueryParameter("package", packageName ?: "")
      .build()
    val intent = Intent(Intent.ACTION_VIEW, deepLink).apply { flags = Intent.FLAG_ACTIVITY_NEW_TASK }
    val pi = PendingIntent.getActivity(
      ctx, key.hashCode(), intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val builder = NotificationCompat.Builder(ctx, channelId)
      .setSmallIcon(android.R.drawable.ic_secure)
      .setContentTitle(ctx.getString(R.string.fallback_title))
      .setContentText(ctx.getString(R.string.fallback_text, packageName ?: webDomain ?: "?"))
      .setAutoCancel(true)
      .setTimeoutAfter(60_000L) // dismiss after 60s
      .setContentIntent(pi)

    NotificationManagerCompat.from(ctx).notify(key.hashCode(), builder.build())
  }

  companion object {
    const val RATE_LIMIT_MS = 60 * 60 * 1000L
    private const val LAST_SHOWN_PREFIX = "last_"
  }
}
