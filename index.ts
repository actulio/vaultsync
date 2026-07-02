// Secure-RNG polyfill MUST load before anything that touches crypto.
// libsodium-wrappers-sumo (src/crypto/*) and uuid() in src/vault/mutations.ts
// both require globalThis.crypto.getRandomValues, which Hermes does not provide.
// Importing this before expo-router/entry guarantees it runs before any route
// module — and therefore any crypto import — is evaluated.
import 'react-native-get-random-values';
import 'expo-router/entry';
