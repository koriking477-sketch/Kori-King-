-- Base schema: tables, indexes, and core functions.
-- Run this FIRST before any other migration file.

-- ─── Tables ───────────────────────────────────────────────────────────────────

create table if not exists public.booking_rounds (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  first_number          integer not null,
  last_number           integer not null,
  opens_at              timestamp with time zone not null,
  closes_at             timestamp with time zone not null,
  status                text not null default 'scheduled'
                          check (status in ('scheduled', 'open', 'closed', 'archived')),
  created_at            timestamp with time zone not null default now(),
  updated_at            timestamp with time zone not null default now(),
  report_downloaded_at  timestamp with time zone
);

create table if not exists public.number_slots (
  id              uuid primary key default gen_random_uuid(),
  round_id        uuid not null references public.booking_rounds(id) on delete cascade,
  slot_number     integer not null,
  status          text not null default 'available'
                    check (status in ('available', 'held', 'booked', 'paid', 'released')),
  hold_expires_at timestamp with time zone,
  created_at      timestamp with time zone not null default now(),
  updated_at      timestamp with time zone not null default now(),
  unique (round_id, slot_number)
);

create table if not exists public.reservations (
  id            uuid primary key default gen_random_uuid(),
  round_id      uuid not null references public.booking_rounds(id) on delete cascade,
  slot_id       uuid not null references public.number_slots(id) on delete cascade,
  mobile        text not null,
  customer_name text,
  state         text not null default 'held'
                  check (state in ('held', 'booked', 'paid', 'released')),
  token_hash    text,
  expires_at    timestamp with time zone,
  booked_at     timestamp with time zone,
  created_at    timestamp with time zone not null default now(),
  updated_at    timestamp with time zone not null default now()
);

create table if not exists public.admin_members (
  user_id    uuid primary key,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.api_rate_limits (
  key_hash      text not null,
  action        text not null,
  window_start  timestamp with time zone not null default now(),
  request_count integer not null default 1,
  primary key (key_hash, action)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

create index if not exists number_slots_round_id_idx   on public.number_slots (round_id);
create index if not exists reservations_round_id_idx   on public.reservations  (round_id);
create index if not exists reservations_mobile_idx     on public.reservations  (mobile);

-- ─── Rate limit function ──────────────────────────────────────────────────────

create or replace function public.consume_api_rate_limit(
  p_key_hash       text,
  p_action         text,
  p_limit          integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window_start timestamp with time zone;
  v_count        integer;
begin
  v_window_start := date_trunc('minute', now());

  insert into public.api_rate_limits (key_hash, action, window_start, request_count)
  values (p_key_hash, p_action, v_window_start, 1)
  on conflict (key_hash, action) do update
    set request_count = case
          when public.api_rate_limits.window_start < v_window_start
          then 1
          else public.api_rate_limits.request_count + 1
        end,
        window_start = case
          when public.api_rate_limits.window_start < v_window_start
          then v_window_start
          else public.api_rate_limits.window_start
        end
  returning request_count into v_count;

  return v_count <= p_limit;
end;
$$;

revoke all on function public.consume_api_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, text, integer, integer) to service_role;

-- ─── Public booking functions ─────────────────────────────────────────────────

create or replace function public.reserve_numbers(
  p_round_id    uuid,
  p_slot_numbers integer[],
  p_mobile      text,
  p_token_hash  text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slot       record;
  v_expires_at timestamp with time zone;
begin
  if p_round_id is null or p_mobile is null or p_token_hash is null then
    raise exception using errcode = '22023', message = 'invalid_reservation';
  end if;

  if not exists (
    select 1 from public.booking_rounds
    where id = p_round_id and status = 'open'
      and opens_at <= now() and closes_at > now()
  ) then
    raise exception using errcode = '23514', message = 'round_not_open';
  end if;

  if exists (
    select 1 from public.reservations
    where round_id = p_round_id and mobile = p_mobile
      and state in ('booked', 'paid')
  ) then
    raise exception using errcode = '23505', message = 'mobile_already_booked';
  end if;

  v_expires_at := now() + interval '1 minute';

  for v_slot in
    select s.id, s.slot_number, s.status
    from public.number_slots s
    where s.round_id = p_round_id
      and s.slot_number = any(p_slot_numbers)
    for update
  loop
    if v_slot.status <> 'available' then
      raise exception using errcode = '23514', message = 'slot_unavailable';
    end if;

    update public.number_slots
    set status = 'held', hold_expires_at = v_expires_at, updated_at = now()
    where id = v_slot.id;

    insert into public.reservations (round_id, slot_id, mobile, state, token_hash, expires_at)
    values (p_round_id, v_slot.id, p_mobile, 'held', p_token_hash, v_expires_at);
  end loop;

  return jsonb_build_object('expires_at', v_expires_at);
end;
$$;

revoke all on function public.reserve_numbers(uuid, integer[], text, text) from public, anon, authenticated;
grant execute on function public.reserve_numbers(uuid, integer[], text, text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.confirm_number_bookings(
  p_round_id      uuid,
  p_slot_numbers  integer[],
  p_mobile        text,
  p_token_hash    text,
  p_customer_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slot    record;
  v_results jsonb := '[]'::jsonb;
begin
  for v_slot in
    select s.id as slot_id, s.slot_number, r.id as reservation_id
    from public.number_slots s
    join public.reservations r on r.slot_id = s.id
    where s.round_id = p_round_id
      and s.slot_number = any(p_slot_numbers)
      and r.mobile = p_mobile
      and r.token_hash = p_token_hash
      and r.state = 'held'
      and r.expires_at > now()
    for update
  loop
    update public.number_slots
    set status = 'booked', hold_expires_at = null, updated_at = now()
    where id = v_slot.slot_id;

    update public.reservations
    set state = 'booked', customer_name = p_customer_name,
        token_hash = null, expires_at = null,
        booked_at = now(), updated_at = now()
    where id = v_slot.reservation_id;

    v_results := v_results || jsonb_build_object(
      'reservation_id', v_slot.reservation_id,
      'slot_number',    v_slot.slot_number
    );
  end loop;

  if jsonb_array_length(v_results) = 0 then
    raise exception using errcode = '23514', message = 'hold_expired';
  end if;

  return jsonb_build_object('reservations', v_results);
end;
$$;

revoke all on function public.confirm_number_bookings(uuid, integer[], text, text, text) from public, anon, authenticated;
grant execute on function public.confirm_number_bookings(uuid, integer[], text, text, text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.update_booking_state(
  p_reservation_id uuid,
  p_state          text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.reservations
  set state = p_state, updated_at = now()
  where id = p_reservation_id;

  update public.number_slots
  set status = p_state, updated_at = now()
  where id = (select slot_id from public.reservations where id = p_reservation_id);

  return found;
end;
$$;

revoke all on function public.update_booking_state(uuid, text) from public, anon, authenticated;
grant execute on function public.update_booking_state(uuid, text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.delete_booking(
  p_reservation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slot_id uuid;
begin
  select slot_id into v_slot_id
  from public.reservations where id = p_reservation_id;

  delete from public.reservations where id = p_reservation_id;

  update public.number_slots
  set status = 'available', hold_expires_at = null, updated_at = now()
  where id = v_slot_id;

  return found;
end;
$$;

revoke all on function public.delete_booking(uuid) from public, anon, authenticated;
grant execute on function public.delete_booking(uuid) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.reset_booking_round(
  p_round_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.reservations where round_id = p_round_id;

  update public.number_slots
  set status = 'available', hold_expires_at = null, updated_at = now()
  where round_id = p_round_id;

  update public.booking_rounds
  set status = 'archived', updated_at = now()
  where id = p_round_id;

  return true;
end;
$$;

revoke all on function public.reset_booking_round(uuid) from public, anon, authenticated;
grant execute on function public.reset_booking_round(uuid) to service_role;
