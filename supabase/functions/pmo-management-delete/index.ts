import {
  asRecord,
  auditEmail,
  auditToken,
  corsHeaders,
  deletePmoReport,
  errorResponse,
  findOwnReport,
  identifyUser,
  isAuditUser,
  json,
  pmoApiBaseUrl,
  reportDayKey,
  todayInBogota,
} from '../_shared/pmo-session.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  try {
    const authorization = request.headers.get('Authorization') || '';
    const apiBaseUrl = pmoApiBaseUrl();
    const currentUser = await identifyUser(authorization, apiBaseUrl);

    const payload = asRecord(await request.json().catch(() => null));
    const identifier = String(payload?.identifier || '').trim();
    if (!identifier) return json({ error: 'Identificador requerido' }, 400);

    // Auditoría borra siempre; el dueño solo registros de hoy (America/Bogota).
    if (!isAuditUser(currentUser)) {
      const report = await findOwnReport(authorization, apiBaseUrl, currentUser, identifier);
      if (!report) return json({ error: 'El reporte no pertenece al usuario actual' }, 403);
      if (reportDayKey(report) !== todayInBogota())
        return json(
          {
            error:
              'Solo puedes eliminar directamente registros de hoy; solicita la eliminación a auditoría',
          },
          403,
        );
    }

    // La sesión de la cuenta técnica borra con su propio token; cualquier otro auditor usa el técnico.
    const bearer = authorization.slice('Bearer '.length);
    const sessionIsTechnical = !!currentUser.email && currentUser.email === auditEmail();
    await deletePmoReport(apiBaseUrl, sessionIsTechnical ? bearer : await auditToken(apiBaseUrl), identifier);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error, 'No fue posible completar la eliminación del reporte');
  }
});
