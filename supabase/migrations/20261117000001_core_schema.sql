-- HWC Trainer Suite — core schema
-- All tables live in `public` and are protected by RLS (see 0002). Helper/security functions live in `private`.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

do $$ begin
  create type public.app_role as enum ('super_admin', 'admin', 'instructor');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------- super admin allow-list
-- Intentionally NOT seeded from the repo (public). Populate once in the Supabase SQL editor:
--   insert into private.super_admin_emails (email) values ('owner@example.com');
create table if not exists private.super_admin_emails (
  email text primary key check (email = lower(email))
);

-- ---------------------------------------------------------------- generic updated_at trigger
create or replace function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------- facilities
create table public.facilities (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (length(trim(name)) between 2 and 160),
  short_code  text not null unique check (short_code ~ '^[A-Z0-9]{2,8}$'),
  address     text,
  city        text,
  state       text,
  zip         text,
  phone       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- profiles (1:1 auth.users)
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  email            text not null unique,
  full_name        text not null default '',
  title            text,
  phone            text,
  role             public.app_role not null default 'instructor',
  hwc_cert_number  text,
  hwc_cert_expires date,
  signature_id     uuid,
  active           boolean not null default true,
  invited_by       uuid references public.profiles (id) on delete set null,
  last_sign_in_at  timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on public.profiles (invited_by);

create table public.facility_members (
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  facility_id uuid not null references public.facilities (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (profile_id, facility_id)
);
create index on public.facility_members (facility_id);

-- ---------------------------------------------------------------- signatures (deduplicated images)
create table public.signatures (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  data_url   text not null check (data_url like 'data:image/png;base64,%' and length(data_url) < 400000),
  kind       text not null default 'drawn' check (kind in ('drawn', 'typed', 'uploaded')),
  created_at timestamptz not null default now()
);
create index on public.signatures (owner_id);
alter table public.profiles
  add constraint profiles_signature_fk foreign key (signature_id) references public.signatures (id) on delete set null;
create index on public.profiles (signature_id);

-- ---------------------------------------------------------------- invitations
create table public.invitations (
  id           uuid primary key default gen_random_uuid(),
  email        text not null check (email = lower(email) and email like '%_@_%._%'),
  full_name    text,
  role         public.app_role not null default 'instructor' check (role <> 'super_admin'),
  facility_ids uuid[] not null default '{}',
  invited_by   uuid references public.profiles (id) on delete set null,
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired', 'failed')),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '14 days',
  accepted_at  timestamptz
);
create index on public.invitations (email);
create index on public.invitations (invited_by);
create index on public.invitations (status);

-- ---------------------------------------------------------------- editable lookup lists
create table public.lookup_values (
  id         uuid primary key default gen_random_uuid(),
  category   text not null check (category in (
               'student_type', 'department', 'course_type', 'technique', 'incident_type',
               'body_part', 'location', 'job_title', 'contributing_factor')),
  value      text not null check (length(trim(value)) between 1 and 120),
  sort_order int not null default 100,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (category, value)
);

-- ---------------------------------------------------------------- students (records, not app users)
create table public.students (
  id             uuid primary key default gen_random_uuid(),
  facility_id    uuid not null references public.facilities (id) on delete restrict,
  first_name     text not null check (length(trim(first_name)) between 1 and 80),
  middle_initial text check (middle_initial is null or length(middle_initial) <= 3),
  last_name      text not null check (length(trim(last_name)) between 1 and 80),
  preferred_name text,
  employee_id    text,
  email          text,
  phone          text,
  job_title      text,
  department     text,
  student_type   text,
  hire_date      date,
  status         text not null default 'active' check (status in ('active', 'inactive', 'on_leave', 'separated')),
  notes          text,
  created_by     uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index students_facility_employee_uidx on public.students (facility_id, employee_id)
  where employee_id is not null and employee_id <> '';
create index on public.students (facility_id);
create index on public.students (last_name, first_name);
create index on public.students (student_type);
create index on public.students (department);
create index on public.students (created_by);

-- ---------------------------------------------------------------- training sessions (classes)
create table public.training_sessions (
  id                 uuid primary key default gen_random_uuid(),
  facility_id        uuid not null references public.facilities (id) on delete restrict,
  title              text,
  course_type        text not null,
  program_verbal     boolean not null default true,
  program_physical   boolean not null default true,
  location           text,
  start_date         date not null,
  end_date           date,
  hours              numeric(5, 2) check (hours is null or hours between 0 and 200),
  capacity           int check (capacity is null or capacity > 0),
  lead_instructor_id uuid references public.profiles (id) on delete set null,
  co_instructor_ids  uuid[] not null default '{}',
  status             text not null default 'scheduled' check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),
  notes              text,
  created_by         uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create index on public.training_sessions (facility_id, start_date);
create index on public.training_sessions (lead_instructor_id);
create index on public.training_sessions (start_date);
create index on public.training_sessions (created_by);

create table public.enrollments (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references public.training_sessions (id) on delete cascade,
  student_id        uuid not null references public.students (id) on delete cascade,
  attendance        text not null default 'present' check (attendance in ('present', 'absent', 'partial')),
  verbal_passed     boolean,
  physical_passed   boolean,
  written_score     int check (written_score is null or written_score between 0 and 100),
  result            text not null default 'pending' check (result in ('pending', 'pass', 'fail', 'incomplete')),
  attempt           int not null default 1 check (attempt between 1 and 20),
  remediation_notes text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (session_id, student_id)
);
create index on public.enrollments (student_id);

-- ---------------------------------------------------------------- certificates (student certificates only)
create sequence if not exists public.certificate_seq start 1001;

create table public.certificates (
  id                     uuid primary key default gen_random_uuid(),
  cert_number            text unique,
  verify_code            text not null unique default substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 16),
  student_id             uuid not null references public.students (id) on delete cascade,
  enrollment_id          uuid references public.enrollments (id) on delete set null,
  facility_id            uuid not null references public.facilities (id) on delete restrict,
  student_name           text not null,
  facility_name          text not null,
  program_verbal         boolean not null default true,
  program_physical       boolean not null default true,
  program_label          text not null default 'Basic Training Program',
  issue_date             date not null default current_date,
  expiration_date        date not null default (current_date + interval '12 months')::date,
  signature_id           uuid references public.signatures (id) on delete set null,
  signer_name            text,
  signer_title           text not null default 'Certified HWC Instructor',
  instructor_cert_number text,
  personnel              jsonb not null default '[]'::jsonb
                           check (jsonb_typeof(personnel) = 'array' and jsonb_array_length(personnel) <= 6),
  theme                  text not null default 'navy' check (theme in ('navy', 'archvista', 'crimson', 'forest')),
  status                 text not null default 'active' check (status in ('active', 'revoked')),
  revoked_reason         text,
  created_by             uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (expiration_date > issue_date)
);
create index on public.certificates (student_id);
create index on public.certificates (facility_id, expiration_date);
create index on public.certificates (expiration_date);
create index on public.certificates (issue_date);
create index on public.certificates (enrollment_id);
create index on public.certificates (signature_id);
create index on public.certificates (created_by);

create or replace function private.certificate_defaults() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_code text;
begin
  if new.cert_number is null or new.cert_number = '' then
    select short_code into v_code from public.facilities where id = new.facility_id;
    new.cert_number := 'HWC-' || coalesce(v_code, 'GEN') || '-' || to_char(new.issue_date, 'YYYY') || '-'
                       || lpad(nextval('public.certificate_seq')::text, 6, '0');
  end if;
  return new;
end $$;
create trigger certificates_defaults before insert on public.certificates
  for each row execute function private.certificate_defaults();

-- ---------------------------------------------------------------- training incidents (training accidents only — never patient data)
create table public.training_incidents (
  id                     uuid primary key default gen_random_uuid(),
  facility_id            uuid not null references public.facilities (id) on delete restrict,
  session_id             uuid references public.training_sessions (id) on delete set null,
  occurred_at            timestamptz not null default now(),
  location               text,
  involved_role          text not null default 'student' check (involved_role in ('student', 'instructor', 'observer')),
  student_id             uuid references public.students (id) on delete set null,
  involved_instructor_id uuid references public.profiles (id) on delete set null,
  incident_type          text not null,
  technique              text,
  body_part              text,
  severity               text not null default 'minor' check (severity in ('none', 'minor', 'moderate', 'severe')),
  injury                 boolean not null default false,
  first_aid              boolean not null default false,
  medical_referral       boolean not null default false,
  lost_time              boolean not null default false,
  description            text not null check (length(description) <= 4000),
  contributing_factors   text[] not null default '{}',
  corrective_action      text,
  followup_owner         text,
  followup_due           date,
  followup_status        text not null default 'open' check (followup_status in ('open', 'in_progress', 'closed')),
  reported_by            uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index on public.training_incidents (facility_id, occurred_at);
create index on public.training_incidents (session_id);
create index on public.training_incidents (student_id);
create index on public.training_incidents (involved_instructor_id);
create index on public.training_incidents (reported_by);
create index on public.training_incidents (followup_status);

-- ---------------------------------------------------------------- settings
create table public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- logging (super admin only)
create table public.audit_log (
  id          bigint generated always as identity primary key,
  table_name  text not null,
  record_id   text,
  action      text not null,
  old_data    jsonb,
  new_data    jsonb,
  actor_id    uuid,
  actor_email text,
  created_at  timestamptz not null default now()
);
create index on public.audit_log (created_at desc);
create index on public.audit_log (table_name, record_id);

create table public.app_errors (
  id          bigint generated always as identity primary key,
  level       text not null default 'error' check (level in ('debug', 'info', 'warn', 'error', 'fatal')),
  source      text not null default 'client',
  message     text not null,
  stack       text,
  route       text,
  user_id     uuid,
  user_email  text,
  user_agent  text,
  context     jsonb,
  resolved    boolean not null default false,
  resolved_at timestamptz,
  created_at  timestamptz not null default now()
);
create index on public.app_errors (created_at desc);
create index on public.app_errors (resolved, level);

create table public.auth_events (
  id         bigint generated always as identity primary key,
  event      text not null check (event in ('sign_in', 'sign_out', 'sign_in_failed', 'invite_sent', 'invite_accepted',
                                             'password_set', 'password_reset_requested', 'reset_link_created',
                                             'user_deactivated', 'user_reactivated', 'role_changed')),
  email      text,
  user_id    uuid,
  actor_id   uuid,
  detail     jsonb,
  user_agent text,
  created_at timestamptz not null default now()
);
create index on public.auth_events (created_at desc);
create index on public.auth_events (email);

-- ---------------------------------------------------------------- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['facilities', 'profiles', 'students', 'training_sessions', 'enrollments',
                           'certificates', 'training_incidents', 'app_settings']
  loop
    execute format('create trigger %I before update on public.%I for each row execute function private.touch_updated_at()',
                   t || '_touch', t);
  end loop;
end $$;
