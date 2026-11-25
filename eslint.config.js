const neostandard = require('neostandard')

module.exports = [
  // Global, so they cover every block below (neostandard's own `ignores` option only reaches its blocks).
  { ignores: neostandard.resolveIgnoresFromGitignore() },
  ...neostandard({ ts: true }),
  {
    // The type-aware checks the previous `standard-with-typescript` config ran, which neostandard leaves out.
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: __dirname
      }
    },
    rules: {
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/return-await': ['error', 'always'],
      '@typescript-eslint/strict-boolean-expressions': ['error', { allowString: false, allowNumber: false, allowNullableObject: false }]
    }
  }
]
