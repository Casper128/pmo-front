create table if not exists public.pmo_management_templates (
  user_key text not null,
  gestion_id text not null,
  gestion_name text not null,
  client text,
  project text,
  field_values jsonb not null default '{}'::jsonb,
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_key, gestion_id)
);

alter table public.pmo_management_templates
  add column if not exists completed boolean not null default false;

alter table public.pmo_management_templates enable row level security;

drop policy if exists "Management templates are service managed" on public.pmo_management_templates;
create policy "Management templates are service managed"
  on public.pmo_management_templates
  for all
  to service_role
  using (true)
  with check (true);

grant all on public.pmo_management_templates to service_role;
