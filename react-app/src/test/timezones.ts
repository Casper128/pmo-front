/** Zonas de `npm run test:tz`: UTC, Colombia (UTC-5) y Japón (UTC+9). */
export const TEST_TIMEZONES = ['UTC', 'America/Bogota', 'Asia/Tokyo'] as const;
export type TestTimezone = (typeof TEST_TIMEZONES)[number];

/** Desfase esperado de `getTimezoneOffset()` (minutos) para comprobar que el cambio de TZ se aplicó. */
export const TIMEZONE_OFFSETS: Record<TestTimezone, number> = {
  UTC: 0,
  'America/Bogota': 300,
  'Asia/Tokyo': -540,
};

/**
 * Ejecuta el bloque de tests en la zona horaria indicada: `vi.stubEnv` asigna `process.env.TZ`, que Node
 * aplica al momento; `vi.unstubAllEnvs` restaura la zona original al terminar el bloque.
 */
export function useTimezone(timezone: TestTimezone): void {
  beforeAll(() => {
    vi.stubEnv('TZ', timezone);
  });
  afterAll(() => {
    vi.unstubAllEnvs();
  });
}
