-- Exercise real storage.objects rows and RLS, not only helper functions.
-- These are metadata-only local fixtures; no real files are created or removed.
begin;

create extension if not exists pgtap with schema extensions;
select plan(37);

-- Supabase Storage's statement-level DELETE guard is separate from RLS. Match
-- the Storage API session setting so these rollback-only tests reach DELETE
-- policies; this setting does not bypass grants or row-level authorization.
select set_config('storage.allow_delete_query', 'true', true);

insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8200-000000000001', 'authenticated', 'authenticated', 'storagenonmember@example.test', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8200-000000000002', 'authenticated', 'authenticated', 'storageactive@example.test', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8200-000000000003', 'authenticated', 'authenticated', 'storagegrace@example.test', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8200-000000000004', 'authenticated', 'authenticated', 'storageinactive@example.test', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8200-000000000005', 'authenticated', 'authenticated', 'storageexpired@example.test', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8200-000000000006', 'authenticated', 'authenticated', 'storagestaff@example.test', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.memberships (user_id, status, source, starts_at, access_until)
values
  ('00000000-0000-4000-8200-000000000002', 'active', 'manual', now() - interval '1 day', null),
  ('00000000-0000-4000-8200-000000000003', 'grace', 'manual', now() - interval '1 day', now() + interval '1 day'),
  ('00000000-0000-4000-8200-000000000004', 'inactive', 'manual', now() - interval '1 day', null),
  ('00000000-0000-4000-8200-000000000005', 'active', 'manual', now() - interval '1 day', now() - interval '1 minute');

insert into public.staff_roles (user_id, role, created_by)
values ('00000000-0000-4000-8200-000000000006', 'editor', '00000000-0000-4000-8200-000000000006');

insert into public.as_member_resources (id, as_id, slot_key, resource_type, title, storage_path, sort_order, active)
values
  ('30000000-0000-4000-8200-000000000001', 'AS01', 'as01-storage-active-test', 'file', 'Active Storage Fixture', 'test-private-assets/active.pdf', 1, true),
  ('30000000-0000-4000-8200-000000000002', 'AS01', 'as01-storage-inactive-test', 'file', 'Inactive Storage Fixture', 'test-private-assets/inactive.pdf', 2, false);

insert into storage.objects (id, bucket_id, name, metadata)
values
  ('40000000-0000-4000-8200-000000000001', 'member-assets', 'test-private-assets/active.pdf', '{"mimetype":"application/pdf","size":1}'),
  ('40000000-0000-4000-8200-000000000002', 'member-assets', 'test-private-assets/inactive.pdf', '{"mimetype":"application/pdf","size":1}'),
  ('40000000-0000-4000-8200-000000000003', 'member-assets', 'test-private-assets/unreferenced.pdf', '{"mimetype":"application/pdf","size":1}');

-- Deliberately model an accidentally broad future permissive policy. Every
-- deny case below must still hold through the protected bucket's restrictive
-- gates. This policy exists only inside this rolled-back test transaction.
create policy storage_test_broad_access
on storage.objects for all to anon, authenticated
using (true) with check (true);

select is((select bucket.public from storage.buckets as bucket where id = 'member-assets'), false,
  'member-assets is a private Storage bucket');
select ok((select relrowsecurity from pg_class where oid = 'storage.objects'::regclass),
  'storage.objects has RLS enabled');

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select is((select count(*) from storage.objects where bucket_id = 'member-assets'), 0::bigint,
  'anonymous visitor cannot list or read private Storage objects');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('member-assets', 'test-private-assets/anon-write.pdf')$$,
  '42501', null, 'anonymous visitor cannot insert private Storage objects'
);
select is_empty(
  $$update storage.objects set metadata = '{}'::jsonb where bucket_id = 'member-assets' returning id$$,
  'anonymous visitor cannot update private Storage objects'
);
select is_empty(
  $$delete from storage.objects where bucket_id = 'member-assets' returning id$$,
  'anonymous visitor cannot delete private Storage objects'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8200-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8200-000000000001","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from storage.objects where bucket_id = 'member-assets'), 0::bigint,
  'authenticated non-member cannot list or read private Storage objects');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('member-assets', 'test-private-assets/nonmember-write.pdf')$$,
  '42501', null, 'authenticated non-member cannot insert private Storage objects'
);
select is_empty(
  $$update storage.objects set metadata = '{}'::jsonb where bucket_id = 'member-assets' returning id$$,
  'authenticated non-member cannot update private Storage objects'
);
select is_empty(
  $$delete from storage.objects where bucket_id = 'member-assets' returning id$$,
  'authenticated non-member cannot delete private Storage objects'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8200-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8200-000000000002","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from storage.objects where bucket_id = 'member-assets' and name = 'test-private-assets/active.pdf'), 1::bigint,
  'active member reads an object referenced by an active AS resource');
select is((select count(*) from storage.objects where bucket_id = 'member-assets' and name = 'test-private-assets/inactive.pdf'), 0::bigint,
  'active member cannot read a guessed object referenced only by an inactive resource');
select is((select count(*) from storage.objects where bucket_id = 'member-assets' and name = 'test-private-assets/unreferenced.pdf'), 0::bigint,
  'active member cannot read a guessed unreferenced object');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('member-assets', 'test-private-assets/member-write.pdf')$$,
  '42501', null, 'active member cannot insert staff-managed Storage objects'
);
select is_empty(
  $$update storage.objects set metadata = '{}'::jsonb where bucket_id = 'member-assets' returning id$$,
  'read access does not let an active member update Storage objects'
);
select is_empty(
  $$delete from storage.objects where bucket_id = 'member-assets' returning id$$,
  'read access does not let an active member delete Storage objects'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8200-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8200-000000000003","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from storage.objects where bucket_id = 'member-assets'), 1::bigint,
  'grace member reads only the actively referenced object');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('member-assets', 'test-private-assets/grace-write.pdf')$$,
  '42501', null, 'grace member cannot insert Storage objects'
);
select is_empty(
  $$update storage.objects set metadata = '{}'::jsonb where bucket_id = 'member-assets' returning id$$,
  'grace member cannot update Storage objects'
);
select is_empty(
  $$delete from storage.objects where bucket_id = 'member-assets' returning id$$,
  'grace member cannot delete Storage objects'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8200-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8200-000000000004","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from storage.objects where bucket_id = 'member-assets'), 0::bigint,
  'inactive member cannot list or read private Storage objects');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('member-assets', 'test-private-assets/inactive-write.pdf')$$,
  '42501', null, 'inactive member cannot insert Storage objects'
);
select is_empty(
  $$update storage.objects set metadata = '{}'::jsonb where bucket_id = 'member-assets' returning id$$,
  'inactive member cannot update Storage objects'
);
select is_empty(
  $$delete from storage.objects where bucket_id = 'member-assets' returning id$$,
  'inactive member cannot delete Storage objects'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8200-000000000005', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8200-000000000005","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from storage.objects where bucket_id = 'member-assets'), 0::bigint,
  'expired active-status member cannot list or read private Storage objects');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('member-assets', 'test-private-assets/expired-write.pdf')$$,
  '42501', null, 'expired member cannot insert Storage objects'
);
select is_empty(
  $$update storage.objects set metadata = '{}'::jsonb where bucket_id = 'member-assets' returning id$$,
  'expired member cannot update Storage objects'
);
select is_empty(
  $$delete from storage.objects where bucket_id = 'member-assets' returning id$$,
  'expired member cannot delete Storage objects'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8200-000000000006', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8200-000000000006","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from storage.objects where bucket_id = 'member-assets'), 3::bigint,
  'staff without membership can inspect active, inactive, and unreferenced objects');
select lives_ok(
  $$insert into storage.objects (id, bucket_id, name, metadata) values ('40000000-0000-4000-8200-000000000004', 'member-assets', 'test-private-assets/staff-created.pdf', '{"mimetype":"application/pdf","size":1}')$$,
  'staff can insert a private Storage object'
);
select is((select count(*) from storage.objects where id = '40000000-0000-4000-8200-000000000004'), 1::bigint,
  'staff can read a newly inserted object before a resource references it');
select lives_ok(
  $$update storage.objects set metadata = '{"mimetype":"application/pdf","size":2}'::jsonb
    where id = '40000000-0000-4000-8200-000000000004'$$,
  'staff can update private Storage object metadata'
);
select is(
  (select metadata ->> 'size' from storage.objects where id = '40000000-0000-4000-8200-000000000004'),
  '2',
  'staff metadata update persists on the intended object'
);
select lives_ok(
  $$delete from storage.objects where id = '40000000-0000-4000-8200-000000000004'$$,
  'staff can delete a private Storage object through the RLS policy'
);
select is((select count(*) from storage.objects where id = '40000000-0000-4000-8200-000000000004'), 0::bigint,
  'staff deletion removes the test object row');

-- Revoking the resource or membership affects the next object query immediately.
reset role;
update public.as_member_resources set active = false where id = '30000000-0000-4000-8200-000000000001';
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8200-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8200-000000000002","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from storage.objects where bucket_id = 'member-assets'), 0::bigint,
  'deactivating the resource immediately removes member object access');

reset role;
update public.as_member_resources set active = true where id = '30000000-0000-4000-8200-000000000001';
update public.memberships set status = 'inactive' where user_id = '00000000-0000-4000-8200-000000000002';
set local role authenticated;

select is((select count(*) from storage.objects where bucket_id = 'member-assets'), 0::bigint,
  'deactivating membership immediately removes access to a still-active resource object');

select * from finish();
rollback;
