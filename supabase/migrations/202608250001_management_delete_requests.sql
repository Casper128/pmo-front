create table if not exists public.pmo_management_delete_requests (
  id uuid primary key default gen_random_uuid(),
  identifier text not null,
  requester_key text not null,
  requester_email text,
  auditor_email text,
  report jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text,
  review_note text
);

create index if not exists pmo_management_delete_requests_status_idx
  on public.pmo_management_delete_requests (status, requested_at desc);

create index if not exists pmo_management_delete_requests_requester_idx
  on public.pmo_management_delete_requests (requester_key, requested_at desc);

create unique index if not exists pmo_management_delete_requests_pending_identifier_idx
  on public.pmo_management_delete_requests (identifier)
  where status = 'pending';

alter table public.pmo_management_delete_requests enable row level security;

drop policy if exists "Management delete requests are service managed"
  on public.pmo_management_delete_requests;

create policy "Management delete requests are service managed"
  on public.pmo_management_delete_requests
  for all
  to service_role
  using (true)
  with check (true);

grant all on public.pmo_management_delete_requests to service_role;

comment on table public.pmo_management_delete_requests is
  'Solicitudes auditadas de eliminación de reportes enviados. El borrado real lo ejecuta auditoría.';
