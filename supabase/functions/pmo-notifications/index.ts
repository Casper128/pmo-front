import {
  asRecord,
  corsHeaders,
  errorResponse,
  identifyUser,
  json,
  pmoApiBaseUrl,
  secretClient,
} from '../_shared/pmo-session.ts';

const READ_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_LIMIT = 50;
const MAX_IDS = 100;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'GET' && request.method !== 'POST')
    return json({ error: 'Método no permitido' }, 405);

  try {
    const currentUser = await identifyUser(
      request.headers.get('Authorization') || '',
      pmoApiBaseUrl(),
    );
    const supabase = secretClient();
    // El destinatario es el id del usuario PMO o su correo (la cuenta de auditoría se notifica por correo).
    const recipients = [...new Set([currentUser.userKey, currentUser.email].filter(Boolean))];

    if (request.method === 'GET') {
      const params = new URL(request.url).searchParams;
      const limit = Math.min(Math.max(Number(params.get('limit')) || 20, 1), MAX_LIMIT);

      // Purga perezosa de las notificaciones propias leídas hace más de 30 días.
      await supabase
        .from('pmo_notifications')
        .delete()
        .in('recipient_key', recipients)
        .not('read_at', 'is', null)
        .lt('read_at', new Date(Date.now() - READ_RETENTION_MS).toISOString());

      let query = supabase
        .from('pmo_notifications')
        .select('id,kind,request_id,title,body,data,created_at,read_at')
        .in('recipient_key', recipients)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (params.get('unread') === '1') query = query.is('read_at', null);

      const [list, unread] = await Promise.all([
        query,
        supabase
          .from('pmo_notifications')
          .select('id', { count: 'exact', head: true })
          .in('recipient_key', recipients)
          .is('read_at', null),
      ]);
      const failure = list.error || unread.error;
      if (failure) return json({ error: failure.message }, 500);
      return json({ notifications: list.data || [], unreadCount: unread.count ?? 0 });
    }

    const payload = asRecord(await request.json().catch(() => null));
    const ids = Array.isArray(payload?.ids) ? payload.ids.map((id) => String(id)) : [];
    if (payload?.all !== true && !ids.length) return json({ error: 'ids o all requerido' }, 400);
    if (ids.length > MAX_IDS || ids.some((id) => !UUID.test(id)))
      return json({ error: 'ids inválidos (uuid, máximo 100)' }, 400);

    let update = supabase
      .from('pmo_notifications')
      .update({ read_at: new Date().toISOString() })
      .in('recipient_key', recipients)
      .is('read_at', null);
    if (payload?.all !== true) update = update.in('id', ids);

    const { error } = await update;
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
});
