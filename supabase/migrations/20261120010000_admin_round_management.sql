create or replace function public.update_booking_round(
  p_round_id uuid,
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
  v_status text;
begin
  if p_round_id is null then
    raise exception using errcode = '22023', message = 'invalid_round_id';
  end if;
  if p_name is null or pg_catalog.length(pg_catalog.btrim(p_name)) < 2 or pg_catalog.length(pg_catalog.btrim(p_name)) > 80 then
    raise exception using errcode = '22023', message = 'invalid_round_name';
  end if;
  if p_first_number < 1 or p_last_number < p_first_number or p_last_number - p_first_number > 4999 then
    raise exception using errcode = '22023', message = 'invalid_number_range';
  end if;
  if p_opens_at is null or p_closes_at is null or p_closes_at <= p_opens_at then
    raise exception using errcode = '22023', message = 'invalid_time_range';
  end if;

  select r.status into v_status
  from public.booking_rounds r
  where r.id = p_round_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'round_not_found';
  end if;

  if v_status <> 'archived' and exists (
    select 1
    from public.booking_rounds r
    where r.id <> p_round_id
      and r.status in ('scheduled', 'open')
      and r.opens_at < p_closes_at
      and r.closes_at > p_opens_at
  ) then
    raise exception using errcode = '23505', message = 'round_time_conflict';
  end if;

  perform 1
  from public.number_slots s
  where s.round_id = p_round_id
    and (s.slot_number < p_first_number or s.slot_number > p_last_number)
  for update;

  if exists (
    select 1
    from public.number_slots s
    join public.reservations r on r.slot_id = s.id
    where s.round_id = p_round_id
      and (s.slot_number < p_first_number or s.slot_number > p_last_number)
  ) then
    raise exception using errcode = '23514', message = 'round_slots_in_use';
  end if;

  update public.booking_rounds
  set name = pg_catalog.btrim(p_name),
      first_number = p_first_number,
      last_number = p_last_number,
      opens_at = p_opens_at,
      closes_at = p_closes_at,
      status = case
        when status = 'archived' then 'archived'
        when p_closes_at <= pg_catalog.now() then 'closed'
        when p_opens_at <= pg_catalog.now() then 'open'
        else 'scheduled'
      end,
      updated_at = pg_catalog.now()
  where id = p_round_id;

  delete from public.number_slots
  where round_id = p_round_id
    and (slot_number < p_first_number or slot_number > p_last_number);

  insert into public.number_slots (round_id, slot_number)
  select p_round_id, n
  from pg_catalog.generate_series(p_first_number, p_last_number) as n
  on conflict (round_id, slot_number) do nothing;

  return p_round_id;
end;
$$;

revoke all on function public.update_booking_round(uuid, text, integer, integer, timestamp with time zone, timestamp with time zone) from public, anon, authenticated;
grant execute on function public.update_booking_round(uuid, text, integer, integer, timestamp with time zone, timestamp with time zone) to service_role;

create or replace function public.delete_booking_round(p_round_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  if p_round_id is null then
    raise exception using errcode = '22023', message = 'invalid_round_id';
  end if;

  delete from public.booking_rounds where id = p_round_id;
  get diagnostics v_deleted = row_count;
  return v_deleted = 1;
end;
$$;

revoke all on function public.delete_booking_round(uuid) from public, anon, authenticated;
grant execute on function public.delete_booking_round(uuid) to service_role;
