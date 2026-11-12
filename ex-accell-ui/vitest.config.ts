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
      // Floor measured on 2026-11-12 (stmts 54.25, branches 53.30, funcs 63.55, lines 52.37).
      // `npm run test:unit:coverage` fails if any metric drops below it. Raise it when you add tests.
      thresholds: { statements: 54, branches: 53, functions: 63, lines: 52 }
    }
  }
});
