import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [sveltekit()],
  // Render Svelte components with the browser build so component tests can mount them
  resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.ts'],
    exclude: ['tests/**', 'node_modules/**'],
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/routes/api/**'],
      exclude: ['src/lib/services/types/**', 'src/lib/components/**/*.svelte'],
      // Floor measured on 2026-11-12 (stmts 59.89, branches 58.24, funcs 70.96, lines 57.66).
      // `npm run test:unit:coverage` fails if any metric drops below it. Raise it when you add tests.
      thresholds: { statements: 59, branches: 58, functions: 70, lines: 57 }
    }
  }
});
