-- Searchable, filterable roster with each student's current certification status (RLS applies: security_invoker).
create or replace view public.student_roster with (security_invoker = true) as
select s.id as student_id,
       s.facility_id,
       s.first_name,
       s.middle_initial,
       s.last_name,
       s.preferred_name,
       s.employee_id,
       s.job_title,
       s.department,
       s.student_type,
       s.status as student_status,
       s.created_at,
       c.expiration_date,
       case
         when c.expiration_date is null then 'none'
         when c.expiration_date < current_date then 'expired'
         when c.expiration_date <= current_date + 60 then 'expiring'
         else 'current'
       end as cert_status,
       coalesce(c.cert_count, 0) as cert_count
from public.students s
left join lateral (
  select max(expiration_date) filter (where status = 'active') as expiration_date, count(*) as cert_count
  from public.certificates
  where student_id = s.id
) c on true;

revoke all on public.student_roster from anon;
grant select on public.student_roster to authenticated;
