import { createClient } from 'npm:@supabase/supabase-js@2';

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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) return json({ error: 'Sesión PMO requerida' }, 401);

  const userResponse = await fetch(
    'https://wwz8sswbkh.execute-api.us-west-2.amazonaws.com/dev/home/datosusuario',
    {
      headers: { Authorization: authorization },
    },
  );
  if (!userResponse.ok) return json({ error: 'La sesión PMO no es válida' }, 401);

  const user = await userResponse.json();
  const email = String(findValue(user, ['email', 'correo', 'mail', 'usuarioEmail']) || '')
    .trim()
    .toLowerCase();
  const externalId = String(findValue(user, ['id', 'idUsuario', 'userId', 'codigo']) || '').trim();
  const username = String(findValue(user, ['username', 'usuario', 'login']) || '').trim();
  const fullName = String(
    findValue(user, ['nombre', 'name', 'nombres', 'nombreCompleto', 'fullName', 'usuario']) ||
      email,
  ).trim();
  const role = String(findValue(user, ['rol', 'role', 'perfil', 'tipoUsuario']) || '').trim();
  const userKey = (externalId || email).toLowerCase();
  if (!userKey || !email) return json({ error: 'No fue posible identificar al usuario PMO' }, 422);

  const payload = await request.json().catch(() => ({}));
  const allowedStatuses = new Set(['granted', 'denied', 'unavailable', 'timeout', 'unsupported']);
  const locationStatus = allowedStatuses.has(payload?.locationStatus)
    ? payload.locationStatus
    : 'unavailable';
  const latitude =
    typeof payload?.latitude === 'number' && payload.latitude >= -90 && payload.latitude <= 90
      ? payload.latitude
      : null;
  const longitude =
    typeof payload?.longitude === 'number' && payload.longitude >= -180 && payload.longitude <= 180
      ? payload.longitude
      : null;
  const accuracy =
    typeof payload?.accuracy === 'number' && payload.accuracy >= 0
      ? Math.min(payload.accuracy, 1000000)
      : null;

  const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
  const secretKey = secretKeys.default;
  if (!secretKey) return json({ error: 'La clave secreta de Supabase no está configurada' }, 500);
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, secretKey, {
    auth: { persistSession: false },
  });
  if (payload?.eventType === 'time_report') {
    const { error } = await supabase.rpc('upsert_pmo_latest_location', {
      identity_key: userKey,
      client_latitude: latitude,
      client_longitude: longitude,
      client_accuracy_m: accuracy,
      client_location_status: locationStatus,
      location_source: 'time_report',
    });
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, eventType: 'time_report' });
  }
  const { error } = await supabase.rpc('record_pmo_login', {
    identity_key: userKey,
    identity_external_id: externalId,
    identity_email: email,
    identity_username: username,
    identity_name: fullName,
    identity_role: role,
    client_user_agent: request.headers.get('user-agent') || '',
    client_latitude: latitude,
    client_longitude: longitude,
    client_accuracy_m: accuracy,
    client_location_status: locationStatus,
  });
  if (error) return json({ error: error.message }, 500);
  const { error: locationError } = await supabase.rpc('upsert_pmo_latest_location', {
    identity_key: userKey,
    client_latitude: latitude,
    client_longitude: longitude,
    client_accuracy_m: accuracy,
    client_location_status: locationStatus,
    location_source: 'login',
  });
  if (locationError) return json({ error: locationError.message }, 500);
  return json({ ok: true });
});
