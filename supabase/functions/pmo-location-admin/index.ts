import { createClient } from 'npm:@supabase/supabase-js@2';

const PMO_USER_ENDPOINT =
  'https://wwz8sswbkh.execute-api.us-west-2.amazonaws.com/dev/home/datosusuario';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

const dateValue = (value: string | null, fallback: Date): string =>
  /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? String(value) : fallback.toISOString().slice(0, 10);

const bogotaBoundary = (value: string, nextDay = false): string => {
  const boundary = new Date(`${value}T05:00:00.000Z`);
  if (nextDay) boundary.setUTCDate(boundary.getUTCDate() + 1);
  return boundary.toISOString();
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'GET') return json({ error: 'Método no permitido' }, 405);

  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) return json({ error: 'Sesión PMO requerida' }, 401);

  const userResponse = await fetch(PMO_USER_ENDPOINT, {
    headers: { Authorization: authorization },
  });
  if (!userResponse.ok) return json({ error: 'La sesión PMO no es válida' }, 401);

  const user = await userResponse.json();
  const email = String(findValue(user, ['email', 'correo', 'mail', 'usuarioEmail']) || '')
    .trim()
    .toLowerCase();
  const admins = (Deno.env.get('LOCATION_ADMIN_EMAILS') || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (!email || !admins.includes(email)) return json({ error: 'Acceso restringido' }, 403);

  const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
  const secretKey = secretKeys.default;
  if (!secretKey) return json({ error: 'La clave secreta de Supabase no está configurada' }, 500);
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, secretKey, {
    auth: { persistSession: false },
  });

  const url = new URL(request.url);
  const nowBogota = new Date(Date.now() - 5 * 60 * 60 * 1000);
  const defaultFrom = new Date(nowBogota);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 29);
  const from = dateValue(url.searchParams.get('from'), defaultFrom);
  const to = dateValue(url.searchParams.get('to'), nowBogota);
  if (from > to) return json({ error: 'Rango de fechas inválido' }, 400);

  const [directoryResult, eventsResult] = await Promise.all([
    supabase
      .from('pmo_user_directory')
      .select(
        'user_key,email,full_name,username,home_latitude,home_longitude,home_radius_m,last_latitude,last_longitude,last_location_accuracy_m,last_location_status,last_distance_to_home_m,last_within_home_radius,last_verification_status,last_location_source,last_location_at',
      )
      .eq('status', 'active')
      .order('full_name', { ascending: true }),
    Promise.resolve({ data: [], error: null }),
  ]);

  if (directoryResult.error) return json({ error: directoryResult.error.message }, 500);
  if (eventsResult.error) return json({ error: eventsResult.error.message }, 500);
  return json({ consultants: directoryResult.data || [], events: eventsResult.data || [] });
});
