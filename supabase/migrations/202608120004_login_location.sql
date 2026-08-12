alter table public.pmo_user_directory
  add column if not exists last_latitude numeric(9,6),
  add column if not exists last_longitude numeric(9,6),
  add column if not exists last_location_accuracy_m numeric(10,2),
  add column if not exists last_location_status text,
  add column if not exists last_location_at timestamptz;

alter table public.pmo_login_events
  add column if not exists latitude numeric(9,6),
  add column if not exists longitude numeric(9,6),
  add column if not exists location_accuracy_m numeric(10,2),
  add column if not exists location_status text not null default 'not_requested',
  add column if not exists location_captured_at timestamptz;

drop function if exists public.record_pmo_login(text, text, text, text, text, text, text);

create function public.record_pmo_login(
  identity_key text,
  identity_external_id text,
  identity_email text,
  identity_username text,
  identity_name text,
  identity_role text,
  client_user_agent text,
  client_latitude numeric,
  client_longitude numeric,
  client_accuracy_m numeric,
  client_location_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_status text := case
    when client_location_status in ('granted', 'denied', 'unavailable', 'timeout', 'unsupported') then client_location_status
    else 'unavailable'
  end;
begin
  if client_latitude is not null and (client_latitude < -90 or client_latitude > 90) then
    raise exception 'Latitud inválida';
  end if;
  if client_longitude is not null and (client_longitude < -180 or client_longitude > 180) then
    raise exception 'Longitud inválida';
  end if;

  insert into public.pmo_user_directory (
    user_key, external_user_id, email, username, full_name, user_role, status,
    first_login_at, last_login_at, created_at, updated_at,
    last_latitude, last_longitude, last_location_accuracy_m, last_location_status, last_location_at
  ) values (
    identity_key, nullif(identity_external_id, ''), lower(identity_email), nullif(identity_username, ''),
    coalesce(nullif(identity_name, ''), lower(identity_email)), nullif(identity_role, ''), 'active',
    now(), now(), now(), now(), client_latitude, client_longitude, client_accuracy_m,
    normalized_status, case when normalized_status = 'granted' then now() else null end
  )
  on conflict (user_key) do update set
    external_user_id = coalesce(excluded.external_user_id, public.pmo_user_directory.external_user_id),
    email = excluded.email,
    username = coalesce(excluded.username, public.pmo_user_directory.username),
    full_name = excluded.full_name,
    user_role = coalesce(excluded.user_role, public.pmo_user_directory.user_role),
    last_login_at = now(), updated_at = now(),
    last_latitude = case when normalized_status = 'granted' then client_latitude else public.pmo_user_directory.last_latitude end,
    last_longitude = case when normalized_status = 'granted' then client_longitude else public.pmo_user_directory.last_longitude end,
    last_location_accuracy_m = case when normalized_status = 'granted' then client_accuracy_m else public.pmo_user_directory.last_location_accuracy_m end,
    last_location_status = normalized_status,
    last_location_at = case when normalized_status = 'granted' then now() else public.pmo_user_directory.last_location_at end;

  insert into public.pmo_login_events (
    user_key, event_type, occurred_at, user_agent, source,
    latitude, longitude, location_accuracy_m, location_status, location_captured_at
  ) values (
    identity_key, 'login', now(), nullif(left(client_user_agent, 500), ''), 'pmo-front',
    client_latitude, client_longitude, client_accuracy_m, normalized_status,
    case when normalized_status = 'granted' then now() else null end
  );
end;
$$;

revoke all on function public.record_pmo_login(text, text, text, text, text, text, text, numeric, numeric, numeric, text) from public, anon, authenticated;
grant execute on function public.record_pmo_login(text, text, text, text, text, text, text, numeric, numeric, numeric, text) to service_role;
