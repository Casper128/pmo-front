create table if not exists public.pmo_field_options (
  field_key text not null check (field_key in ('tipoActividad','causa','complejidad','impacto','equipo','modoActuacion','lenguaje','tipoHora','prefijo','objetoRicef','categoria')),
  option_value text not null,
  option_label text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  is_default boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (field_key, option_value)
);

create table if not exists public.pmo_app_settings (
  id text primary key default 'global',
  monday_thursday_hours numeric(4,2) not null default 9,
  friday_hours numeric(4,2) not null default 8,
  daily_hours jsonb not null default '{"0":0,"1":9,"2":9,"3":9,"4":9,"5":8,"6":0}'::jsonb,
  max_daily_labor_hours numeric(4,2) not null default 10,
  max_hours_per_record numeric(4,2) not null default 16,
  updated_at timestamptz not null default now()
);

alter table public.pmo_field_options enable row level security;
alter table public.pmo_app_settings enable row level security;

drop policy if exists "Parameters are readable" on public.pmo_field_options;
create policy "Parameters are readable" on public.pmo_field_options for select to anon, authenticated using (true);
drop policy if exists "Settings are readable" on public.pmo_app_settings;
create policy "Settings are readable" on public.pmo_app_settings for select to anon, authenticated using (true);

grant select on public.pmo_field_options to anon, authenticated;
grant select on public.pmo_app_settings to anon, authenticated;

insert into public.pmo_app_settings (id) values ('global') on conflict (id) do nothing;

insert into public.pmo_field_options (field_key, option_value, option_label, sort_order, is_default) values
  ('tipoActividad','ActividadDesarrollo','Actividad de desarrollo',0,true),
  ('tipoActividad','Control De Cambio','Control de cambio',1,false),
  ('tipoActividad','Debug','Debug',2,false),
  ('tipoActividad','Analisis Funcional','Análisis funcional',3,false),
  ('tipoActividad','Soporte','Soporte',4,false),
  ('tipoActividad','Reunion','Reunión',5,false),
  ('tipoActividad','Estimacion','Estimación',6,false),
  ('tipoActividad','Despliegue','Despliegue',7,false),
  ('causa','Garantia','Garantia',0,false),
  ('causa','Data Maestra','Data Maestra',1,false),
  ('causa','Falta Configuraion','Falta Configuraion',2,false),
  ('causa','EscenarioNoProbado','EscenarioNoProbado',3,false),
  ('causa','EscenarioNoContemplado','EscenarioNoContemplado',4,false),
  ('causa','Nueva Funcionalidad','Nueva Funcionalidad',5,true),
  ('causa','Administrativo','Administrativo',6,false),
  ('causa','Reunion','Reunion',7,false),
  ('complejidad','Alta','Alta',0,false), ('complejidad','Media','Media',1,true), ('complejidad','Baja','Baja',2,false),
  ('impacto','Alta','Alta',0,false), ('impacto','Media','Media',1,true), ('impacto','Baja','Baja',2,false),
  ('equipo','Financiero','Financiero',0,false), ('equipo','Comercial','Comercial',1,true), ('equipo','Logistico','Logistico',2,false),
  ('equipo','PlaneacionDemanda','PlaneacionDemanda',3,false), ('equipo','Analitica','Analitica',4,false), ('equipo','Portales','Portales',5,false), ('equipo','Infraestructura','Infraestructura',6,false),
  ('modoActuacion','Basado-Datos-Integraciones','Basado-Datos-Integraciones',0,true),
  ('modoActuacion','Basado-Datos-Automatizacion','Basado-Datos-Automatizacion',1,false),
  ('modoActuacion','Basado-Datos-Analitica','Basado-Datos-Analitica',2,false),
  ('modoActuacion','OXDE','OXDE',3,false), ('modoActuacion','Transaccional','Transaccional',4,false),
  ('lenguaje','JavaScript','JavaScript',0,false), ('lenguaje','Java','Java',1,false), ('lenguaje','PHP','PHP',2,false),
  ('lenguaje','PullOvers','PullOvers',3,false), ('lenguaje','ABAP','ABAP',4,true), ('lenguaje','NODEjs','NODEjs',5,false),
  ('lenguaje','PO','PO',6,false), ('lenguaje','OData','OData',7,false), ('lenguaje','DataService','DataService',8,false),
  ('lenguaje','Strling','Strling',9,false), ('lenguaje','Python','Python',10,false), ('lenguaje','UiPath','UiPath',11,false), ('lenguaje','Agility','Agility',12,false),
  ('tipoHora','Laboral','Laboral',0,true), ('tipoHora','Fabrica','Fábrica',1,false),
  ('prefijo','CH','CH',0,true), ('prefijo','SR','SR',1,false), ('prefijo','IN','IN',2,false), ('prefijo','Proyecto','Proyecto',3,false),
  ('objetoRicef','Interfases','Interfases',0,false), ('objetoRicef','Reportes','Reportes',1,false), ('objetoRicef','Conversiones','Conversiones',2,false),
  ('objetoRicef','Enhacement','Enhacement',3,false), ('objetoRicef','Formularios','Formularios',4,false),
  ('categoria','Everest','Everest',0,false), ('categoria','Operacion','Operacion',1,true), ('categoria','Proyecto','Proyecto',2,false), ('categoria','Coordinacion','Coordinacion',3,false)
on conflict (field_key, option_value) do nothing;

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
