module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { project: './tsconfig.json' },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended-type-checked',
    'prettier',
  ],
  ignorePatterns: ['node_modules', 'modules/*/build', '.expo'],
  rules: {
    '@typescript-eslint/consistent-type-imports': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
  },
  overrides: [
    {
      // Scoped disable for type-aware rules that produce noise against jest mock
      // factories (async stubs without await, any-typed mock return values, etc.).
      // no-floating-promises, no-misused-promises, and no-unused-vars remain ON.
      files: ['__tests__/**/*.ts', '__tests__/**/*.tsx'],
      rules: {
        '@typescript-eslint/require-await': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        '@typescript-eslint/no-unsafe-argument': 'off',
      },
    },
  ],
};
