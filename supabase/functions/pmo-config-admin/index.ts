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
    const [personalResult, optionsResult, settingsResult] = await Promise.all([
      supabase
        .from('pmo_user_configurations')
        .select('field_config')
        .eq('user_key', userKey)
        .maybeSingle(),
      supabase
        .from('pmo_field_options')
        .select('field_key,option_value,option_label,active,sort_order,is_default')
        .order('field_key')
        .order('sort_order'),
      supabase
        .from('pmo_app_settings')
        .select('monday_thursday_hours,friday_hours,max_daily_labor_hours,max_hours_per_record')
        .eq('id', 'global')
        .maybeSingle(),
    ]);
    const readError = personalResult.error || optionsResult.error || settingsResult.error;
    if (readError) return json({ error: readError.message }, 500);
    return json({
      fields: personalResult.data?.field_config || null,
      optionRows: optionsResult.data || [],
      workSettings: settingsResult.data || null,
      isAdmin,
      user: { key: userKey, email },
    });
  }

  const payload = await request.json();
  if (!Array.isArray(payload?.fields)) return json({ error: 'Configuración inválida' }, 400);

  const { error: personalSaveError } = await supabase.from('pmo_user_configurations').upsert({
    user_key: userKey,
    user_email: email,
    field_config: payload.fields,
    updated_at: new Date().toISOString(),
  });
  if (personalSaveError) return json({ error: personalSaveError.message }, 500);

  if (isAdmin && payload?.workSettings) {
    const { error: settingsSaveError } = await supabase.from('pmo_app_settings').upsert({
      id: 'global',
      monday_thursday_hours: payload.workSettings.mondayThursdayHours,
      friday_hours: payload.workSettings.fridayHours,
      max_daily_labor_hours: payload.workSettings.maxDailyLaborHours,
      max_hours_per_record: payload.workSettings.maxHoursPerRecord,
      updated_at: new Date().toISOString(),
    });
    if (settingsSaveError) return json({ error: settingsSaveError.message }, 500);
  }

  return json({ ok: true, updatedBy: email, isAdmin });
});
