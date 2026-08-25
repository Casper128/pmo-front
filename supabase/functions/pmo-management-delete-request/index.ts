import { createClient } from 'npm:@supabase/supabase-js@2';

const DEFAULT_PMO_API = 'https://wwz8sswbkh.execute-api.us-west-2.amazonaws.com/dev';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Max-Age': '86400',
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

const normalizeEmail = (value: unknown): string =>
  String(value || '')
    .trim()
    .toLowerCase();

const identifyUser = async (authorization: string, apiBaseUrl: string) => {
  if (!authorization.startsWith('Bearer ')) throw new Error('Sesión PMO requerida');
  const userResponse = await fetch(`${apiBaseUrl}/home/datosusuario`, {
    headers: { Authorization: authorization },
  }).catch(() => null);
  if (!userResponse) throw new Error('No fue posible contactar el API PMO para validar la sesión');
  if (!userResponse.ok) throw new Error('La sesión PMO no es válida');
  const user = await userResponse.json();
  const userId = String(findValue(user, ['id', 'idUsuario', 'userId', 'codigo']) || '').trim();
  const email = normalizeEmail(findValue(user, ['email', 'correo', 'mail', 'usuarioEmail']));
  const role = normalizeEmail(findValue(user, ['role', 'rol', 'perfil', 'tipoUsuario']));
  const userKey = (userId || email).toLowerCase();
  if (!userKey) throw new Error('No fue posible identificar al usuario PMO');
  return { userKey, userId, email, role };
};

const secretClient = () => {
  const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
  const secretKey = secretKeys.default;
  if (!secretKey) throw new Error('La clave secreta de Supabase no está configurada');
  return createClient(Deno.env.get('SUPABASE_URL')!, secretKey, {
    auth: { persistSession: false },
  });
};

const isAuditUser = (currentEmail: string, currentRole: string, auditorEmail?: unknown): boolean => {
  const configuredAuditor = normalizeEmail(Deno.env.get('PMO_AUDIT_EMAIL'));
  const rowAuditor = normalizeEmail(auditorEmail);
  return (
    currentRole === 'admin' ||
    currentRole.includes('auditor') ||
    (!!currentEmail && (currentEmail === configuredAuditor || currentEmail === rowAuditor))
  );
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authorization = request.headers.get('Authorization') || '';
    const apiBaseUrl = (Deno.env.get('PMO_API_BASE_URL') || DEFAULT_PMO_API).replace(/\/$/, '');
    const currentUser = await identifyUser(authorization, apiBaseUrl);
    const supabase = secretClient();

    if (request.method === 'GET') {
      if (!currentUser.email && currentUser.role !== 'admin')
        return json({ error: 'Usuario de auditoría requerido' }, 403);
      const configuredAuditor = normalizeEmail(Deno.env.get('PMO_AUDIT_EMAIL'));
      let query = supabase
        .from('pmo_management_delete_requests')
        .select('*')
        .eq('status', 'pending')
        .order('requested_at', { ascending: false });

      if (currentUser.role !== 'admin' && !currentUser.role.includes('auditor') && currentUser.email !== configuredAuditor) {
        query = query.eq('auditor_email', currentUser.email);
      }

      const { data, error } = await query;
      if (error) return json({ error: error.message }, 500);
      return json({ requests: data || [] });
    }

    if (request.method === 'PATCH') {
      const payload = asRecord(await request.json().catch(() => null));
      const id = String(payload?.id || '').trim();
      const status = String(payload?.status || '').trim();
      if (!id) return json({ error: 'Solicitud requerida' }, 400);
      if (status !== 'approved' && status !== 'rejected')
        return json({ error: 'Estado no permitido' }, 400);

      const existing = await supabase
        .from('pmo_management_delete_requests')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (existing.error) return json({ error: existing.error.message }, 500);
      if (!existing.data) return json({ error: 'Solicitud no encontrada' }, 404);
      if (existing.data.status !== 'pending')
        return json({ error: 'La solicitud ya fue procesada' }, 409);
      if (!isAuditUser(currentUser.email, currentUser.role, existing.data.auditor_email))
        return json({ error: 'Solo auditoría puede procesar la solicitud' }, 403);

      const { data, error } = await supabase
        .from('pmo_management_delete_requests')
        .update({
          status,
          reviewed_at: new Date().toISOString(),
          reviewed_by: currentUser.email || currentUser.userKey,
          review_note: String(payload?.reviewNote || '').trim() || null,
        })
        .eq('id', id)
        .select('*')
        .single();

      if (error) return json({ error: error.message }, 500);
      return json({ request: data });
    }

    if (request.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

    const payload = asRecord(await request.json().catch(() => null));
    const identifier = String(payload?.identifier || '').trim();
    if (!identifier) return json({ error: 'Identificador requerido' }, 400);

    const reportsResponse = await fetch(`${apiBaseUrl}/tiemposConsultores/gestion`, {
      method: 'POST',
      headers: { Authorization: authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify({ idConsultor: currentUser.userId || currentUser.userKey }),
    }).catch(() => null);
    if (!reportsResponse)
      return json({ error: 'No fue posible contactar el API PMO para validar el reporte' }, 502);
    if (!reportsResponse.ok) return json({ error: 'No fue posible validar el reporte' }, 502);

    const reports = extractRows(await reportsResponse.json());
    const ownsReport = reports.some((report) => String(report.identificador || '') === identifier);
    if (!ownsReport) return json({ error: 'El reporte no pertenece al usuario actual' }, 403);

    const auditorEmail =
      normalizeEmail(payload?.auditorEmail) || normalizeEmail(Deno.env.get('PMO_AUDIT_EMAIL'));
    const report = asRecord(payload?.report) || {};
    const existing = await supabase
      .from('pmo_management_delete_requests')
      .select('id,identifier,status,requested_at,auditor_email')
      .eq('identifier', identifier)
      .eq('status', 'pending')
      .maybeSingle();

    if (existing.error) return json({ error: existing.error.message }, 500);
    if (existing.data) return json({ request: existing.data, duplicated: true });

    const { data, error } = await supabase
      .from('pmo_management_delete_requests')
      .insert({
        identifier,
        requester_key: currentUser.userKey,
        requester_email: currentUser.email || null,
        auditor_email: auditorEmail || null,
        report,
        status: 'pending',
      })
      .select('id,identifier,status,requested_at,auditor_email')
      .single();

    if (error) return json({ error: error.message }, 500);
    return json({ request: data });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Error inesperado' }, 500);
  }
});
