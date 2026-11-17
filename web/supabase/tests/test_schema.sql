-- Tests for schema.sql. Run on a local Postgres after stub_supabase.sql and schema.sql
-- (see run_tests.sh). Every check raises an exception on failure; the run stops at the first one.
\set ON_ERROR_STOP on

-- Helpers: act as a signed-in user, or as the SQL editor.
create function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p::text, false);
  execute 'set role authenticated';
end $$;
create function pg_temp.as_editor() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
end $$;
create function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok - %', what;
end $$;
-- Runs a statement and passes if it raises an error containing p_like.
create function pg_temp.expect_error(p_sql text, p_like text, what text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'FAILED (no error): %', what;
exception when others then
  if sqlerrm like 'FAILED (no error)%' then raise; end if;
  if position(p_like in sqlerrm) = 0 then
    raise exception 'FAILED (wrong error "%"): %', sqlerrm, what;
  end if;
  raise notice 'ok - %', what;
end $$;

-- Users
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'rest1@test', '{"role":"restaurant","full_name":"Rosa","phone":"555-0101"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'rest2@test', '{"role":"restaurant","full_name":"Ray"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'cour1@test', '{"role":"courier","full_name":"Marcus","phone":"555-0201"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'cour2@test', '{"role":"courier","full_name":"Dee"}'),
  ('00000000-0000-0000-0000-0000000000d1', 'admin@test', '{"role":"admin","full_name":"Boss"}'),
  ('00000000-0000-0000-0000-0000000000e1', 'none@test', '{}');

select pg_temp.check((select role from profiles where id = '00000000-0000-0000-0000-0000000000a1') = 'restaurant', 'sign-up creates a restaurant profile');
select pg_temp.check((select role from profiles where id = '00000000-0000-0000-0000-0000000000c1') = 'courier', 'sign-up creates a courier profile');
select pg_temp.check((select role from profiles where id = '00000000-0000-0000-0000-0000000000d1') = 'restaurant', 'admin cannot be chosen at sign-up');
select pg_temp.check((select role from profiles where id = '00000000-0000-0000-0000-0000000000e1') = 'restaurant', 'missing role defaults to restaurant');
select pg_temp.check((select full_name from profiles where id = '00000000-0000-0000-0000-0000000000c1') = 'Marcus', 'name copied from sign-up');

-- Make the admin by hand, as the README says.
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000d1';
select pg_temp.check((select role from profiles where id = '00000000-0000-0000-0000-0000000000d1') = 'admin', 'SQL editor can make an admin');

-- Role is locked for users
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_error($$update profiles set role = 'admin' where id = auth.uid()$$, 'cannot change your account type', 'courier cannot make themself admin');
update profiles set phone = '555-0299' where id = auth.uid();
select pg_temp.check((select phone from profiles where id = auth.uid()) = '555-0299', 'user can edit own phone');
select pg_temp.check((select count(*) from profiles) = 1, 'user sees only own profile');

-- Restaurant setup
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
insert into restaurants (owner_id, name, address, area, phone)
  values (auth.uid(), 'Neighborhood Bakery', '30th Ave, Astoria', 'Astoria', '555-0111');
select pg_temp.check((select zone from restaurants where owner_id = auth.uid()) = 'queens', 'Astoria is in the Queens zone');
select pg_temp.expect_error($$insert into restaurants (owner_id, name, address, area) values ('00000000-0000-0000-0000-0000000000a2', 'Fake', 'x', 'Harlem')$$, 'row-level security', 'cannot create a restaurant for someone else');
select pg_temp.expect_error($$insert into restaurants (owner_id, name, address, area) values (auth.uid(), 'Two', 'x', 'Harlem')$$, 'duplicate key', 'one restaurant per account');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
insert into restaurants (owner_id, name, address, area) values (auth.uid(), 'Harlem Deli', 'Lenox Ave', 'Harlem');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_error($$insert into restaurants (owner_id, name, address, area) values (auth.uid(), 'Mine', 'x', 'Harlem')$$, 'row-level security', 'a courier cannot create a restaurant');

-- Courier application
insert into couriers (id, zone, mode, status, online) values (auth.uid(), 'queens', 'bike', 'approved', true);
select pg_temp.check((select status from couriers where id = auth.uid()) = 'pending', 'courier cannot approve themself at sign-up');
select pg_temp.check((select online from couriers where id = auth.uid()) = false, 'pending courier starts offline');
select pg_temp.expect_error($$update couriers set status = 'approved' where id = auth.uid()$$, 'review status', 'courier cannot approve themself later');
select pg_temp.expect_error($$update couriers set online = true where id = auth.uid()$$, 'must be approved', 'pending courier cannot go online');
select pg_temp.check((select count(*) from restaurants) = 0, 'pending courier cannot see restaurants');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
insert into couriers (id, zone, mode) values (auth.uid(), 'queens', 'walk');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.expect_error($$insert into couriers (id, zone) values (auth.uid(), 'queens')$$, 'row-level security', 'a restaurant cannot become a courier');
select pg_temp.expect_error($$select set_courier_status('00000000-0000-0000-0000-0000000000c1', 'approved')$$, 'Only Eat Sooner staff', 'restaurant cannot approve couriers');

-- Admin approves
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
select set_courier_status('00000000-0000-0000-0000-0000000000c1', 'approved');
select set_courier_status('00000000-0000-0000-0000-0000000000c2', 'approved');
select pg_temp.check((select count(*) from couriers where status = 'approved') = 2, 'admin approves couriers');

-- Restaurant requests deliveries; the database sets the fee
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.expect_error($$insert into deliveries (restaurant_id, customer_address, tier, order_size, ready_in_minutes, fee) select id, 'x', 'short', 'one_bag', 0, 0.01 from restaurants$$, 'row-level security', 'deliveries cannot be inserted directly (no price tampering)');
create temp table ids (name text, id uuid);
grant all on ids to authenticated;
insert into ids select 'short', create_delivery('31st Ave, Apt 2', '555-7777', 'short', 'one_bag', 0, 'Ring bell');
insert into ids select 'standard', create_delivery('Crescent St', '555-8888', 'standard', 'two_bags', 10);
insert into ids select 'long', create_delivery('36th St', '', 'long', 'cake_box', 20);
select pg_temp.check((select fee from deliveries where id = (select id from ids where name = 'short')) = 5.25, 'short trip fee is $5.25');
select pg_temp.check((select fee from deliveries where id = (select id from ids where name = 'standard')) = 5.75, 'standard trip fee is $5.75');
select pg_temp.check((select fee from deliveries where id = (select id from ids where name = 'long')) = 6.75, 'long trip fee is $6.75');
select pg_temp.expect_error($$select create_delivery('x', '', 'huge', 'one_bag', 0)$$, 'Choose a trip distance', 'unknown distance refused');
update deliveries set fee = 0, status = 'delivered' where true;
select pg_temp.check((select sum(fee) from deliveries) = 17.75 and (select count(*) from deliveries where status = 'requested') = 3, 'restaurant cannot edit fees or status directly');
select pg_temp.check((select count(*) from delivery_contacts) = 3, 'restaurant sees its customer phones');

-- The other restaurant sees none of it
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select pg_temp.check((select count(*) from deliveries) = 0, 'restaurants cannot see each other''s deliveries');
select pg_temp.expect_error(format($$select cancel_delivery(%L)$$, (select id from ids where name = 'short')), 'can no longer be cancelled', 'restaurant cannot cancel another restaurant''s delivery');

-- Couriers see offers but not customer phones
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select pg_temp.check((select count(*) from deliveries where status = 'requested') = 3, 'approved courier sees open offers');
select pg_temp.check((select count(*) from delivery_contacts) = 0, 'courier cannot see customer phone before accepting');
select pg_temp.check((select count(*) from restaurants) = 2, 'approved courier sees pickup addresses');
select pg_temp.expect_error(format($$select accept_delivery(%L)$$, (select id from ids where name = 'short')), 'Go online', 'offline courier cannot accept');
update couriers set online = true where id = auth.uid();
select accept_delivery((select id from ids where name = 'short'));
select pg_temp.check((select status from deliveries where id = (select id from ids where name = 'short')) = 'accepted', 'courier accepts a delivery');
select pg_temp.check((select customer_phone from delivery_contacts where delivery_id = (select id from ids where name = 'short')) = '555-7777', 'courier sees customer phone after accepting');

-- Second courier cannot take the same job
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
update couriers set online = true where id = auth.uid();
select pg_temp.expect_error(format($$select accept_delivery(%L)$$, (select id from ids where name = 'short')), 'already taken', 'a taken delivery cannot be accepted twice');
select pg_temp.check((select count(*) from deliveries) = 2, 'other courier no longer sees the taken delivery');
select pg_temp.expect_error(format($$select mark_picked_up(%L)$$, (select id from ids where name = 'short')), 'not waiting for pickup by you', 'other courier cannot pick it up');
select decline_delivery((select id from ids where name = 'standard'));
select pg_temp.check((select count(*) from delivery_declines) = 1, 'courier can decline an offer');

-- The restaurant sees who is coming
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.check((select full_name from profiles where id = '00000000-0000-0000-0000-0000000000c1') = 'Marcus', 'restaurant sees the assigned courier''s name');
select pg_temp.check((select count(*) from profiles where id = '00000000-0000-0000-0000-0000000000c2') = 0, 'restaurant cannot see other couriers');

-- Pickup and delivery, in order
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_error(format($$select mark_delivered(%L)$$, (select id from ids where name = 'short')), 'picked up first', 'cannot deliver before pickup');
select mark_picked_up((select id from ids where name = 'short'));
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.expect_error(format($$select cancel_delivery(%L)$$, (select id from ids where name = 'short')), 'can no longer be cancelled', 'restaurant cannot cancel after pickup');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select mark_delivered((select id from ids where name = 'short'));
select pg_temp.check((select status from deliveries where id = (select id from ids where name = 'short')) = 'delivered', 'courier marks delivered');
select pg_temp.check((select count(*) from delivery_contacts where delivery_id = (select id from ids where name = 'short')) = 0, 'customer phone hidden from courier after delivery');

-- Hand back a job
select accept_delivery((select id from ids where name = 'standard'));
select release_delivery((select id from ids where name = 'standard'));
select pg_temp.check((select status from deliveries where id = (select id from ids where name = 'standard')) = 'requested', 'handed-back delivery is open again');

-- Three active jobs at most
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
insert into ids select 'x1', create_delivery('a', '', 'short', 'one_bag', 0);
insert into ids select 'x2', create_delivery('b', '', 'short', 'one_bag', 0);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select accept_delivery((select id from ids where name = 'standard'));
select accept_delivery((select id from ids where name = 'long'));
select accept_delivery((select id from ids where name = 'x1'));
select pg_temp.expect_error(format($$select accept_delivery(%L)$$, (select id from ids where name = 'x2')), '3 at a time', 'courier holds at most 3 active jobs');

-- Restaurant cancels an accepted job
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select cancel_delivery((select id from ids where name = 'x1'));
select pg_temp.check((select status from deliveries where id = (select id from ids where name = 'x1')) = 'cancelled', 'restaurant cancels before pickup');

-- Pausing a courier takes them offline and hides offers
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
select pg_temp.check((select count(*) from deliveries) = 5, 'admin sees every delivery');
select set_courier_status('00000000-0000-0000-0000-0000000000c2', 'paused');
select pg_temp.check((select online from couriers where id = '00000000-0000-0000-0000-0000000000c2') = false, 'paused courier is taken offline');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
select pg_temp.check((select count(*) from deliveries) = 0, 'paused courier sees no offers');
select pg_temp.expect_error(format($$select accept_delivery(%L)$$, (select id from ids where name = 'x2')), 'Only approved couriers', 'paused courier cannot accept');

-- Signed-out visitors see nothing and can call nothing
select pg_temp.as_editor();
set role anon;
select pg_temp.check((select count(*) from deliveries) = 0 and (select count(*) from restaurants) = 0, 'signed-out visitor sees nothing');
select pg_temp.expect_error($$select create_delivery('x', '', 'short', 'one_bag', 0)$$, 'permission denied', 'signed-out visitor cannot request a courier');
reset role;

\echo ALL TESTS PASSED
