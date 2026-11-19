import { parseEnvironment } from './environment'

const validSource = {
  PROD: false,
  VITE_API_BASE_URL: 'https://api.example.test/dev',
  VITE_SUPABASE_URL: 'https://project.supabase.example.test',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
  VITE_CONFIGURATION_ADMIN_EMAILS: ' Admin@Example.test ,otra@example.test,',
  VITE_LOCATION_ADMIN_EMAILS: '1admin@example.test',
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

  it('falla indicando la variable obligatoria que falta', () => {
    expect(() => parseEnvironment({ ...validSource, VITE_API_BASE_URL: undefined })).toThrow(
      /VITE_API_BASE_URL/,
    )
  })
})
