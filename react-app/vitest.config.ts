import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.{test,spec}.{ts,tsx}', 'scripts/**/*.test.mjs'],
      css: false,
      // Valores ficticios: los tests nunca llaman a la API ni a Supabase reales.
      env: {
        VITE_API_BASE_URL: 'https://api.example.test/dev',
        VITE_SUPABASE_URL: 'https://project.supabase.example.test',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
        VITE_CONFIGURATION_ADMIN_EMAILS: 'admin@example.test',
        VITE_LOCATION_ADMIN_EMAILS: 'admin@example.test',
      },
    },
  }),
)
