-- HWC Trainer Suite — reporting & metrics (security invoker: RLS still applies to every row counted)

create or replace view public.student_cert_status with (security_invoker = true) as
select s.id as student_id,
       s.facility_id,
       s.status as student_status,
       s.student_type,
       s.department,
       max(c.expiration_date) filter (where c.status = 'active') as expiration_date,
       case
         when max(c.expiration_date) filter (where c.status = 'active') is null then 'none'
         when max(c.expiration_date) filter (where c.status = 'active') < current_date then 'expired'
         when max(c.expiration_date) filter (where c.status = 'active') <= current_date + 60 then 'expiring'
         else 'current'
       end as cert_status
from public.students s
left join public.certificates c on c.student_id = s.id
group by s.id;
revoke all on public.student_cert_status from anon;
grant select on public.student_cert_status to authenticated;

create or replace function public.report_metrics(
  p_from date default null, p_to date default null, p_facility uuid default null
) returns jsonb
language sql stable security invoker set search_path = '' as $$
with params as (
  select coalesce(p_from, (current_date - interval '12 months')::date) as d_from,
         coalesce(p_to, current_date) as d_to
),
fac as (
  select f.id, f.name from public.facilities f where p_facility is null or f.id = p_facility
),
st as (
  select s.* from public.students s join fac on fac.id = s.facility_id
),
latest as (
  select st.id as student_id, st.facility_id, coalesce(st.department, 'Unassigned') as department,
         coalesce(st.student_type, 'Unassigned') as student_type,
         max(c.expiration_date) filter (where c.status = 'active') as exp
  from st
  left join public.certificates c on c.student_id = st.id
  where st.status = 'active'
  group by 1, 2, 3, 4
),
certs as (
  select c.* from public.certificates c join fac on fac.id = c.facility_id, params
  where c.issue_date between params.d_from and params.d_to
),
ses as (
  select t.* from public.training_sessions t join fac on fac.id = t.facility_id, params
  where t.start_date between params.d_from and params.d_to and t.status <> 'cancelled'
),
enr as (
  select e.*, ses.course_type, ses.start_date, ses.hours, ses.lead_instructor_id, ses.facility_id,
         coalesce(ses.location, 'Unspecified') as location,
         coalesce(s.student_type, 'Unassigned') as student_type,
         coalesce(s.department, 'Unassigned') as department
  from public.enrollments e
  join ses on ses.id = e.session_id
  join public.students s on s.id = e.student_id
),
inc_all as (
  select i.* from public.training_incidents i join fac on fac.id = i.facility_id
),
inc as (
  select inc_all.* from inc_all, params
  where inc_all.occurred_at >= params.d_from and inc_all.occurred_at < params.d_to + 1
),
months as (
  select generate_series(date_trunc('month', d_from), date_trunc('month', d_to), interval '1 month')::date as m from params
),
future_months as (
  select generate_series(date_trunc('month', current_date), date_trunc('month', current_date) + interval '11 months',
                         interval '1 month')::date as m
)
select jsonb_build_object(
  'range', (select jsonb_build_object('from', d_from, 'to', d_to) from params),
  'generated_at', now(),

  'kpis', jsonb_build_object(
    'active_students',        (select count(*) from latest),
    'total_students',         (select count(*) from st),
    'certified_current',      (select count(*) from latest where exp >= current_date),
    'expiring_30',            (select count(*) from latest where exp between current_date and current_date + 30),
    'expiring_60',            (select count(*) from latest where exp between current_date and current_date + 60),
    'expiring_90',            (select count(*) from latest where exp between current_date and current_date + 90),
    'expired',                (select count(*) from latest where exp < current_date),
    'never_certified',        (select count(*) from latest where exp is null),
    'sessions',               (select count(*) from ses),
    'sessions_completed',     (select count(*) from ses where status = 'completed'),
    'sessions_scheduled',     (select count(*) from public.training_sessions t join fac on fac.id = t.facility_id
                                where t.status = 'scheduled' and t.start_date >= current_date),
    'trainees',               (select count(*) from enr where attendance <> 'absent'),
    'unique_trainees',        (select count(distinct student_id) from enr where attendance <> 'absent'),
    'no_shows',               (select count(*) from enr where attendance = 'absent'),
    'hours_delivered',        (select coalesce(sum(hours), 0) from ses where status = 'completed'),
    'person_hours',           (select coalesce(sum(hours), 0) from enr where attendance = 'present'),
    'passed',                 (select count(*) from enr where result = 'pass'),
    'failed',                 (select count(*) from enr where result = 'fail'),
    'incomplete',             (select count(*) from enr where result = 'incomplete'),
    'first_attempt_passed',   (select count(*) from enr where result = 'pass' and attempt = 1),
    'first_attempt_graded',   (select count(*) from enr where result in ('pass', 'fail') and attempt = 1),
    'avg_written_score',      (select round(avg(written_score), 1) from enr),
    'remediations',           (select count(*) from enr where coalesce(remediation_notes, '') <> '' or attempt > 1),
    'certs_issued',           (select count(*) from certs where status = 'active'),
    'certs_revoked',          (select count(*) from certs where status = 'revoked'),
    'incidents',              (select count(*) from inc),
    'injuries',               (select count(*) from inc where injury),
    'medical_referrals',      (select count(*) from inc where medical_referral),
    'lost_time',              (select count(*) from inc where lost_time),
    'serious_incidents',      (select count(*) from inc where severity in ('moderate', 'severe')),
    'open_followups',         (select count(*) from inc_all where followup_status <> 'closed'),
    'overdue_followups',      (select count(*) from inc_all where followup_status <> 'closed' and followup_due < current_date),
    'last_incident_at',       (select max(occurred_at) from inc_all),
    'active_instructors',     (select count(*) from public.profiles p
                                where p.active and (p_facility is null or exists (
                                  select 1 from public.facility_members m where m.profile_id = p.id and m.facility_id = p_facility))),
    'instructors_expiring_90',(select count(*) from public.profiles p
                                where p.active and p.hwc_cert_expires between current_date and current_date + 90
                                  and (p_facility is null or exists (
                                  select 1 from public.facility_members m where m.profile_id = p.id and m.facility_id = p_facility)))
  ),

  'by_month', (select coalesce(jsonb_agg(jsonb_build_object(
      'month', to_char(m.m, 'YYYY-MM'),
      'sessions',  (select count(*) from ses where date_trunc('month', ses.start_date)::date = m.m),
      'trainees',  (select count(*) from enr where date_trunc('month', enr.start_date)::date = m.m and attendance <> 'absent'),
      'hours',     (select coalesce(sum(hours), 0) from ses where date_trunc('month', ses.start_date)::date = m.m),
      'passed',    (select count(*) from enr where date_trunc('month', enr.start_date)::date = m.m and result = 'pass'),
      'failed',    (select count(*) from enr where date_trunc('month', enr.start_date)::date = m.m and result = 'fail'),
      'certs',     (select count(*) from certs where date_trunc('month', certs.issue_date)::date = m.m and status = 'active'),
      'incidents', (select count(*) from inc where date_trunc('month', inc.occurred_at)::date = m.m),
      'injuries',  (select count(*) from inc where date_trunc('month', inc.occurred_at)::date = m.m and injury)
    ) order by m.m), '[]'::jsonb) from months m),

  'by_course', (select coalesce(jsonb_agg(x order by x.sessions desc), '[]'::jsonb) from (
      select ses.course_type as name, count(distinct ses.id) as sessions,
             count(e.id) filter (where e.attendance <> 'absent') as trainees,
             count(e.id) filter (where e.result = 'pass') as passed,
             count(e.id) filter (where e.result = 'fail') as failed,
             round(avg(e.written_score), 1) as avg_score,
             (select coalesce(sum(s2.hours), 0) from ses s2 where s2.course_type = ses.course_type) as hours
      from ses left join public.enrollments e on e.session_id = ses.id
      group by ses.course_type) x),

  'students_by_type', (select coalesce(jsonb_agg(x order by x.students desc), '[]'::jsonb) from (
      select student_type as name, count(*) as students,
             count(*) filter (where exp >= current_date) as current,
             count(*) filter (where exp between current_date and current_date + 60) as expiring,
             count(*) filter (where exp < current_date) as expired,
             count(*) filter (where exp is null) as never
      from latest group by student_type) x),

  'outcomes_by_type', (select coalesce(jsonb_agg(x order by x.trainees desc), '[]'::jsonb) from (
      select student_type as name, count(*) filter (where attendance <> 'absent') as trainees,
             count(*) filter (where result = 'pass') as passed,
             count(*) filter (where result = 'fail') as failed,
             round(avg(written_score), 1) as avg_score
      from enr group by student_type) x),

  'by_department', (select coalesce(jsonb_agg(x order by x.students desc), '[]'::jsonb) from (
      select department as name, count(*) as students,
             count(*) filter (where exp >= current_date) as current,
             count(*) filter (where exp between current_date and current_date + 60) as expiring,
             count(*) filter (where exp < current_date) as expired,
             count(*) filter (where exp is null) as never
      from latest group by department) x),

  'by_facility', (select coalesce(jsonb_agg(x order by x.name), '[]'::jsonb) from (
      select fac.name,
             (select count(*) from latest l where l.facility_id = fac.id) as students,
             (select count(*) from latest l where l.facility_id = fac.id and l.exp >= current_date) as current,
             (select count(*) from latest l where l.facility_id = fac.id and l.exp < current_date) as expired,
             (select count(*) from latest l where l.facility_id = fac.id and l.exp is null) as never,
             (select count(*) from ses where ses.facility_id = fac.id) as sessions,
             (select count(*) from enr where enr.facility_id = fac.id and attendance <> 'absent') as trainees,
             (select count(*) from inc where inc.facility_id = fac.id) as incidents
      from fac) x),

  'by_location', (select coalesce(jsonb_agg(x order by x.sessions desc), '[]'::jsonb) from (
      select d.facility, d.name, d.sessions, d.trainees,
             (select count(*) from inc where inc.facility_id = d.facility_id
                and coalesce(inc.location, 'Unspecified') = d.name) as incidents
      from (
        select fac.id as facility_id, fac.name as facility, coalesce(ses.location, 'Unspecified') as name,
               count(distinct ses.id) as sessions,
               count(e.id) filter (where e.attendance <> 'absent') as trainees
        from ses join fac on fac.id = ses.facility_id
        left join public.enrollments e on e.session_id = ses.id
        group by 1, 2, 3) d) x),

  'by_weekday', (select coalesce(jsonb_agg(x order by x.dow), '[]'::jsonb) from (
      select d.dow, d.sessions,
             (select count(*) from enr where extract(isodow from enr.start_date)::int = d.dow
                and attendance <> 'absent') as trainees
      from (select extract(isodow from start_date)::int as dow, count(*) as sessions from ses group by 1) d) x),

  'by_instructor', (select coalesce(jsonb_agg(x order by x.sessions desc), '[]'::jsonb) from (
      select coalesce(nullif(p.full_name, ''), p.email, 'Unassigned') as name,
             p.hwc_cert_expires as cert_expires,
             count(distinct ses.id) as sessions,
             coalesce((select sum(s2.hours) from ses s2 where s2.lead_instructor_id is not distinct from ses.lead_instructor_id), 0) as hours,
             count(e.id) filter (where e.attendance <> 'absent') as trainees,
             count(e.id) filter (where e.result = 'pass') as passed,
             count(e.id) filter (where e.result = 'fail') as failed,
             (select count(*) from inc where inc.session_id in (select s3.id from ses s3
                where s3.lead_instructor_id is not distinct from ses.lead_instructor_id)) as incidents
      from ses
      left join public.profiles p on p.id = ses.lead_instructor_id
      left join public.enrollments e on e.session_id = ses.id
      group by ses.lead_instructor_id, p.full_name, p.email, p.hwc_cert_expires) x),

  'expiration_forecast', (select coalesce(jsonb_agg(jsonb_build_object(
      'month', to_char(fm.m, 'YYYY-MM'),
      'expiring', (select count(*) from latest where date_trunc('month', exp)::date = fm.m)
    ) order by fm.m), '[]'::jsonb) from future_months fm),

  'certs_by_program', jsonb_build_object(
      'both',          (select count(*) from certs where status = 'active' and program_verbal and program_physical),
      'verbal_only',   (select count(*) from certs where status = 'active' and program_verbal and not program_physical),
      'physical_only', (select count(*) from certs where status = 'active' and program_physical and not program_verbal)),

  'student_status', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
      select status as name, count(*) as value from st group by status) x),

  'incidents_by_type',      (select coalesce(jsonb_agg(x order by x.value desc), '[]'::jsonb) from (
      select incident_type as name, count(*) as value, count(*) filter (where injury) as injuries from inc group by 1) x),
  'incidents_by_severity',  (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
      select severity as name, count(*) as value from inc group by 1) x),
  'incidents_by_technique', (select coalesce(jsonb_agg(x order by x.value desc), '[]'::jsonb) from (
      select coalesce(technique, 'Unspecified') as name, count(*) as value from inc group by 1) x),
  'incidents_by_body_part', (select coalesce(jsonb_agg(x order by x.value desc), '[]'::jsonb) from (
      select coalesce(body_part, 'Unspecified') as name, count(*) as value from inc group by 1) x),
  'incidents_by_role',      (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
      select involved_role as name, count(*) as value from inc group by 1) x),
  'incidents_by_factor',    (select coalesce(jsonb_agg(x order by x.value desc), '[]'::jsonb) from (
      select f as name, count(*) as value from inc, unnest(contributing_factors) f group by 1) x),
  'incidents_followup',     (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
      select followup_status as name, count(*) as value from inc_all group by 1) x)
);
$$;

grant execute on function public.report_metrics(date, date, uuid) to authenticated;
