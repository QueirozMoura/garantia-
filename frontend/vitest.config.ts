import { defineConfig } from 'vitest/config'

// Configuração mínima de testes unitários do frontend.
// - ambiente jsdom: necessário porque api.ts usa localStorage, FormData e Headers.
// - `vitest run` (script `test`) garante execução única, adequada para CI.
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
    restoreMocks: true,
  },
})
