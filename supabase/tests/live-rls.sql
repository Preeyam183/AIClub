-- Run the entire script as the SQL editor's postgres role.
-- All fixtures, including synthetic Auth users, are rolled back. No passwords,
-- sessions, emails, or actual Storage files are created. Existing rows are never
-- updated or deleted. Do not run only a selected portion of this script.
begin;
set local statement_timeout = '15s';

do $rentcheck_tests$
declare
  test_owner uuid := gen_random_uuid();
  test_renter uuid := gen_random_uuid();
  test_stranger uuid := gen_random_uuid();
  test_listing uuid := gen_random_uuid();
  test_inquiry uuid := gen_random_uuid();
  renter_email text;
  visible_count integer;
  affected_count integer;
  blocked boolean;
begin
  renter_email := test_renter::text || '@rentcheck-test.invalid';
  insert into auth.users(id, email, aud, role) values
    (test_owner, test_owner::text || '@rentcheck-test.invalid', 'authenticated', 'authenticated'),
    (test_renter, renter_email, 'authenticated', 'authenticated'),
    (test_stranger, test_stranger::text || '@rentcheck-test.invalid', 'authenticated', 'authenticated');

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', test_owner::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', test_owner, 'role', 'authenticated', 'email', test_owner::text || '@rentcheck-test.invalid')::text, true);

  insert into public.rentcheck_listings
    (id, owner_id, title, description, address, city, state, price, beds, baths, sqft, listing_type, available_from, images, host_name)
  values
    (test_listing, test_owner, 'Temporary RentCheck test listing', 'Temporary automated access-control test. This transaction is rolled back.', 'Test address', 'Test city', 'NJ', 1800, 1, 1, 700, 'Lease', current_date, array['https://example.invalid/test.jpg'], 'Test host');

  perform set_config('request.jwt.claim.sub', test_renter::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', test_renter, 'role', 'authenticated', 'email', renter_email)::text, true);
  if auth.uid() <> test_renter then raise exception 'FAIL: renter identity'; end if;

  insert into public.rentcheck_favorites(user_id, listing_id) values (test_renter, test_listing);
  select count(*) into visible_count from public.rentcheck_favorites where listing_id = test_listing;
  if visible_count <> 1 then raise exception 'FAIL: renter can save and read a favorite'; end if;

  insert into public.rentcheck_inquiries(id, listing_id, sender_id, sender_email, message)
  values (test_inquiry, test_listing, test_renter, renter_email, 'Automated test inquiry. This will be rolled back.');
  select count(*) into visible_count from public.rentcheck_inquiries where id = test_inquiry;
  if visible_count <> 1 then raise exception 'FAIL: renter can send and read an inquiry'; end if;

  blocked := false;
  begin
    insert into public.rentcheck_inquiries(listing_id, sender_id, sender_email, message)
    values (test_listing, test_renter, renter_email, 'Duplicate inquiry must be rejected.');
  exception when unique_violation then blocked := true;
  end;
  if not blocked then raise exception 'FAIL: duplicate inquiry accepted'; end if;

  update public.rentcheck_listings set price = 1 where id = test_listing;
  get diagnostics affected_count = row_count;
  if affected_count <> 0 then raise exception 'FAIL: renter edited another owner listing'; end if;
  delete from public.rentcheck_listings where id = test_listing;
  get diagnostics affected_count = row_count;
  if affected_count <> 0 then raise exception 'FAIL: renter deleted another owner listing'; end if;

  perform set_config('request.jwt.claim.sub', test_stranger::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', test_stranger, 'role', 'authenticated', 'email', test_stranger::text || '@rentcheck-test.invalid')::text, true);
  select count(*) into visible_count from public.rentcheck_favorites where listing_id = test_listing;
  if visible_count <> 0 then raise exception 'FAIL: another user can read private favorites'; end if;
  select count(*) into visible_count from public.rentcheck_inquiries where id = test_inquiry;
  if visible_count <> 0 then raise exception 'FAIL: another user can read private inquiries'; end if;

  blocked := false;
  begin
    insert into public.rentcheck_inquiries(listing_id, sender_id, sender_email, message)
    values (test_listing, test_stranger, renter_email, 'Spoofed reply email must be rejected.');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'FAIL: spoofed inquiry email accepted'; end if;

  perform set_config('request.jwt.claim.sub', test_owner::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', test_owner, 'role', 'authenticated', 'email', test_owner::text || '@rentcheck-test.invalid')::text, true);
  select count(*) into visible_count from public.rentcheck_inquiries where id = test_inquiry;
  if visible_count <> 1 then raise exception 'FAIL: owner cannot read received inquiry'; end if;
  select count(*) into visible_count from public.rentcheck_favorites where listing_id = test_listing;
  if visible_count <> 0 then raise exception 'FAIL: owner can read renter private favorites'; end if;

  blocked := false;
  begin
    insert into public.rentcheck_inquiries(listing_id, sender_id, sender_email, message)
    values (test_listing, test_owner, test_owner::text || '@rentcheck-test.invalid', 'Owners must not contact their own listing.');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'FAIL: owner self inquiry accepted'; end if;

  update public.rentcheck_listings set status = 'rented' where id = test_listing;
  get diagnostics affected_count = row_count;
  if affected_count <> 1 then raise exception 'FAIL: owner cannot mark listing rented'; end if;

  execute 'set local role anon';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}', true);
  select count(*) into visible_count from public.rentcheck_listings where id = test_listing;
  if visible_count <> 0 then raise exception 'FAIL: anonymous visitor can see rented listing'; end if;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', test_stranger::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', test_stranger, 'role', 'authenticated', 'email', test_stranger::text || '@rentcheck-test.invalid')::text, true);
  blocked := false;
  begin
    insert into public.rentcheck_inquiries(listing_id, sender_id, sender_email, message)
    values (test_listing, test_stranger, test_stranger::text || '@rentcheck-test.invalid', 'Inquiries about rented places must be rejected.');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'FAIL: inquiry about rented listing accepted'; end if;

  perform set_config('request.jwt.claim.sub', test_owner::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', test_owner, 'role', 'authenticated', 'email', test_owner::text || '@rentcheck-test.invalid')::text, true);
  update public.rentcheck_listings set status = 'published' where id = test_listing;
  get diagnostics affected_count = row_count;
  if affected_count <> 1 then raise exception 'FAIL: owner cannot make listing available'; end if;
  delete from public.rentcheck_listings where id = test_listing;
  get diagnostics affected_count = row_count;
  if affected_count <> 1 then raise exception 'FAIL: owner cannot remove test listing'; end if;
  select count(*) into visible_count from public.rentcheck_inquiries where id = test_inquiry;
  if visible_count <> 0 then raise exception 'FAIL: inquiry not removed with test listing'; end if;

  perform set_config('request.jwt.claim.sub', test_renter::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', test_renter, 'role', 'authenticated', 'email', renter_email)::text, true);
  select count(*) into visible_count from public.rentcheck_favorites where listing_id = test_listing;
  if visible_count <> 0 then raise exception 'FAIL: favorite not removed with test listing'; end if;
  execute 'reset role';
end;
$rentcheck_tests$;

rollback;
select 'PASS: live renter/owner, favorites, inquiries, privacy, spoofing, ownership, rented status, and deletion cascade checks. All temporary test records rolled back.' as result;
