-- Regression for email-to-UUID invitation collision probing. The inviter sees
-- accepted collaborators only; invitees and staff retain their scoped records.
begin;

create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8100-000000000001', 'authenticated', 'authenticated', 'inviteowner@example.test', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8100-000000000002', 'authenticated', 'authenticated', 'uuidtarget@example.test', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8100-000000000003', 'authenticated', 'authenticated', 'collisiontarget@example.test', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8100-000000000004', 'authenticated', 'authenticated', 'invitestaff@example.test', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.profiles (id, name)
values
  ('00000000-0000-4000-8100-000000000001', 'Invitation Owner Fixture'),
  ('00000000-0000-4000-8100-000000000002', 'UUID Target Fixture'),
  ('00000000-0000-4000-8100-000000000003', 'Email Target Fixture');

insert into public.memberships (user_id, status, source, starts_at)
values
  ('00000000-0000-4000-8100-000000000001', 'active', 'manual', now() - interval '1 day'),
  ('00000000-0000-4000-8100-000000000002', 'active', 'manual', now() - interval '1 day'),
  ('00000000-0000-4000-8100-000000000003', 'active', 'manual', now() - interval '1 day');

insert into public.staff_roles (user_id, role, created_by)
values ('00000000-0000-4000-8100-000000000004', 'editor', '00000000-0000-4000-8100-000000000004');

insert into public.states (id, owner_id, title)
values ('10000000-0000-4000-8100-000000000001', '00000000-0000-4000-8100-000000000001', 'Invitation Collision Fixture');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8100-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8100-000000000001","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$select public.invite_state_collaborator('10000000-0000-4000-8100-000000000001', '00000000-0000-4000-8100-000000000002')$$,
  'owner can issue a direct UUID invitation'
);
select is((select count(*) from public.state_collaborators), 0::bigint,
  'a direct invitation is hidden from its owner while pending');

reset role;
set local role service_role;

select lives_ok(
  $$select public.invite_state_collaborator_by_email('00000000-0000-4000-8100-000000000001', '10000000-0000-4000-8100-000000000001', 'unknown-invite@example.test')$$,
  'an unresolved email invitation returns the same void response'
);
select lives_ok(
  $$select public.invite_state_collaborator_by_email('00000000-0000-4000-8100-000000000001', '10000000-0000-4000-8100-000000000001', 'collisiontarget@example.test')$$,
  'an eligible email invitation returns a void response'
);
select is(
  (select count(*) from public.state_collaborators where user_id = '00000000-0000-4000-8100-000000000003' and invited_via_email and status = 'pending'),
  1::bigint,
  'the email probe has created a pending row before the UUID collision'
);

reset role;
set local role authenticated;

select lives_ok(
  $$select public.invite_state_collaborator('10000000-0000-4000-8100-000000000001', '00000000-0000-4000-8100-000000000003')$$,
  'a UUID invitation colliding with a pending email invitation returns normally'
);
select is((select count(*) from public.state_collaborators), 0::bigint,
  'owner listings expose neither the colliding email invitation nor the new UUID invitation');

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8100-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8100-000000000003","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.state_collaborators where status = 'pending'), 1::bigint,
  'email invitee can read their pending invitation after the collision');
select is((select count(*) from public.states), 0::bigint,
  'pending invitation still grants no private State access');
select lives_ok(
  $$select public.respond_to_state_invitation('10000000-0000-4000-8100-000000000001', false)$$,
  'invitee can decline the invitation'
);
select is((select count(*) from public.state_collaborators where status = 'declined'), 1::bigint,
  'invitee retains access to their declined invitation');

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8100-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8100-000000000001","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.state_collaborators), 0::bigint,
  'owner cannot infer an email result from a declined invitation');

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8100-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8100-000000000004","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.state_collaborators where status in ('pending', 'declined')), 2::bigint,
  'staff without membership can inspect pending and declined invitations');

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8100-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8100-000000000001","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$select public.invite_state_collaborator('10000000-0000-4000-8100-000000000001', '00000000-0000-4000-8100-000000000003')$$,
  'owner can invite again by UUID after a decline'
);
select is((select count(*) from public.state_collaborators), 0::bigint,
  'switching a declined email invitation to a UUID invitation does not reveal it');

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8100-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8100-000000000003","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$select public.respond_to_state_invitation('10000000-0000-4000-8100-000000000001', true)$$,
  'invitee can explicitly accept the renewed invitation'
);
select is((select count(*) from public.states), 1::bigint,
  'accepted invitation grants the invitee scoped private State access');

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8100-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8100-000000000001","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.state_collaborators where status = 'accepted'), 1::bigint,
  'owner can see the collaborator after explicit acceptance');
select lives_ok(
  $$select public.revoke_state_collaborator('10000000-0000-4000-8100-000000000001', '00000000-0000-4000-8100-000000000003')$$,
  'owner can revoke an accepted collaborator'
);
select is((select count(*) from public.state_collaborators), 0::bigint,
  'revoked UUID and pending UUID invitations are uniformly hidden from the owner');

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8100-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8100-000000000003","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.state_collaborators where status = 'revoked'), 1::bigint,
  'invitee retains access to their revoked invitation');
select is((select count(*) from public.states), 0::bigint,
  'revocation immediately removes State access');

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8100-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8100-000000000004","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.state_collaborators), 2::bigint,
  'staff retains access to pending and revoked invitation records');
select is((select count(*) from public.state_collaborators where status = 'revoked'), 1::bigint,
  'staff can distinguish the revoked invitation for administration');

select * from finish();
rollback;
