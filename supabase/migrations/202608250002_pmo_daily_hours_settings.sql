alter table public.pmo_app_settings
  add column if not exists daily_hours jsonb not null
  default '{"0":0,"1":9,"2":9,"3":9,"4":9,"5":8,"6":0}'::jsonb;

create or replace function public.replace_pmo_configuration(field_config jsonb, work_config jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.pmo_field_options;

  insert into public.pmo_field_options (field_key, option_value, option_label, active, sort_order, is_default, updated_at)
  select
    field->>'key',
    option->>'value',
    coalesce(nullif(option->>'label', ''), option->>'value'),
    coalesce((option->>'active')::boolean, true),
    coalesce((option->>'sortOrder')::integer, 0),
    option->>'value' = field->>'defaultValue',
    now()
  from jsonb_array_elements(field_config) field
  cross join lateral jsonb_array_elements(field->'options') option
  where field->>'key' in ('tipoActividad','causa','complejidad','impacto','equipo','modoActuacion','lenguaje','tipoHora','prefijo','objetoRicef','categoria')
    and nullif(trim(option->>'value'), '') is not null;

  insert into public.pmo_app_settings (id, monday_thursday_hours, friday_hours, daily_hours, max_daily_labor_hours, max_hours_per_record, updated_at)
  values (
    'global',
    (work_config->>'mondayThursdayHours')::numeric,
    (work_config->>'fridayHours')::numeric,
    coalesce(work_config->'dailyHours', work_config->'daily_hours', '{"0":0,"1":9,"2":9,"3":9,"4":9,"5":8,"6":0}'::jsonb),
    (work_config->>'maxDailyLaborHours')::numeric,
    (work_config->>'maxHoursPerRecord')::numeric,
    now()
  )
  on conflict (id) do update set
    monday_thursday_hours = excluded.monday_thursday_hours,
    friday_hours = excluded.friday_hours,
    daily_hours = excluded.daily_hours,
    max_daily_labor_hours = excluded.max_daily_labor_hours,
    max_hours_per_record = excluded.max_hours_per_record,
    updated_at = now();
end;
$$;

revoke all on function public.replace_pmo_configuration(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.replace_pmo_configuration(jsonb, jsonb) to service_role;
