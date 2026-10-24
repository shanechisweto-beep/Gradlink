-- GradLink interview-track CV support.
-- Run after the existing profiles / companies / listings / applications schema.
-- Requires a PRIVATE Storage bucket named `student-cvs`; do not make it public.

begin;

-- Package tier and CV eligibility belong to the authenticated student profile.
alter table public.profiles
  add column if not exists package_tier text,
  add column if not exists interview_track_enabled boolean not null default false;

alter table public.profiles
  drop constraint if exists profiles_package_tier_check,
  add constraint profiles_package_tier_check check (
    package_tier is null or package_tier in ('general', 'intermediate', 'professional', 'advanced')
  );

-- Package selection is user-editable profile data; keep role and verification
-- fields protected while permitting the owner to save their package choice.
grant update (package_tier, interview_track_enabled) on public.profiles to authenticated;

-- A student can keep multiple CV versions; only the current version is flagged.
-- object_path must point into the private student-cvs bucket (e.g. <auth uid>/<cv uuid>.pdf).
create table if not exists public.student_cvs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  object_path text not null unique,
  file_name text not null,
  content_type text not null check (content_type in ('application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  file_size_bytes bigint not null check (file_size_bytes between 1 and 10485760),
  version integer not null default 1 check (version > 0),
  is_current boolean not null default true,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (student_id, version)
);

create unique index if not exists student_cvs_one_current_per_student
  on public.student_cvs(student_id) where is_current;

-- Structured CV content supports updating the appropriate section when a student
-- chooses Add to CV. Keep the original uploaded file private as the source document.
create table if not exists public.student_cv_sections (
  id uuid primary key default gen_random_uuid(),
  cv_id uuid not null references public.student_cvs(id) on delete cascade,
  section_key text not null check (section_key in (
    'summary', 'education', 'experience', 'projects', 'skills', 'certifications', 'other'
  )),
  heading text not null,
  content jsonb not null default '{}'::jsonb,
  position integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (cv_id, section_key, heading)
);

-- This table powers recommendations. It links a completed GradLink task to the CV
-- section entry derived from that task. One experience entry per application.
create table if not exists public.student_cv_experiences (
  id uuid primary key default gen_random_uuid(),
  cv_id uuid not null references public.student_cvs(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  section_id uuid references public.student_cv_sections(id) on delete set null,
  added_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (cv_id, application_id)
);

-- Field equivalencies let recommendations connect adjacent disciplines (for
-- example Cybersecurity work with a Computer Science study field). Extend this
-- small taxonomy as product-approved mappings are added.
create table if not exists public.gradlink_field_equivalencies (
  source_field text not null,
  related_field text not null,
  primary key (source_field, related_field)
);

insert into public.gradlink_field_equivalencies(source_field, related_field) values
  ('cybersecurity', 'computer science'),
  ('computer science', 'cybersecurity'),
  ('cyber security', 'computer science'),
  ('computer science', 'cyber security'),
  ('coding', 'computer science'),
  ('computer science', 'coding')
on conflict do nothing;

-- Each application records the exact CV version the student elected to send.
-- Keep the storage path snapshot even if the student later uploads a new version.
alter table public.applications
  add column if not exists cv_id uuid references public.student_cvs(id) on delete set null,
  add column if not exists cv_object_path_snapshot text,
  add column if not exists cv_attached_at timestamptz;

create index if not exists student_cvs_student_id_idx on public.student_cvs(student_id, created_at desc);
create index if not exists student_cv_sections_cv_idx on public.student_cv_sections(cv_id, position);
create index if not exists student_cv_experiences_cv_idx on public.student_cv_experiences(cv_id, created_at desc);
create index if not exists applications_cv_id_idx on public.applications(cv_id);

alter table public.student_cvs enable row level security;
alter table public.student_cv_sections enable row level security;
alter table public.student_cv_experiences enable row level security;
alter table public.gradlink_field_equivalencies enable row level security;

revoke all on public.student_cvs, public.student_cv_sections, public.student_cv_experiences from anon, authenticated;
grant select, insert, update, delete on public.student_cvs, public.student_cv_sections, public.student_cv_experiences to authenticated;
revoke all on public.gradlink_field_equivalencies from anon, authenticated;
grant select on public.gradlink_field_equivalencies to authenticated;

drop policy if exists gradlink_field_equivalencies_read on public.gradlink_field_equivalencies;
create policy gradlink_field_equivalencies_read on public.gradlink_field_equivalencies
for select to authenticated using (true);

-- CV files and editable CV content are private to their owner.
drop policy if exists student_cvs_owner_all on public.student_cvs;
create policy student_cvs_owner_all on public.student_cvs for all to authenticated
using (student_id = (select auth.uid()))
with check (student_id = (select auth.uid()));

drop policy if exists student_cv_sections_owner_all on public.student_cv_sections;
create policy student_cv_sections_owner_all on public.student_cv_sections for all to authenticated
using (exists (
  select 1 from public.student_cvs cv
  where cv.id = student_cv_sections.cv_id and cv.student_id = (select auth.uid())
))
with check (exists (
  select 1 from public.student_cvs cv
  where cv.id = student_cv_sections.cv_id and cv.student_id = (select auth.uid())
));

drop policy if exists student_cv_experiences_owner_all on public.student_cv_experiences;
create policy student_cv_experiences_owner_all on public.student_cv_experiences for all to authenticated
using (added_by = (select auth.uid()) and exists (
  select 1 from public.student_cvs cv
  where cv.id = student_cv_experiences.cv_id and cv.student_id = (select auth.uid())
))
with check (added_by = (select auth.uid()) and exists (
  select 1 from public.student_cvs cv
  where cv.id = student_cv_experiences.cv_id and cv.student_id = (select auth.uid())
));

-- Keep the student_id and completed status checks inside the database. The client
-- should request candidate work through this function, then the student reviews it.
create or replace function public.gradlink_cv_task_suggestions(p_listing_id uuid)
returns table (
  application_id uuid,
  task_title text,
  task_description text,
  task_category text,
  task_skill text,
  completed_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select a.id, l.title, l.description, l.category, l.skill, a.updated_at
  from public.applications a
  join public.listings l on l.id = a.listing_id
  where a.student_id = (select auth.uid())
    and a.status = 'completed'
    and exists (
      select 1
      from public.listings target
      left join public.profiles p on p.id = auth.uid()
      where target.id = p_listing_id
        and (
          lower(coalesce(l.skill, '')) in (lower(coalesce(target.skill, '')), lower(coalesce(target.category, '')))
          or lower(coalesce(l.category, '')) in (lower(coalesce(target.skill, '')), lower(coalesce(target.category, '')))
          or lower(coalesce(l.skill, '')) = lower(coalesce(p.study_field, ''))
          or lower(coalesce(l.category, '')) = lower(coalesce(p.study_field, ''))
          or exists (
            select 1 from public.gradlink_field_equivalencies e
            where (lower(e.source_field) = lower(coalesce(target.skill, target.category, ''))
                   and lower(e.related_field) in (lower(coalesce(l.skill, '')), lower(coalesce(l.category, '')), lower(coalesce(p.study_field, ''))))
               or (lower(e.source_field) = lower(coalesce(target.category, target.skill, ''))
                   and lower(e.related_field) in (lower(coalesce(l.skill, '')), lower(coalesce(l.category, '')), lower(coalesce(p.study_field, ''))))
          )
          or lower(coalesce(l.title, '') || ' ' || coalesce(l.description, ''))
             like '%' || lower(coalesce(target.skill, target.category, '')) || '%'
          or lower(coalesce(l.title, '') || ' ' || coalesce(l.description, ''))
             like '%' || lower(coalesce(target.category, target.skill, '')) || '%'
        )
    )
  order by a.updated_at desc
$$;

revoke all on function public.gradlink_cv_task_suggestions(uuid) from public, anon;
grant execute on function public.gradlink_cv_task_suggestions(uuid) to authenticated;

-- Add a completed GradLink task to the current CV's structured experience section.
-- The function derives owner identity and task/application details from the DB.
create or replace function public.gradlink_add_completed_task_to_cv(
  p_cv_id uuid,
  p_application_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_section_id uuid;
  v_experience_id uuid;
  v_content jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  if not exists (
    select 1 from public.student_cvs cv
    join public.profiles p on p.id = cv.student_id
    where cv.id = p_cv_id
      and cv.student_id = auth.uid()
      and cv.is_current
      and p.package_tier in ('professional', 'advanced')
      and p.interview_track_enabled
  ) then
    raise exception 'An active interview-track CV is required';
  end if;

  select jsonb_build_object(
    'application_id', a.id,
    'title', l.title,
    'company', c.company_name,
    'category', l.category,
    'skill', l.skill,
    'description', l.description,
    'completed_at', a.updated_at
  ) into v_content
  from public.applications a
  join public.listings l on l.id = a.listing_id
  join public.companies c on c.id = l.company_id
  where a.id = p_application_id
    and a.student_id = auth.uid()
    and a.status = 'completed';

  if v_content is null then raise exception 'Completed task not found for this student'; end if;

  insert into public.student_cv_sections(cv_id, section_key, heading, content)
  values (p_cv_id, 'experience', 'GradLink task experience', jsonb_build_array(v_content))
  on conflict (cv_id, section_key, heading) do update
    set content = case
      when public.student_cv_sections.content @> jsonb_build_array(v_content)
        then public.student_cv_sections.content
      else public.student_cv_sections.content || jsonb_build_array(v_content)
    end,
    updated_at = now()
  returning id into v_section_id;

  insert into public.student_cv_experiences(cv_id, application_id, section_id, added_by)
  values (p_cv_id, p_application_id, v_section_id, auth.uid())
  on conflict (cv_id, application_id) do update set section_id = excluded.section_id
  returning id into v_experience_id;

  return v_experience_id;
end;
$$;

revoke all on function public.gradlink_add_completed_task_to_cv(uuid, uuid) from public, anon;
grant execute on function public.gradlink_add_completed_task_to_cv(uuid, uuid) to authenticated;

-- Attach the selected current CV to an application. This records a snapshot path;
-- employer file access should be granted only after the application is submitted.
create or replace function public.gradlink_attach_cv_to_application(
  p_application_id uuid,
  p_cv_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_path text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select object_path into v_path
  from public.student_cvs
  where id = p_cv_id and student_id = auth.uid() and is_current;
  if v_path is null then raise exception 'Current CV not found'; end if;

  update public.applications
  set cv_id = p_cv_id,
      cv_object_path_snapshot = v_path,
      cv_attached_at = now(),
      updated_at = now()
  where id = p_application_id
    and student_id = auth.uid()
    and status in ('applied', 'submitted');
  if not found then raise exception 'Application not found or cannot be changed'; end if;
end;
$$;

revoke all on function public.gradlink_attach_cv_to_application(uuid, uuid) from public, anon;
grant execute on function public.gradlink_attach_cv_to_application(uuid, uuid) to authenticated;

commit;

-- REQUIRED MANUAL STORAGE SETUP:
-- 1. This idempotently creates a private bucket (10 MB, PDF/DOCX only).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'student-cvs', 'student-cvs', false, 10485760,
  array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Student owns objects in their UUID folder. Authenticated companies do not get
-- direct object access; use the signed-URL RPC guidance below after authorization.
drop policy if exists student_cvs_storage_insert_owner on storage.objects;
create policy student_cvs_storage_insert_owner on storage.objects
for insert to authenticated
with check (
  bucket_id = 'student-cvs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists student_cvs_storage_select_owner on storage.objects;
create policy student_cvs_storage_select_owner on storage.objects
for select to authenticated
using (
  bucket_id = 'student-cvs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists student_cvs_storage_update_owner on storage.objects;
create policy student_cvs_storage_update_owner on storage.objects
for update to authenticated
using (
  bucket_id = 'student-cvs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'student-cvs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists student_cvs_storage_delete_owner on storage.objects;
create policy student_cvs_storage_delete_owner on storage.objects
for delete to authenticated
using (
  bucket_id = 'student-cvs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- 2. Add Storage object policies requiring the first folder segment to equal auth.uid().
-- 4. Employers must not receive direct bucket access. For an application where a CV
--    was attached, have a trusted server function verify the application belongs to
--    that employer and issue a short-lived signed URL. Do not expose service_role to clients.
-- 5. The SQL stores structured CV entries, but editing an uploaded PDF/DOCX file itself
--    requires a document generation service or client-side file editor. Generate a new
--    CV version from the structured sections, upload it, and mark the old version non-current.
