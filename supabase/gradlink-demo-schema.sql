-- GradLink ZW demonstration backend
-- Proposal for review. Do not run against production until the existing
-- profiles, companies, listings, and applications schemas have been reconciled.
--
-- This script creates tables and policies only. It does not seed demo records,
-- bootstrap an administrator, send invitation email, or configure the frontend.
-- Run in the Supabase SQL Editor using a project-owner account only after review.
--
-- Marketplace notifications are derived from application_events for this phase.
-- Escrow is deliberately excluded; no payment state or payment provider is added.

begin;

create extension if not exists pgcrypto with schema extensions;

-- Core GradLink tables. IF NOT EXISTS keeps existing tables. The preflight below
-- checks required column names only; reconcile types, keys, constraints, indexes,
-- triggers, grants, and existing policies before using this with an existing schema.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null check (char_length(trim(display_name)) between 1 and 100),
  education text not null default '',
  location text not null default '',
  study_field text not null default 'Coding',
  track text not null default 'earning' check (track in ('earning', 'interview')),
  bio text not null default '' check (char_length(bio) <= 2000),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete restrict,
  company_name text not null check (char_length(trim(company_name)) between 1 and 160),
  industry text not null default '',
  website text not null default '',
  location text not null default '',
  description text not null default '' check (char_length(description) <= 4000),
  contact_email text not null default '',
  contact_phone text not null default '',
  logo_path text,
  verification_status text not null default 'not_verified'
    check (verification_status in ('not_verified', 'pending', 'verified', 'rejected', 'resubmission_required')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text not null check (char_length(trim(description)) between 10 and 20000),
  skill text not null,
  work_level text not null default 'Intermediate'
    check (work_level in ('Entry level', 'Intermediate', 'Professional', 'Advanced')),
  budget numeric(12, 2) not null check (budget > 0),
  payment_method text not null check (payment_method in ('USD', 'EcoCash')),
  deadline date not null,
  status text not null default 'pending_review'
    check (status in ('draft', 'pending_review', 'published', 'rejected', 'closed')),
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete restrict,
  student_id uuid not null references public.profiles(id) on delete restrict,
  student_track text not null check (student_track in ('earning', 'interview')),
  student_study_field text not null,
  proposal text not null check (char_length(trim(proposal)) between 1 and 10000),
  delivery_days integer not null check (delivery_days between 1 and 365),
  portfolio_url text,
  status text not null default 'applied'
    check (status in ('applied', 'interview_invited', 'accepted', 'rejected', 'withdrawn', 'submitted', 'revision_requested', 'completed')),
  company_feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, student_id)
);

-- Refuse to install policies/functions on a pre-existing table with an
-- incompatible shape. Reconcile the real schema before rerunning the script.
do $compatibility$
declare
  v_table text;
  v_columns text[];
  v_missing text[];
  v_type_mismatches text[];
begin
  for v_table, v_columns in
    select * from (values
      ('profiles', array['id','display_name','education','location','study_field','track','bio','avatar_path','created_at','updated_at']),
      ('companies', array['id','owner_id','company_name','industry','website','location','description','contact_email','contact_phone','logo_path','verification_status','created_at','updated_at']),
      ('listings', array['id','company_id','title','description','skill','work_level','budget','payment_method','deadline','status','rejection_reason','created_at','updated_at']),
      ('applications', array['id','listing_id','student_id','student_track','student_study_field','proposal','delivery_days','portfolio_url','status','company_feedback','created_at','updated_at'])
    ) as required(table_name, column_names)
  loop
    select array_agg(required_column)
      into v_missing
      from unnest(v_columns) as u(required_column)
      where not exists (
        select 1
          from information_schema.columns c
         where c.table_schema = 'public'
           and c.table_name = v_table
           and c.column_name = u.required_column
      );
    if coalesce(cardinality(v_missing), 0) > 0 then
      raise exception 'Existing public.% is incompatible with this GradLink schema. Missing columns: %. Inspect and reconcile the existing schema; no changes from this transaction were committed.',
        v_table, array_to_string(v_missing, ', ');
    end if;
  end loop;

  select array_agg(format('%s.%s (%s; expected %s)', e.table_name, e.column_name, c.udt_name, e.expected_type))
    into v_type_mismatches
    from (values
      ('profiles','id','uuid'), ('profiles','track','text'),
      ('companies','id','uuid'), ('companies','owner_id','uuid'), ('companies','verification_status','text'),
      ('listings','id','uuid'), ('listings','company_id','uuid'), ('listings','budget','numeric'),
      ('listings','deadline','date'), ('listings','status','text'),
      ('applications','id','uuid'), ('applications','listing_id','uuid'),
      ('applications','student_id','uuid'), ('applications','status','text')
    ) as e(table_name, column_name, expected_type)
    join information_schema.columns c
      on c.table_schema = 'public'
     and c.table_name = e.table_name
     and c.column_name = e.column_name
   where not (
     c.udt_name = e.expected_type
     or (e.expected_type = 'text' and c.udt_name in ('varchar', 'bpchar'))
   );
  if coalesce(cardinality(v_type_mismatches), 0) > 0 then
    raise exception 'Existing GradLink columns have incompatible types: %. Reconcile the schema before continuing.',
      array_to_string(v_type_mismatches, ', ');
  end if;
end
$compatibility$;

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete restrict,
  role text not null check (role = 'admin'),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table if not exists public.profile_contacts (
  user_id uuid primary key references public.profiles(id) on delete restrict,
  email text not null default '',
  phone text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(trim(email)) and email like '%@%'),
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  invited_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete restrict,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (accepted_at is null or revoked_at is null)
);

create unique index if not exists admin_invitations_one_pending_email
  on public.admin_invitations (email)
  where accepted_at is null and revoked_at is null;

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_table text not null,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.company_verification_submissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  submitted_by uuid not null references auth.users(id) on delete restrict,
  registration_number text,
  legal_name text,
  business_email text,
  contact_name text,
  contact_phone text,
  document_paths text[] not null default '{}',
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'rejected', 'resubmission_required')),
  reviewer_id uuid references auth.users(id) on delete set null,
  reviewer_notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (status = 'pending' and reviewer_id is null and reviewed_at is null)
    or (status <> 'pending' and reviewer_id is not null and reviewed_at is not null)
  )
);

create index if not exists company_verification_submissions_company_idx
  on public.company_verification_submissions (company_id, created_at desc);
create index if not exists company_verification_submissions_pending_idx
  on public.company_verification_submissions (created_at)
  where status = 'pending';

create table if not exists public.work_submissions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete restrict,
  student_id uuid not null references public.profiles(id) on delete restrict,
  version integer not null check (version > 0),
  submission_text text not null default '' check (char_length(submission_text) <= 20000),
  file_path text,
  status text not null default 'submitted'
    check (status in ('submitted', 'revision_requested', 'approved')),
  reviewer_id uuid references auth.users(id) on delete set null,
  reviewer_feedback text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (application_id, version),
  check (char_length(trim(submission_text)) > 0 or file_path is not null)
);

create index if not exists work_submissions_application_idx
  on public.work_submissions (application_id, version desc);

create table if not exists public.application_events (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.applications(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  actor_role text not null check (actor_role in ('student', 'company', 'admin', 'system')),
  event_type text not null check (event_type in (
    'applied', 'accepted', 'rejected', 'interview_invited', 'withdrawn',
    'work_submitted', 'revision_requested', 'work_approved', 'completed'
  )),
  from_status text,
  to_status text,
  description text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists application_events_application_idx
  on public.application_events (application_id, created_at desc);

create table if not exists public.student_certificates (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete restrict,
  file_name text not null check (char_length(file_name) between 1 and 255),
  file_path text not null unique,
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  file_size bigint not null check (file_size between 1 and 5242880),
  created_at timestamptz not null default now()
);

create table if not exists public.platform_settings (
  id boolean primary key default true check (id),
  student_completed_tasks_for_interview integer not null default 10 check (student_completed_tasks_for_interview between 1 and 1000),
  company_completed_tasks_for_interview integer not null default 10 check (company_completed_tasks_for_interview between 1 and 1000),
  minimum_interview_invites integer not null default 5 check (minimum_interview_invites between 1 and 1000),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (id)
values (true)
on conflict (id) do nothing;

create index if not exists listings_company_created_idx
  on public.listings (company_id, created_at desc);
create index if not exists listings_published_feed_idx
  on public.listings (created_at desc)
  where status = 'published';
create index if not exists listings_skill_level_idx
  on public.listings (skill, work_level, created_at desc)
  where status = 'published';
create index if not exists applications_student_created_idx
  on public.applications (student_id, created_at desc);
create index if not exists applications_listing_status_idx
  on public.applications (listing_id, status);

-- Avoid permissive policies left behind by an earlier schema. PostgreSQL
-- combines permissive policies with OR, so unknown policies must be reviewed.
do $policy_preflight$
declare
  v_unexpected text[];
begin
  select array_agg(schemaname || '.' || tablename || ':' || policyname order by tablename, policyname)
    into v_unexpected
    from pg_catalog.pg_policies
   where schemaname = 'public'
     and tablename in (
       'profiles', 'profile_contacts', 'companies', 'listings', 'applications',
       'user_roles', 'admin_invitations', 'admin_audit_log',
       'company_verification_submissions', 'work_submissions',
       'application_events', 'student_certificates', 'platform_settings'
     )
     and policyname not in (
       'profiles_select_related', 'profiles_insert_self', 'profiles_update_self',
       'profile_contacts_select_self', 'profile_contacts_insert_self', 'profile_contacts_update_self',
       'companies_select_visible', 'companies_insert_owner', 'companies_update_owner',
       'listings_select_available', 'listings_insert_owner', 'listings_update_owner',
       'applications_select_parties', 'applications_insert_student',
       'user_roles_select_self_or_admin', 'admin_invitations_select_admin',
       'admin_audit_select_admin', 'verification_submissions_select_parties',
       'work_submissions_select_parties', 'application_events_select_parties',
       'student_certificates_select_owner_admin', 'student_certificates_insert_owner',
       'student_certificates_delete_owner', 'platform_settings_select_authenticated'
     );
  if coalesce(cardinality(v_unexpected), 0) > 0 then
    raise exception 'Unexpected existing RLS policies must be reviewed before installing GradLink policies: %',
      array_to_string(v_unexpected, ', ');
  end if;
end
$policy_preflight$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at := pg_catalog.now();
  return new;
end
$function$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();
drop trigger if exists profile_contacts_set_updated_at on public.profile_contacts;
create trigger profile_contacts_set_updated_at
before update on public.profile_contacts
for each row execute function public.set_updated_at();
drop trigger if exists companies_set_updated_at on public.companies;
create trigger companies_set_updated_at
before update on public.companies
for each row execute function public.set_updated_at();
drop trigger if exists listings_set_updated_at on public.listings;
create trigger listings_set_updated_at
before update on public.listings
for each row execute function public.set_updated_at();
drop trigger if exists applications_set_updated_at on public.applications;
create trigger applications_set_updated_at
before update on public.applications
for each row execute function public.set_updated_at();
drop trigger if exists platform_settings_set_updated_at on public.platform_settings;
create trigger platform_settings_set_updated_at
before update on public.platform_settings
for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
      from public.user_roles r
     where r.user_id = (select auth.uid())
       and r.role = 'admin'
  )
$function$;

create or replace function public.owns_company(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
      from public.companies c
     where c.id = p_company_id
       and c.owner_id = (select auth.uid())
  )
$function$;

create or replace function public.owns_listing(p_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
      from public.listings l
      join public.companies c on c.id = l.company_id
     where l.id = p_listing_id
       and c.owner_id = (select auth.uid())
  )
$function$;

create or replace function public.can_access_application(p_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
      from public.applications a
      join public.listings l on l.id = a.listing_id
      join public.companies c on c.id = l.company_id
     where a.id = p_application_id
       and (a.student_id = (select auth.uid()) or c.owner_id = (select auth.uid()))
  ) or public.is_admin()
$function$;

create or replace function public.can_view_profile(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select p_student_id = (select auth.uid())
    or exists (
      select 1
        from public.applications a
        join public.listings l on l.id = a.listing_id
        join public.companies c on c.id = l.company_id
       where a.student_id = p_student_id
         and c.owner_id = (select auth.uid())
    )
    or public.is_admin()
$function$;

create or replace function public.can_view_public_asset(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.profiles p
     where p.avatar_path = p_object_name
       and public.can_view_profile(p.id)
  ) or exists (
    select 1 from public.companies c
     where c.logo_path = p_object_name
       and (
         c.owner_id = (select auth.uid())
         or public.is_admin()
         or exists (select 1 from public.listings l where l.company_id = c.id and l.status = 'published')
       )
  )
$function$;

create or replace function public.can_access_work_file(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select public.is_admin()
    or exists (
      select 1
        from public.work_submissions w
        join public.applications a on a.id = w.application_id
        join public.listings l on l.id = a.listing_id
        join public.companies c on c.id = l.company_id
       where w.file_path = p_object_name
         and (w.student_id = (select auth.uid()) or c.owner_id = (select auth.uid()))
    )
$function$;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.owns_company(uuid) from public, anon;
revoke all on function public.owns_listing(uuid) from public, anon;
revoke all on function public.can_access_application(uuid) from public, anon;
revoke all on function public.can_view_profile(uuid) from public, anon;
revoke all on function public.can_view_public_asset(text) from public, anon;
revoke all on function public.can_access_work_file(text) from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.owns_company(uuid) to authenticated;
grant execute on function public.owns_listing(uuid) to authenticated;
grant execute on function public.can_access_application(uuid) to authenticated;
grant execute on function public.can_view_profile(uuid) to authenticated;
grant execute on function public.can_view_public_asset(text) to authenticated;
grant execute on function public.can_access_work_file(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.profile_contacts enable row level security;
alter table public.companies enable row level security;
alter table public.listings enable row level security;
alter table public.applications enable row level security;
alter table public.user_roles enable row level security;
alter table public.admin_invitations enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.company_verification_submissions enable row level security;
alter table public.work_submissions enable row level security;
alter table public.application_events enable row level security;
alter table public.student_certificates enable row level security;
alter table public.platform_settings enable row level security;

drop policy if exists profiles_select_related on public.profiles;
create policy profiles_select_related on public.profiles
for select to authenticated using (public.can_view_profile(id));
drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
for insert to authenticated with check (
  id = (select auth.uid())
  and (avatar_path is null or (
    (storage.foldername(avatar_path))[1] = (select auth.uid())::text
    and (storage.foldername(avatar_path))[2] = 'avatars'
  ))
);
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
for update to authenticated using (id = (select auth.uid())) with check (
  id = (select auth.uid())
  and (avatar_path is null or (
    (storage.foldername(avatar_path))[1] = (select auth.uid())::text
    and (storage.foldername(avatar_path))[2] = 'avatars'
  ))
);

drop policy if exists profile_contacts_select_self on public.profile_contacts;
create policy profile_contacts_select_self on public.profile_contacts
for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
drop policy if exists profile_contacts_insert_self on public.profile_contacts;
create policy profile_contacts_insert_self on public.profile_contacts
for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists profile_contacts_update_self on public.profile_contacts;
create policy profile_contacts_update_self on public.profile_contacts
for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists companies_select_visible on public.companies;
create policy companies_select_visible on public.companies
for select to authenticated using (
  owner_id = (select auth.uid())
  or public.is_admin()
  or exists (
    select 1 from public.listings l
     where l.company_id = companies.id and l.status = 'published'
  )
);
drop policy if exists companies_insert_owner on public.companies;
create policy companies_insert_owner on public.companies
for insert to authenticated with check (
  owner_id = (select auth.uid())
  and (logo_path is null or (
    (storage.foldername(logo_path))[1] = (select auth.uid())::text
    and (storage.foldername(logo_path))[2] = 'company-logos'
  ))
);
drop policy if exists companies_update_owner on public.companies;
create policy companies_update_owner on public.companies
for update to authenticated using (owner_id = (select auth.uid())) with check (
  owner_id = (select auth.uid())
  and (logo_path is null or (
    (storage.foldername(logo_path))[1] = (select auth.uid())::text
    and (storage.foldername(logo_path))[2] = 'company-logos'
  ))
);

drop policy if exists listings_select_available on public.listings;
create policy listings_select_available on public.listings
for select to authenticated using (
  status = 'published' or public.owns_company(company_id) or public.is_admin()
);
drop policy if exists listings_insert_owner on public.listings;
create policy listings_insert_owner on public.listings
for insert to authenticated with check (
  public.owns_company(company_id)
  and status in ('draft', 'pending_review')
  and (
    work_level not in ('Professional', 'Advanced')
    or exists (select 1 from public.companies c where c.id = company_id and c.verification_status = 'verified')
  )
);
drop policy if exists listings_update_owner on public.listings;
create policy listings_update_owner on public.listings
for update to authenticated using (public.owns_company(company_id))
with check (
  public.owns_company(company_id)
  and status in ('draft', 'pending_review', 'rejected', 'published', 'closed')
  and (
    work_level not in ('Professional', 'Advanced')
    or exists (select 1 from public.companies c where c.id = company_id and c.verification_status = 'verified')
  )
);

drop policy if exists applications_select_parties on public.applications;
create policy applications_select_parties on public.applications
for select to authenticated using (
  student_id = (select auth.uid()) or public.owns_listing(listing_id) or public.is_admin()
);
drop policy if exists applications_insert_student on public.applications;
drop policy if exists user_roles_select_self_or_admin on public.user_roles;
create policy user_roles_select_self_or_admin on public.user_roles
for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists admin_invitations_select_admin on public.admin_invitations;
create policy admin_invitations_select_admin on public.admin_invitations
for select to authenticated using (public.is_admin());

drop policy if exists admin_audit_select_admin on public.admin_audit_log;
create policy admin_audit_select_admin on public.admin_audit_log
for select to authenticated using (public.is_admin());

drop policy if exists verification_submissions_select_parties on public.company_verification_submissions;
create policy verification_submissions_select_parties on public.company_verification_submissions
for select to authenticated using (public.owns_company(company_id) or public.is_admin());

drop policy if exists work_submissions_select_parties on public.work_submissions;
create policy work_submissions_select_parties on public.work_submissions
for select to authenticated using (student_id = (select auth.uid()) or public.can_access_application(application_id));

drop policy if exists application_events_select_parties on public.application_events;
create policy application_events_select_parties on public.application_events
for select to authenticated using (public.can_access_application(application_id));

drop policy if exists student_certificates_select_owner_admin on public.student_certificates;
create policy student_certificates_select_owner_admin on public.student_certificates
for select to authenticated using (student_id = (select auth.uid()) or public.is_admin());
drop policy if exists student_certificates_insert_owner on public.student_certificates;
create policy student_certificates_insert_owner on public.student_certificates
for insert to authenticated with check (
  student_id = (select auth.uid())
  and (storage.foldername(file_path))[1] = (select auth.uid())::text
  and (storage.foldername(file_path))[2] = 'certificates'
);
drop policy if exists student_certificates_delete_owner on public.student_certificates;
create policy student_certificates_delete_owner on public.student_certificates
for delete to authenticated using (student_id = (select auth.uid()));

drop policy if exists platform_settings_select_authenticated on public.platform_settings;
create policy platform_settings_select_authenticated on public.platform_settings
for select to authenticated using (true);

-- Start from no client table privileges, then grant only the required columns.
revoke all on public.profiles, public.companies, public.listings, public.applications,
  public.profile_contacts, public.user_roles, public.admin_invitations, public.admin_audit_log,
  public.company_verification_submissions, public.work_submissions,
  public.application_events, public.student_certificates, public.platform_settings
  from public, anon, authenticated;

do $column_grants$
declare
  v_column record;
begin
  for v_column in
    select table_name, column_name
      from information_schema.columns
     where table_schema = 'public'
       and table_name in (
         'profiles', 'companies', 'listings', 'applications', 'profile_contacts',
         'user_roles', 'admin_invitations', 'admin_audit_log',
         'company_verification_submissions', 'work_submissions',
         'application_events', 'student_certificates', 'platform_settings'
       )
  loop
    execute format(
      'revoke select (%1$I), insert (%1$I), update (%1$I), references (%1$I) on table public.%2$I from public, anon, authenticated',
      v_column.column_name, v_column.table_name
    );
  end loop;
end
$column_grants$;

grant select (id, display_name, education, location, study_field, track, bio, avatar_path, created_at, updated_at)
  on public.profiles to authenticated;
grant insert (id, display_name, education, location, study_field, track, bio, avatar_path)
  on public.profiles to authenticated;
grant update (display_name, education, location, study_field, track, bio, avatar_path)
  on public.profiles to authenticated;
grant select, insert, update on public.profile_contacts to authenticated;

grant select (id, company_name, industry, website, location, description, logo_path, verification_status, created_at, updated_at)
  on public.companies to authenticated;
grant insert (owner_id, company_name, industry, website, location, description, contact_email, contact_phone, logo_path)
  on public.companies to authenticated;
grant update (company_name, industry, website, location, description, contact_email, contact_phone, logo_path)
  on public.companies to authenticated;

grant select on public.listings to authenticated;
grant insert (company_id, title, description, skill, work_level, budget, payment_method, deadline, status)
  on public.listings to authenticated;
grant update (title, description, skill, work_level, budget, payment_method, deadline)
  on public.listings to authenticated;

grant select on public.applications to authenticated;

grant select on public.user_roles, public.admin_audit_log to authenticated;
grant select (
  id, email, invited_by, expires_at, accepted_at, accepted_by, revoked_at, created_at
) on public.admin_invitations to authenticated;
grant select on public.company_verification_submissions, public.work_submissions,
  public.application_events to authenticated;
grant select, insert, delete on public.student_certificates to authenticated;
grant select on public.platform_settings to authenticated;

create or replace function public.create_company(
  p_company_name text,
  p_industry text default '',
  p_website text default '',
  p_location text default '',
  p_description text default '',
  p_contact_email text default '',
  p_contact_phone text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_company_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if char_length(trim(coalesce(p_company_name, ''))) not between 1 and 160 then
    raise exception 'Company name is required';
  end if;
  insert into public.companies (owner_id, company_name, industry, website, location, description, contact_email, contact_phone)
  values (auth.uid(), trim(p_company_name), coalesce(p_industry, ''), coalesce(p_website, ''), coalesce(p_location, ''),
    coalesce(p_description, ''), coalesce(p_contact_email, ''), coalesce(p_contact_phone, ''))
  returning id into v_company_id;
  return v_company_id;
end
$function$;

create or replace function public.get_my_company_contacts(p_company_id uuid)
returns table (contact_email text, contact_phone text)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null or not public.owns_company(p_company_id) then
    raise exception 'Company owner authorization required';
  end if;
  return query
    select c.contact_email, c.contact_phone
      from public.companies c
     where c.id = p_company_id;
end
$function$;

create or replace function public.submit_listing_for_review(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null or not public.owns_listing(p_listing_id) then
    raise exception 'Only the listing owner can submit it for review';
  end if;
  update public.listings
     set status = 'pending_review', rejection_reason = null
   where id = p_listing_id and status in ('draft', 'rejected');
  if not found then raise exception 'Listing cannot be submitted from its current state'; end if;
end
$function$;

create or replace function public.close_listing(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null or not public.owns_listing(p_listing_id) then
    raise exception 'Only the listing owner can close it';
  end if;
  update public.listings set status = 'closed'
   where id = p_listing_id and status = 'published';
  if not found then raise exception 'Only a published listing can be closed'; end if;
end
$function$;

create or replace function public.moderate_listing(
  p_listing_id uuid,
  p_decision text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_old_status text;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Administrator authorization required'; end if;
  if p_decision is distinct from 'published' and p_decision is distinct from 'rejected' then
    raise exception 'Invalid moderation decision';
  end if;
  select status into v_old_status from public.listings where id = p_listing_id for update;
  if not found or v_old_status not in ('pending_review', 'rejected') then
    raise exception 'Listing is not awaiting moderation';
  end if;
  update public.listings
     set status = p_decision,
         rejection_reason = case when p_decision = 'rejected' then nullif(trim(coalesce(p_reason, '')), '') else null end
   where id = p_listing_id;
  insert into public.admin_audit_log (actor_id, action, target_table, target_id, details)
  values (auth.uid(), 'listing_' || p_decision, 'listings', p_listing_id::text,
    jsonb_build_object('from_status', v_old_status, 'to_status', p_decision, 'reason', p_reason));
end
$function$;

create or replace function public.apply_to_listing(
  p_listing_id uuid,
  p_student_track text,
  p_proposal text,
  p_delivery_days integer,
  p_portfolio_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_application_id uuid;
  v_profile_track text;
  v_profile_study_field text;
  v_work_level text;
  v_listing_company uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select p.track, p.study_field into v_profile_track, v_profile_study_field
    from public.profiles p where p.id = auth.uid();
  if not found then
    raise exception 'Create your student profile before applying';
  end if;
  if p_student_track is distinct from v_profile_track then
    raise exception 'Application track must match your saved profile';
  end if;
  select l.work_level, l.company_id into v_work_level, v_listing_company
    from public.listings l
   where l.id = p_listing_id and l.status = 'published' and l.deadline >= current_date
   for share;
  if not found then
    raise exception 'This listing is not available';
  end if;
  if exists (select 1 from public.companies c where c.id = v_listing_company and c.owner_id = auth.uid()) then
    raise exception 'You cannot apply to your own company listing';
  end if;
  if p_student_track = 'interview' and v_work_level not in ('Professional', 'Advanced') then
    raise exception 'Interview-pathway applications require Professional or Advanced work';
  end if;
  insert into public.applications (
    listing_id, student_id, student_track, student_study_field, proposal, delivery_days, portfolio_url
  ) values (
    p_listing_id, auth.uid(), p_student_track, v_profile_study_field, trim(p_proposal), p_delivery_days, nullif(trim(coalesce(p_portfolio_url, '')), '')
  ) returning id into v_application_id;
  insert into public.application_events (application_id, actor_id, actor_role, event_type, to_status, description)
  values (v_application_id, auth.uid(), 'student', 'applied', 'applied', 'Application submitted');
  return v_application_id;
exception
  when unique_violation then raise exception 'You have already applied to this listing';
end
$function$;

create or replace function public.decide_application(
  p_application_id uuid,
  p_decision text,
  p_feedback text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_old_status text;
  v_company_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_decision is distinct from 'accepted' and p_decision is distinct from 'rejected' then
    raise exception 'Decision must be accepted or rejected';
  end if;
  select a.status, l.company_id into v_old_status, v_company_id
    from public.applications a join public.listings l on l.id = a.listing_id
   where a.id = p_application_id for update of a;
  if not found or not public.owns_company(v_company_id) then raise exception 'Application not found for your company'; end if;
  if v_old_status not in ('applied', 'interview_invited') then raise exception 'Application is not awaiting a decision'; end if;
  update public.applications set status = p_decision, company_feedback = nullif(trim(coalesce(p_feedback, '')), '')
   where id = p_application_id;
  insert into public.application_events (application_id, actor_id, actor_role, event_type, from_status, to_status, description, details)
  values (p_application_id, auth.uid(), 'company', p_decision, v_old_status, p_decision,
    case when p_decision = 'accepted' then 'Company accepted application' else 'Company declined application' end,
    jsonb_build_object('feedback', p_feedback));
end
$function$;

create or replace function public.invite_candidate_to_interview(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_application public.applications%rowtype;
  v_company_id uuid;
  v_skill text;
  v_level text;
  v_student_completed integer;
  v_company_completed integer;
  v_policy public.platform_settings%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select a, l.company_id, l.skill, l.work_level into v_application, v_company_id, v_skill, v_level
    from public.applications a join public.listings l on l.id = a.listing_id
   where a.id = p_application_id
   for update of a;
  if not found or not public.owns_company(v_company_id) then raise exception 'Application not found for your company'; end if;
  if v_application.status <> 'applied' then raise exception 'Only active applications can receive an interview invitation'; end if;
  if v_application.student_track <> 'interview' or v_level not in ('Professional', 'Advanced') then
    raise exception 'Interview pathway and Professional or Advanced listing are required';
  end if;
  perform 1 from public.profiles p where p.id = v_application.student_id for update;
  if exists (
    select 1 from public.applications a
    join public.listings l on l.id = a.listing_id
    where a.student_id = v_application.student_id
      and a.status = 'interview_invited'
      and l.company_id = v_company_id
      and l.skill = v_skill
  ) then raise exception 'This candidate has already received an invitation in this field'; end if;
  select * into v_policy from public.platform_settings where id = true;
  select count(distinct a.listing_id)::integer into v_student_completed
    from public.applications a join public.listings l on l.id = a.listing_id
   where a.student_id = v_application.student_id and a.status = 'completed' and l.skill = v_skill;
  select count(distinct a.listing_id)::integer into v_company_completed
    from public.applications a join public.listings l on l.id = a.listing_id
   where l.company_id = v_company_id and a.status = 'completed' and l.skill = v_skill;
  if v_student_completed < v_policy.student_completed_tasks_for_interview
     or v_company_completed < v_policy.company_completed_tasks_for_interview then
    raise exception 'Interview eligibility thresholds have not been met';
  end if;
  update public.applications set status = 'interview_invited' where id = p_application_id;
  insert into public.application_events (application_id, actor_id, actor_role, event_type, from_status, to_status, description)
  values (p_application_id, auth.uid(), 'company', 'interview_invited', 'applied', 'interview_invited', 'Company sent an interview invitation');
end
$function$;

create or replace function public.withdraw_application(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_old_status text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select status into v_old_status from public.applications
   where id = p_application_id and student_id = auth.uid() for update;
  if not found or v_old_status not in ('applied', 'interview_invited') then
    raise exception 'This application can no longer be withdrawn';
  end if;
  update public.applications set status = 'withdrawn' where id = p_application_id;
  insert into public.application_events (application_id, actor_id, actor_role, event_type, from_status, to_status, description)
  values (p_application_id, auth.uid(), 'student', 'withdrawn', v_old_status, 'withdrawn', 'Student withdrew application');
end
$function$;

create or replace function public.submit_work(
  p_application_id uuid,
  p_submission_text text default '',
  p_file_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_application public.applications%rowtype;
  v_submission_id uuid;
  v_version integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_application from public.applications
   where id = p_application_id and student_id = auth.uid() for update;
  if not found or v_application.status not in ('accepted', 'revision_requested') then
    raise exception 'Work can only be submitted for accepted work or a requested revision';
  end if;
  if char_length(trim(coalesce(p_submission_text, ''))) = 0 and p_file_path is null then
    raise exception 'Provide work text or a private storage file path';
  end if;
  if p_file_path is not null and (storage.foldername(p_file_path))[1] <> auth.uid()::text then
    raise exception 'Work files must be stored in your private folder';
  end if;
  if p_file_path is not null and (
    (storage.foldername(p_file_path))[2] <> 'work'
    or (storage.foldername(p_file_path))[3] <> p_application_id::text
  ) then
    raise exception 'Work files must be stored in the folder for this application';
  end if;
  if p_file_path is not null and not exists (
    select 1 from storage.objects o
     where o.bucket_id = 'gradlink-private-documents' and o.name = p_file_path
  ) then
    raise exception 'Work file was not found in private storage';
  end if;
  select coalesce(max(version), 0) + 1 into v_version
    from public.work_submissions where application_id = p_application_id;
  insert into public.work_submissions (application_id, student_id, version, submission_text, file_path)
  values (p_application_id, auth.uid(), v_version, coalesce(p_submission_text, ''), p_file_path)
  returning id into v_submission_id;
  update public.applications set status = 'submitted' where id = p_application_id;
  insert into public.application_events (application_id, actor_id, actor_role, event_type, from_status, to_status, description, details)
  values (p_application_id, auth.uid(), 'student', 'work_submitted', v_application.status, 'submitted',
    'Student submitted work for review', jsonb_build_object('work_submission_id', v_submission_id, 'version', v_version));
  return v_submission_id;
end
$function$;

create or replace function public.review_work(
  p_work_submission_id uuid,
  p_decision text,
  p_feedback text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_submission public.work_submissions%rowtype;
  v_company_id uuid;
  v_target_status text;
  v_event_type text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_decision is distinct from 'revision_requested' and p_decision is distinct from 'approved' then
    raise exception 'Invalid work review decision';
  end if;
  select w.* into v_submission
    from public.work_submissions w
   where w.id = p_work_submission_id for update;
  if not found then raise exception 'Work submission not found'; end if;
  select l.company_id into v_company_id
    from public.applications a join public.listings l on l.id = a.listing_id
   where a.id = v_submission.application_id;
  if not public.owns_company(v_company_id) then raise exception 'Only the listing owner can review work'; end if;
  if v_submission.status <> 'submitted' then raise exception 'This submission has already been reviewed'; end if;
  update public.work_submissions
     set status = p_decision, reviewer_id = auth.uid(),
         reviewer_feedback = nullif(trim(coalesce(p_feedback, '')), ''), reviewed_at = now()
   where id = p_work_submission_id;
  v_target_status := case when p_decision = 'approved' then 'completed' else 'revision_requested' end;
  v_event_type := case when p_decision = 'approved' then 'work_approved' else 'revision_requested' end;
  update public.applications set status = v_target_status,
    company_feedback = nullif(trim(coalesce(p_feedback, '')), '')
   where id = v_submission.application_id and status = 'submitted';
  if not found then raise exception 'Application is no longer awaiting work review'; end if;
  insert into public.application_events (application_id, actor_id, actor_role, event_type, from_status, to_status, description, details)
  values (v_submission.application_id, auth.uid(), 'company', v_event_type, 'submitted', v_target_status,
    case when p_decision = 'approved' then 'Company approved submitted work' else 'Company requested a work revision' end,
    jsonb_build_object('work_submission_id', p_work_submission_id, 'feedback', p_feedback));
end
$function$;

create or replace function public.submit_company_verification(
  p_company_id uuid,
  p_registration_number text,
  p_legal_name text,
  p_business_email text,
  p_contact_name text,
  p_contact_phone text,
  p_document_paths text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_status text;
  v_submission_id uuid;
begin
  if auth.uid() is null or not public.owns_company(p_company_id) then
    raise exception 'Only the company owner can submit verification';
  end if;
  if p_document_paths is null or cardinality(p_document_paths) = 0 then
    raise exception 'Upload at least one verification document';
  end if;
  if exists (select 1 from unnest(p_document_paths) as paths(object_path)
             where paths.object_path is null or trim(paths.object_path) = '') then
    raise exception 'Verification document paths cannot be empty';
  end if;
  if exists (
    select 1 from unnest(p_document_paths) as paths(object_path)
    where (storage.foldername(paths.object_path))[1] <> auth.uid()::text
       or (storage.foldername(paths.object_path))[2] <> 'company-verification'
  ) then raise exception 'Verification documents must use your private company-verification folder'; end if;
  if exists (
    select 1 from unnest(p_document_paths) as paths(object_path)
    where not exists (
      select 1 from storage.objects o
       where o.bucket_id = 'gradlink-private-documents'
         and o.name = paths.object_path
    )
  ) then raise exception 'A verification document was not found in private storage'; end if;
  select verification_status into v_status from public.companies where id = p_company_id for update;
  if v_status not in ('not_verified', 'rejected', 'resubmission_required') then
    raise exception 'Company verification cannot be resubmitted from its current state';
  end if;
  insert into public.company_verification_submissions (
    company_id, submitted_by, registration_number, legal_name, business_email,
    contact_name, contact_phone, document_paths
  ) values (
    p_company_id, auth.uid(), nullif(trim(coalesce(p_registration_number, '')), ''),
    nullif(trim(coalesce(p_legal_name, '')), ''), nullif(trim(coalesce(p_business_email, '')), ''),
    nullif(trim(coalesce(p_contact_name, '')), ''), nullif(trim(coalesce(p_contact_phone, '')), ''),
    p_document_paths
  ) returning id into v_submission_id;
  update public.companies set verification_status = 'pending' where id = p_company_id;
  return v_submission_id;
end
$function$;

create or replace function public.decide_company_verification(
  p_submission_id uuid,
  p_decision text,
  p_reviewer_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_submission public.company_verification_submissions%rowtype;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Administrator authorization required'; end if;
  if p_decision is distinct from 'verified'
    and p_decision is distinct from 'rejected'
    and p_decision is distinct from 'resubmission_required' then
    raise exception 'Invalid verification decision';
  end if;
  select * into v_submission from public.company_verification_submissions
   where id = p_submission_id for update;
  if not found or v_submission.status <> 'pending' then raise exception 'Submission is not awaiting review'; end if;
  update public.company_verification_submissions
     set status = p_decision, reviewer_id = auth.uid(),
         reviewer_notes = nullif(trim(coalesce(p_reviewer_notes, '')), ''), reviewed_at = now()
   where id = p_submission_id;
  update public.companies set verification_status = p_decision where id = v_submission.company_id;
  insert into public.admin_audit_log (actor_id, action, target_table, target_id, details)
  values (auth.uid(), 'company_verification_' || p_decision, 'companies', v_submission.company_id::text,
    jsonb_build_object('submission_id', p_submission_id, 'notes', p_reviewer_notes));
end
$function$;

create or replace function public.update_interview_policy(
  p_student_completed_tasks integer,
  p_company_completed_tasks integer,
  p_minimum_interview_invites integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Administrator authorization required'; end if;
  if p_student_completed_tasks not between 1 and 1000
    or p_company_completed_tasks not between 1 and 1000
    or p_minimum_interview_invites not between 1 and 1000 then
    raise exception 'Interview policy values are out of range';
  end if;
  update public.platform_settings
     set student_completed_tasks_for_interview = p_student_completed_tasks,
         company_completed_tasks_for_interview = p_company_completed_tasks,
         minimum_interview_invites = p_minimum_interview_invites,
         updated_by = auth.uid()
   where id = true;
  insert into public.admin_audit_log (actor_id, action, target_table, target_id, details)
  values (auth.uid(), 'interview_policy_updated', 'platform_settings', 'true',
    jsonb_build_object('student_completed_tasks', p_student_completed_tasks,
      'company_completed_tasks', p_company_completed_tasks,
      'minimum_interview_invites', p_minimum_interview_invites));
end
$function$;

-- Admin invitation tokens are generated by a trusted server/Edge Function.
-- Only the SHA-256 hash is stored. Email delivery is outside PostgreSQL.
create or replace function public.create_admin_invitation(
  p_email text,
  p_token_hash bytea,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_invitation_id uuid;
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Administrator authorization required'; end if;
  if v_email not like '%@%' or p_token_hash is null or octet_length(p_token_hash) <> 32 then
    raise exception 'Invalid invitation details';
  end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '7 days' then
    raise exception 'Invitation expiry must be within the next seven days';
  end if;
  if exists (select 1 from public.user_roles r join auth.users u on u.id = r.user_id
             where r.role = 'admin' and lower(u.email) = v_email) then
    raise exception 'This email already belongs to an administrator';
  end if;
  if exists (select 1 from public.admin_invitations i
             where i.email = v_email and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()) then
    raise exception 'An active invitation already exists for this email';
  end if;
  update public.admin_invitations
     set revoked_at = now()
   where email = v_email and accepted_at is null and revoked_at is null and expires_at <= now();
  insert into public.admin_invitations (email, token_hash, invited_by, expires_at)
  values (v_email, p_token_hash, auth.uid(), p_expires_at)
  returning id into v_invitation_id;
  insert into public.admin_audit_log (actor_id, action, target_table, target_id, details)
  values (auth.uid(), 'admin_invitation_created', 'admin_invitations', v_invitation_id::text,
    jsonb_build_object('email', v_email, 'expires_at', p_expires_at));
  return v_invitation_id;
end
$function$;

create or replace function public.revoke_admin_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Administrator authorization required'; end if;
  update public.admin_invitations
     set revoked_at = now()
   where id = p_invitation_id and accepted_at is null and revoked_at is null and expires_at > now();
  if not found then raise exception 'Invitation is missing, expired, accepted, or already revoked'; end if;
  insert into public.admin_audit_log (actor_id, action, target_table, target_id)
  values (auth.uid(), 'admin_invitation_revoked', 'admin_invitations', p_invitation_id::text);
end
$function$;

create or replace function public.accept_admin_invitation(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_invitation public.admin_invitations%rowtype;
begin
  if v_user_id is null then raise exception 'Sign in before accepting an administrator invitation'; end if;
  select lower(email) into v_email from auth.users where id = v_user_id and email_confirmed_at is not null;
  if v_email is null then raise exception 'A verified email address is required'; end if;
  select * into v_invitation
    from public.admin_invitations
   where token_hash = extensions.digest(pg_catalog.convert_to(coalesce(p_token, ''), 'UTF8'), 'sha256')
   for update;
  if not found or v_invitation.email <> v_email or v_invitation.expires_at <= now()
    or v_invitation.revoked_at is not null or v_invitation.accepted_at is not null then
    raise exception 'Invitation is invalid, expired, revoked, already used, or belongs to another email';
  end if;
  if exists (select 1 from public.user_roles where user_id = v_user_id and role = 'admin') then
    raise exception 'This account is already an administrator';
  end if;
  update public.admin_invitations set accepted_at = now(), accepted_by = v_user_id where id = v_invitation.id;
  insert into public.user_roles (user_id, role, granted_by)
  values (v_user_id, 'admin', v_invitation.invited_by);
  insert into public.admin_audit_log (actor_id, action, target_table, target_id, details)
  values (v_user_id, 'admin_invitation_accepted', 'user_roles', v_user_id::text,
    jsonb_build_object('invitation_id', v_invitation.id, 'invited_by', v_invitation.invited_by));
end
$function$;

create or replace function public.remove_admin_role(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_admin_count bigint;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Administrator authorization required'; end if;
  if p_user_id = auth.uid() then raise exception 'Use a separate trusted process to remove your own admin role'; end if;
  select count(*) into v_admin_count from public.user_roles where role = 'admin';
  if v_admin_count <= 1 then raise exception 'The last administrator cannot be removed'; end if;
  delete from public.user_roles where user_id = p_user_id and role = 'admin';
  if not found then raise exception 'Administrator role not found'; end if;
  insert into public.admin_audit_log (actor_id, action, target_table, target_id)
  values (auth.uid(), 'admin_role_removed', 'user_roles', p_user_id::text);
end
$function$;

revoke all on function public.create_company(text,text,text,text,text,text,text) from public, anon;
revoke all on function public.get_my_company_contacts(uuid) from public, anon;
revoke all on function public.submit_listing_for_review(uuid) from public, anon;
revoke all on function public.close_listing(uuid) from public, anon;
revoke all on function public.moderate_listing(uuid,text,text) from public, anon;
revoke all on function public.apply_to_listing(uuid,text,text,integer,text) from public, anon;
revoke all on function public.decide_application(uuid,text,text) from public, anon;
revoke all on function public.invite_candidate_to_interview(uuid) from public, anon;
revoke all on function public.withdraw_application(uuid) from public, anon;
revoke all on function public.submit_work(uuid,text,text) from public, anon;
revoke all on function public.review_work(uuid,text,text) from public, anon;
revoke all on function public.submit_company_verification(uuid,text,text,text,text,text,text[]) from public, anon;
revoke all on function public.decide_company_verification(uuid,text,text) from public, anon;
revoke all on function public.update_interview_policy(integer,integer,integer) from public, anon;
revoke all on function public.create_admin_invitation(text,bytea,timestamptz) from public, anon;
revoke all on function public.revoke_admin_invitation(uuid) from public, anon;
revoke all on function public.accept_admin_invitation(text) from public, anon;
revoke all on function public.remove_admin_role(uuid) from public, anon;

grant execute on function public.create_company(text,text,text,text,text,text,text) to authenticated;
grant execute on function public.get_my_company_contacts(uuid) to authenticated;
grant execute on function public.submit_listing_for_review(uuid) to authenticated;
grant execute on function public.close_listing(uuid) to authenticated;
grant execute on function public.moderate_listing(uuid,text,text) to authenticated;
grant execute on function public.apply_to_listing(uuid,text,text,integer,text) to authenticated;
grant execute on function public.decide_application(uuid,text,text) to authenticated;
grant execute on function public.invite_candidate_to_interview(uuid) to authenticated;
grant execute on function public.withdraw_application(uuid) to authenticated;
grant execute on function public.submit_work(uuid,text,text) to authenticated;
grant execute on function public.review_work(uuid,text,text) to authenticated;
grant execute on function public.submit_company_verification(uuid,text,text,text,text,text,text[]) to authenticated;
grant execute on function public.decide_company_verification(uuid,text,text) to authenticated;
grant execute on function public.update_interview_policy(integer,integer,integer) to authenticated;
grant execute on function public.create_admin_invitation(text,bytea,timestamptz) to authenticated;
grant execute on function public.revoke_admin_invitation(uuid) to authenticated;
grant execute on function public.accept_admin_invitation(text) to authenticated;
grant execute on function public.remove_admin_role(uuid) to authenticated;

-- Private object paths:
--   <auth-user-uuid>/certificates/<random-file-id>
--   <auth-user-uuid>/company-verification/<random-file-id>
--   <auth-user-uuid>/work/<application-uuid>/<random-file-id>
do $storage_policy_preflight$
declare
  v_unexpected text[];
begin
  select array_agg(policyname order by policyname)
    into v_unexpected
    from pg_catalog.pg_policies
   where schemaname = 'storage'
     and tablename = 'objects'
     and policyname not in (
       'gradlink_documents_insert_own',
       'gradlink_documents_select_authorized',
       'gradlink_documents_delete_own'
     );
  if coalesce(cardinality(v_unexpected), 0) > 0 then
    raise exception 'Review existing storage.objects policies before installing GradLink storage access: %',
      array_to_string(v_unexpected, ', ');
  end if;
end
$storage_policy_preflight$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gradlink-private-documents',
  'gradlink-private-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists gradlink_documents_insert_own on storage.objects;
create policy gradlink_documents_insert_own on storage.objects
for insert to authenticated with check (
  bucket_id = 'gradlink-private-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2] in (
    'certificates', 'company-verification', 'work', 'avatars', 'company-logos'
  )
);

drop policy if exists gradlink_documents_select_authorized on storage.objects;
create policy gradlink_documents_select_authorized on storage.objects
for select to authenticated using (
  bucket_id = 'gradlink-private-documents'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.is_admin()
    or public.can_access_work_file(name)
    or public.can_view_public_asset(name)
  )
);

drop policy if exists gradlink_documents_delete_own on storage.objects;
create policy gradlink_documents_delete_own on storage.objects
for delete to authenticated using (
  bucket_id = 'gradlink-private-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (select 1 from public.student_certificates c where c.file_path = name)
  and not exists (select 1 from public.work_submissions w where w.file_path = name)
  and not exists (
    select 1 from public.company_verification_submissions s
     where name = any(s.document_paths)
  )
);

-- First-admin bootstrap: perform manually in SQL Editor after creating and
-- verifying the owner's Auth account. Replace the UUID with that account's id.
-- Never create a public bootstrap RPC or put a service-role key in the frontend.
--
-- insert into public.user_roles (user_id, role, granted_by)
-- values ('REPLACE-WITH-TRUSTED-AUTH-USER-UUID'::uuid, 'admin', null);
-- insert into public.admin_audit_log (actor_id, action, target_table, target_id)
-- values (null, 'first_admin_bootstrapped', 'user_roles', 'REPLACE-WITH-TRUSTED-AUTH-USER-UUID');

commit;
