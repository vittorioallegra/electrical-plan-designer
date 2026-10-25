import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import i18next from 'eslint-plugin-i18next';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: [
      '.gstack',
      '**/dist',
      '**/node_modules',
      '**/playwright-report',
      '**/test-results',
      'apps/web/src/data/database.types.ts',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
  {
    // The domain is pure: no React, no Supabase, no app layers.
    files: ['packages/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-*', 'react/*'],
              message: '@epd/domain must not import React.',
            },
            { group: ['@supabase/*'], message: '@epd/domain must not import Supabase.' },
            {
              group: ['@/*', '@epd/web', '@epd/web/*', '**/apps/**'],
              message: '@epd/domain must not import app layers.',
            },
          ],
        },
      ],
    },
  },
  {
    // User-facing strings go through i18n.
    files: ['apps/web/src/features/**/*.tsx', 'apps/web/src/ui/**/*.tsx', 'apps/web/src/App.tsx'],
    ignores: ['**/*.test.tsx'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': ['error', { mode: 'jsx-text-only' }],
    },
  },
);
