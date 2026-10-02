create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price numeric(10, 2) not null check (price >= 0),
  duration integer not null check (duration > 0),
  image text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.services enable row level security;
revoke all on table public.services from anon, authenticated;
grant select on table public.services to anon, authenticated;
grant insert, update, delete on table public.services to authenticated;

drop policy if exists "Anyone can read active services" on public.services;
create policy "Anyone can read active services"
  on public.services for select
  to anon, authenticated
  using (active = true);

drop policy if exists "Admins can read all services" on public.services;
create policy "Admins can read all services"
  on public.services for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

drop policy if exists "Admins can create services" on public.services;
create policy "Admins can create services"
  on public.services for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

drop policy if exists "Admins can update services" on public.services;
create policy "Admins can update services"
  on public.services for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

drop policy if exists "Admins can delete services" on public.services;
create policy "Admins can delete services"
  on public.services for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists services_updated_at on public.services;
create trigger services_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

insert into public.services (id, name, description, price, duration, image, active)
values
  ('a1000000-0000-4000-8000-000000000001', 'Haircut & Styling', 'A considered cut and a beautiful finish, tailored to you.', 1500, 45, '/images/haircut.jpg', true),
  ('a1000000-0000-4000-8000-000000000002', 'Hair Treatment', 'A restorative ritual for softer, healthier-looking hair.', 2500, 60, '/images/hair-treatment.jpg', true),
  ('a1000000-0000-4000-8000-000000000003', 'Facial', 'A calming, glow-giving facial made for your skin.', 2000, 60, '/images/facial.jpg', true),
  ('a1000000-0000-4000-8000-000000000004', 'Manicure', 'Neat, polished nails with a little time to unwind.', 1200, 45, '/images/manicure.jpg', true),
  ('a1000000-0000-4000-8000-000000000005', 'Pedicure', 'A refreshing reset, finished with your perfect shade.', 1500, 45, '/images/pedicure.jpg', true),
  ('a1000000-0000-4000-8000-000000000006', 'Party Makeup', 'A polished, occasion-ready look that still feels like you.', 4000, 90, '/images/party-makeup.jpg', true),
  ('a1000000-0000-4000-8000-000000000007', 'Bridal Makeup', 'Thoughtful, timeless bridal artistry for your special day.', 8000, 150, '/images/bridal-makeup.jpg', true),
  ('a1000000-0000-4000-8000-000000000008', 'Hair Styling', 'Effortless waves, an elegant updo, or something all your own.', 2000, 60, '/images/hair-styling.jpg', true)
on conflict (id) do nothing;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete restrict,
  service_id uuid not null references public.services (id) on delete restrict,
  booking_date date not null,
  start_time time without time zone not null,
  end_time time without time zone not null,
  customer_name text not null,
  customer_phone text not null,
  note text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'rejected', 'cancelled', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_positive_duration check (end_time > start_time)
);

alter table public.bookings enable row level security;
revoke all on table public.bookings from anon, authenticated;
grant select, insert on table public.bookings to authenticated;

drop policy if exists "Customers can read their bookings" on public.bookings;
create policy "Customers can read their bookings"
  on public.bookings for select
  to authenticated
  using (customer_id = auth.uid());

drop policy if exists "Admins can read all bookings" on public.bookings;
create policy "Admins can read all bookings"
  on public.bookings for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

drop policy if exists "Customers can create pending bookings" on public.bookings;
create policy "Customers can create pending bookings"
  on public.bookings for insert
  to authenticated
  with check (
    customer_id = auth.uid()
    and status = 'pending'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'customer'
    )
    and exists (
      select 1 from public.services
      where services.id = service_id and services.active = true
    )
  );

create index if not exists bookings_customer_created_idx
  on public.bookings (customer_id, created_at desc);
create index if not exists bookings_service_day_status_idx
  on public.bookings (service_id, booking_date, status);
create index if not exists bookings_active_day_time_idx
  on public.bookings (booking_date, start_time, end_time)
  where status in ('pending', 'confirmed');

drop trigger if exists bookings_updated_at on public.bookings;
create trigger bookings_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();
