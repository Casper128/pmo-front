create table if not exists public.pmo_user_configurations (
  user_key text primary key,
  user_email text not null,
  field_config jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.pmo_user_configurations enable row level security;

-- La identidad PMO se valida en la Edge Function; no se permite lectura REST pública.
revoke all on table public.pmo_user_configurations from public, anon, authenticated;

create index if not exists pmo_user_configurations_email_idx
  on public.pmo_user_configurations (lower(user_email));
