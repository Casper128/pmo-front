alter table public.pmo_user_directory
  add column if not exists last_distance_to_home_m numeric(12,2),
  add column if not exists last_within_home_radius boolean,
  add column if not exists last_verification_status text,
  add column if not exists last_location_source text;

create or replace function public.upsert_pmo_latest_location(
  identity_key text,
  client_latitude numeric,
  client_longitude numeric,
  client_accuracy_m numeric,
  client_location_status text,
  location_source text
)
returns void language plpgsql security definer set search_path = public as $$
declare
  home_lat numeric;
  home_lon numeric;
  radius_m integer;
  distance_m numeric;
  verification text;
  within_radius boolean;
  normalized_source text;
begin
  normalized_source := case when location_source = 'time_report' then 'time_report' else 'login' end;

  select home_latitude, home_longitude, home_radius_m
    into home_lat, home_lon, radius_m
    from public.pmo_user_directory
    where user_key = identity_key;

  if client_location_status <> 'granted' then
    verification := client_location_status;
  elsif client_latitude is null or client_longitude is null then
    verification := 'unavailable';
  elsif client_accuracy_m is null or client_accuracy_m > 500 then
    verification := 'low_accuracy';
  elsif home_lat is null or home_lon is null then
    update public.pmo_user_directory
      set home_latitude = client_latitude,
          home_longitude = client_longitude,
          home_radius_m = 500,
          updated_at = now()
      where user_key = identity_key;
    distance_m := 0;
    within_radius := true;
    verification := 'reference_auto_created';
  else
    distance_m := 6371000 * 2 * asin(sqrt(
      power(sin(radians((client_latitude - home_lat) / 2)), 2) +
      cos(radians(home_lat)) * cos(radians(client_latitude)) *
      power(sin(radians((client_longitude - home_lon) / 2)), 2)
    ));
    within_radius := distance_m <= radius_m;
    verification := case when within_radius then 'within_home_radius' else 'outside_home_radius' end;
  end if;

  update public.pmo_user_directory
    set last_latitude = case when client_location_status = 'granted' then client_latitude else last_latitude end,
        last_longitude = case when client_location_status = 'granted' then client_longitude else last_longitude end,
        last_location_accuracy_m = case when client_location_status = 'granted' then client_accuracy_m else last_location_accuracy_m end,
        last_location_status = client_location_status,
        last_location_at = now(),
        last_distance_to_home_m = distance_m,
        last_within_home_radius = within_radius,
        last_verification_status = verification,
        last_location_source = normalized_source,
        updated_at = now()
    where user_key = identity_key;
end; $$;

revoke all on function public.upsert_pmo_latest_location(text, numeric, numeric, numeric, text, text)
  from public, anon, authenticated;
grant execute on function public.upsert_pmo_latest_location(text, numeric, numeric, numeric, text, text)
  to service_role;

-- El historial existente se conserva para auditoría, pero la aplicación deja de insertar nuevas filas.
