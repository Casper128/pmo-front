const DEFAULT_PMO_API = 'https://wwz8sswbkh.execute-api.us-west-2.amazonaws.com/dev';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;

const findValue = (value: unknown, keys: string[]): unknown => {
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

const normalizeText = (value: unknown): string =>
  String(value || '')
    .trim()
    .toLowerCase();

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

Deno.serve(async (request) => {
  try {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (request.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

    const authorization = request.headers.get('Authorization') || '';
    if (!authorization.startsWith('Bearer ')) return json({ error: 'Sesión PMO requerida' }, 401);

    const apiBaseUrl = (Deno.env.get('PMO_API_BASE_URL') || DEFAULT_PMO_API).replace(/\/$/, '');
    const userResponse = await fetch(`${apiBaseUrl}/home/datosusuario`, {
      headers: { Authorization: authorization },
    }).catch(() => null);
    if (!userResponse)
      return json({ error: 'No fue posible contactar el API PMO para validar la sesión' }, 502);
    if (!userResponse.ok) return json({ error: 'La sesión PMO no es válida' }, 401);

    const currentUser = await userResponse.json();
    const consultantId = findValue(currentUser, ['id', 'idUsuario', 'userId', 'codigo']);
    if (consultantId === undefined)
      return json({ error: 'No fue posible identificar al consultor' }, 422);

    const payload = asRecord(await request.json().catch(() => null));
    const identifier = String(payload?.identifier || '').trim();
    if (!identifier) return json({ error: 'Identificador requerido' }, 400);

    const auditEmail = Deno.env.get('PMO_AUDIT_EMAIL') || '';
    const auditPassword = Deno.env.get('PMO_AUDIT_PASSWORD') || '';
    const currentEmail = findValue(currentUser, [
      'email',
      'correo',
      'mail',
      'usuarioEmail',
      'username',
      'usuario',
      'login',
    ]);
    const isAuditSession =
      !!auditEmail && normalizeText(currentEmail) === normalizeText(auditEmail);

    if (!isAuditSession) {
      const reportsResponse = await fetch(`${apiBaseUrl}/tiemposConsultores/gestion`, {
        method: 'POST',
        headers: { Authorization: authorization, 'Content-Type': 'application/json' },
        body: JSON.stringify({ idConsultor: consultantId }),
      }).catch(() => null);
      if (!reportsResponse)
        return json({ error: 'No fue posible contactar el API PMO para validar el reporte' }, 502);
      if (!reportsResponse.ok) return json({ error: 'No fue posible validar el reporte' }, 502);

      const reports = extractRows(await reportsResponse.json());
      const ownsReport = reports.some((report) => String(report.identificador || '') === identifier);
      if (!ownsReport) return json({ error: 'El reporte no pertenece al usuario actual' }, 403);
    }

    let deleteAuthorization = authorization;
    if (!isAuditSession) {
      if (!auditEmail || !auditPassword)
        return json({ error: 'Las credenciales técnicas de auditoría no están configuradas' }, 500);

      const auditLoginResponse = await fetch(`${apiBaseUrl}/cuentas/authenticate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: auditEmail, password: auditPassword }),
      }).catch(() => null);
      if (!auditLoginResponse)
        return json({ error: 'No fue posible contactar el API PMO para autenticar auditoría' }, 502);
      const auditLogin = await auditLoginResponse.json().catch(() => ({}));
      const auditToken = String(
        findValue(auditLogin, ['token', 'jwtToken', 'key', 'accessToken']) || '',
      );
      if (!auditLoginResponse.ok || !auditToken)
        return json({ error: 'No fue posible autenticar el servicio de auditoría' }, 502);

      deleteAuthorization = `Bearer ${auditToken}`;
    }

    const deleteResponse = await fetch(
      `${apiBaseUrl}/tiemposConsultores/tiempo/delete/${encodeURIComponent(identifier)}`,
      {
        method: 'DELETE',
        headers: {
          accept: '*/*',
          'accept-language': 'es',
          Authorization: deleteAuthorization,
          'cache-control': 'no-cache',
          'Content-Type': 'application/json',
          pragma: 'no-cache',
        },
      },
    ).catch(() => null);
    if (!deleteResponse)
      return json({ error: 'No fue posible contactar el API PMO para eliminar el reporte' }, 502);
    if (!deleteResponse.ok) {
      const errorBody = await deleteResponse.json().catch(() => ({}));
      const message = String(findValue(errorBody, ['mensaje', 'message', 'error']) || '');
      return json(
        { error: message || 'El API de tiempos rechazó la eliminación' },
        deleteResponse.status,
      );
    }

    return json({ ok: true });
  } catch (error) {
    console.error('pmo-management-delete', error);
    return json({ error: 'No fue posible completar la eliminación del reporte' }, 500);
  }
});
