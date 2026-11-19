/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
  /** Lista separada por comas. */
  readonly VITE_CONFIGURATION_ADMIN_EMAILS?: string
  /** Lista separada por comas. */
  readonly VITE_LOCATION_ADMIN_EMAILS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
