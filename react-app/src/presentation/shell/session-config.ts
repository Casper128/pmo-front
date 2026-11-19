/** Renovación de sesión cada 4 minutos (igual que Angular). */
export const SESSION_REFRESH_INTERVAL_MS = 4 * 60 * 1000;

/** Opciones de geolocalización de la auditoría de login (las mismas que Angular). */
export const LOGIN_LOCATION_REQUEST = { highAccuracy: false, maximumAgeMs: 300000, timeoutMs: 10000 } as const;
