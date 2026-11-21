-- Security hardening for the booking project.
--
-- The application never reads customer data with the public (anon) Supabase key:
-- every read/write goes through the Next.js server using the service role. These
-- statements make that guarantee explicit so a leaked publishable/anon key cannot
-- be used against PostgREST to read `reservations`, `admin_members` or rounds.
--
-- Apply this migration in the Supabase SQL editor or with `supabase db push`.
--
-- Admin accounts are NOT created by the application anymore. Create the user in
-- Supabase Dashboard > Authentication > Users, then register it here:
--
--   insert into public.admin_members (user_id, email)
--   values ('<auth-user-uuid>', '<admin-email>')
--   on conflict (user_id) do update set email = excluded.email;
--
-- Also disable public sign-ups in Dashboard > Authentication > Providers > Email
-- (and > Sign In / Up settings) so only accounts you create can exist.

begin;

do $$
begin
  -- Private tables: no direct browser access at all.
  if to_regclass('public.reservations') is not null then
    execute 'alter table public.reservations enable row level security';
    execute 'revoke all on table public.reservations from anon, authenticated';
  end if;

  if to_regclass('public.admin_members') is not null then
    execute 'alter table public.admin_members enable row level security';
    execute 'revoke all on table public.admin_members from anon, authenticated';
  end if;

  if to_regclass('public.booking_rounds') is not null then
    execute 'alter table public.booking_rounds enable row level security';
    execute 'revoke all on table public.booking_rounds from anon, authenticated';
  end if;

  -- Availability data is public by design (the live number grid). It is read
  -- only, and contains no personal information.
  if to_regclass('public.number_slots') is not null then
    execute 'alter table public.number_slots enable row level security';
    execute 'revoke all on table public.number_slots from anon, authenticated';
    execute 'grant select on table public.number_slots to anon, authenticated';
  end if;
end $$;

-- Remove any write policies that previously allowed browsers to change slots.
do $$
declare
  policy_row record;
begin
  if to_regclass('public.number_slots') is null then
    return;
  end if;

  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'number_slots'
      and cmd <> 'SELECT'
  loop
    execute format('drop policy %I on public.number_slots', policy_row.policyname);
  end loop;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'number_slots'
      and policyname = 'number_slots_public_read'
  ) then
    execute 'create policy number_slots_public_read on public.number_slots for select to anon, authenticated using (true)';
  end if;
end $$;

commit;
