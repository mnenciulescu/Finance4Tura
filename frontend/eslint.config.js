import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'dev-dist', 'playwright-report', 'test-results', '.preview']),
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',
      // Several hooks intentionally mirror props into refs during render.
      'react-hooks/refs': 'off',
    },
  },
  {
    // Tests and config run under Node / Vitest.
    files: ['**/*.test.{js,jsx,ts,tsx}', 'src/test/**', 'e2e/**', '*.config.js', 'scripts/**'],
    languageOptions: { globals: { ...globals.node, ...globals.vitest } },
    rules: {
      'react-refresh/only-export-components': 'off',
      // Test harnesses capture hook values into outer variables on purpose.
      'react-hooks/globals': 'off',
    },
  },
])
