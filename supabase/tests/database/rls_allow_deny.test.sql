-- Release-blocking authorization matrix for phases 2-6.
-- All fixtures are synthetic and transactional; finish() plus rollback leaves
-- the local database unchanged.

begin;

create extension if not exists pgtap with schema extensions;

select plan(87);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'nonmember@example.test', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'owner@example.test', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'other@example.test', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'pending@example.test', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'accepted@example.test', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'inactive@example.test', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000007', 'authenticated', 'authenticated', 'grace@example.test', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000008', 'authenticated', 'authenticated', 'editor@example.test', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000009', 'authenticated', 'authenticated', 'expired@example.test', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'emailtarget@example.test', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.profiles (id, handle, name)
values
  ('00000000-0000-4000-8000-000000000002', 'owner-test', 'Owner Test'),
  ('00000000-0000-4000-8000-000000000003', 'other-test', 'Other Test'),
  ('00000000-0000-4000-8000-000000000004', 'pending-test', 'Pending Test'),
  ('00000000-0000-4000-8000-000000000005', 'accepted-test', 'Accepted Test'),
  ('00000000-0000-4000-8000-000000000006', 'inactive-test', 'Inactive Test'),
  ('00000000-0000-4000-8000-000000000007', 'grace-test', 'Grace Test'),
  ('00000000-0000-4000-8000-000000000009', 'expired-test', 'Expired Test'),
  ('00000000-0000-4000-8000-00000000000a', 'email-target-test', 'Email Target Test');

insert into public.memberships (
  user_id,
  status,
  source,
  starts_at,
  access_until
)
values
  ('00000000-0000-4000-8000-000000000002', 'active', 'manual', now() - interval '1 day', null),
  ('00000000-0000-4000-8000-000000000003', 'active', 'manual', now() - interval '1 day', null),
  ('00000000-0000-4000-8000-000000000004', 'active', 'invite', now() - interval '1 day', null),
  ('00000000-0000-4000-8000-000000000005', 'active', 'invite', now() - interval '1 day', null),
  ('00000000-0000-4000-8000-000000000006', 'inactive', 'manual', now() - interval '1 year', null),
  ('00000000-0000-4000-8000-000000000007', 'grace', 'manual', now() - interval '1 year', now() + interval '2 days'),
  ('00000000-0000-4000-8000-000000000009', 'active', 'manual', now() - interval '1 year', now() - interval '1 minute'),
  ('00000000-0000-4000-8000-00000000000a', 'active', 'invite', now() - interval '1 day', null);

insert into public.staff_roles (user_id, role, created_by)
values (
  '00000000-0000-4000-8000-000000000008',
  'editor',
  '00000000-0000-4000-8000-000000000008'
);

insert into public.states (
  id,
  owner_id,
  title,
  description,
  visibility,
  review_status,
  opened_at,
  opened_by
)
values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'Owner private one', null, 'private', 'none', null, null),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'Owner private two', null, 'private', 'none', null, null),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000003', 'Other private', null, 'private', 'none', null, null),
  ('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002', 'Member Index fixture', null, 'index', 'approved', now(), '00000000-0000-4000-8000-000000000008'),
  ('10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000006', 'Inactive owner private', null, 'private', 'none', null, null),
  ('10000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000009', 'Expired owner private', null, 'private', 'none', null, null),
  ('10000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000002', 'Lifecycle fixture', null, 'private', 'none', null, null),
  ('10000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000003', 'Connection target', null, 'private', 'none', null, null);

insert into public.materials (
  id,
  created_by,
  type,
  title,
  body,
  url
)
values
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'url', 'Private owner URL', null, 'https://same.example.test/reference'),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'text', 'Second private note', 'Only the owner of the second State should read this.', null),
  ('20000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000003', 'url', 'Other duplicate URL', null, 'https://same.example.test/reference'),
  ('20000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002', 'text', 'Index material', 'Visible to active and grace members through the Index State.', null),
  ('20000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000002', 'text', 'Orphan material', 'A creator alone cannot read an unassociated row.', null);

insert into public.state_materials (
  state_id,
  material_id,
  added_by,
  position,
  annotation
)
values
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 1024, 'Owner context'),
  ('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 1024, null),
  ('10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000003', 1024, null),
  ('10000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002', 1024, null);

insert into public.state_collaborators (
  state_id,
  user_id,
  role,
  status,
  invited_by,
  responded_at
)
values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004', 'editor', 'pending', '00000000-0000-4000-8000-000000000002', null),
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', 'editor', 'accepted', '00000000-0000-4000-8000-000000000002', now()),
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000009', 'editor', 'accepted', '00000000-0000-4000-8000-000000000002', now());

insert into public.as_member_resources (
  id,
  as_id,
  slot_key,
  resource_type,
  title,
  body,
  sort_order,
  active
)
values
  ('30000000-0000-4000-8000-000000000001', 'AS01', 'as01-active-test', 'text', 'Active fixture', 'Member-only body', 1, true),
  ('30000000-0000-4000-8000-000000000002', 'AS01', 'as01-inactive-test', 'text', 'Inactive fixture', 'Staff-only inactive body', 2, false);

-- Schema and grant boundaries.
select ok(
  (
    select relrowsecurity and relforcerowsecurity
    from pg_class
    where oid = 'public.states'::regclass
  ),
  'states has enabled and forced RLS'
);

select ok(
  (
    select relrowsecurity and relforcerowsecurity
    from pg_class
    where oid = 'public.materials'::regclass
  ),
  'materials has enabled and forced RLS'
);

select ok(
  (
    select relrowsecurity and relforcerowsecurity
    from pg_class
    where oid = 'public.state_materials'::regclass
  ),
  'state_materials has enabled and forced RLS'
);

select ok(
  (
    select relrowsecurity and relforcerowsecurity
    from pg_class
    where oid = 'public.state_collaborators'::regclass
  ),
  'state_collaborators has enabled and forced RLS'
);

select ok(
  not has_column_privilege('authenticated', 'public.states', 'visibility', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.states', 'review_status', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.states', 'owner_id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.states', 'opened_at', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.states', 'opened_by', 'UPDATE'),
  'authenticated clients cannot directly update ownership or editorial columns'
);

select ok(
  not has_table_privilege('authenticated', 'public.staff_roles', 'INSERT')
  and not has_table_privilege('authenticated', 'public.memberships', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.materials', 'INSERT'),
  'authenticated clients cannot forge staff, entitlement, or material rows'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.invite_state_collaborator_by_email(uuid,uuid,text)',
    'EXECUTE'
  ),
  'email resolver RPC is service-role only'
);

select ok(
  not has_table_privilege('anon', 'public.states', 'SELECT')
  and not has_table_privilege('anon', 'public.materials', 'SELECT')
  and not has_table_privilege('anon', 'public.state_collaborators', 'SELECT'),
  'anonymous role has no State-layer read grants'
);

-- Authenticated non-member: Auth identity alone grants no institutional data.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.states), 0::bigint,
  'authenticated non-member sees no States');
select is((select count(*) from public.profiles), 0::bigint,
  'authenticated non-member sees no profiles');
select is((select count(*) from public.as_member_resources), 0::bigint,
  'authenticated non-member sees no AS member resources');
select throws_ok(
  $$insert into public.states (owner_id, title, description)
    values ('00000000-0000-4000-8000-000000000001', 'Non-member attempt', null)$$,
  '42501',
  null,
  'authenticated non-member cannot create a private State'
);

reset role;

-- Owner: own paths are visible, unrelated paths and orphans are not.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.states where id = '10000000-0000-4000-8000-000000000001'),
  1::bigint,
  'owner reads own private State'
);
select is(
  (select count(*) from public.states where id = '10000000-0000-4000-8000-000000000003'),
  0::bigint,
  'owner cannot read another member private State'
);
select is(
  (select count(*) from public.materials where id = '20000000-0000-4000-8000-000000000001'),
  1::bigint,
  'owner reads material through own State association'
);
select is(
  (select count(*) from public.materials where id = '20000000-0000-4000-8000-000000000005'),
  0::bigint,
  'material creator cannot read an orphan outside an authorized State path'
);
select is(
  (select count(*) from public.state_materials where state_id = '10000000-0000-4000-8000-000000000001'),
  1::bigint,
  'owner reads contextual material association and annotation'
);
select lives_ok(
  $$insert into public.states (owner_id, title, description)
    values ('00000000-0000-4000-8000-000000000002', 'Created through member grant', null)$$,
  'active owner creates a private State using only permitted columns'
);
select throws_ok(
  $$insert into public.states (owner_id, title, description)
    values ('00000000-0000-4000-8000-000000000003', 'Forbidden ownership', null)$$,
  '42501',
  null,
  'active member cannot create a State for another user'
);
select throws_ok(
  $$update public.states
    set visibility = 'index'
    where id = '10000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'owner cannot self-publish by directly changing visibility'
);
select throws_ok(
  $$update public.states
    set owner_id = '00000000-0000-4000-8000-000000000003'
    where id = '10000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'owner cannot transfer ownership through direct update'
);
select lives_ok(
  $$select public.add_state_material(
    '10000000-0000-4000-8000-000000000001',
    'url',
    'Added URL',
    null,
    'https://added.example.test/research',
    null
  )$$,
  'owner adds URL material through the atomic RPC'
);
select lives_ok(
  $$select public.add_state_material(
    '10000000-0000-4000-8000-000000000001',
    'text',
    'Added note',
    'Plain text only.',
    null,
    'State context'
  )$$,
  'owner adds plain text material through the atomic RPC'
);
select throws_ok(
  $$select public.add_state_material(
    '10000000-0000-4000-8000-000000000001',
    'file',
    'Deferred upload',
    null,
    null,
    null
  )$$,
  '22023',
  'unsupported material type',
  'browser material RPC rejects deferred file uploads'
);

reset role;

-- An unrelated active member cannot enumerate guessed private UUIDs or reuse
-- private materials, but can read/connect material already opened in the Index.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.states where id = '10000000-0000-4000-8000-000000000001'),
  0::bigint,
  'guessed private State UUID returns no row to another active member'
);
select is(
  (select count(*) from public.materials where id = '20000000-0000-4000-8000-000000000001'),
  0::bigint,
  'guessed private material UUID returns no row to another active member'
);
select is(
  (select count(*) from public.state_materials where state_id = '10000000-0000-4000-8000-000000000001'),
  0::bigint,
  'private State connection metadata is not enumerable'
);
select is(
  (select count(*) from public.materials where url = 'https://same.example.test/reference'),
  1::bigint,
  'same URL in unrelated private States reveals only the actor visible copy'
);
select is(
  (select count(*) from public.states where id = '10000000-0000-4000-8000-000000000004'),
  1::bigint,
  'active member reads a staff-opened Index State'
);
select is(
  (select count(*) from public.materials where id = '20000000-0000-4000-8000-000000000004'),
  1::bigint,
  'active member reads material through an Index State association'
);
select is_empty(
  $$update public.states
    set title = 'Forbidden edit'
    where id = '10000000-0000-4000-8000-000000000001'
    returning id$$,
  'unrelated member cannot edit a private State'
);
select throws_ok(
  $$select public.connect_state_material(
    '10000000-0000-4000-8000-000000000008',
    '20000000-0000-4000-8000-000000000001',
    null
  )$$,
  '42501',
  'material unavailable',
  'member cannot CONNECT a hidden private material by guessed UUID'
);
select lives_ok(
  $$select public.connect_state_material(
    '10000000-0000-4000-8000-000000000008',
    '20000000-0000-4000-8000-000000000004',
    'Connected from Index'
  )$$,
  'member can CONNECT an already-visible Index material without copying it'
);
select is(
  (
    select count(*)
    from public.state_materials
    where state_id = '10000000-0000-4000-8000-000000000008'
      and material_id = '20000000-0000-4000-8000-000000000004'
  ),
  1::bigint,
  'CONNECT creates the association in the editable destination State'
);
select lives_ok(
  $$select public.reorder_state_materials(
    '10000000-0000-4000-8000-000000000008',
    array['20000000-0000-4000-8000-000000000004'::uuid]
  )$$,
  'owner can reorder the exact material association set'
);
select throws_ok(
  $$select public.reorder_state_materials(
    '10000000-0000-4000-8000-000000000008',
    array[]::uuid[]
  )$$,
  '22023',
  'invalid material order',
  'reorder rejects an incomplete association set'
);

reset role;

-- Pending collaborator: invitation is visible to the invitee, State/material
-- content is not. Acceptance grants only this State, and revocation is immediate.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.state_collaborators where state_id = '10000000-0000-4000-8000-000000000001'),
  1::bigint,
  'pending invitee reads only their own invitation row'
);
select is(
  (select count(*) from public.states where id = '10000000-0000-4000-8000-000000000001'),
  0::bigint,
  'pending invitation grants no State access'
);
select is(
  (select count(*) from public.materials where id = '20000000-0000-4000-8000-000000000001'),
  0::bigint,
  'pending invitation grants no material access'
);
select throws_ok(
  $$select public.add_state_material(
    '10000000-0000-4000-8000-000000000001',
    'text',
    null,
    'Pending users cannot write.',
    null,
    null
  )$$,
  '42501',
  'operation not permitted',
  'pending invitation grants no material write access'
);
select lives_ok(
  $$select public.respond_to_state_invitation(
    '10000000-0000-4000-8000-000000000001',
    true
  )$$,
  'invitee can accept their own pending invitation'
);
select is(
  (select count(*) from public.states where id = '10000000-0000-4000-8000-000000000001'),
  1::bigint,
  'accepted invitation grants access to that State'
);
select is(
  (select count(*) from public.states where id = '10000000-0000-4000-8000-000000000002'),
  0::bigint,
  'accepted collaborator still cannot see owner other private State'
);
select lives_ok(
  $$update public.states
    set title = 'Collaborator metadata edit'
    where id = '10000000-0000-4000-8000-000000000001'$$,
  'accepted editor can update ordinary State metadata'
);
select throws_ok(
  $$select public.invite_state_collaborator(
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000007'
  )$$,
  '42501',
  'operation not permitted',
  'collaborator cannot invite another collaborator'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$select public.revoke_state_collaborator(
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000004'
  )$$,
  'owner can revoke an accepted collaborator'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.states where id = '10000000-0000-4000-8000-000000000001'),
  0::bigint,
  'revoked collaborator loses State access immediately at RLS'
);
select is(
  (select count(*) from public.materials where id = '20000000-0000-4000-8000-000000000001'),
  0::bigint,
  'revoked collaborator loses material access immediately at RLS'
);

reset role;

-- A pre-accepted collaborator may read/edit only the explicitly scoped State.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000005', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.states where id = '10000000-0000-4000-8000-000000000001'),
  1::bigint,
  'accepted collaborator reads the explicitly shared private State'
);
select is(
  (select count(*) from public.states where id = '10000000-0000-4000-8000-000000000002'),
  0::bigint,
  'accepted collaborator cannot enumerate another owner State'
);
select is(
  (select count(*) from public.materials where id = '20000000-0000-4000-8000-000000000001'),
  1::bigint,
  'accepted collaborator reads material through the shared State only'
);
select lives_ok(
  $$select public.add_state_material(
    '10000000-0000-4000-8000-000000000001',
    'text',
    'Collaborator note',
    'Accepted collaborators can add plain text.',
    null,
    null
  )$$,
  'accepted editor can add material to the explicitly shared State'
);

reset role;

-- Inactive and expired entitlements fail closed even for ownership or an
-- accepted collaborator row. Grace remains an active entitlement.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000006', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.states), 0::bigint,
  'inactive owner cannot read retained State data');

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000009', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000009","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.states), 0::bigint,
  'expired entitlement cannot read owned, collaborated, or Index States');
select is((select count(*) from public.as_member_resources), 0::bigint,
  'expired entitlement cannot read AS member enrichment');
select is((select count(*) from public.profiles), 0::bigint,
  'expired entitlement cannot read member profiles');

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000007', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000007","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.states where visibility = 'index'),
  1::bigint,
  'grace entitlement can read the member-only Index'
);
select is(
  (select count(*) from public.as_member_resources where active),
  1::bigint,
  'grace entitlement can read active AS member enrichment'
);
select ok((select count(*) from public.profiles) >= 1,
  'grace entitlement can read member bibliography');

reset role;

-- Owner-only direct invitations and the email-enumeration guard.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$select public.invite_state_collaborator(
    '10000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000007'
  )$$,
  'owner can invite a known active/grace member UUID'
);
select is(
  (
    select count(*)
    from public.state_collaborators
    where state_id = '10000000-0000-4000-8000-000000000002'
      and user_id = '00000000-0000-4000-8000-000000000007'
  ),
  0::bigint,
  'owner cannot see a pending direct UUID invitation or infer an email collision'
);

reset role;
set local role service_role;

select lives_ok(
  $$select public.invite_state_collaborator_by_email(
    '00000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    'emailtarget@example.test'
  )$$,
  'trusted email resolver records an eligible pending invitation'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select is(
  (
    select count(*)
    from public.state_collaborators
    where state_id = '10000000-0000-4000-8000-000000000002'
      and user_id = '00000000-0000-4000-8000-00000000000a'
  ),
  0::bigint,
  'owner cannot infer whether a pending email invitation resolved'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

select is(
  (
    select count(*)
    from public.state_collaborators
    where state_id = '10000000-0000-4000-8000-000000000002'
      and status = 'pending'
  ),
  1::bigint,
  'resolved email invitee can read their own pending invitation'
);

reset role;

-- Curated lifecycle: member submits/withdraws; only staff atomically opens,
-- rejects, or closes. Index visibility never grants edit rights.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$select public.submit_state('10000000-0000-4000-8000-000000000007')$$,
  'owner can submit a private State for review'
);
select is(
  (
    select review_status::text
    from public.states
    where id = '10000000-0000-4000-8000-000000000007'
  ),
  'submitted',
  'submission changes review status but remains owner-visible'
);
select throws_ok(
  $$select public.review_state(
    '10000000-0000-4000-8000-000000000007',
    'approve'
  )$$,
  '42501',
  'operation not permitted',
  'owner cannot self-approve a submitted State'
);
select is_empty(
  $$delete from public.states
    where id = '10000000-0000-4000-8000-000000000007'
    returning id$$,
  'owner cannot delete a State while it is submitted'
);
select lives_ok(
  $$select public.withdraw_state('10000000-0000-4000-8000-000000000007')$$,
  'owner can withdraw a pending submission'
);
select lives_ok(
  $$select public.submit_state('10000000-0000-4000-8000-000000000007')$$,
  'owner can resubmit a withdrawn State'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000008', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000008","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$select public.review_state(
    '10000000-0000-4000-8000-000000000007',
    null
  )$$,
  '22023',
  'invalid review action',
  'staff review explicitly rejects a null action on a submitted State'
);
select lives_ok(
  $$select public.review_state(
    '10000000-0000-4000-8000-000000000007',
    'approve'
  )$$,
  'staff editor can approve and open a submitted State atomically'
);
select ok((select count(*) from public.states) >= 8,
  'staff can read private States for scoped editorial and security work');
select is((select count(*) from public.as_member_resources), 2::bigint,
  'staff can read active and inactive AS member resources');
select is(
  (
    select visibility::text || '/' || review_status::text
    from public.states
    where id = '10000000-0000-4000-8000-000000000007'
  ),
  'index/approved',
  'approved State enters the member-only Index with approved status'
);
select throws_ok(
  $$select public.review_state(
    '10000000-0000-4000-8000-000000000007',
    null
  )$$,
  '22023',
  'invalid review action',
  'staff review cannot interpret a null action as closing an Index State'
);
select throws_ok(
  $$select public.review_state(
    '10000000-0000-4000-8000-000000000007',
    'invalid'
  )$$,
  '22023',
  'invalid review action',
  'staff review rejects unrecognized non-null actions'
);
select is(
  (
    select visibility::text || '/' || review_status::text
    from public.states
    where id = '10000000-0000-4000-8000-000000000007'
  ),
  'index/approved',
  'invalid review actions leave Index visibility and approval intact'
);
select is(
  (
    select count(*)
    from public.audit_log
    where object_id = '10000000-0000-4000-8000-000000000007'
      and event_type = 'state.closed'
  ),
  0::bigint,
  'invalid review actions do not write a closure audit event'
);
select is_empty(
  $$update public.states
    set title = 'Staff must not rewrite member work'
    where id = '10000000-0000-4000-8000-000000000007'
    returning id$$,
  'staff bypass is scoped and does not grant direct member-content editing'
);
select ok(
  (
    select count(*) >= 1
    from public.audit_log
    where object_id = '10000000-0000-4000-8000-000000000007'
      and event_type = 'state.approved'
  ),
  'staff review transition writes an audit event'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.states where id = '10000000-0000-4000-8000-000000000007'),
  1::bigint,
  'all active members can read a newly approved Index State'
);
select is_empty(
  $$update public.states
    set title = 'Index is not collaborative by visibility'
    where id = '10000000-0000-4000-8000-000000000007'
    returning id$$,
  'Index visibility does not grant unrelated members edit rights'
);
select is((select count(*) from public.audit_log), 0::bigint,
  'ordinary active members cannot read staff audit records');

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000008', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000008","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$select public.review_state(
    '10000000-0000-4000-8000-000000000007',
    'close'
  )$$,
  'staff can close an Index State without deleting member work'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.states where id = '10000000-0000-4000-8000-000000000007'),
  0::bigint,
  'closed State immediately leaves the Index for unrelated members'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select is(
  (
    select visibility::text || '/' || review_status::text
    from public.states
    where id = '10000000-0000-4000-8000-000000000007'
  ),
  'private/withdrawn',
  'owner retains closed State privately without losing the work'
);

select * from finish();
rollback;
