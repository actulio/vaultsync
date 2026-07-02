package expo.modules.vaultsyncnative.autofill

/**
 * Outcome of the save-flow decision over the current vault (spec §6.5). Extracted as a pure,
 * UI-free unit so the no-silent-overwrite policy is directly unit-testable.
 */
sealed interface SaveDecision {
  /** No matches for this app/site — offer to save a brand-new entry. */
  object SaveNew : SaveDecision

  /** A match already stores this exact username + password — nothing to do, never prompt. */
  object NoOp : SaveDecision

  /** A match has this username but a different password — offer to update (never overwrite silently). */
  data class UpdatePassword(val entry: EntryView) : SaveDecision

  /** Matches exist but none with this username — offer to save as a new entry (never overwrite). */
  object SaveAsNew : SaveDecision
}

object SavePolicy {
  /**
   * Pure decision over the [matches] returned by [Matcher] for the current app/site and the
   * just-submitted [username]/[password].
   *
   * Hard rule (spec §6.5): this NEVER returns a decision that overwrites an existing entry without
   * an explicit confirmation step. The only write-nothing branch is [SaveDecision.NoOp] (the exact
   * credential is already stored), so it is safe to act on without a prompt.
   */
  fun decide(matches: List<EntryView>, username: String, password: String): SaveDecision {
    if (matches.isEmpty()) return SaveDecision.SaveNew
    // Exact-credential match wins first: it must be a silent no-op, never a write.
    if (matches.any { it.username == username && it.password == password }) return SaveDecision.NoOp
    val sameUser = matches.firstOrNull { it.username == username }
    if (sameUser != null) return SaveDecision.UpdatePassword(sameUser)
    return SaveDecision.SaveAsNew
  }
}
