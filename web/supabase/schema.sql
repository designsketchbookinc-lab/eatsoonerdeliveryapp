-- Eat Sooner database setup.
-- Run this once, in the SQL editor of a NEW Supabase project.
-- Every change to a delivery goes through the functions at the bottom of this file,
-- so the database (not the browser) decides prices, who can accept a job, and in what order.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('restaurant', 'courier', 'admin')),
  full_name text not null default '' check (length(full_name) <= 120),
  phone text not null default '' check (length(phone) <= 30),
  created_at timestamptz not null default now()
);

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  address text not null check (length(btrim(address)) between 1 and 200),
  area text not null check (area in ('Sunnyside', 'Long Island City', 'Astoria', 'Midtown', 'Harlem')),
  zone text generated always as (
    case area when 'Midtown' then 'midtown' when 'Harlem' then 'harlem' else 'queens' end
  ) stored,
  phone text not null default '' check (length(phone) <= 30),
  created_at timestamptz not null default now()
);

create table public.couriers (
  id uuid primary key references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'paused')),
  zone text not null check (zone in ('queens', 'midtown', 'harlem')),
  mode text not null default 'bike' check (mode in ('bike', 'ebike', 'walk', 'transit')),
  languages text not null default 'English' check (length(languages) <= 120),
  second_chance_note text not null default '' check (length(second_chance_note) <= 1000),
  online boolean not null default false,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  customer_address text not null check (length(btrim(customer_address)) between 1 and 200),
  tier text not null check (tier in ('short', 'standard', 'long')),
  order_size text not null check (order_size in ('one_bag', 'two_bags', 'cake_box')),
  ready_in_minutes integer not null check (ready_in_minutes in (0, 10, 20)),
  notes text not null default '' check (length(notes) <= 300),
  fee numeric(6, 2) not null,
  status text not null default 'requested'
    check (status in ('requested', 'accepted', 'picked_up', 'delivered', 'cancelled')),
  courier_id uuid references public.couriers (id),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz
);

create index deliveries_restaurant_created_idx on public.deliveries (restaurant_id, created_at desc);
create index deliveries_courier_idx on public.deliveries (courier_id) where courier_id is not null;
create index deliveries_open_idx on public.deliveries (status) where status = 'requested';

-- The customer's phone number is kept apart from the delivery, so couriers
-- only see it after they accept the job.
create table public.delivery_contacts (
  delivery_id uuid primary key references public.deliveries (id) on delete cascade,
  customer_phone text not null default '' check (length(customer_phone) <= 30)
);

create table public.delivery_declines (
  delivery_id uuid not null references public.deliveries (id) on delete cascade,
  courier_id uuid not null references public.couriers (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (delivery_id, courier_id)
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Flat fee per delivery, in dollars.
create or replace function public.fee_for_tier(p_tier text)
returns numeric
language sql
immutable
as $$
  select case p_tier
    when 'short' then 5.25
    when 'standard' then 5.75
    when 'long' then 6.75
  end::numeric(6, 2)
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

create or replace function public.is_approved_courier()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.couriers where id = auth.uid() and status = 'approved')
$$;

create or replace function public.owns_restaurant(p_restaurant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.restaurants where id = p_restaurant and owner_id = auth.uid())
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- A new login gets a profile. Only 'restaurant' and 'courier' can be chosen at sign-up;
-- an admin is made by hand in the SQL editor (see README).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := coalesce(new.raw_user_meta_data ->> 'role', '');
begin
  if v_role not in ('restaurant', 'courier') then
    v_role := 'restaurant';
  end if;
  insert into public.profiles (id, role, full_name, phone)
  values (
    new.id,
    v_role,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    left(coalesce(new.raw_user_meta_data ->> 'phone', ''), 30)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Nobody can change their own role from the app.
-- (auth.uid() is null in the SQL editor, which is how an admin is set up.)
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'You cannot change your account type.';
  end if;
  return new;
end;
$$;

create trigger guard_profile_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- Couriers start as 'pending'. Only an admin can approve or pause them,
-- and only an approved courier can go online.
create or replace function public.guard_courier()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_privileged boolean := auth.uid() is null or public.is_admin();
begin
  if tg_op = 'INSERT' then
    if not v_privileged then
      new.status := 'pending';
      new.reviewed_at := null;
      new.online := false;
    end if;
  else
    if not v_privileged and (new.status is distinct from old.status
        or new.reviewed_at is distinct from old.reviewed_at) then
      raise exception 'Only Eat Sooner staff can change a courier''s review status.';
    end if;
    -- Pausing (or un-approving) a courier takes them offline.
    if new.status <> 'approved' and new.status is distinct from old.status then
      new.online := false;
    end if;
  end if;
  if new.online and new.status <> 'approved' then
    raise exception 'Your account must be approved before you can go online.';
  end if;
  return new;
end;
$$;

create trigger guard_courier
  before insert or update on public.couriers
  for each row execute function public.guard_courier();

-- ---------------------------------------------------------------------------
-- Row security: who can read what. All delivery writes go through the functions below.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.restaurants enable row level security;
alter table public.couriers enable row level security;
alter table public.deliveries enable row level security;
alter table public.delivery_contacts enable row level security;
alter table public.delivery_declines enable row level security;

-- Profiles: yourself, admins, and the restaurant whose job you hold (so they can call you).
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from public.deliveries d
    join public.restaurants r on r.id = d.restaurant_id
    where d.courier_id = profiles.id
      and r.owner_id = auth.uid()
      and d.status in ('accepted', 'picked_up')
  )
);
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Restaurants: the owner, admins, and approved couriers (who need the pickup address).
create policy restaurants_select on public.restaurants for select to authenticated using (
  owner_id = auth.uid() or public.is_admin() or public.is_approved_courier()
);
create policy restaurants_insert on public.restaurants for insert to authenticated with check (
  owner_id = auth.uid()
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'restaurant')
);
create policy restaurants_update on public.restaurants for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Couriers: yourself, admins, and the restaurant whose job you hold.
create policy couriers_select on public.couriers for select to authenticated using (
  id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from public.deliveries d
    join public.restaurants r on r.id = d.restaurant_id
    where d.courier_id = couriers.id
      and r.owner_id = auth.uid()
      and d.status in ('accepted', 'picked_up')
  )
);
create policy couriers_insert on public.couriers for insert to authenticated with check (
  id = auth.uid()
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'courier')
);
create policy couriers_update on public.couriers for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Deliveries: the restaurant's own, a courier's own, open offers for approved couriers, admins.
create policy deliveries_select on public.deliveries for select to authenticated using (
  public.owns_restaurant(restaurant_id)
  or courier_id = auth.uid()
  or (status = 'requested' and public.is_approved_courier())
  or public.is_admin()
);

-- Customer phone: the restaurant, the courier who accepted (until delivered), admins.
create policy delivery_contacts_select on public.delivery_contacts for select to authenticated using (
  public.is_admin()
  or exists (
    select 1 from public.deliveries d
    where d.id = delivery_contacts.delivery_id
      and (
        public.owns_restaurant(d.restaurant_id)
        or (d.courier_id = auth.uid() and d.status in ('accepted', 'picked_up'))
      )
  )
);

create policy delivery_declines_select on public.delivery_declines for select to authenticated
  using (courier_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Actions (called from the app with supabase.rpc)
-- ---------------------------------------------------------------------------

create or replace function public.create_delivery(
  p_customer_address text,
  p_customer_phone text,
  p_tier text,
  p_order_size text,
  p_ready_in_minutes integer,
  p_notes text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant uuid;
  v_id uuid;
begin
  select id into v_restaurant from public.restaurants where owner_id = auth.uid();
  if v_restaurant is null then
    raise exception 'Set up your restaurant before requesting a courier.';
  end if;
  if public.fee_for_tier(p_tier) is null then
    raise exception 'Choose a trip distance.';
  end if;
  insert into public.deliveries (restaurant_id, customer_address, tier, order_size, ready_in_minutes, notes, fee)
  values (v_restaurant, btrim(p_customer_address), p_tier, p_order_size, p_ready_in_minutes,
          coalesce(btrim(p_notes), ''), public.fee_for_tier(p_tier))
  returning id into v_id;
  insert into public.delivery_contacts (delivery_id, customer_phone)
  values (v_id, coalesce(btrim(p_customer_phone), ''));
  return v_id;
end;
$$;

-- A courier may hold up to 3 active jobs, so short trips can be batched.
create or replace function public.accept_delivery(p_delivery uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_courier public.couriers;
  v_active integer;
begin
  select * into v_courier from public.couriers where id = auth.uid();
  if v_courier.id is null or v_courier.status <> 'approved' then
    raise exception 'Only approved couriers can accept deliveries.';
  end if;
  if not v_courier.online then
    raise exception 'Go online to accept deliveries.';
  end if;
  select count(*) into v_active from public.deliveries
    where courier_id = v_courier.id and status in ('accepted', 'picked_up');
  if v_active >= 3 then
    raise exception 'Finish one of your current deliveries first (3 at a time at most).';
  end if;
  update public.deliveries
    set status = 'accepted', courier_id = v_courier.id, accepted_at = now()
    where id = p_delivery and status = 'requested' and courier_id is null;
  if not found then
    raise exception 'This delivery was already taken or cancelled.';
  end if;
end;
$$;

create or replace function public.decline_delivery(p_delivery uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_approved_courier() then
    raise exception 'Only approved couriers can decline deliveries.';
  end if;
  insert into public.delivery_declines (delivery_id, courier_id)
  values (p_delivery, auth.uid())
  on conflict do nothing;
end;
$$;

-- The courier can't make it: the job goes back to open offers.
create or replace function public.release_delivery(p_delivery uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.deliveries
    set status = 'requested', courier_id = null, accepted_at = null
    where id = p_delivery and courier_id = auth.uid() and status = 'accepted';
  if not found then
    raise exception 'You can only hand back a delivery you accepted and have not picked up.';
  end if;
  insert into public.delivery_declines (delivery_id, courier_id)
  values (p_delivery, auth.uid())
  on conflict do nothing;
end;
$$;

create or replace function public.mark_picked_up(p_delivery uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.deliveries
    set status = 'picked_up', picked_up_at = now()
    where id = p_delivery and courier_id = auth.uid() and status = 'accepted';
  if not found then
    raise exception 'This delivery is not waiting for pickup by you.';
  end if;
end;
$$;

create or replace function public.mark_delivered(p_delivery uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.deliveries
    set status = 'delivered', delivered_at = now()
    where id = p_delivery and courier_id = auth.uid() and status = 'picked_up';
  if not found then
    raise exception 'Mark the delivery as picked up first.';
  end if;
end;
$$;

-- The restaurant (or an admin) can cancel until the food is picked up.
create or replace function public.cancel_delivery(p_delivery uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.deliveries d
    set status = 'cancelled', cancelled_at = now()
    where d.id = p_delivery
      and d.status in ('requested', 'accepted')
      and (public.owns_restaurant(d.restaurant_id) or public.is_admin());
  if not found then
    raise exception 'This delivery can no longer be cancelled.';
  end if;
end;
$$;

create or replace function public.set_courier_status(p_courier uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only Eat Sooner staff can review couriers.';
  end if;
  if p_status not in ('pending', 'approved', 'paused') then
    raise exception 'Unknown status.';
  end if;
  update public.couriers set status = p_status, reviewed_at = now() where id = p_courier;
  if not found then
    raise exception 'Courier not found.';
  end if;
end;
$$;

-- Only signed-in users may call the actions.
revoke execute on function
  public.create_delivery(text, text, text, text, integer, text),
  public.accept_delivery(uuid),
  public.decline_delivery(uuid),
  public.release_delivery(uuid),
  public.mark_picked_up(uuid),
  public.mark_delivered(uuid),
  public.cancel_delivery(uuid),
  public.set_courier_status(uuid, text)
from public, anon;

grant execute on function
  public.create_delivery(text, text, text, text, integer, text),
  public.accept_delivery(uuid),
  public.decline_delivery(uuid),
  public.release_delivery(uuid),
  public.mark_picked_up(uuid),
  public.mark_delivered(uuid),
  public.cancel_delivery(uuid),
  public.set_courier_status(uuid, text)
to authenticated;

-- Live updates in the app (Supabase Realtime respects the row security above).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.deliveries;
  end if;
end;
$$;
