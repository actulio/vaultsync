package expo.modules.vaultsyncnative.autofill

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Instrumented tests for the pure no-silent-overwrite decision (spec §6.5). Covers all four
 * branches of [SavePolicy.decide]. The dialog/biometric UI in [AutofillSaveActivity] is not
 * instrumentable and is intentionally left untested.
 */
@RunWith(AndroidJUnit4::class)
class SavePolicyTest {
  private fun entry(id: String, user: String, pw: String) = EntryView(
    id = id, title = "Title-$id", username = user, password = pw, url = null, packageNames = emptyList(),
  )

  @Test
  fun noMatches_savesNew() {
    assertEquals(SaveDecision.SaveNew, SavePolicy.decide(emptyList(), "alice", "pw"))
  }

  @Test
  fun sameUsernameSamePassword_isNoOp() {
    val matches = listOf(entry("e1", "alice", "pw"))
    assertEquals(SaveDecision.NoOp, SavePolicy.decide(matches, "alice", "pw"))
  }

  @Test
  fun sameUsernameDifferentPassword_updatesPassword() {
    val existing = entry("e1", "alice", "oldpw")
    val decision = SavePolicy.decide(listOf(existing), "alice", "newpw")
    assertTrue(decision is SaveDecision.UpdatePassword)
    decision as SaveDecision.UpdatePassword
    assertEquals("e1", decision.entry.id)
    assertEquals("oldpw", decision.entry.password)
  }

  @Test
  fun matchesButNoneWithThisUsername_savesAsNew() {
    val matches = listOf(entry("e1", "bob", "pw"))
    assertEquals(SaveDecision.SaveAsNew, SavePolicy.decide(matches, "alice", "otherpw"))
  }

  @Test
  fun exactCredentialMatch_takesPriorityOverASameUserDifferentPasswordMatch() {
    // Never a write when the exact credential is already stored, even if another same-user entry differs.
    val matches = listOf(entry("e1", "alice", "different"), entry("e2", "alice", "pw"))
    assertEquals(SaveDecision.NoOp, SavePolicy.decide(matches, "alice", "pw"))
  }
}
