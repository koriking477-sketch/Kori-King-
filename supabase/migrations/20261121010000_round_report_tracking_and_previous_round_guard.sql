begin;

alter table public.booking_rounds
  add column if not exists report_downloaded_at timestamp with time zone;

create or replace function public.create_booking_round(
  p_name text,
  p_first_number integer,
  p_last_number integer,
  p_opens_at timestamp with time zone,
  p_closes_at timestamp with time zone
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_round_id uuid;
begin
  if p_name is null or pg_catalog.length(pg_catalog.btrim(p_name)) < 2 or pg_catalog.length(pg_catalog.btrim(p_name)) > 80 then
    raise exception using errcode = '22023', message = 'invalid_round_name';
  end if;
  if p_first_number < 1 or p_last_number < p_first_number or p_last_number - p_first_number > 4999 then
    raise exception using errcode = '22023', message = 'invalid_number_range';
  end if;
  if p_opens_at is null or p_closes_at is null or p_closes_at <= p_opens_at then
    raise exception using errcode = '22023', message = 'invalid_time_range';
  end if;

  lock table public.booking_rounds in share row exclusive mode;

  if exists (
    select 1
    from public.booking_rounds r
    where pg_catalog.lower(pg_catalog.btrim(r.name)) = pg_catalog.lower(pg_catalog.btrim(p_name))
  ) then
    raise exception using errcode = '23505', message = 'round_name_conflict';
  end if;
  if exists (
    select 1
    from public.booking_rounds r
    where r.closes_at <= p_opens_at
  ) then
    raise exception using errcode = '23514', message = 'previous_round_exists';
  end if;
  if exists (
    select 1
    from public.booking_rounds r
    where r.status in ('scheduled', 'open')
      and r.opens_at < p_closes_at
      and r.closes_at > p_opens_at
  ) then
    raise exception using errcode = '23505', message = 'round_time_conflict';
  end if;

  insert into public.booking_rounds (name, first_number, last_number, opens_at, closes_at, status)
  values (
    pg_catalog.btrim(p_name), p_first_number, p_last_number, p_opens_at, p_closes_at,
    case when p_opens_at <= pg_catalog.now() and p_closes_at > pg_catalog.now() then 'open' else 'scheduled' end
  ) returning id into v_round_id;

  insert into public.number_slots (round_id, slot_number)
  select v_round_id, n
  from pg_catalog.generate_series(p_first_number, p_last_number) as n;

  return v_round_id;
end;
$$;

revoke all on function public.create_booking_round(text, integer, integer, timestamp with time zone, timestamp with time zone) from public, anon, authenticated;
grant execute on function public.create_booking_round(text, integer, integer, timestamp with time zone, timestamp with time zone) to service_role;

commit;
