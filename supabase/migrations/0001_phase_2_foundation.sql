-- Phase 2: identity, provider-agnostic entitlement, protected staff roles,
-- administrative provisioning, and the audit spine used by later phases.
--
-- Browser callers never receive write privileges on memberships, staff_roles, or
-- audit_log. The service role is reserved for Supabase-hosted administrative
-- paths and must never enter the static site build.

begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

revoke create on schema public from public, anon, authenticated;

create type public.membership_status as enum ('active', 'grace', 'inactive');
create type public.membership_source as enum ('manual', 'billing', 'complimentary', 'invite');
create type public.staff_role as enum ('editor', 'admin');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text unique,
  name text not null,
  location text,
  practice text,
  website_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_handle_format_check check (
    handle is null
    or (
      handle = lower(handle)
      and handle ~ '^[a-z0-9][a-z0-9_-]{2,47}$'
    )
  ),
  constraint profiles_name_check check (
    name = btrim(name)
    and char_length(name) between 1 and 160
  ),
  constraint profiles_location_length_check check (
    location is null or char_length(location) <= 240
  ),
  constraint profiles_practice_length_check check (
    practice is null or char_length(practice) <= 1000
  ),
  constraint profiles_website_url_check check (
    website_url is null
    or (
      website_url = btrim(website_url)
      and website_url ~ '^https://[^[:space:]]+$'
      and char_length(website_url) <= 2048
    )
  )
);

create table public.memberships (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status public.membership_status not null default 'inactive',
  source public.membership_source not null default 'manual',
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  starts_at timestamptz not null default now(),
  access_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memberships_provider_check check (
    provider is null
    or (
      provider = btrim(provider)
      and provider <> ''
      and char_length(provider) <= 80
    )
  ),
  constraint memberships_provider_customer_check check (
    provider_customer_id is null
    or (
      provider_customer_id = btrim(provider_customer_id)
      and provider_customer_id <> ''
      and char_length(provider_customer_id) <= 255
    )
  ),
  constraint memberships_provider_subscription_check check (
    provider_subscription_id is null
    or (
      provider_subscription_id = btrim(provider_subscription_id)
      and provider_subscription_id <> ''
      and char_length(provider_subscription_id) <= 255
    )
  ),
  constraint memberships_billing_provider_check check (
    source <> 'billing'
    or provider is not null
  )
);

create unique index memberships_provider_customer_uidx
  on public.memberships (provider, provider_customer_id)
  where provider is not null and provider_customer_id is not null;

create unique index memberships_provider_subscription_uidx
  on public.memberships (provider, provider_subscription_id)
  where provider is not null and provider_subscription_id is not null;

create index memberships_status_access_idx
  on public.memberships (status, access_until, starts_at);

create table public.staff_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.staff_role not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  primary key (user_id, role)
);

create index staff_roles_role_idx on public.staff_roles (role, user_id);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  event_type text not null,
  object_type text not null,
  object_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_log_event_type_check check (
    event_type ~ '^[a-z][a-z0-9_.-]{2,79}$'
  ),
  constraint audit_log_object_type_check check (
    object_type ~ '^[a-z][a-z0-9_.-]{1,79}$'
  ),
  constraint audit_log_details_object_check check (
    jsonb_typeof(details) = 'object'
  )
);

create index audit_log_object_idx
  on public.audit_log (object_type, object_id, created_at desc);
create index audit_log_actor_idx
  on public.audit_log (actor_id, created_at desc);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger memberships_set_updated_at
before update on public.memberships
for each row execute function private.set_updated_at();

create or replace function private.is_active_member(
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
      from public.memberships as membership
      where membership.user_id = check_user_id
        and membership.status in ('active', 'grace')
        and membership.starts_at <= now()
        and (
          membership.access_until is null
          or membership.access_until > now()
        )
    );
$$;

create or replace function private.is_staff(
  check_user_id uuid default auth.uid(),
  required_role public.staff_role default null
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
      from public.staff_roles as staff
      where staff.user_id = check_user_id
        and (required_role is null or staff.role = required_role)
    );
$$;

create or replace function private.write_audit(
  event_name text,
  target_type text,
  target_id uuid,
  event_details jsonb default '{}'::jsonb,
  event_actor uuid default auth.uid()
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_log (
    actor_id,
    event_type,
    object_type,
    object_id,
    details
  )
  values (
    event_actor,
    event_name,
    target_type,
    target_id,
    coalesce(event_details, '{}'::jsonb)
  );
end;
$$;

create or replace function private.audit_membership_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_name text;
  subject_id uuid;
  event_details jsonb;
begin
  if tg_op = 'INSERT' then
    event_name := 'membership.created';
    subject_id := new.user_id;
    event_details := jsonb_build_object(
      'status', new.status,
      'source', new.source,
      'starts_at', new.starts_at,
      'access_until', new.access_until
    );
  elsif tg_op = 'UPDATE' then
    event_name := 'membership.updated';
    subject_id := new.user_id;
    event_details := jsonb_build_object(
      'from_status', old.status,
      'to_status', new.status,
      'from_source', old.source,
      'to_source', new.source,
      'starts_at', new.starts_at,
      'access_until', new.access_until
    );
  else
    event_name := 'membership.deleted';
    subject_id := old.user_id;
    event_details := jsonb_build_object(
      'status', old.status,
      'source', old.source
    );
  end if;

  perform private.write_audit(
    event_name,
    'membership',
    subject_id,
    event_details,
    auth.uid()
  );

  return coalesce(new, old);
end;
$$;

create trigger memberships_audit_change
after insert or update or delete on public.memberships
for each row execute function private.audit_membership_change();

create or replace function private.audit_staff_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  subject_id uuid;
  changed_role public.staff_role;
begin
  subject_id := coalesce(new.user_id, old.user_id);
  changed_role := coalesce(new.role, old.role);

  perform private.write_audit(
    case when tg_op = 'DELETE' then 'staff_role.revoked' else 'staff_role.granted' end,
    'staff_role',
    subject_id,
    jsonb_build_object('role', changed_role),
    auth.uid()
  );

  return coalesce(new, old);
end;
$$;

create trigger staff_roles_audit_change
after insert or delete on public.staff_roles
for each row execute function private.audit_staff_role_change();

revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.is_active_member(uuid) from public, anon, authenticated;
revoke all on function private.is_staff(uuid, public.staff_role) from public, anon, authenticated;
revoke all on function private.write_audit(text, text, uuid, jsonb, uuid) from public, anon, authenticated;
revoke all on function private.audit_membership_change() from public, anon, authenticated;
revoke all on function private.audit_staff_role_change() from public, anon, authenticated;

-- RLS policies need these boolean helpers, but the private schema is not in the
-- PostgREST exposed-schema list. Browser callers cannot invoke them as RPCs.
grant execute on function private.is_active_member(uuid) to authenticated;
grant execute on function private.is_staff(uuid, public.staff_role) to authenticated;

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.memberships enable row level security;
alter table public.memberships force row level security;
alter table public.staff_roles enable row level security;
alter table public.staff_roles force row level security;
alter table public.audit_log enable row level security;
alter table public.audit_log force row level security;

revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.memberships from public, anon, authenticated;
revoke all on table public.staff_roles from public, anon, authenticated;
revoke all on table public.audit_log from public, anon, authenticated;

grant select on table public.profiles to authenticated;
grant insert (id, handle, name, location, practice, website_url)
  on table public.profiles to authenticated;
grant update (handle, name, location, practice, website_url)
  on table public.profiles to authenticated;
grant select on table public.memberships to authenticated;
grant select on table public.staff_roles to authenticated;
grant select on table public.audit_log to authenticated;

grant select, insert, update, delete on table public.profiles to service_role;
grant select, insert, update, delete on table public.memberships to service_role;
grant select, insert, update, delete on table public.staff_roles to service_role;
grant select, insert, update, delete on table public.audit_log to service_role;
grant usage, select on sequence public.audit_log_id_seq to service_role;

create policy profiles_member_select
on public.profiles
for select
to authenticated
using (
  private.is_active_member((select auth.uid()))
  or private.is_staff((select auth.uid()), null)
);

create policy profiles_member_select_gate
on public.profiles
as restrictive
for select
to authenticated
using (
  private.is_active_member((select auth.uid()))
  or private.is_staff((select auth.uid()), null)
);

create policy profiles_self_insert
on public.profiles
for insert
to authenticated
with check (
  private.is_active_member((select auth.uid()))
  and id = (select auth.uid())
);

create policy profiles_self_update
on public.profiles
for update
to authenticated
using (
  private.is_active_member((select auth.uid()))
  and id = (select auth.uid())
)
with check (
  private.is_active_member((select auth.uid()))
  and id = (select auth.uid())
);

create policy memberships_self_or_staff_select
on public.memberships
for select
to authenticated
using (
  user_id = (select auth.uid())
  or private.is_staff((select auth.uid()), null)
);

create policy memberships_self_or_staff_select_gate
on public.memberships
as restrictive
for select
to authenticated
using (
  user_id = (select auth.uid())
  or private.is_staff((select auth.uid()), null)
);

create policy staff_roles_self_or_staff_select
on public.staff_roles
for select
to authenticated
using (
  user_id = (select auth.uid())
  or private.is_staff((select auth.uid()), null)
);

create policy staff_roles_self_or_staff_select_gate
on public.staff_roles
as restrictive
for select
to authenticated
using (
  user_id = (select auth.uid())
  or private.is_staff((select auth.uid()), null)
);

create policy audit_log_staff_select
on public.audit_log
for select
to authenticated
using (private.is_staff((select auth.uid()), null));

create policy audit_log_staff_select_gate
on public.audit_log
as restrictive
for select
to authenticated
using (private.is_staff((select auth.uid()), null));

-- Service-role-only administrative RPC. It creates the minimal profile and the
-- entitlement atomically. It intentionally accepts provider-neutral fields.
create or replace function public.provision_membership(
  target_user_id uuid,
  target_name text,
  desired_status public.membership_status default 'active',
  desired_source public.membership_source default 'manual',
  desired_starts_at timestamptz default now(),
  desired_access_until timestamptz default null,
  desired_provider text default null,
  desired_provider_customer_id text default null,
  desired_provider_subscription_id text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_user_id is null then
    raise exception using errcode = '22023', message = 'target_user_id is required';
  end if;

  insert into public.profiles (id, name)
  values (target_user_id, target_name)
  on conflict (id) do update
    set name = excluded.name;

  insert into public.memberships (
    user_id,
    status,
    source,
    provider,
    provider_customer_id,
    provider_subscription_id,
    starts_at,
    access_until
  )
  values (
    target_user_id,
    desired_status,
    desired_source,
    desired_provider,
    desired_provider_customer_id,
    desired_provider_subscription_id,
    desired_starts_at,
    desired_access_until
  )
  on conflict (user_id) do update
    set status = excluded.status,
        source = excluded.source,
        provider = excluded.provider,
        provider_customer_id = excluded.provider_customer_id,
        provider_subscription_id = excluded.provider_subscription_id,
        starts_at = excluded.starts_at,
        access_until = excluded.access_until;
end;
$$;

create or replace function public.provision_staff_role(
  target_user_id uuid,
  target_role public.staff_role,
  enabled boolean default true
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_user_id is null or target_role is null then
    raise exception using errcode = '22023', message = 'target user and role are required';
  end if;

  if enabled then
    insert into public.staff_roles (user_id, role, created_by)
    values (target_user_id, target_role, auth.uid())
    on conflict (user_id, role) do nothing;
  else
    delete from public.staff_roles
    where user_id = target_user_id and role = target_role;
  end if;
end;
$$;

revoke all on function public.provision_membership(
  uuid,
  text,
  public.membership_status,
  public.membership_source,
  timestamptz,
  timestamptz,
  text,
  text,
  text
) from public, anon, authenticated;
grant execute on function public.provision_membership(
  uuid,
  text,
  public.membership_status,
  public.membership_source,
  timestamptz,
  timestamptz,
  text,
  text,
  text
) to service_role;

revoke all on function public.provision_staff_role(uuid, public.staff_role, boolean)
  from public, anon, authenticated;
grant execute on function public.provision_staff_role(uuid, public.staff_role, boolean)
  to service_role;

comment on schema private is
  'Non-exposed authorization and audit helpers. Keep this schema out of PostgREST exposed schemas.';
comment on table public.profiles is
  'Minimal member bibliography. No email address or social/engagement data.';
comment on table public.memberships is
  'Provider-agnostic Applied State access entitlement; Auth identity alone grants nothing.';
comment on table public.staff_roles is
  'Protected institutional authority. Browser clients have no write grant.';
comment on table public.audit_log is
  'Minimal append-only record of privileged entitlement and editorial transitions.';
comment on function public.provision_membership is
  'Service-role-only member provisioning. Create/invite auth.users first, then call this RPC from a trusted administrative context.';
comment on function public.provision_staff_role is
  'Service-role-only staff grant/revoke operation. Never expose the service credential to a browser.';

commit;
