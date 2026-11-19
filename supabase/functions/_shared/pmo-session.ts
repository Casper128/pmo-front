import { createClient } from 'npm:@supabase/supabase-js@2';

const DEFAULT_PMO_API = 'https://wwz8sswbkh.execute-api.us-west-2.amazonaws.com/dev';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/** Error con el estado HTTP que debe devolver la función. */
export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** `HttpError` conserva su estado; cualquier otro error se registra y responde 500 (con `fallback` si se da). */
export const errorResponse = (error: unknown, fallback?: string) => {
  if (error instanceof HttpError) return json({ error: error.message }, error.status);
  console.error(error);
  return json(
    { error: fallback || (error instanceof Error ? error.message : 'Error inesperado') },
    500,
  );
};

export const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;

export const findValue = (value: unknown, keys: string[]): unknown => {
  const object = asRecord(value);
  if (!object) return undefined;
  for (const key of keys) {
    const candidate = object[key];
    if (candidate !== undefined && candidate !== null && candidate !== '') return candidate;
  }
  for (const child of Object.values(object)) {
    const candidate = findValue(child, keys);
    if (candidate !== undefined) return candidate;
  }
  return undefined;
};

export const normalizeEmail = (value: unknown): string =>
  String(value || '')
    .trim()
    .toLowerCase();

export const pmoApiBaseUrl = () =>
  (Deno.env.get('PMO_API_BASE_URL') || DEFAULT_PMO_API).replace(/\/$/, '');

export interface PmoUser {
  userKey: string;
  userId: string;
  email: string;
  role: string;
}

/** Valida el Bearer contra PMO (`/home/datosusuario`) y devuelve la identidad del usuario. */
export const identifyUser = async (authorization: string, apiBaseUrl: string): Promise<PmoUser> => {
  if (!authorization.startsWith('Bearer ')) throw new HttpError('Sesión PMO requerida', 401);
  const userResponse = await fetch(`${apiBaseUrl}/home/datosusuario`, {
    headers: { Authorization: authorization },
  }).catch(() => null);
  if (!userResponse)
    throw new HttpError('No fue posible contactar el API PMO para validar la sesión', 502);
  if (!userResponse.ok) throw new HttpError('La sesión PMO no es válida', 401);
  const user = await userResponse.json();
  const userId = String(findValue(user, ['id', 'idUsuario', 'userId', 'codigo']) || '').trim();
  const email = normalizeEmail(
    findValue(user, ['email', 'correo', 'mail', 'usuarioEmail']) ??
      findValue(user, ['username', 'usuario', 'login']),
  );
  const role = normalizeEmail(findValue(user, ['role', 'rol', 'perfil', 'tipoUsuario']));
  const userKey = (userId || email).toLowerCase();
  if (!userKey) throw new HttpError('No fue posible identificar al usuario PMO', 422);
  return { userKey, userId, email, role };
};

export const secretClient = () => {
  const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
  const secretKey = secretKeys.default;
  if (!secretKey) throw new HttpError('La clave secreta de Supabase no está configurada', 500);
  return createClient(Deno.env.get('SUPABASE_URL')!, secretKey, {
    auth: { persistSession: false },
  });
};

export const auditEmail = () => normalizeEmail(Deno.env.get('PMO_AUDIT_EMAIL'));

const AUDIT_ROLES = ['admin', 'auditor'];

/** Auditoría: rol exacto admin/auditor, la cuenta `PMO_AUDIT_EMAIL` o (solicitudes antiguas) el auditor de la fila. */
export const isAuditUser = (user: PmoUser, rowAuditorEmail?: unknown): boolean => {
  const configured = auditEmail();
  const rowAuditor = normalizeEmail(rowAuditorEmail);
  return (
    AUDIT_ROLES.includes(user.role.trim().toLowerCase()) ||
    (!!user.email && (user.email === configured || user.email === rowAuditor))
  );
};

const extractRows = (response: unknown): Record<string, unknown>[] => {
  if (Array.isArray(response))
    return response.filter((row) => asRecord(row)) as Record<string, unknown>[];
  const root = asRecord(response);
  const data = asRecord(root?.data);
  const rows = [data?.rows, root?.data, root?.rows].find(Array.isArray);
  return Array.isArray(rows)
    ? (rows.filter((row) => asRecord(row)) as Record<string, unknown>[])
    : [];
};

/** Reporte del consultor autenticado con ese identificador, o `null` si no le pertenece. */
export const findOwnReport = async (
  authorization: string,
  apiBaseUrl: string,
  user: PmoUser,
  identifier: string,
): Promise<Record<string, unknown> | null> => {
  const response = await fetch(`${apiBaseUrl}/tiemposConsultores/gestion`, {
    method: 'POST',
    headers: { Authorization: authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify({ idConsultor: user.userId || user.userKey }),
  }).catch(() => null);
  if (!response)
    throw new HttpError('No fue posible contactar el API PMO para validar el reporte', 502);
  if (!response.ok) throw new HttpError('No fue posible validar el reporte', 502);
  return (
    extractRows(await response.json()).find((row) => String(row.identificador || '') === identifier) ??
    null
  );
};

/** Token de la cuenta técnica de auditoría (`PMO_AUDIT_EMAIL`/`PMO_AUDIT_PASSWORD`). */
export const auditToken = async (apiBaseUrl: string): Promise<string> => {
  const email = Deno.env.get('PMO_AUDIT_EMAIL') || '';
  const password = Deno.env.get('PMO_AUDIT_PASSWORD') || '';
  if (!email || !password)
    throw new HttpError('Las credenciales técnicas de auditoría no están configuradas', 500);
  const response = await fetch(`${apiBaseUrl}/cuentas/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }).catch(() => null);
  if (!response)
    throw new HttpError('No fue posible contactar el API PMO para autenticar auditoría', 502);
  const login = await response.json().catch(() => ({}));
  const token = String(findValue(login, ['token', 'jwtToken', 'key', 'accessToken']) || '');
  if (!response.ok || !token)
    throw new HttpError('No fue posible autenticar el servicio de auditoría', 502);
  return token;
};

/** Borra el reporte en PMO. Lanza `HttpError` con el estado del API si lo rechaza (404 = no existe). */
export const deletePmoReport = async (
  apiBaseUrl: string,
  bearer: string,
  identifier: string,
): Promise<void> => {
  const response = await fetch(
    `${apiBaseUrl}/tiemposConsultores/tiempo/delete/${encodeURIComponent(identifier)}`,
    {
      method: 'DELETE',
      headers: {
        accept: '*/*',
        'accept-language': 'es',
        Authorization: `Bearer ${bearer}`,
        'cache-control': 'no-cache',
        'Content-Type': 'application/json',
        pragma: 'no-cache',
      },
    },
  ).catch(() => null);
  if (!response)
    throw new HttpError('No fue posible contactar el API PMO para eliminar el reporte', 502);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = String(findValue(body, ['mensaje', 'message', 'error']) || '');
    throw new HttpError(message || 'El API de tiempos rechazó la eliminación', response.status);
  }
};

/** Día `YYYY-MM-DD` de un ISO o de la etiqueta `Wed Sep 09 2026 ...`; `''` si no hay fecha real. */
const dayFromText = (value: unknown): string => {
  const months = 'jan feb mar apr may jun jul aug sep oct nov dec'.split(' ');
  const text = String(value ?? '');
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  const textual = text.match(
    /\b(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(\d{4})/i,
  );
  const parts = iso
    ? [iso[1], iso[2], iso[3]]
    : textual
      ? [
          textual[3],
          String(months.indexOf(textual[1].toLowerCase()) + 1).padStart(2, '0'),
          textual[2].padStart(2, '0'),
        ]
      : null;
  if (!parts) return '';
  const [year, month, day] = parts.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const real =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return real ? parts.join('-') : '';
};

/** Igual que `reportDayKey` de react-app: `HoraInicio` (hora de pared, sin convertir zona) y si falta `fechaInicio`. */
export const reportDayKey = (report: Record<string, unknown>): string =>
  dayFromText(report.HoraInicio) || dayFromText(report.fechaInicio);

/** Hoy (`YYYY-MM-DD`) en America/Bogota. */
export const todayInBogota = (): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
