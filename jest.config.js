/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/__tests__/**/*.test.{ts,tsx}'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Native module can't load under Node — back it with the WASM libsodium build.
    '^react-native-libsodium$': '<rootDir>/test/shims/react-native-libsodium.ts',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(.pnpm|expo|expo-modules-core|@expo|expo-router|react-native|@react-native|libsodium-wrappers-sumo|@noble))',
  ],
  testTimeout: 30_000,
};
