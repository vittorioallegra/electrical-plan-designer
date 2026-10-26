import { readdirSync } from 'node:fs';
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import i18next from 'eslint-plugin-i18next';
import importX from 'eslint-plugin-import-x';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const web = './apps/web/src';
const features = readdirSync(new URL(`${web}/features`, import.meta.url), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

export default defineConfig(
  {
    ignores: [
      '.gstack',
      '**/dist',
      '**/out',
      '**/release',
      '**/node_modules',
      '**/playwright-report',
      '**/test-results',
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
    files: ['scripts/**/*.mjs', '*.js'],
    languageOptions: { globals: globals.node },
  },
  {
    // The domain is pure: no React, no app layers.
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
    // The bridge is a types-and-names contract: it imports nothing from the apps.
    files: ['packages/bridge/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@epd/web', '@epd/web/*', '@epd/desktop', '@epd/desktop/*', '**/apps/**'],
              message: '@epd/bridge must not import app code.',
            },
          ],
        },
      ],
    },
  },
  {
    // The desktop shell (main, preload, e2e) talks to the web app only through @epd/bridge. The
    // web app, in turn, never imports the shell (checked below through its own boundaries).
    files: ['apps/desktop/{src,e2e}/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react-*',
                'react/*',
                '@/*',
                '@epd/web',
                '@epd/web/*',
                '**/apps/web/**',
              ],
              message: '@epd/desktop must not import React or the web app; use @epd/bridge.',
            },
          ],
        },
      ],
    },
  },
  {
    // Import boundaries (Bulletproof React): features never import each other, shared code never
    // imports features or the app. `src/app` composes features. `src/testing` may import the app
    // (renderApp mounts the real routes) but not features.
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { 'import-x': importX },
    settings: {
      'import-x/resolver-next': [
        createTypeScriptImportResolver({ project: 'apps/web/tsconfig.json' }),
      ],
    },
    rules: {
      'import-x/no-restricted-paths': [
        'error',
        {
          basePath: import.meta.dirname,
          zones: [
            ...features.map((name) => ({
              target: `${web}/features/${name}`,
              from: `${web}/features`,
              except: [`./${name}`],
              message: 'Features must not import other features; compose them in src/app.',
            })),
            {
              target: ['api', 'components', 'config', 'hooks', 'lib', 'stores'].map(
                (dir) => `${web}/${dir}`,
              ),
              from: [`${web}/features`, `${web}/app`],
              message: 'Shared code must not import features or the app.',
            },
            {
              target: `${web}/testing`,
              from: `${web}/features`,
              message: 'Test helpers must not import features.',
            },
          ],
        },
      ],
    },
  },
  {
    // No re-export barrels: import modules by path.
    files: ['**/index.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportAllDeclaration, ExportNamedDeclaration[source]',
          message: 'No re-export barrels in index files; import the module by its path.',
        },
      ],
    },
  },
  {
    // User-facing strings go through i18n.
    files: [
      'apps/web/src/app/**/*.tsx',
      'apps/web/src/components/**/*.tsx',
      'apps/web/src/features/**/*.tsx',
      'apps/web/src/lib/**/*.tsx',
    ],
    ignores: ['**/*.test.tsx'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': ['error', { mode: 'jsx-text-only' }],
    },
  },
);
