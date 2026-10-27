-- Curated membership applications: public intake, staff-only review, no
-- automatic Auth or entitlement changes. Synthetic data is transactional.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (
  instance_id, id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  'f0000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'admissioneditor@example.test', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now()
);

insert into public.staff_roles (user_id, role, created_by)
values (
  'f0000000-0000-4000-8000-000000000001',
  'editor',
  'f0000000-0000-4000-8000-000000000001'
);

select ok(not has_function_privilege('anon', 'public.submit_membership_application(text,text,text,text,text,text,text)', 'EXECUTE'),
  'anonymous visitors cannot submit while admissions are closed');
select ok(not has_function_privilege('authenticated', 'public.submit_membership_application(text,text,text,text,text,text,text)', 'EXECUTE'),
  'signed-in members cannot bypass the closed admissions gate');
select ok(not has_table_privilege('anon', 'public.membership_applications', 'SELECT'),
  'anonymous visitors cannot list applications');
select ok(not has_table_privilege('anon', 'public.membership_applications', 'INSERT'),
  'anonymous visitors cannot insert arbitrary application records');
select ok(not has_function_privilege('anon', 'public.review_membership_application(uuid,text,text)', 'EXECUTE'),
  'anonymous visitors cannot call review');

set local role service_role;
select lives_ok(
  $$select public.submit_membership_application(
    'Research Artist', 'Artist@Example.Test',
    'Independent research and film practice', 'Dublin',
    'https://example.test/work',
    'I would like to develop situated research and contribute to shared institutional work.',
    null
  )$$,
  'privileged intake RPC accepts a valid application'
);
select lives_ok(
  $$select public.submit_membership_application(
    'Research Artist', 'ARTIST@EXAMPLE.TEST',
    'Independent research and film practice', 'Dublin',
    'https://example.test/work',
    'I would like to develop situated research and contribute to shared institutional work.',
    null
  )$$,
  'repeat submission does not disclose other applications'
);
select throws_ok(
  $$select public.submit_membership_application(
    'Test Name', 'invalid', 'A suitable detailed practice', null, null,
    'A valid length of application statement is provided here.', null
  )$$,
  '22023', 'invalid application', 'reject invalid email addresses'
);
reset role;

select is(
  (select count(*) from public.membership_applications where email = 'artist@example.test'),
  2::bigint, 'unverified email cannot block another application'
);

select set_config('request.jwt.claim.sub', 'f0000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"f0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.membership_applications), 0::bigint,
  'authenticated non-staff cannot read applications');
select throws_ok(
  $$select public.review_membership_application(
    (select id from public.membership_applications limit 1), 'accepted', null
  )$$,
  '42501', 'operation not permitted', 'non-staff cannot review applications'
);
reset role;

select set_config('request.jwt.claim.sub', 'f0000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"f0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.membership_applications), 2::bigint,
  'staff member can view the queue');
select lives_ok(
  $$select public.review_membership_application(
    (select id from public.membership_applications limit 1), 'accepted', 'Research fit'
  )$$,
  'staff member can accept application'
);
reset role;

select is((select status::text from public.membership_applications where status = 'accepted' limit 1),
  'accepted', 'review decision is persisted');
select is((select count(*) from public.memberships), 0::bigint,
  'acceptance does not create a membership entitlement');

set local role anon;
select ok(not has_table_privilege('anon', 'public.membership_applications', 'UPDATE'),
  'anonymous visitors cannot amend admissions');
reset role;

select * from finish();
rollback;
