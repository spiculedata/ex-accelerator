import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';
import globals from 'globals';
import ts from 'typescript-eslint';

// Deliberately small. `any` and `console` are warnings, not errors: src/lib/utils/lintRatchet.test.ts
// holds their counts so they can only fall. Real errors (parse failures, genuine bugs) fail CI.
export default ts.config(
  { ignores: ['build/', '.svelte-kit/', 'node_modules/', 'coverage/', 'playwright-report/', 'test-results/', 'static/', 'docs-site/', 'scripts/', 'notebooks/'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs['flat/recommended'],
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'warn',
      // Existing findings (about 85) stay visible as warnings until they are fixed; new rules can be promoted to errors one at a time.
      'svelte/infinite-reactive-loop': 'warn',
      'svelte/no-dom-manipulating': 'warn',
      'svelte/valid-prop-names-in-kit-pages': 'warn',
      'svelte/no-reactive-reassign': 'warn',
      'no-useless-assignment': 'warn',
      'preserve-caught-error': 'warn',
      'no-unsafe-finally': 'warn',
      'prefer-const': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      // Hygiene rules the codebase has not been held to; svelte-check and the ratchets cover what matters.
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'no-empty': 'off',
      'no-useless-escape': 'off',
      'no-case-declarations': 'off',
      'no-control-regex': 'off',
      'no-prototype-builtins': 'off',
      'no-async-promise-executor': 'off',
      'svelte/require-each-key': 'off',
      'svelte/no-navigation-without-resolve': 'off',
      'svelte/no-at-html-tags': 'off',
      'svelte/prefer-svelte-reactivity': 'off',
      'svelte/no-unused-svelte-ignore': 'off',
      'svelte/no-useless-mustaches': 'off'
    }
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: { parser: svelteParser, parserOptions: { parser: ts.parser } }
  }
);
