import {
  asRecord,
  auditToken,
  corsHeaders,
  deletePmoReport,
  errorResponse,
  findOwnReport,
  identifyUser,
  json,
  normalizeEmail,
  pmoApiBaseUrl,
} from '../_shared/pmo-session.ts';

const matchesSecret = (input: string, secret: string): boolean => {
  if (!input || !secret || input.length !== secret.length) return false;
  let diff = 0;
  for (let index = 0; index < input.length; index++) {
    diff |= input.charCodeAt(index) ^ secret.charCodeAt(index);
  }
  return diff === 0;
};

// Los correos autorizados salen del secret TECHNICAL_DELETE_EMAILS (separados por coma); vacío = falla cerrada.
const technicalDeleteEmails = (): string[] =>
  (Deno.env.get('TECHNICAL_DELETE_EMAILS') || '')
    .split(',')
    .map(normalizeEmail)
    .filter(Boolean);

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  try {
    const authorization = request.headers.get('Authorization') || '';
    if (!authorization.startsWith('Bearer ')) return json({ error: 'Sesión PMO requerida' }, 401);

    const payload = asRecord(await request.json().catch(() => null));
    const identifier = String(payload?.identifier || '').trim();
    const technicalKey = String(payload?.technicalKey || '').trim();
    if (!identifier) return json({ error: 'Identificador requerido' }, 400);

    const apiBaseUrl = pmoApiBaseUrl();
    const currentUser = await identifyUser(authorization, apiBaseUrl);
    if (!currentUser.email || !technicalDeleteEmails().includes(currentUser.email))
      return json({ error: 'No tienes autorización para la eliminación técnica' }, 403);

    if (!matchesSecret(technicalKey, Deno.env.get('PMO_TECHNICAL_DELETE_KEY') || ''))
      return json({ error: 'La clave técnica no es válida' }, 403);

    const report = await findOwnReport(authorization, apiBaseUrl, currentUser, identifier);
    if (!report) return json({ error: 'El reporte no pertenece al usuario actual' }, 403);

    await deletePmoReport(apiBaseUrl, await auditToken(apiBaseUrl), identifier);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error, 'No fue posible completar la eliminación técnica del reporte');
  }
});
