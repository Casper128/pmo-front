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

// Librerías de base en chunks propios (cacheables entre despliegues). Las páginas se cargan con `lazy` por ruta y
// recharts queda en el chunk de las gráficas, que solo descargan el Dashboard y Datos.
const vendorGroups = [
  { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
  { name: 'vendor-router', test: /node_modules[\\/]react-router[\\/]/ },
  { name: 'vendor-ui', test: /node_modules[\\/](radix-ui|@radix-ui|@floating-ui|cmdk|react-day-picker|date-fns)[\\/]/ },
  { name: 'vendor-data', test: /node_modules[\\/](@tanstack|react-hook-form|@hookform|zod)[\\/]/ },
]

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias },
  build: { rolldownOptions: { output: { codeSplitting: { groups: vendorGroups } } } },
})
