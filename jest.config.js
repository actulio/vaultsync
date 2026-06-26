/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/__tests__/**/*.test.{ts,tsx}'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  transformIgnorePatterns: [
    'node_modules/(?!(.pnpm|expo|expo-modules-core|@expo|expo-router|react-native|@react-native|libsodium-wrappers-sumo))',
  ],
  testTimeout: 30_000,
};
