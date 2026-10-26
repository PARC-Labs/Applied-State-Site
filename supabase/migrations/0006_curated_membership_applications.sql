-- Curated admission is independent of Auth and membership entitlement.
-- Applicants are not members; an accepted application never grants access.
begin;

create type public.membership_application_status as enum (
  'submitted', 'waitlisted', 'accepted', 'declined'
);

create table public.membership_applications (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  practice text not null,
  location text,
  portfolio_url text,
  statement text not null,
  status public.membership_application_status not null default 'submitted',
  internal_note text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint application_name_check check (
    full_name = btrim(full_name) and char_length(full_name) between 2 and 160
  ),
  constraint application_email_check check (
    email = lower(btrim(email))
    and char_length(email) between 3 and 254
    and email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
  ),
  constraint application_practice_check check (
    practice = btrim(practice) and char_length(practice) between 10 and 2000
  ),
  constraint application_location_check check (
    location is null or (
      location = btrim(location) and char_length(location) between 1 and 160
    )
  ),
  constraint application_portfolio_check check (
    portfolio_url is null or (
      portfolio_url = btrim(portfolio_url)
      and char_length(portfolio_url) <= 2048
      and portfolio_url ~ '^https://[^[:space:]]+$'
    )
  ),
  constraint application_statement_check check (
    statement = btrim(statement) and char_length(statement) between 40 and 4000
  ),
  constraint application_internal_note_check check (
    internal_note is null or char_length(internal_note) <= 2000
  ),
  constraint application_review_check check (
    (status = 'submitted' and reviewed_at is null and reviewed_by is null)
    or (status <> 'submitted' and reviewed_at is not null and reviewed_by is not null)
  )
);

create unique index membership_applications_email_unique
  on public.membership_applications (email);
create index membership_applications_review_queue
  on public.membership_applications (status, created_at asc);

alter table public.membership_applications enable row level security;
alter table public.membership_applications force row level security;

revoke all on table public.membership_applications from public, anon, authenticated;
grant select on table public.membership_applications to authenticated;
grant select, insert, update, delete on table public.membership_applications to service_role;

create policy membership_applications_staff_select
on public.membership_applications as permissive for select to authenticated
using (private.is_staff((select auth.uid()), null));

create policy membership_applications_staff_select_gate
on public.membership_applications as restrictive for select to authenticated
using (private.is_staff((select auth.uid()), null));

-- This is an anonymous public intake, not an account-creation mechanism.
-- The form has a honeypot and bounded inputs. Duplicates are silent and reveal
-- nothing about prior applicants. Monitor this RPC for abuse and add an
-- edge-level challenge before high-traffic recruitment.
create or replace function public.submit_membership_application(
  p_name text,
  p_email text,
  p_practice text,
  p_location text,
  p_portfolio_url text,
  p_statement text,
  p_honeypot text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_name text := nullif(btrim(p_name), '');
  normalized_email text := nullif(lower(btrim(p_email)), '');
  normalized_practice text := nullif(btrim(p_practice), '');
  normalized_location text := nullif(btrim(p_location), '');
  normalized_portfolio text := nullif(btrim(p_portfolio_url), '');
  normalized_statement text := nullif(btrim(p_statement), '');
begin
  if nullif(btrim(p_honeypot), '') is not null then
    return;
  end if;

  if normalized_name is null or char_length(normalized_name) not between 2 and 160
    or normalized_email is null or char_length(normalized_email) not between 3 and 254
    or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
    or normalized_practice is null or char_length(normalized_practice) not between 10 and 2000
    or (normalized_location is not null and char_length(normalized_location) > 160)
    or (normalized_portfolio is not null and (
      char_length(normalized_portfolio) > 2048
      or normalized_portfolio !~ '^https://[^[:space:]]+$'
    ))
    or normalized_statement is null or char_length(normalized_statement) not between 40 and 4000
  then
    raise exception using errcode = '22023', message = 'invalid application';
  end if;

  insert into public.membership_applications (
    full_name, email, practice, location, portfolio_url, statement
  )
  values (
    normalized_name, normalized_email, normalized_practice,
    normalized_location, normalized_portfolio, normalized_statement
  )
  on conflict do nothing;
end;
$$;

create or replace function public.review_membership_application(
  target_application_id uuid,
  decision text,
  reviewer_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
begin
  if not private.is_staff(actor_id, null) then
    raise exception using errcode = '42501', message = 'operation not permitted';
  end if;

  if decision is null or decision not in ('accepted', 'waitlisted', 'declined')
    or (reviewer_note is not null and char_length(reviewer_note) > 2000)
  then
    raise exception using errcode = '22023', message = 'invalid review decision';
  end if;

  update public.membership_applications
  set status = decision::public.membership_application_status,
      reviewed_at = now(),
      reviewed_by = actor_id,
      internal_note = nullif(btrim(reviewer_note), '')
  where id = target_application_id
    and status in ('submitted', 'waitlisted');

  if not found then
    raise exception using errcode = '42501', message = 'operation not permitted';
  end if;

  perform private.write_audit(
    'membership_application.reviewed',
    'membership_application',
    target_application_id,
    jsonb_build_object('decision', decision),
    actor_id
  );
end;
$$;

revoke all on function public.submit_membership_application(
  text, text, text, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.review_membership_application(
  uuid, text, text
) from public, anon, authenticated;

grant execute on function public.submit_membership_application(
  text, text, text, text, text, text, text
) to anon, authenticated;
grant execute on function public.review_membership_application(
  uuid, text, text
) to authenticated;

comment on table public.membership_applications is
  'Confidential admission applications. Curatorial review grants no access; Auth invite and entitlement provisioning are separate operations.';

commit;
