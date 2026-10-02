-- Allow the public booking page to submit appointments without an account.
-- Existing authenticated customer bookings keep their profile relationship.
alter table public.bookings
  alter column customer_id drop not null;

alter table public.bookings
  add column if not exists customer_email text not null default '';

-- Anonymous clients receive only the intervals needed to render availability.
-- No customer names, email addresses, or phone numbers are returned.
create or replace function public.get_blocked_booking_times(p_booking_date date)
returns table (start_time time without time zone, end_time time without time zone, status text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_booking_date is null then
    raise exception 'Choose an appointment date.' using errcode = '22023';
  end if;

  return query
    select b.start_time, b.end_time, b.status
    from public.bookings as b
    where b.booking_date = p_booking_date
      and b.status in ('pending', 'confirmed');
end;
$$;

revoke all on function public.get_blocked_booking_times(date) from public, anon, authenticated;
grant execute on function public.get_blocked_booking_times(date) to anon, authenticated;

-- Guest submissions use a separate RPC. The original authenticated RPC remains
-- available to existing customer flows and continues to use customer_id.
create or replace function public.create_guest_booking_if_available(
  p_service_id uuid,
  p_booking_date date,
  p_start_time time without time zone,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_duration integer;
  v_start_minute integer;
  v_end_minute integer;
  v_end_time time without time zone;
  v_now_lahore timestamp without time zone;
  v_booking_id uuid;
  v_name text := pg_catalog.btrim(coalesce(p_customer_name, ''));
  v_email text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_customer_email, '')));
  v_phone text := pg_catalog.btrim(coalesce(p_customer_phone, ''));
  v_note text := pg_catalog.btrim(coalesce(p_note, ''));
begin
  if pg_catalog.length(v_name) < 2 or pg_catalog.length(v_name) > 100
     or v_email = ''
     or pg_catalog.length(v_email) > 254
     or v_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
     or v_phone !~ '^[+0-9() -]{7,20}$'
     or pg_catalog.length(pg_catalog.regexp_replace(v_phone, '[^0-9]', '', 'g')) not between 7 and 15
     or pg_catalog.length(v_note) > 500 then
    raise exception 'Please provide a valid name, email, phone number, and message.'
      using errcode = '22023';
  end if;

  if p_service_id is null or p_booking_date is null or p_start_time is null then
    raise exception 'Choose a service, date, and time.' using errcode = '22023';
  end if;

  v_now_lahore := pg_catalog.now() at time zone 'Asia/Karachi';
  if p_booking_date < v_now_lahore::date
     or extract(isodow from p_booking_date) = 7 then
    raise exception 'Choose a future Monday-to-Saturday date.' using errcode = '22023';
  end if;
  if p_booking_date = v_now_lahore::date and p_start_time <= v_now_lahore::time then
    raise exception 'Choose a future appointment time.' using errcode = '22023';
  end if;

  select s.duration into v_duration
  from public.services as s
  where s.id = p_service_id and s.active = true
  for share;
  if not found then
    raise exception 'This service is no longer available.' using errcode = '22023';
  end if;

  v_start_minute := extract(hour from p_start_time)::integer * 60
    + extract(minute from p_start_time)::integer;
  if extract(second from p_start_time) <> 0
     or extract(minute from p_start_time)::integer not in (0, 30) then
    raise exception 'Choose a valid appointment start time.' using errcode = '22023';
  end if;
  v_end_minute := v_start_minute + v_duration;
  if v_start_minute < 600 or v_end_minute > 1140 then
    raise exception 'Appointment is outside salon hours.' using errcode = '22023';
  end if;
  if v_start_minute < 840 and v_end_minute > 780 then
    raise exception 'Appointment overlaps the salon lunch break.' using errcode = '22023';
  end if;
  v_end_time := pg_catalog.make_time(v_end_minute / 60, v_end_minute % 60, 0);

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('elan-bookings:' || p_booking_date::text, 0)
  );

  if exists (
    select 1 from public.bookings as b
    where b.booking_date = p_booking_date
      and b.status in ('pending', 'confirmed')
      and b.start_time < v_end_time
      and b.end_time > p_start_time
  ) then
    raise exception 'This time slot is no longer available. Please select another time.'
      using errcode = 'P0001';
  end if;

  insert into public.bookings (
    customer_id, customer_email, service_id, booking_date, start_time, end_time,
    customer_name, customer_phone, note, status
  ) values (
    null, v_email, p_service_id, p_booking_date, p_start_time, v_end_time,
    v_name, v_phone, v_note, 'pending'
  )
  returning id into v_booking_id;

  return v_booking_id;
end;
$$;

revoke all on function public.create_guest_booking_if_available(uuid, date, time without time zone, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_guest_booking_if_available(uuid, date, time without time zone, text, text, text, text)
  to anon, authenticated;

notify pgrst, 'reload schema';
