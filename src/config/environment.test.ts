import { parseEnvironment } from './environment'

const validSource = {
  PROD: false,
  VITE_API_BASE_URL: 'https://api.example.test/dev',
  VITE_SUPABASE_URL: 'https://project.supabase.example.test',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
  VITE_CONFIGURATION_ADMIN_EMAILS: ' Admin@Example.test ,otra@example.test,',
  VITE_LOCATION_ADMIN_EMAILS: '1admin@example.test',
  VITE_DEFAULT_AUDITOR_EMAIL: ' Auditor@Example.test ',
}

describe('parseEnvironment', () => {
  it('devuelve la forma del environment de Angular con listas normalizadas', () => {
    expect(parseEnvironment(validSource)).toEqual({
      production: false,
      apiBaseUrl: 'https://api.example.test/dev',
      supabaseUrl: 'https://project.supabase.example.test',
      supabasePublishableKey: 'publishable-key',
      configurationAdminEmails: ['admin@example.test', 'otra@example.test'],
      locationAdminEmails: ['1admin@example.test'],
      defaultAuditorEmail: 'auditor@example.test',
    })
  })

  it('acepta listas de correos ausentes como vacías', () => {
    const parsed = parseEnvironment({
      ...validSource,
      VITE_CONFIGURATION_ADMIN_EMAILS: undefined,
      VITE_LOCATION_ADMIN_EMAILS: undefined,
    })
    expect(parsed.configurationAdminEmails).toEqual([])
    expect(parsed.locationAdminEmails).toEqual([])
  })

  it('el auditor por defecto es opcional: ausente o vacío → cadena vacía', () => {
    expect(parseEnvironment({ ...validSource, VITE_DEFAULT_AUDITOR_EMAIL: undefined }).defaultAuditorEmail).toBe('')
    expect(parseEnvironment({ ...validSource, VITE_DEFAULT_AUDITOR_EMAIL: '' }).defaultAuditorEmail).toBe('')
    expect(parseEnvironment({ ...validSource, VITE_DEFAULT_AUDITOR_EMAIL: '  ' }).defaultAuditorEmail).toBe('')
  })

  it('rechaza un auditor por defecto que no es un correo', () => {
    expect(() => parseEnvironment({ ...validSource, VITE_DEFAULT_AUDITOR_EMAIL: 'no-es-correo' })).toThrow(
      /VITE_DEFAULT_AUDITOR_EMAIL/,
    )
  })

  it('falla indicando la variable obligatoria que falta', () => {
    expect(() => parseEnvironment({ ...validSource, VITE_API_BASE_URL: undefined })).toThrow(
      /VITE_API_BASE_URL/,
    )
  })
})
