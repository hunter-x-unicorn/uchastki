// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/**', 'artifacts/**', 'android/**', 'ios/**', 'test-results/**'],
  },
  {
    files: ['scripts/**/*.cjs', 'plugins/**/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: { __dirname: 'readonly' } },
  },
]);
