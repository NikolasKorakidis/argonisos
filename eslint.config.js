// Lint: catches mistakes (undefined names, unreachable code, duplicate keys, unused variables), never layout. The
// codebase deliberately writes dense one-line statements, so no formatting or style rules are switched on here.
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', 'vendor/', 'legacy/', 'assets/', 'tests/reports/', 'concept/'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.browser } },
  },
  { files: ['src/world/terrain-worker.js'], languageOptions: { globals: { ...globals.worker } } },
  {
    files: ['tests/**/*.{js,mjs}', 'tools/**/*.mjs', '*.{js,mjs}'],
    // (AG is the game's handle on window, used by the code the tests run inside the page)
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.node, ...globals.browser, AG: 'readonly' } },
  },
  {
    rules: {
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true, varsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-cond-assign': ['error', 'except-parens'],
      'no-constant-condition': ['error', { checkLoops: false }],
    },
  },
];
