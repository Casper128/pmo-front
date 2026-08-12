alter table public.pmo_user_directory
  add column if not exists username text;

drop function if exists public.record_pmo_login(text, text, text, text, text, text);

create function public.record_pmo_login(
  identity_key text,
  identity_external_id text,
  identity_email text,
  identity_username text,
  identity_name text,
  identity_role text,
  client_user_agent text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.pmo_user_directory (
    user_key, external_user_id, email, username, full_name, user_role, status,
    first_login_at, last_login_at, created_at, updated_at
  ) values (
    identity_key,
    nullif(identity_external_id, ''),
    lower(identity_email),
    nullif(identity_username, ''),
    coalesce(nullif(identity_name, ''), lower(identity_email)),
    nullif(identity_role, ''),
    'active',
    now(), now(), now(), now()
  )
  on conflict (user_key) do update set
    external_user_id = coalesce(excluded.external_user_id, public.pmo_user_directory.external_user_id),
    email = excluded.email,
    username = coalesce(excluded.username, public.pmo_user_directory.username),
    full_name = excluded.full_name,
    user_role = coalesce(excluded.user_role, public.pmo_user_directory.user_role),
    last_login_at = now(),
    updated_at = now();

  insert into public.pmo_login_events (user_key, event_type, occurred_at, user_agent, source)
  values (identity_key, 'login', now(), nullif(left(client_user_agent, 500), ''), 'pmo-front');
end;
$$;

revoke all on function public.record_pmo_login(text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.record_pmo_login(text, text, text, text, text, text, text) to service_role;
