# VaultSync

End-to-end encrypted vault synced to Google Drive.

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure Google OAuth (required for Drive sync)

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials.
2. Click **Create credentials** → **OAuth client ID**.
3. Choose **Android** (or **iOS** for simulator/TestFlight).
4. Copy the resulting client ID.
5. Create a `.env` file in the project root (copy from `.env.example`):

```bash
cp .env.example .env
```

6. Paste the client ID:

```
EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=your-client-id-here
```

> Without this env var the Drive sign-in screen will throw at runtime. The rest of the app (vault creation, biometric unlock) works without it.

### 3. Run

```bash
pnpm start          # Expo dev server
pnpm android        # Android device / emulator
pnpm test           # Jest unit tests
pnpm run typecheck  # TypeScript type-check
```

## Building a release APK (Android)

Produces a standalone, minified APK you can sideload onto any phone — no dev
server, no USB debugging, no developer mode required.

### Prerequisites (macOS)

The build needs a **JDK 17** toolchain and a complete Android NDK. On this
machine the JDK lives in Homebrew (`openjdk@17`); adjust paths to your setup.

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
```

- A `local.properties` in `android/` with `sdk.dir=$ANDROID_HOME` (created
  automatically by `pnpm android`, or write it by hand).
- NDK `27.1.12297006` fully installed. If a build fails with
  `NDK ... does not contain 'platforms'`, the NDK is corrupt — reinstall it:
  `sdkmanager --sdk_root="$ANDROID_HOME" --install "ndk;27.1.12297006"`.

### Build

```bash
cd android
./gradlew assembleRelease \
  -PabiFilter=arm64-v8a \
  -Dorg.gradle.java.installations.paths="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

- `-PabiFilter=arm64-v8a` ships only the 64-bit ARM library (every phone from
  the last ~7 years), giving a ~38 MB APK instead of ~92 MB. Omit it to build a
  universal APK for all architectures (needed for x86_64 emulators).
- Release builds are **debug-signed** — fine for sideloading, but generate a
  real keystore before publishing to the Play Store.
- Minification and resource shrinking are enabled for release only
  (`android/gradle.properties`); dev builds are unaffected.

> **Toolchain note:** the JDK-17 requirement is exact — Gradle's automatic
> JDK download is broken with this project's Gradle 9 (`JvmVendorSpec.IBM_SEMERU`
> / foojay error), so always point it at a local JDK 17 via
> `-Dorg.gradle.java.installations.paths=...`. If you hit that error on a
> subsequent build, a stale daemon is the cause: run `./gradlew --stop` first.

### Install on a phone

1. Transfer the APK (Google Drive, email, or USB file transfer).
2. Tap it in the Files app and allow "install unknown apps" when prompted.
3. Install and open — it runs standalone.

