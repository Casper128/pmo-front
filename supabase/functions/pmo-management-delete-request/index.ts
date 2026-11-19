import {
  HttpError,
  asRecord,
  auditEmail,
  auditToken,
  corsHeaders,
  deletePmoReport,
  errorResponse,
  findOwnReport,
  identifyUser,
  isAuditUser,
  json,
  pmoApiBaseUrl,
  secretClient,
} from '../_shared/pmo-session.ts';

type Notification = {
  recipient_key: string;
  kind: 'delete_request_created' | 'delete_request_approved' | 'delete_request_rejected';
  request_id: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
};

// Las notificaciones son best-effort: un fallo no debe invalidar la operación principal.
const notify = async (supabase: ReturnType<typeof secretClient>, notification: Notification) => {
  if (!notification.recipient_key) return;
  try {
    const { error } = await supabase
      .from('pmo_notifications')
      .upsert(notification, { onConflict: 'request_id,recipient_key,kind', ignoreDuplicates: true });
    if (error) console.error('pmo_notifications', error.message);
  } catch (error) {
    console.error('pmo_notifications', error);
  }
};

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authorization = request.headers.get('Authorization') || '';
    const apiBaseUrl = pmoApiBaseUrl();
    const currentUser = await identifyUser(authorization, apiBaseUrl);
    const supabase = secretClient();

    if (request.method === 'GET') {
      if (new URL(request.url).searchParams.get('scope') === 'mine') {
        const { data, error } = await supabase
          .from('pmo_management_delete_requests')
          .select('*')
          .eq('requester_key', currentUser.userKey)
          .gte('requested_at', new Date(Date.now() - NINETY_DAYS_MS).toISOString())
          .order('requested_at', { ascending: false });
        if (error) return json({ error: error.message }, 500);
        return json({ requests: data || [] });
      }

      if (!currentUser.email && currentUser.role !== 'admin')
        return json({ error: 'Usuario de auditoría requerido' }, 403);
      let query = supabase
        .from('pmo_management_delete_requests')
        .select('*')
        .eq('status', 'pending')
        .order('requested_at', { ascending: false });

      if (!isAuditUser(currentUser)) query = query.eq('auditor_email', currentUser.email);

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
      // El borrado con token técnico no acepta el auditor guardado en la fila (pudo elegirlo el cliente).
      const serverDelete = status === 'approved' && payload?.deleteReport === true;
      if (!isAuditUser(currentUser, serverDelete ? undefined : existing.data.auditor_email))
        return json({ error: 'Solo auditoría puede procesar la solicitud' }, 403);

      // Con `deleteReport:true` el servidor borra primero en PMO (404 = ya borrado) y luego aprueba.
      if (serverDelete) {
        try {
          await deletePmoReport(apiBaseUrl, await auditToken(apiBaseUrl), existing.data.identifier);
        } catch (error) {
          if (!(error instanceof HttpError && error.status === 404)) throw error;
        }
      }

      const reviewNote = String(payload?.reviewNote || '').trim() || null;
      const { data, error } = await supabase
        .from('pmo_management_delete_requests')
        .update({
          status,
          reviewed_at: new Date().toISOString(),
          reviewed_by: currentUser.email || currentUser.userKey,
          review_note: reviewNote,
        })
        .eq('id', id)
        .eq('status', 'pending')
        .select('*')
        .maybeSingle();

      if (error) return json({ error: error.message }, 500);
      if (!data) return json({ error: 'La solicitud ya fue procesada' }, 409);

      const approved = status === 'approved';
      await notify(supabase, {
        recipient_key: String(existing.data.requester_key || ''),
        kind: approved ? 'delete_request_approved' : 'delete_request_rejected',
        request_id: id,
        title: approved ? 'Eliminación aprobada' : 'Eliminación rechazada',
        body: `Reporte ${existing.data.identifier}${reviewNote ? `: ${reviewNote}` : ''}`,
        data: { identifier: existing.data.identifier, status, reviewNote },
      });
      return json({ request: data });
    }

    if (request.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

    const payload = asRecord(await request.json().catch(() => null));
    const identifier = String(payload?.identifier || '').trim();
    if (!identifier) return json({ error: 'Identificador requerido' }, 400);

    if (!(await findOwnReport(authorization, apiBaseUrl, currentUser, identifier)))
      return json({ error: 'El reporte no pertenece al usuario actual' }, 403);

    const pendingColumns = 'id,identifier,status,requested_at,auditor_email';
    const findPending = () =>
      supabase
        .from('pmo_management_delete_requests')
        .select(pendingColumns)
        .eq('identifier', identifier)
        .eq('status', 'pending')
        .maybeSingle();

    const existing = await findPending();
    if (existing.error) return json({ error: existing.error.message }, 500);
    if (existing.data) return json({ request: existing.data, duplicated: true });

    const { data, error } = await supabase
      .from('pmo_management_delete_requests')
      .insert({
        identifier,
        requester_key: currentUser.userKey,
        requester_email: currentUser.email || null,
        auditor_email: auditEmail() || null,
        report: asRecord(payload?.report) || {},
        status: 'pending',
      })
      .select(pendingColumns)
      .single();

    if (error?.code === '23505') {
      const raced = await findPending();
      if (raced.data) return json({ request: raced.data, duplicated: true });
    }
    if (error) return json({ error: error.message }, 500);

    await notify(supabase, {
      recipient_key: auditEmail(),
      kind: 'delete_request_created',
      request_id: data.id,
      title: 'Nueva solicitud de eliminación',
      body: `${currentUser.email || currentUser.userKey} solicita eliminar el reporte ${identifier}`,
      data: { identifier, requesterEmail: currentUser.email || null },
    });
    return json({ request: data });
  } catch (error) {
    return errorResponse(error);
  }
});
