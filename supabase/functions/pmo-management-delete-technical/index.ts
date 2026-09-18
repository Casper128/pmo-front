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

const matchesSecret = (input: string, secret: string): boolean => {
  if (!input || !secret || input.length !== secret.length) return false;
  let diff = 0;
  for (let index = 0; index < input.length; index++) {
    diff |= input.charCodeAt(index) ^ secret.charCodeAt(index);
  }
  return diff === 0;
};

Deno.serve(async (request) => {
  try {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (request.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

    const authorization = request.headers.get('Authorization') || '';
    if (!authorization.startsWith('Bearer ')) return json({ error: 'Sesión PMO requerida' }, 401);

    const payload = asRecord(await request.json().catch(() => null));
    const identifier = String(payload?.identifier || '').trim();
    const technicalKey = String(payload?.technicalKey || '').trim();
    const requesterEmail = normalizeText(payload?.requesterEmail);
    if (!identifier) return json({ error: 'Identificador requerido' }, 400);

    const configuredKey = Deno.env.get('PMO_TECHNICAL_DELETE_KEY') || '';
    if (!matchesSecret(technicalKey, configuredKey)) {
      return json({ error: 'La clave técnica no es válida' }, 403);
    }

    const apiBaseUrl = (Deno.env.get('PMO_API_BASE_URL') || DEFAULT_PMO_API).replace(/\/$/, '');
    const userResponse = await fetch(`${apiBaseUrl}/home/datosusuario`, {
      headers: { Authorization: authorization },
    }).catch(() => null);
    if (!userResponse)
      return json({ error: 'No fue posible contactar el API PMO para validar la sesión' }, 502);
    if (!userResponse.ok) return json({ error: 'La sesión PMO no es válida' }, 401);

    const currentUser = await userResponse.json();
    const currentEmail = normalizeText(
      findValue(currentUser, [
        'email',
        'correo',
        'mail',
        'usuarioEmail',
        'username',
        'usuario',
        'login',
      ]),
    );
    if (requesterEmail && currentEmail && requesterEmail !== currentEmail) {
      return json({ error: 'El correo solicitante no coincide con la sesión actual' }, 403);
    }

    const auditEmail = Deno.env.get('PMO_AUDIT_EMAIL') || '';
    const auditPassword = Deno.env.get('PMO_AUDIT_PASSWORD') || '';
    if (!auditEmail || !auditPassword) {
      return json({ error: 'Las credenciales técnicas de auditoría no están configuradas' }, 500);
    }

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
    if (!auditLoginResponse.ok || !auditToken) {
      return json({ error: 'No fue posible autenticar el servicio de auditoría' }, 502);
    }

    const deleteResponse = await fetch(
      `${apiBaseUrl}/tiemposConsultores/tiempo/delete/${encodeURIComponent(identifier)}`,
      {
        method: 'DELETE',
        headers: {
          accept: '*/*',
          'accept-language': 'es',
          Authorization: `Bearer ${auditToken}`,
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
    console.error('pmo-management-delete-technical', error);
    return json({ error: 'No fue posible completar la eliminación técnica del reporte' }, 500);
  }
});
