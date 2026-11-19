import { z } from 'zod'

/** Convierte una lista CSV en correos normalizados (sin espacios, en minúsculas, sin vacíos). */
const emailList = z
  .string()
  .optional()
  .transform((value) =>
    (value ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  )

const environmentSchema = z.object({
  PROD: z.boolean(),
  VITE_API_BASE_URL: z.url(),
  VITE_SUPABASE_URL: z.url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().trim().min(1),
  VITE_CONFIGURATION_ADMIN_EMAILS: emailList,
  VITE_LOCATION_ADMIN_EMAILS: emailList,
})

/** Misma forma que `src/environments/environment.ts` de la app Angular. */
export interface Environment {
  readonly production: boolean
  readonly apiBaseUrl: string
  readonly supabaseUrl: string
  readonly supabasePublishableKey: string
  readonly configurationAdminEmails: readonly string[]
  readonly locationAdminEmails: readonly string[]
}

/** Valida las variables de Vite y falla rápido si falta alguna obligatoria. */
export function parseEnvironment(source: Record<string, unknown>): Environment {
  const result = environmentSchema.safeParse(source)
  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join('.')).join(', ')
    throw new Error(
      `Configuración de entorno inválida o incompleta (${fields}). Revise .env.local o las variables de Netlify; ver .env.example.`,
    )
  }
  const env = result.data
  return {
    production: env.PROD,
    apiBaseUrl: env.VITE_API_BASE_URL,
    supabaseUrl: env.VITE_SUPABASE_URL,
    supabasePublishableKey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
    configurationAdminEmails: env.VITE_CONFIGURATION_ADMIN_EMAILS,
    locationAdminEmails: env.VITE_LOCATION_ADMIN_EMAILS,
  }
}

export const environment: Environment = parseEnvironment(import.meta.env)
