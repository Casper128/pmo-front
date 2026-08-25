import { createClient } from 'npm:@supabase/supabase-js@2';

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

const defaultDailyHours: Record<number, number> = {
  0: 0,
  1: 9,
  2: 9,
  3: 9,
  4: 9,
  5: 8,
  6: 0,
};

const validHours = (value: unknown, allowZero: boolean): value is number => {
  const numericValue = Number(value);
  return (
    Number.isFinite(numericValue) &&
    numericValue <= 24 &&
    (allowZero ? numericValue >= 0 : numericValue > 0)
  );
};

const sanitizeWorkSettings = (value: unknown) => {
  if (!value || typeof value !== 'object') return null;
  const settings = value as Record<string, unknown>;
  const sourceDaily =
    settings.dailyHours && typeof settings.dailyHours === 'object'
      ? (settings.dailyHours as Record<string, unknown>)
      : settings.daily_hours && typeof settings.daily_hours === 'object'
        ? (settings.daily_hours as Record<string, unknown>)
        : {};
  const legacyMondayThursday = validHours(settings.mondayThursdayHours, true)
    ? Number(settings.mondayThursdayHours)
    : defaultDailyHours[1];
  const legacyFriday = validHours(settings.fridayHours, true)
    ? Number(settings.fridayHours)
    : defaultDailyHours[5];
  const dailyHours = Object.fromEntries(
    [0, 1, 2, 3, 4, 5, 6].map((day) => {
      const fallback = day === 0 || day === 6 ? 0 : day === 5 ? legacyFriday : legacyMondayThursday;
      return [day, sourceDaily[day] ?? fallback];
    }),
  ) as Record<number, unknown>;
  const invalidDays = Object.entries(dailyHours)
    .filter(([, hours]) => !validHours(hours, true))
    .map(([day]) => day);
  if (invalidDays.length) return null;
  if (!validHours(settings.maxDailyLaborHours, false)) return null;
  if (!validHours(settings.maxHoursPerRecord, false)) return null;
  return {
    mondayThursdayHours: Number(dailyHours[1]),
    fridayHours: Number(dailyHours[5]),
    dailyHours: Object.fromEntries(
      Object.entries(dailyHours).map(([day, hours]) => [day, Number(hours)]),
    ),
    maxDailyLaborHours: Number(settings.maxDailyLaborHours),
    maxHoursPerRecord: Number(settings.maxHoursPerRecord),
  };
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Método no permitido' }, 405);

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
  const userId = String(findValue(user, ['id', 'idUsuario', 'userId', 'codigo']) || '').trim();
  const userKey = (userId || email).toLowerCase();
  if (!userKey || !email) return json({ error: 'No fue posible identificar al usuario PMO' }, 401);

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

  if (request.method === 'GET') {
    const [optionsResult, settingsResult] = await Promise.all([
      supabase
        .from('pmo_field_options')
        .select('field_key,option_value,option_label,active,sort_order,is_default')
        .order('field_key')
        .order('sort_order'),
      supabase
        .from('pmo_app_settings')
        .select(
          'monday_thursday_hours,friday_hours,daily_hours,max_daily_labor_hours,max_hours_per_record',
        )
        .eq('id', 'global')
        .maybeSingle(),
    ]);
    const readError = optionsResult.error || settingsResult.error;
    if (readError) return json({ error: readError.message }, 500);
    return json({
      optionRows: optionsResult.data || [],
      workSettings: settingsResult.data || null,
      isAdmin,
      user: { key: userKey, email },
    });
  }

  if (!isAdmin)
    return json({ error: 'Solo el administrador puede modificar la configuración' }, 403);

  const payload = await request.json();
  if (!Array.isArray(payload?.fields)) return json({ error: 'Configuración inválida' }, 400);
  const workSettings = sanitizeWorkSettings(payload?.workSettings);
  if (!workSettings) {
    return json(
      {
        error:
          'La jornada debe usar valores entre 0 y 24 horas; los límites deben estar entre 1 y 24 horas.',
      },
      400,
    );
  }

  const { error: saveError } = await supabase.rpc('replace_pmo_configuration', {
    field_config: payload.fields,
    work_config: workSettings,
  });
  if (saveError) return json({ error: saveError.message }, 500);

  return json({ ok: true, updatedBy: email, isAdmin });
});
