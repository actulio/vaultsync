# Future: generate a real release keystore

**Status:** deferred (decided 2026-07-19). Not blocking personal sideloading.
**Blocks:** any public distribution — Play Store, F-Droid, sharing the APK with anyone else.

---

## The situation today

Release APKs are **debug-signed**. `android/app/build.gradle:121-124` has the `release` buildType using `signingConfigs.debug`, which points at `android/app/debug.keystore`.

That file is the **stock React Native template debug keystore** — valid from 2013, committed to this repo, and byte-identical across thousands of RN projects. Its fingerprint is:

```
SHA-1: 5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
```

It is not unique to VaultSync. **Anyone can sign an APK with that same key and the package name `com.vaultsync.app`.** For a password manager installed only on the owner's own phone, that risk is acceptable. For anything distributed, it is not.

---

## What to do when the time comes

### 1. Generate the keystore

```bash
mkdir -p ~/keystores
keytool -genkeypair -v \
  -keystore ~/keystores/vaultsync-release.jks \
  -alias vaultsync \
  -keyalg RSA -keysize 4096 \
  -validity 10000 \
  -storetype PKCS12
```

`PKCS12` is the modern format (JKS is legacy). 10000 days ≈ 27 years — expiry means never shipping a signed update again, so err long.

### 2. Keep credentials outside the repo

In `~/.gradle/gradle.properties` (NOT in this project):

```properties
VAULTSYNC_STORE_FILE=/Users/<you>/keystores/vaultsync-release.jks
VAULTSYNC_STORE_PASSWORD=…
VAULTSYNC_KEY_ALIAS=vaultsync
VAULTSYNC_KEY_PASSWORD=…
```

### 3. Wire it into the build — mind the CNG constraint

`android/` is **gitignored** (`.gitignore:42`) because this project uses Expo CNG and regenerates it. A signing config edited directly into `android/app/build.gradle` is untracked and will be wiped by `expo prebuild --clean`.

Two options:

- **Pragmatic:** edit `android/app/build.gradle` directly and never run `prebuild --clean` (the README already advises against it). Fragile but zero extra machinery.
- **Durable:** write an Expo config plugin that injects the `release` signing config at prebuild time. Lives in tracked code, survives regeneration. This is the right answer if the app is ever distributed.

The same constraint is why `FLAG_SECURE` lives in `modules/vaultsync-native/` rather than `MainActivity.kt` — see commit `960f8f8`.

---

## Three consequences that are easy to get wrong

### ① Switching keys breaks Google OAuth

The Drive OAuth client is registered against the **debug** keystore's SHA-1. A new keystore means a new fingerprint, and sign-in then fails **silently** — indistinguishable from the dead-button bug fixed in commit `6187945`/`8f232cc`.

Before switching: add the new SHA-1 as an additional Android OAuth client in Google Cloud Console (package `com.vaultsync.app`). Keep both registered during the transition.

Read the new fingerprint with:

```bash
keytool -list -v -keystore ~/keystores/vaultsync-release.jks -alias vaultsync
```

### ② Switching keys forces an uninstall, which wipes the vault

Android refuses to update an installed app signed with a different key. You must uninstall first — and that deletes app storage, including `vault.enc`.

**Before switching keys:**
1. Confirm Drive sync genuinely round-trips (see `docs/TESTING-2026-07-18-ux-lock-drive.md` §4). Do not assume it works.
2. Have the recovery code to hand.
3. Ideally pull a copy of `vault.enc` off the device first.

Do not test the backup and the restore in the same sitting.

### ③ Losing the keystore is unrecoverable

No signed update is ever possible again for that package. Back it up somewhere that is not the build laptop. The password too — a keystore without its password is equally lost.

---

## Related

- `docs/TESTING-2026-07-18-ux-lock-drive.md` — on-device checklist; §4 covers the Drive round-trip that must pass before any keystore switch
- `README.md` — release build recipe and the JDK-17 / foojay toolchain notes
- `.superpowers/sdd/progress.md` — full execution ledger
