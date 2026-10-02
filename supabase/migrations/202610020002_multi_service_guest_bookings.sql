-- Store each chosen treatment with the booking and retain the legacy primary service.
alter table public.bookings
  add column if not exists total_duration integer not null default 0 check (total_duration >= 0),
  add column if not exists total_price numeric(10, 2) not null default 0 check (total_price >= 0);

create table if not exists public.booking_services (
  booking_id uuid not null references public.bookings(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  service_name text not null,
  service_price numeric(10, 2) not null check (service_price >= 0),
  service_duration integer not null check (service_duration > 0),
  position integer not null check (position > 0),
  primary key (booking_id, service_id),
  unique (booking_id, position)
);

alter table public.booking_services enable row level security;
revoke all on table public.booking_services from anon, authenticated;
grant select on table public.booking_services to authenticated;
drop policy if exists "Customers and admins can read booking services" on public.booking_services;
create policy "Customers and admins can read booking services"
  on public.booking_services for select
  to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and (
          b.customer_id = auth.uid()
          or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
        )
    )
  );

-- Calendar availability returns only blocking intervals, never customer information.
create or replace function public.get_blocked_booking_times_range(p_from_date date, p_to_date date)
returns table (booking_date date, start_time time without time zone, end_time time without time zone, status text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_from_date is null or p_to_date is null
     or p_from_date > p_to_date
     or p_to_date - p_from_date > 62 then
    raise exception 'Choose a valid date range.' using errcode = '22023';
  end if;

  return query
    select b.booking_date, b.start_time, b.end_time, b.status
    from public.bookings b
    where b.booking_date between p_from_date and p_to_date
      and b.status in ('pending', 'confirmed');
end;
$$;
revoke all on function public.get_blocked_booking_times_range(date, date) from public, anon, authenticated;
grant execute on function public.get_blocked_booking_times_range(date, date) to anon, authenticated;

-- Inserts all selected services and reserves their combined duration atomically.
create or replace function public.create_guest_booking_with_services(
  p_service_ids uuid[],
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
  v_service_count integer;
  v_distinct_count integer;
  v_first_service uuid;
  v_duration integer;
  v_price numeric(10, 2);
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
  if coalesce(pg_catalog.cardinality(p_service_ids), 0) < 1
     or pg_catalog.cardinality(p_service_ids) > 20 then
    raise exception 'Choose at least one service.' using errcode = '22023';
  end if;

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

  if p_booking_date is null or p_start_time is null then
    raise exception 'Choose an appointment date and time.' using errcode = '22023';
  end if;

  select count(*), count(distinct s.id), sum(s.duration), sum(s.price),
         (pg_catalog.array_agg(s.id order by requested.position))[1]
    into v_service_count, v_distinct_count, v_duration, v_price, v_first_service
  from pg_catalog.unnest(p_service_ids) with ordinality as requested(id, position)
  join public.services s on s.id = requested.id and s.active = true;

  if v_service_count <> pg_catalog.cardinality(p_service_ids)
     or v_distinct_count <> v_service_count then
    raise exception 'One or more selected services are unavailable.' using errcode = '22023';
  end if;

  v_now_lahore := pg_catalog.now() at time zone 'Asia/Karachi';
  if p_booking_date < v_now_lahore::date or extract(isodow from p_booking_date) = 7 then
    raise exception 'Choose a future Monday-to-Saturday date.' using errcode = '22023';
  end if;
  if p_booking_date = v_now_lahore::date and p_start_time <= v_now_lahore::time then
    raise exception 'Choose a future appointment time.' using errcode = '22023';
  end if;

  v_start_minute := extract(hour from p_start_time)::integer * 60 + extract(minute from p_start_time)::integer;
  if extract(second from p_start_time) <> 0 or extract(minute from p_start_time)::integer not in (0, 30) then
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

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('elan-bookings:' || p_booking_date::text, 0));
  if exists (
    select 1 from public.bookings b
    where b.booking_date = p_booking_date
      and b.status in ('pending', 'confirmed')
      and b.start_time < v_end_time
      and b.end_time > p_start_time
  ) then
    raise exception 'This time slot is no longer available. Please select another time.' using errcode = 'P0001';
  end if;

  insert into public.bookings (
    customer_id, customer_email, service_id, booking_date, start_time, end_time,
    customer_name, customer_phone, note, status, total_duration, total_price
  ) values (
    null, v_email, v_first_service, p_booking_date, p_start_time, v_end_time,
    v_name, v_phone, v_note, 'pending', v_duration, v_price
  ) returning id into v_booking_id;

  insert into public.booking_services (
    booking_id, service_id, service_name, service_price, service_duration, position
  )
  select v_booking_id, s.id, s.name, s.price, s.duration, requested.position::integer
  from pg_catalog.unnest(p_service_ids) with ordinality as requested(id, position)
  join public.services s on s.id = requested.id;

  return v_booking_id;
end;
$$;

revoke all on function public.create_guest_booking_with_services(uuid[], date, time without time zone, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_guest_booking_with_services(uuid[], date, time without time zone, text, text, text, text)
  to anon, authenticated;

notify pgrst, 'reload schema';
