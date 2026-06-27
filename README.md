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
