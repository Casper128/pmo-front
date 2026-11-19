create table if not exists public.pmo_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_key text not null,
  kind text not null
    check (kind in ('delete_request_created', 'delete_request_approved', 'delete_request_rejected')),
  request_id uuid not null references public.pmo_management_delete_requests (id) on delete cascade,
  title text not null,
  body text not null default '',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (request_id, recipient_key, kind)
);

create index if not exists pmo_notifications_recipient_idx
  on public.pmo_notifications (recipient_key, created_at desc);

create index if not exists pmo_notifications_unread_idx
  on public.pmo_notifications (recipient_key, created_at desc)
  where read_at is null;

alter table public.pmo_notifications enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'pmo_notifications'
      and policyname = 'Notifications are service managed'
  ) then
    create policy "Notifications are service managed"
      on public.pmo_notifications
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end
$$;

grant all on public.pmo_notifications to service_role;

comment on table public.pmo_notifications is
  'Notificaciones de solicitudes de eliminación. Se leen y marcan solo vía la función pmo-notifications.';
