create or replace function public.release_number_holds(p_round_id uuid, p_mobile text, p_token_hash text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_released integer := 0;
begin
  if p_round_id is null or p_mobile !~ '^[+]91[6-9][0-9]{9}$' or p_token_hash is null or pg_catalog.length(p_token_hash) <> 64 then
    raise exception using errcode = '22023', message = 'invalid_reservation';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_round_id::text || ':' || p_mobile, 0));

  with released as (
    update public.reservations r
    set state = 'released', token_hash = null, expires_at = null, updated_at = pg_catalog.now()
    where r.round_id = p_round_id
      and r.mobile = p_mobile
      and r.state = 'held'
      and r.token_hash = p_token_hash
    returning r.slot_id
  )
  update public.number_slots s
  set status = 'available', hold_expires_at = null
  from released r
  where s.id = r.slot_id;

  get diagnostics v_released = row_count;
  return v_released;
end;
$$;

revoke all on function public.release_number_holds(uuid, text, text) from public, anon, authenticated;
grant execute on function public.release_number_holds(uuid, text, text) to service_role;
