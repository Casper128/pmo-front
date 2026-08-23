import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const findValue = (value: unknown, keys: string[]): unknown => {
  if (!value || typeof value !== 'object') return '';
  const object = value as Record<string, unknown>;
  for (const key of keys)
    if (object[key] !== undefined && object[key] !== null && object[key] !== '') return object[key];
  for (const child of Object.values(object)) {
    const found = findValue(child, keys);
    if (found !== '') return found;
  }
  return '';
};

const identifyUser = async (authorization: string) => {
  if (!authorization.startsWith('Bearer ')) throw new Error('Sesión PMO requerida');
  const userResponse = await fetch(
    'https://wwz8sswbkh.execute-api.us-west-2.amazonaws.com/dev/home/datosusuario',
    { headers: { Authorization: authorization } },
  );
  if (!userResponse.ok) throw new Error('La sesión PMO no es válida');
  const user = await userResponse.json();
  const email = String(findValue(user, ['email', 'correo', 'mail', 'usuarioEmail']) || '')
    .trim()
    .toLowerCase();
  const userId = String(findValue(user, ['id', 'idUsuario', 'userId', 'codigo']) || '').trim();
  const userKey = (userId || email).toLowerCase();
  if (!userKey) throw new Error('No fue posible identificar al usuario PMO');
  return { userKey, email };
};

const toTemplate = (row: Record<string, unknown>) => ({
  gestionId: String(row.gestion_id || ''),
  gestionName: String(row.gestion_name || row.gestion_id || ''),
  client: row.client ? String(row.client) : undefined,
  project: row.project ? String(row.project) : undefined,
  values: row.field_values || {},
  completed: row.completed === true,
  updatedAt: row.updated_at,
});

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (!['GET', 'POST', 'DELETE'].includes(request.method)) {
    return json({ error: 'Método no permitido' }, 405);
  }

  try {
    const authorization = request.headers.get('Authorization') || '';
    const { userKey } = await identifyUser(authorization);
    const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
    const secretKey = secretKeys.default;
    if (!secretKey) return json({ error: 'La clave secreta de Supabase no está configurada' }, 500);
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, secretKey, {
      auth: { persistSession: false },
    });

    if (request.method === 'GET') {
      const url = new URL(request.url);
      const gestionId = url.searchParams.get('gestionId');
      let query = supabase
        .from('pmo_management_templates')
        .select('gestion_id,gestion_name,client,project,field_values,completed,updated_at')
        .eq('user_key', userKey)
        .order('gestion_name');
      if (gestionId) query = query.eq('gestion_id', gestionId);
      const { data, error } = await query;
      if (error) return json({ error: error.message }, 500);
      const templates = (data || []).map((row) => toTemplate(row));
      return gestionId ? json({ template: templates[0] || null }) : json({ templates });
    }

    const payload = await request.json();
    const gestionId = String(payload?.gestionId || '').trim();
    if (!gestionId) return json({ error: 'gestionId es requerido' }, 400);

    if (request.method === 'DELETE') {
      const { error } = await supabase
        .from('pmo_management_templates')
        .delete()
        .eq('user_key', userKey)
        .eq('gestion_id', gestionId);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    const row = {
      user_key: userKey,
      gestion_id: gestionId,
      gestion_name: String(payload.gestionName || gestionId),
      client: payload.client ? String(payload.client) : null,
      project: payload.project ? String(payload.project) : null,
      field_values: payload.values || {},
      completed: payload.completed === true,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('pmo_management_templates')
      .upsert(row)
      .select('gestion_id,gestion_name,client,project,field_values,completed,updated_at')
      .single();
    if (error) return json({ error: error.message }, 500);
    return json({ template: toTemplate(data) });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Error inesperado' }, 401);
  }
});
