module.exports = {
  extends: 'standard-with-typescript',
  parserOptions: {
    ecmaVersion: 2020,
    project: './tsconfig.eslint.json'
  },
  ignorePatterns: [
    'dist/**/*',
    'demo/**/*'
  ],
  rules: {
    'no-void': 'off',
    'object-curly-spacing': ['error', 'always'],
    '@typescript-eslint/no-namespace': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-dynamic-delete': 'off'
  }
}
