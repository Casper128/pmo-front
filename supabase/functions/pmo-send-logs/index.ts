import { createClient } from 'npm:@supabase/supabase-js@2';

const RETENTION_DAYS = 90;
const PMO_USER_ENDPOINT =
  'https://wwz8sswbkh.execute-api.us-west-2.amazonaws.com/dev/home/datosusuario';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

const dateValue = (value: string | null, fallback: Date): string => {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '')
    ? String(value)
    : fallback.toISOString().slice(0, 10);
};

const startOfWeek = (date: Date): Date => {
  const result = new Date(date);
  const day = result.getUTCDay() || 7;
  result.setUTCDate(result.getUTCDate() - day + 1);
  return result;
};

const bogotaDate = (date: Date): Date => new Date(date.getTime() - 5 * 60 * 60 * 1000);

const bogotaBoundary = (value: string, nextDay = false): string => {
  const boundary = new Date(`${value}T05:00:00.000Z`);
  if (nextDay) boundary.setUTCDate(boundary.getUTCDate() + 1);
  return boundary.toISOString();
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Método no permitido' }, 405);

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
  const externalId = String(findValue(user, ['id', 'idUsuario', 'userId', 'codigo']) || '').trim();
  const username = String(findValue(user, ['username', 'usuario', 'login']) || '').trim();
  const fullName = String(
    findValue(user, ['nombre', 'name', 'nombres', 'nombreCompleto', 'fullName', 'usuario']) ||
      email,
  ).trim();
  const role = String(findValue(user, ['rol', 'role', 'perfil', 'tipoUsuario']) || '').trim();
  const proposedUserKey = (externalId || email).toLowerCase();
  if (!proposedUserKey || !email)
    return json({ error: 'No fue posible identificar al usuario PMO' }, 422);

  const admins = (Deno.env.get('CONFIG_ADMIN_EMAILS') || 'darwin.osorio@netwconsulting.com')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const isAdmin = admins.includes(email);
  const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
  const secretKey = secretKeys.default;
  if (!secretKey) return json({ error: 'La clave secreta de Supabase no está configurada' }, 500);
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, secretKey, {
    auth: { persistSession: false },
  });

  const { data: directoryUser, error: directoryLookupError } = await supabase
    .from('pmo_user_directory')
    .select('user_key')
    .eq('email', email)
    .maybeSingle();
  if (directoryLookupError) return json({ error: directoryLookupError.message }, 500);
  const userKey = String(directoryUser?.user_key || proposedUserKey).toLowerCase();

  await supabase.from('pmo_send_logs').delete().lt('expires_at', new Date().toISOString());

  if (request.method === 'GET') {
    const url = new URL(request.url);
    const now = bogotaDate(new Date());
    const oldest = new Date(now);
    oldest.setUTCDate(oldest.getUTCDate() - RETENTION_DAYS);
    const from = dateValue(url.searchParams.get('from'), oldest);
    const to = dateValue(url.searchParams.get('to'), now);
    const allUsers = isAdmin && url.searchParams.get('scope') === 'all';

    let query = supabase
      .from('pmo_send_logs')
      .select(
        'id,user_key,user_email,item_index,successful,reference,error_message,occurred_at,week_start,week_end,expires_at',
      )
      .gte('occurred_at', bogotaBoundary(from))
      .lt('occurred_at', bogotaBoundary(to, true))
      .order('occurred_at', { ascending: false })
      .limit(1000);
    if (!allUsers) query = query.eq('user_key', userKey);
    const { data, error } = await query;
    if (error) return json({ error: error.message }, 500);
    return json({ logs: data || [], isAdmin, retentionDays: RETENTION_DAYS });
  }

  const payload = await request.json().catch(() => ({}));
  const rawLogs = Array.isArray(payload?.logs) ? payload.logs : [payload];
  if (!rawLogs.length || rawLogs.length > 250)
    return json({ error: 'Cantidad de logs inválida' }, 400);

  const logs = rawLogs.map((raw: Record<string, unknown>) => ({
    itemIndex: Number(raw?.itemIndex),
    successful: raw?.successful === true,
    reference: String(raw?.reference || '')
      .trim()
      .slice(0, 250),
    errorMessage: String(raw?.errorMessage || '')
      .trim()
      .slice(0, 1000),
  }));
  if (
    logs.some(
      (log: { itemIndex: number; reference: string }) =>
        !log.reference || !Number.isInteger(log.itemIndex) || log.itemIndex < 0,
    )
  )
    return json({ error: 'Log de envío inválido' }, 400);

  const { error: directoryError } = await supabase.from('pmo_user_directory').upsert({
    user_key: userKey,
    external_user_id: externalId || null,
    email,
    username: username || null,
    full_name: fullName || email,
    user_role: role || null,
    status: 'active',
    updated_at: new Date().toISOString(),
  });
  if (directoryError) return json({ error: directoryError.message }, 500);

  const monday = startOfWeek(bogotaDate(new Date()));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + RETENTION_DAYS);
  const { error } = await supabase.from('pmo_send_logs').insert(
    logs.map(
      (log: {
        itemIndex: number;
        successful: boolean;
        reference: string;
        errorMessage: string;
      }) => ({
        user_key: userKey,
        user_email: email,
        item_index: log.itemIndex,
        successful: log.successful,
        reference: log.reference,
        error_message: log.errorMessage || null,
        week_start: monday.toISOString().slice(0, 10),
        week_end: sunday.toISOString().slice(0, 10),
        expires_at: expiresAt.toISOString(),
      }),
    ),
  );
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, saved: logs.length, userKey, retentionDays: RETENTION_DAYS });
});
