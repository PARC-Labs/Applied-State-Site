-- Phase 3: member-only resources inserted into opaque ASxx slots and the
-- private Storage bucket that backs those resources.

begin;

create type public.as_member_resource_type as enum (
  'text',
  'url',
  'file',
  'film',
  'code',
  'reference'
);

create table public.as_member_resources (
  id uuid primary key default gen_random_uuid(),
  as_id text not null,
  slot_key text not null,
  resource_type public.as_member_resource_type not null,
  title text,
  body text,
  url text,
  storage_path text,
  sort_order integer not null default 0,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (as_id, slot_key, sort_order),
  constraint as_member_resources_as_id_check check (
    as_id ~ '^AS[0-9]{2,}$'
  ),
  constraint as_member_resources_slot_key_check check (
    slot_key ~ '^[a-z0-9][a-z0-9-]{2,127}$'
  ),
  constraint as_member_resources_title_length_check check (
    title is null or char_length(title) <= 300
  ),
  constraint as_member_resources_body_length_check check (
    body is null or char_length(body) <= 250000
  ),
  constraint as_member_resources_url_check check (
    url is null
    or (
      url = btrim(url)
      and url ~ '^https://[^[:space:]]+$'
      and char_length(url) <= 2048
    )
  ),
  constraint as_member_resources_storage_path_check check (
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
  constraint as_member_resources_payload_check check (
    case resource_type
      when 'text' then body is not null and btrim(body) <> ''
      when 'url' then url is not null
      when 'file' then storage_path is not null
      when 'film' then storage_path is not null
      when 'code' then body is not null or url is not null or storage_path is not null
      when 'reference' then body is not null or url is not null or storage_path is not null
      else false
    end
  )
);

create index as_member_resources_active_as_slot_idx
  on public.as_member_resources (as_id, slot_key, sort_order)
  where active;

create index as_member_resources_active_storage_path_idx
  on public.as_member_resources (storage_path)
  where active and storage_path is not null;

create trigger as_member_resources_set_updated_at
before update on public.as_member_resources
for each row execute function private.set_updated_at();

create or replace function private.audit_as_member_resource_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resource_id uuid;
  resource_as_id text;
  resource_slot text;
begin
  resource_id := coalesce(new.id, old.id);
  resource_as_id := coalesce(new.as_id, old.as_id);
  resource_slot := coalesce(new.slot_key, old.slot_key);

  perform private.write_audit(
    case tg_op
      when 'INSERT' then 'as_resource.created'
      when 'UPDATE' then 'as_resource.updated'
      else 'as_resource.deleted'
    end,
    'as_member_resource',
    resource_id,
    jsonb_build_object(
      'as_id', resource_as_id,
      'slot_key', resource_slot
    ),
    auth.uid()
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger as_member_resources_audit_change
after insert or update or delete on public.as_member_resources
for each row execute function private.audit_as_member_resource_change();

create or replace function private.can_read_member_asset(
  object_name text,
  check_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_member(check_user_id)
    and exists (
      select 1
      from public.as_member_resources as resource
      where resource.active
        and resource.storage_path = object_name
    );
$$;

revoke all on function private.audit_as_member_resource_change()
  from public, anon, authenticated;
revoke all on function private.can_read_member_asset(text, uuid)
  from public, anon, authenticated;
grant execute on function private.can_read_member_asset(text, uuid)
  to authenticated;

alter table public.as_member_resources enable row level security;
alter table public.as_member_resources force row level security;

revoke all on table public.as_member_resources from public, anon, authenticated;
grant select, insert, update, delete on table public.as_member_resources to authenticated;
grant select, insert, update, delete on table public.as_member_resources to service_role;

create policy as_member_resources_member_or_staff_select
on public.as_member_resources
for select
to authenticated
using (
  (active and private.is_active_member((select auth.uid())))
  or private.is_staff((select auth.uid()), null)
);

create policy as_member_resources_member_or_staff_select_gate
on public.as_member_resources
as restrictive
for select
to authenticated
using (
  (active and private.is_active_member((select auth.uid())))
  or private.is_staff((select auth.uid()), null)
);

create policy as_member_resources_staff_insert
on public.as_member_resources
for insert
to authenticated
with check (private.is_staff((select auth.uid()), null));

create policy as_member_resources_staff_update
on public.as_member_resources
for update
to authenticated
using (private.is_staff((select auth.uid()), null))
with check (private.is_staff((select auth.uid()), null));

create policy as_member_resources_staff_delete
on public.as_member_resources
for delete
to authenticated
using (private.is_staff((select auth.uid()), null));

-- The bucket is private. Browser-side signed URLs still require the object's
-- SELECT policy, and the URL lifetime is kept short by the application runtime.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'member-assets',
  'member-assets',
  false,
  536870912,
  array[
    'application/json',
    'application/pdf',
    'application/zip',
    'image/avif',
    'image/gif',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
    'video/mp4',
    'video/webm'
  ]::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy member_assets_member_or_staff_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'member-assets'
  and (
    private.can_read_member_asset(name, (select auth.uid()))
    or private.is_staff((select auth.uid()), null)
  )
);

-- Restrictive gates make future broad Storage policies unable to accidentally
-- open this protected bucket through permissive-policy OR composition.
create policy member_assets_authenticated_select_gate
on storage.objects
as restrictive
for select
to authenticated
using (
  bucket_id <> 'member-assets'
  or private.can_read_member_asset(name, (select auth.uid()))
  or private.is_staff((select auth.uid()), null)
);

create policy member_assets_anonymous_select_gate
on storage.objects
as restrictive
for select
to anon
using (bucket_id <> 'member-assets');

create policy member_assets_staff_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'member-assets'
  and private.is_staff((select auth.uid()), null)
);

create policy member_assets_authenticated_insert_gate
on storage.objects
as restrictive
for insert
to authenticated
with check (
  bucket_id <> 'member-assets'
  or private.is_staff((select auth.uid()), null)
);

create policy member_assets_anonymous_insert_gate
on storage.objects
as restrictive
for insert
to anon
with check (bucket_id <> 'member-assets');

create policy member_assets_staff_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'member-assets'
  and private.is_staff((select auth.uid()), null)
)
with check (
  bucket_id = 'member-assets'
  and private.is_staff((select auth.uid()), null)
);

create policy member_assets_authenticated_update_gate
on storage.objects
as restrictive
for update
to authenticated
using (
  bucket_id <> 'member-assets'
  or private.is_staff((select auth.uid()), null)
)
with check (
  bucket_id <> 'member-assets'
  or private.is_staff((select auth.uid()), null)
);

create policy member_assets_anonymous_update_gate
on storage.objects
as restrictive
for update
to anon
using (bucket_id <> 'member-assets')
with check (bucket_id <> 'member-assets');

create policy member_assets_staff_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'member-assets'
  and private.is_staff((select auth.uid()), null)
);

create policy member_assets_authenticated_delete_gate
on storage.objects
as restrictive
for delete
to authenticated
using (
  bucket_id <> 'member-assets'
  or private.is_staff((select auth.uid()), null)
);

create policy member_assets_anonymous_delete_gate
on storage.objects
as restrictive
for delete
to anon
using (bucket_id <> 'member-assets');

comment on table public.as_member_resources is
  'Member-only ASxx resource metadata. Public MDX stores only opaque slot_key values.';
comment on column public.as_member_resources.storage_path is
  'Object path relative to private bucket member-assets; never a public URL.';

commit;
