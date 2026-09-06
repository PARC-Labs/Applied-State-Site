-- Phase 4: private member-created States and their reusable material graph.
--
-- The browser can write only ordinary State metadata directly. Material graph
-- mutations are narrow security-definer RPCs so an actor cannot manufacture an
-- association to a material they cannot already read. File/image/as-reference
-- enum values are reserved for later trusted workflows; v1 member RPCs accept
-- URL and plain text material only.

begin;

create type public.state_visibility as enum ('private', 'index');
create type public.state_review_status as enum (
  'none',
  'submitted',
  'approved',
  'rejected',
  'withdrawn'
);
create type public.material_type as enum (
  'url',
  'text',
  'image',
  'file',
  'as_reference'
);

create table public.states (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text,
  visibility public.state_visibility not null default 'private',
  review_status public.state_review_status not null default 'none',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  opened_at timestamptz,
  opened_by uuid references auth.users (id) on delete set null,
  constraint states_title_check check (
    title = btrim(title)
    and char_length(title) between 1 and 240
  ),
  constraint states_description_check check (
    description is null or char_length(description) <= 20000
  ),
  constraint states_opened_metadata_check check (
    (opened_at is null and opened_by is null)
    or (opened_at is not null and opened_by is not null)
  ),
  constraint states_index_approval_check check (
    visibility <> 'index'
    or (
      review_status = 'approved'
      and opened_at is not null
      and opened_by is not null
    )
  ),
  constraint states_submitted_private_check check (
    review_status <> 'submitted' or visibility = 'private'
  )
);

create index states_owner_updated_idx
  on public.states (owner_id, updated_at desc);
create index states_visibility_opened_idx
  on public.states (visibility, opened_at desc)
  where visibility = 'index';
create index states_review_status_updated_idx
  on public.states (review_status, updated_at asc)
  where review_status = 'submitted';

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users (id) on delete restrict,
  type public.material_type not null,
  title text,
  body text,
  url text,
  storage_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint materials_title_check check (
    title is null
    or (
      title = btrim(title)
      and char_length(title) between 1 and 300
    )
  ),
  constraint materials_body_check check (
    body is null or char_length(body) <= 250000
  ),
  constraint materials_url_check check (
    url is null
    or (
      url = btrim(url)
      and url ~ '^https://[^[:space:]]+$'
      and char_length(url) <= 2048
    )
  ),
  constraint materials_storage_path_check check (
    storage_path is null
    or (
      storage_path = btrim(storage_path)
      and storage_path <> ''
      and char_length(storage_path) <= 1024
      and storage_path !~ '^/'
      and storage_path !~ E'\\\\'
      and storage_path !~ '(^|/)[.][.]?(/|$)'
      and storage_path !~ '://'
      and storage_path !~ '[[:cntrl:]]'
    )
  ),
  constraint materials_metadata_object_check check (
    jsonb_typeof(metadata) = 'object'
  ),
  constraint materials_payload_check check (
    case type
      when 'url' then url is not null and body is null and storage_path is null
      when 'text' then body is not null and btrim(body) <> '' and url is null and storage_path is null
      when 'image' then storage_path is not null and body is null and url is null
      when 'file' then storage_path is not null and body is null and url is null
      when 'as_reference' then storage_path is null and (url is not null or (body is not null and btrim(body) <> ''))
      else false
    end
  )
);

create index materials_created_by_created_idx
  on public.materials (created_by, created_at desc);

-- Intentionally no unique index on URL. Cross-user uniqueness failures would
-- reveal the existence of otherwise private research material.
create index materials_url_lookup_idx
  on public.materials (url)
  where type = 'url' and url is not null;

create table public.state_materials (
  state_id uuid not null references public.states (id) on delete cascade,
  material_id uuid not null references public.materials (id) on delete cascade,
  added_by uuid references auth.users (id) on delete set null,
  position bigint not null,
  annotation text,
  created_at timestamptz not null default now(),
  primary key (state_id, material_id),
  constraint state_materials_position_check check (position > 0),
  constraint state_materials_annotation_check check (
    annotation is null or char_length(annotation) <= 20000
  )
);

create index state_materials_state_position_idx
  on public.state_materials (state_id, position, material_id);
create index state_materials_material_state_idx
  on public.state_materials (material_id, state_id);
create index state_materials_added_by_idx
  on public.state_materials (added_by)
  where added_by is not null;

create trigger states_set_updated_at
before update on public.states
for each row execute function private.set_updated_at();

create trigger materials_set_updated_at
before update on public.materials
for each row execute function private.set_updated_at();

create or replace function private.is_state_owner(
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
      from public.states as state
      where state.id = target_state_id
        and state.owner_id = check_user_id
    );
$$;

-- Phase 5 replaces this helper to include accepted collaborators. Keeping the
-- authorization decision behind one function avoids recursive RLS policies.
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
    and private.is_state_owner(target_state_id, check_user_id);
$$;

create or replace function private.can_view_material(
  target_material_id uuid,
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
        from public.state_materials as connection
        where connection.material_id = target_material_id
          and private.can_view_state(connection.state_id, check_user_id)
      )
    );
$$;

revoke all on function private.is_state_owner(uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.can_view_state(uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.can_edit_state(uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.can_view_material(uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.is_state_owner(uuid, uuid) to authenticated;
grant execute on function private.can_view_state(uuid, uuid) to authenticated;
grant execute on function private.can_edit_state(uuid, uuid) to authenticated;
grant execute on function private.can_view_material(uuid, uuid) to authenticated;

alter table public.states enable row level security;
alter table public.states force row level security;
alter table public.materials enable row level security;
alter table public.materials force row level security;
alter table public.state_materials enable row level security;
alter table public.state_materials force row level security;

revoke all on table public.states from public, anon, authenticated;
revoke all on table public.materials from public, anon, authenticated;
revoke all on table public.state_materials from public, anon, authenticated;

grant select on table public.states to authenticated;
grant insert (owner_id, title, description) on table public.states to authenticated;
grant update (title, description) on table public.states to authenticated;
grant delete on table public.states to authenticated;
grant select on table public.materials to authenticated;
grant select on table public.state_materials to authenticated;

grant select, insert, update, delete on table public.states to service_role;
grant select, insert, update, delete on table public.materials to service_role;
grant select, insert, update, delete on table public.state_materials to service_role;

create policy states_member_select_allow
on public.states
for select
to authenticated
using (private.can_view_state(id, (select auth.uid())));

create policy states_member_select_gate
on public.states
as restrictive
for select
to authenticated
using (private.can_view_state(id, (select auth.uid())));

create policy states_member_insert_allow
on public.states
for insert
to authenticated
with check (
  private.is_active_member((select auth.uid()))
  and owner_id = (select auth.uid())
  and visibility = 'private'
  and review_status = 'none'
  and opened_at is null
  and opened_by is null
);

create policy states_member_insert_gate
on public.states
as restrictive
for insert
to authenticated
with check (
  private.is_active_member((select auth.uid()))
  and owner_id = (select auth.uid())
  and visibility = 'private'
  and review_status = 'none'
  and opened_at is null
  and opened_by is null
);

create policy states_editor_update_allow
on public.states
for update
to authenticated
using (private.can_edit_state(id, (select auth.uid())))
with check (private.can_edit_state(id, (select auth.uid())));

create policy states_editor_update_gate
on public.states
as restrictive
for update
to authenticated
using (private.can_edit_state(id, (select auth.uid())))
with check (private.can_edit_state(id, (select auth.uid())));

create policy states_owner_delete_allow
on public.states
for delete
to authenticated
using (
  private.is_active_member((select auth.uid()))
  and owner_id = (select auth.uid())
  and visibility = 'private'
  and review_status <> 'submitted'
);

create policy states_owner_delete_gate
on public.states
as restrictive
for delete
to authenticated
using (
  private.is_active_member((select auth.uid()))
  and owner_id = (select auth.uid())
  and visibility = 'private'
  and review_status <> 'submitted'
);

create policy materials_visible_path_select_allow
on public.materials
for select
to authenticated
using (private.can_view_material(id, (select auth.uid())));

create policy materials_visible_path_select_gate
on public.materials
as restrictive
for select
to authenticated
using (private.can_view_material(id, (select auth.uid())));

create policy state_materials_visible_state_select_allow
on public.state_materials
for select
to authenticated
using (private.can_view_state(state_id, (select auth.uid())));

create policy state_materials_visible_state_select_gate
on public.state_materials
as restrictive
for select
to authenticated
using (private.can_view_state(state_id, (select auth.uid())));

create or replace function public.add_state_material(
  target_state_id uuid,
  material_kind public.material_type,
  material_title text default null,
  material_body text default null,
  material_url text default null,
  material_annotation text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  new_material_id uuid;
  next_position bigint;
begin
  perform 1
  from public.states
  where id = target_state_id
  for update;

  if not found or not private.can_edit_state(target_state_id, actor_id) then
    raise exception using errcode = '42501', message = 'operation not permitted';
  end if;

  if material_kind not in ('url', 'text') then
    raise exception using errcode = '22023', message = 'unsupported material type';
  end if;

  if material_kind = 'url' and (
    material_url is null
    or btrim(material_url) !~ '^https://[^[:space:]]+$'
  ) then
    raise exception using errcode = '22023', message = 'invalid URL material';
  end if;

  if material_kind = 'text' and (
    material_body is null
    or btrim(material_body) = ''
  ) then
    raise exception using errcode = '22023', message = 'invalid text material';
  end if;

  select coalesce(max(connection.position), 0) + 1024
  into next_position
  from public.state_materials as connection
  where connection.state_id = target_state_id;

  insert into public.materials (
    created_by,
    type,
    title,
    body,
    url
  )
  values (
    actor_id,
    material_kind,
    nullif(btrim(material_title), ''),
    case when material_kind = 'text' then material_body else null end,
    case when material_kind = 'url' then btrim(material_url) else null end
  )
  returning id into new_material_id;

  insert into public.state_materials (
    state_id,
    material_id,
    added_by,
    position,
    annotation
  )
  values (
    target_state_id,
    new_material_id,
    actor_id,
    next_position,
    nullif(material_annotation, '')
  );

  return new_material_id;
end;
$$;

create or replace function public.connect_state_material(
  target_state_id uuid,
  target_material_id uuid,
  material_annotation text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  next_position bigint;
begin
  perform 1
  from public.states
  where id = target_state_id
  for update;

  if not found or not private.can_edit_state(target_state_id, actor_id) then
    raise exception using errcode = '42501', message = 'operation not permitted';
  end if;

  if not private.can_view_material(target_material_id, actor_id) then
    raise exception using errcode = '42501', message = 'material unavailable';
  end if;

  select coalesce(max(connection.position), 0) + 1024
  into next_position
  from public.state_materials as connection
  where connection.state_id = target_state_id;

  insert into public.state_materials (
    state_id,
    material_id,
    added_by,
    position,
    annotation
  )
  values (
    target_state_id,
    target_material_id,
    actor_id,
    next_position,
    nullif(material_annotation, '')
  )
  on conflict (state_id, material_id) do nothing;
end;
$$;

create or replace function public.remove_state_material(
  target_state_id uuid,
  target_material_id uuid
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

  if not found or not private.can_edit_state(target_state_id, actor_id) then
    raise exception using errcode = '42501', message = 'operation not permitted';
  end if;

  delete from public.state_materials
  where state_id = target_state_id
    and material_id = target_material_id;

  -- Remove an orphan only when the current actor originally created it. A
  -- reused material remains intact while any State still references it.
  delete from public.materials as material
  where material.id = target_material_id
    and material.created_by = actor_id
    and not exists (
      select 1
      from public.state_materials as connection
      where connection.material_id = material.id
    );
end;
$$;

create or replace function public.reorder_state_materials(
  target_state_id uuid,
  ordered_material_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  existing_count integer;
  requested_count integer;
begin
  perform 1
  from public.states
  where id = target_state_id
  for update;

  if not found or not private.can_edit_state(target_state_id, actor_id) then
    raise exception using errcode = '42501', message = 'operation not permitted';
  end if;

  if ordered_material_ids is null then
    raise exception using errcode = '22023', message = 'invalid material order';
  end if;

  select count(*)::integer
  into existing_count
  from public.state_materials
  where state_id = target_state_id;

  select count(distinct material_id)::integer
  into requested_count
  from unnest(ordered_material_ids) as requested(material_id);

  if cardinality(ordered_material_ids) <> requested_count
    or existing_count <> requested_count
    or exists (
      select 1
      from public.state_materials as connection
      where connection.state_id = target_state_id
        and not (connection.material_id = any(ordered_material_ids))
    )
  then
    raise exception using errcode = '22023', message = 'invalid material order';
  end if;

  with desired as (
    select material_id, ordinal_position
    from unnest(ordered_material_ids) with ordinality
      as requested(material_id, ordinal_position)
  )
  update public.state_materials as connection
  set position = desired.ordinal_position * 1024
  from desired
  where connection.state_id = target_state_id
    and connection.material_id = desired.material_id;
end;
$$;

revoke all on function public.add_state_material(
  uuid,
  public.material_type,
  text,
  text,
  text,
  text
) from public, anon, authenticated;
revoke all on function public.connect_state_material(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.remove_state_material(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.reorder_state_materials(uuid, uuid[])
  from public, anon, authenticated;

grant execute on function public.add_state_material(
  uuid,
  public.material_type,
  text,
  text,
  text,
  text
) to authenticated;
grant execute on function public.connect_state_material(uuid, uuid, text)
  to authenticated;
grant execute on function public.remove_state_material(uuid, uuid)
  to authenticated;
grant execute on function public.reorder_state_materials(uuid, uuid[])
  to authenticated;

comment on table public.states is
  'Private-by-default member research spaces. Index visibility remains member-only and staff-curated.';
comment on table public.materials is
  'Reusable research objects. Rows are visible only through an authorized State association.';
comment on table public.state_materials is
  'Ordered, contextual material connections. Annotation inherits the State authorization boundary.';
comment on function public.add_state_material is
  'Adds URL or plain text material atomically to a State editable by the caller.';
comment on function public.connect_state_material is
  'Reuses a material already visible to the caller without copying the material row.';

commit;
