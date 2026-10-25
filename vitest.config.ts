import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/domain/**', 'src/lib/application/**', 'src/lib/*.ts'],
      exclude: ['src/lib/__tests__/**', 'src/lib/vendor.d.ts'],
      reporter: ['text-summary', 'html'],
      // Business rules must stay well covered; UI glue is covered by the UI and E2E suites.
      thresholds: { 'src/lib/domain/**': { lines: 90, functions: 90 }, 'src/lib/application/**': { lines: 80, functions: 80 } },
    },
  },
});
