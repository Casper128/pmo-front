import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const fromSrc = (path: string) => fileURLToPath(new URL(`./src/${path}`, import.meta.url))

// Alias por capa (docs/migration-plan.md §4.1). Mantener en sincronía con tsconfig.app.json.
export const alias = {
  '@domain': fromSrc('domain'),
  '@application': fromSrc('application'),
  '@infrastructure': fromSrc('infrastructure'),
  '@presentation': fromSrc('presentation'),
  '@env': fromSrc('config'),
  '@': fromSrc(''),
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias },
})
