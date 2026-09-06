-- Phase 5: explicit, State-scoped collaboration.
--
-- Pending invitations never satisfy the State authorization helper. All
-- unaccepted invitations are hidden from the owner, regardless of invite method.
-- Otherwise an owner could combine an email invite with a UUID invite and infer
-- the email-to-member match from an existing-row collision's visible outcome.

begin;

create type public.state_collaborator_role as enum ('editor');
create type public.state_collaborator_status as enum (
  'pending',
  'accepted',
  'declined',
  'revoked'
);

create table public.state_collaborators (
  state_id uuid not null references public.states (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.state_collaborator_role not null default 'editor',
  status public.state_collaborator_status not null default 'pending',
  invited_by uuid not null references auth.users (id) on delete cascade,
  invited_via_email boolean not null default false,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (state_id, user_id),
  constraint state_collaborators_not_owner_check check (user_id <> invited_by),
  constraint state_collaborators_response_time_check check (
    (status = 'pending' and responded_at is null)
    or (status <> 'pending' and responded_at is not null)
  )
);

create index state_collaborators_user_status_idx
  on public.state_collaborators (user_id, status, created_at desc);
create index state_collaborators_state_status_idx
  on public.state_collaborators (state_id, status, user_id);

create trigger state_collaborators_set_updated_at
before update on public.state_collaborators
for each row execute function private.set_updated_at();

create or replace function private.is_state_collaborator(
  target_state_id uuid,
  check_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select check_user_id is not null
    and exists (
      select 1
      from public.state_collaborators as collaborator
      where collaborator.state_id = target_state_id
        and collaborator.user_id = check_user_id
        and collaborator.status = 'accepted'
        and collaborator.role = 'editor'
    );
$$;

create or replace function private.can_view_state(
  target_state_id uuid,
  check_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_staff(check_user_id, null)
    or (
      private.is_active_member(check_user_id)
      and exists (
        select 1
        from public.states as state
        where state.id = target_state_id
          and (
            state.owner_id = check_user_id
            or state.visibility = 'index'
            or private.is_state_collaborator(state.id, check_user_id)
          )
      )
    );
$$;

create or replace function private.can_edit_state(
  target_state_id uuid,
  check_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_member(check_user_id)
    and (
      private.is_state_owner(target_state_id, check_user_id)
      or private.is_state_collaborator(target_state_id, check_user_id)
    );
$$;

create or replace function private.audit_state_collaborator_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  collaborator_state_id uuid := coalesce(new.state_id, old.state_id);
  collaborator_user_id uuid := coalesce(new.user_id, old.user_id);
  collaborator_status public.state_collaborator_status := coalesce(new.status, old.status);
  event_actor uuid := coalesce(auth.uid(), new.invited_by, old.invited_by);
  event_name text;
begin
  if tg_op = 'INSERT' then
    event_name := 'collaboration.invited';
  elsif collaborator_status = 'accepted' then
    event_name := 'collaboration.accepted';
  elsif collaborator_status = 'declined' then
    event_name := 'collaboration.declined';
  elsif collaborator_status = 'revoked' then
    event_name := 'collaboration.revoked';
  else
    event_name := 'collaboration.updated';
  end if;

  perform private.write_audit(
    event_name,
    'state',
    collaborator_state_id,
    jsonb_build_object(
      'collaborator_user_id', collaborator_user_id,
      'status', collaborator_status
    ),
    event_actor
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger state_collaborators_audit_change
after insert or update or delete on public.state_collaborators
for each row execute function private.audit_state_collaborator_change();

revoke all on function private.is_state_collaborator(uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.can_view_state(uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.can_edit_state(uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.audit_state_collaborator_change()
  from public, anon, authenticated;
grant execute on function private.is_state_collaborator(uuid, uuid)
  to authenticated;
grant execute on function private.can_view_state(uuid, uuid)
  to authenticated;
grant execute on function private.can_edit_state(uuid, uuid)
  to authenticated;

alter table public.state_collaborators enable row level security;
alter table public.state_collaborators force row level security;

revoke all on table public.state_collaborators from public, anon, authenticated;
grant select on table public.state_collaborators to authenticated;
grant select, insert, update, delete on table public.state_collaborators to service_role;

create policy state_collaborators_participant_select_allow
on public.state_collaborators
for select
to authenticated
using (
  private.is_staff((select auth.uid()), null)
  or (
    private.is_active_member((select auth.uid()))
    and (
      user_id = (select auth.uid())
      or (
        private.is_state_owner(state_id, (select auth.uid()))
        and status = 'accepted'
      )
      or (
        status = 'accepted'
        and private.is_state_collaborator(state_id, (select auth.uid()))
      )
    )
  )
);

create policy state_collaborators_participant_select_gate
on public.state_collaborators
as restrictive
for select
to authenticated
using (
  private.is_staff((select auth.uid()), null)
  or (
    private.is_active_member((select auth.uid()))
    and (
      user_id = (select auth.uid())
      or (
        private.is_state_owner(state_id, (select auth.uid()))
        and status = 'accepted'
      )
      or (
        status = 'accepted'
        and private.is_state_collaborator(state_id, (select auth.uid()))
      )
    )
  )
);

create or replace function public.invite_state_collaborator(
  target_state_id uuid,
  target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
begin
  perform 1
  from public.states
  where id = target_state_id
  for update;

  if not found
    or not private.is_active_member(actor_id)
    or not private.is_state_owner(target_state_id, actor_id)
  then
    raise exception using errcode = '42501', message = 'operation not permitted';
  end if;

  -- A UUID invite is intended only for a member identity already visible to the
  -- caller through profiles. Invalid/inactive targets are deliberately a no-op.
  if target_user_id is null
    or target_user_id = actor_id
    or not private.is_active_member(target_user_id)
  then
    return;
  end if;

  insert into public.state_collaborators (
    state_id,
    user_id,
    role,
    status,
    invited_by,
    invited_via_email,
    responded_at
  )
  values (
    target_state_id,
    target_user_id,
    'editor',
    'pending',
    actor_id,
    false,
    null
  )
  on conflict (state_id, user_id) do update
    set role = 'editor',
        status = 'pending',
        invited_by = actor_id,
        invited_via_email = false,
        responded_at = null
  where public.state_collaborators.status in ('declined', 'revoked');
end;
$$;

create or replace function public.respond_to_state_invitation(
  target_state_id uuid,
  accept boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  current_status public.state_collaborator_status;
begin
  if not private.is_active_member(actor_id) then
    raise exception using errcode = '42501', message = 'operation not permitted';
  end if;

  select collaborator.status
  into current_status
  from public.state_collaborators as collaborator
  where collaborator.state_id = target_state_id
    and collaborator.user_id = actor_id
  for update;

  if not found or current_status <> 'pending' or accept is null then
    raise exception using errcode = '42501', message = 'operation not permitted';
  end if;

  update public.state_collaborators
  set status = (case when accept then 'accepted' else 'declined' end)
        ::public.state_collaborator_status,
      responded_at = now()
  where state_id = target_state_id
    and user_id = actor_id;
end;
$$;

create or replace function public.revoke_state_collaborator(
  target_state_id uuid,
  target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
begin
  perform 1
  from public.states
  where id = target_state_id
  for update;

  if not found
    or not (
      (
        private.is_active_member(actor_id)
        and private.is_state_owner(target_state_id, actor_id)
      )
      or private.is_staff(actor_id, null)
    )
  then
    raise exception using errcode = '42501', message = 'operation not permitted';
  end if;

  update public.state_collaborators
  set status = 'revoked',
      responded_at = now()
  where state_id = target_state_id
    and user_id = target_user_id
    and status in ('pending', 'accepted');
end;
$$;

-- Trusted Edge Function boundary for email invitations. It resolves auth.users
-- without returning identity data. Only service_role may execute this function.
create or replace function public.invite_state_collaborator_by_email(
  requesting_user_id uuid,
  target_state_id uuid,
  target_email text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(btrim(target_email));
  resolved_user_id uuid;
begin
  perform 1
  from public.states
  where id = target_state_id
  for update;

  if not found
    or not private.is_active_member(requesting_user_id)
    or not private.is_state_owner(target_state_id, requesting_user_id)
  then
    raise exception using errcode = '42501', message = 'operation not permitted';
  end if;

  if normalized_email is null
    or char_length(normalized_email) > 254
    or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  then
    return;
  end if;

  select account.id
  into resolved_user_id
  from auth.users as account
  where lower(account.email) = normalized_email
    and private.is_active_member(account.id)
  limit 1;

  if resolved_user_id is null or resolved_user_id = requesting_user_id then
    return;
  end if;

  insert into public.state_collaborators (
    state_id,
    user_id,
    role,
    status,
    invited_by,
    invited_via_email,
    responded_at
  )
  values (
    target_state_id,
    resolved_user_id,
    'editor',
    'pending',
    requesting_user_id,
    true,
    null
  )
  on conflict (state_id, user_id) do update
    set role = 'editor',
        status = 'pending',
        invited_by = requesting_user_id,
        invited_via_email = true,
        responded_at = null
  where public.state_collaborators.status in ('declined', 'revoked');
end;
$$;

revoke all on function public.invite_state_collaborator(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.respond_to_state_invitation(uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.revoke_state_collaborator(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.invite_state_collaborator_by_email(uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.invite_state_collaborator(uuid, uuid)
  to authenticated;
grant execute on function public.respond_to_state_invitation(uuid, boolean)
  to authenticated;
grant execute on function public.revoke_state_collaborator(uuid, uuid)
  to authenticated;
grant execute on function public.invite_state_collaborator_by_email(uuid, uuid, text)
  to service_role;

comment on table public.state_collaborators is
  'Explicit State-scoped access. Only accepted rows participate in State authorization.';
comment on column public.state_collaborators.invited_via_email is
  'Administrative invitation provenance. Owners see accepted invitations only, regardless of this value.';
comment on function public.invite_state_collaborator_by_email is
  'Service-role-only email resolver used by the authenticated invitation Edge Function; returns no identity data.';

commit;
