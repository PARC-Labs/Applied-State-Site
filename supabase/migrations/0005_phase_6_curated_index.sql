-- Phase 6: explicit submission and staff-curated Index transitions.
--
-- The Index is member-only. These functions are the sole browser-callable path
-- to review_status, visibility, opened_at, and opened_by; authenticated roles
-- have no direct UPDATE grant on those columns.

begin;

create or replace function public.submit_state(
  target_state_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  current_visibility public.state_visibility;
  current_review_status public.state_review_status;
begin
  select state.visibility, state.review_status
  into current_visibility, current_review_status
  from public.states as state
  where state.id = target_state_id
  for update;

  if not found
    or not private.is_active_member(actor_id)
    or not private.is_state_owner(target_state_id, actor_id)
    or current_visibility <> 'private'
    or current_review_status not in ('none', 'rejected', 'withdrawn')
  then
    raise exception using errcode = '42501', message = 'operation not permitted';
  end if;

  update public.states
  set review_status = 'submitted',
      opened_at = null,
      opened_by = null
  where id = target_state_id;

  perform private.write_audit(
    'state.submitted',
    'state',
    target_state_id,
    '{}'::jsonb,
    actor_id
  );
end;
$$;

create or replace function public.withdraw_state(
  target_state_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  current_visibility public.state_visibility;
  current_review_status public.state_review_status;
begin
  select state.visibility, state.review_status
  into current_visibility, current_review_status
  from public.states as state
  where state.id = target_state_id
  for update;

  if not found
    or not private.is_active_member(actor_id)
    or not private.is_state_owner(target_state_id, actor_id)
    or current_visibility <> 'private'
    or current_review_status <> 'submitted'
  then
    raise exception using errcode = '42501', message = 'operation not permitted';
  end if;

  update public.states
  set review_status = 'withdrawn'
  where id = target_state_id;

  perform private.write_audit(
    'state.withdrawn',
    'state',
    target_state_id,
    '{}'::jsonb,
    actor_id
  );
end;
$$;

create or replace function public.review_state(
  target_state_id uuid,
  action text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  current_visibility public.state_visibility;
  current_review_status public.state_review_status;
begin
  if not private.is_staff(actor_id, null) then
    raise exception using errcode = '42501', message = 'operation not permitted';
  end if;

  if action is null or action not in ('approve', 'reject', 'close') then
    raise exception using errcode = '22023', message = 'invalid review action';
  end if;

  select state.visibility, state.review_status
  into current_visibility, current_review_status
  from public.states as state
  where state.id = target_state_id
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'operation not permitted';
  end if;

  if action = 'approve' then
    if current_visibility <> 'private' or current_review_status <> 'submitted' then
      raise exception using errcode = '55000', message = 'invalid State transition';
    end if;

    update public.states
    set visibility = 'index',
        review_status = 'approved',
        opened_at = now(),
        opened_by = actor_id
    where id = target_state_id;

    perform private.write_audit(
      'state.approved',
      'state',
      target_state_id,
      '{}'::jsonb,
      actor_id
    );
  elsif action = 'reject' then
    if current_visibility <> 'private' or current_review_status <> 'submitted' then
      raise exception using errcode = '55000', message = 'invalid State transition';
    end if;

    update public.states
    set visibility = 'private',
        review_status = 'rejected',
        opened_at = null,
        opened_by = null
    where id = target_state_id;

    perform private.write_audit(
      'state.rejected',
      'state',
      target_state_id,
      '{}'::jsonb,
      actor_id
    );
  else
    if current_visibility <> 'index' or current_review_status <> 'approved' then
      raise exception using errcode = '55000', message = 'invalid State transition';
    end if;

    update public.states
    set visibility = 'private',
        review_status = 'withdrawn',
        opened_at = null,
        opened_by = null
    where id = target_state_id;

    perform private.write_audit(
      'state.closed',
      'state',
      target_state_id,
      '{}'::jsonb,
      actor_id
    );
  end if;
end;
$$;

revoke all on function public.submit_state(uuid)
  from public, anon, authenticated;
revoke all on function public.withdraw_state(uuid)
  from public, anon, authenticated;
revoke all on function public.review_state(uuid, text)
  from public, anon, authenticated;

grant execute on function public.submit_state(uuid) to authenticated;
grant execute on function public.withdraw_state(uuid) to authenticated;
grant execute on function public.review_state(uuid, text) to authenticated;

comment on function public.submit_state is
  'Owner-only submission for institutional review; does not change visibility.';
comment on function public.withdraw_state is
  'Owner-only withdrawal while a private State is awaiting review.';
comment on function public.review_state is
  'Staff-only atomic approve, reject, and close transitions for the member-only curated Index.';

commit;
