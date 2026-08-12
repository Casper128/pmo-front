create table if not exists public.pmo_send_logs (
  id uuid primary key default gen_random_uuid(),
  user_key text not null references public.pmo_user_directory(user_key) on update cascade on delete restrict,
  user_email text not null,
  item_index integer not null check (item_index >= 0),
  successful boolean not null,
  reference text not null,
  error_message text,
  occurred_at timestamptz not null default now(),
  week_start date not null,
  week_end date not null,
  expires_at timestamptz not null default (now() + interval '90 days'),
  source text not null default 'pmo-front'
);

create index if not exists pmo_send_logs_user_time_idx
  on public.pmo_send_logs (user_key, occurred_at desc);

create index if not exists pmo_send_logs_expiry_idx
  on public.pmo_send_logs (expires_at);

create index if not exists pmo_send_logs_success_time_idx
  on public.pmo_send_logs (successful, occurred_at desc);

alter table public.pmo_send_logs enable row level security;

revoke all on table public.pmo_send_logs from public, anon, authenticated;

comment on table public.pmo_send_logs is
  'Trazabilidad mínima de envíos PMO. No almacena contraseñas, tokens ni respuestas completas. Retención: 90 días.';
