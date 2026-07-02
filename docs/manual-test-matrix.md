# Manual Test Matrix

The runs to perform on real hardware before considering VaultSync v1 shippable. JS/unit
and instrumented (emulator) suites are green in CI; this matrix covers what only a physical
device with enrolled biometrics and a real Google account can prove.

## Devices to test on
- Primary: Samsung S24 (Android 14+) — fast, modern hardware.
- Secondary: any device ≥ 4 years old, mid-range (e.g. Samsung A52, Moto G Power). Verifies Argon2id cold path latency is acceptable.

## Scenarios

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 1 | First install + onboarding | Install APK. Open. Welcome → set master password ("Pa55word!") → confirm recovery code (write it down) → enable biometric → sign in to Drive | Onboarding completes; lands on empty vault list; `Drive/VaultSync/vault.enc` exists in user's Drive |
| 2 | Add a login | Tap +, fill GitHub credentials, save | Entry appears at top of list |
| 3 | Edit a login | Open entry → Edit → change password → save | Password updated; previousPassword set; Drive vault.enc mtime advances |
| 4 | Delete an entry | Open entry → Delete → confirm | Entry removed |
| 5 | Lock + biometric unlock | Background app for 6 min → foreground → tap "Use biometric" | Unlocks within 1s |
| 6 | Lock + master password unlock | Reboot device → open app → enter master password | Unlocks within 2s on S24, ≤ 3s on older device |
| 7 | Forgot password recovery | Force-clear app data → reinstall → tap "Forgot password" on unlock screen → enter recovery code → set new password → continue | Vault restored from Drive; new recovery code shown |
| 8 | Autofill in Chrome | Open chrome.com → login form → tap field → choose VaultSync from autofill bar → biometric prompt → values filled | Username + password autofilled correctly |
| 9 | Autofill in a native app (e.g. Instagram) | Login screen → tap username → VaultSync prompts → fill | Correct credentials filled |
| 10 | Autofill miss → notification | Open an app where vault has no entry | Notification "no autofill match" within 5s; tap → opens app filtered by that package |
| 11 | Save flow — new credentials | In a fresh app, sign in with new username/password → Android prompts "Save?" → confirm | New entry appears; Drive vault.enc updates |
| 12 | Save flow — same password | Re-submit the same credentials | No save prompt |
| 13 | Save flow — different password | Change password on the site → re-login | "Update password" prompt; on confirm, previousPassword field stored |
| 14 | Save flow — different username | Sign in with another account | "Save as new" prompt; old entry untouched |
| 15 | Password generator | Generator tab → adjust length to 32 → toggle off symbols → tap Copy | Clipboard contains 32-char password with no symbols; clears within 30s |
| 16 | CSV import (1Password) | Settings → Import CSV → pick a 1Password export → confirm | All entries imported; count matches; CSV file deleted from app sandbox |
| 17 | CSV import (manual mapping) | Pick a CSV with non-standard headers → map columns → import | Entries imported with chosen mapping |
| 18 | Language switch | Settings → Idioma → Inglês | UI changes to English on next render; persists across restarts |
| 19 | Auto-lock timeout | Settings → Bloqueio automático → 1 minuto. Background for 2 min, foreground | Vault locked; biometric prompt required |
| 20 | Drive sync — offline edit | Disable network → edit an entry → re-enable network → wait | Settings sync row shows queue depth dropping to 0; vault.enc mtime updates |
| 21 | Drive sync — second device | Install on a second device → sign in to same Google account → enter master password | Vault restored; same entries present |

## Pass criteria
- Scenarios 1, 5, 6, 7 — pass on all devices.
- Scenarios 8, 9, 10, 11, 12, 13, 14 — pass on S24; pass on at least one older device.
- Scenarios 16, 17 — pass with at least the 1Password sample file.
- Scenario 6 on older device — Argon2id ≤ 3s (acceptable). If > 5s, consider lowering memory parameter to 32 MiB and update spec.
