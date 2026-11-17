-- Certificate layouts (classic / modern / heritage), open-ended theme catalogue, and badge data on the public verify RPC.
alter table public.certificates drop constraint if exists certificates_theme_check;
alter table public.certificates add constraint certificates_theme_check check (theme ~ '^[a-z0-9_-]{2,30}$');
alter table public.certificates add column if not exists layout text not null default 'classic'
  check (layout in ('classic', 'modern', 'heritage'));

update public.app_settings
   set value = value || jsonb_build_object('default_layout', 'classic')
 where key = 'certificate' and not (value ? 'default_layout');

-- Public credential lookup: adds the visual style so the public badge page can render the matching badge.
create or replace function public.verify_certificate(p_code text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'cert_number', c.cert_number,
    'student_name', c.student_name,
    'facility_name', c.facility_name,
    'program_verbal', c.program_verbal,
    'program_physical', c.program_physical,
    'program_label', c.program_label,
    'issue_date', c.issue_date,
    'expiration_date', c.expiration_date,
    'theme', c.theme,
    'layout', c.layout,
    'status', case when c.status = 'revoked' then 'revoked'
                   when c.expiration_date < current_date then 'expired'
                   else 'valid' end)
  from public.certificates c
  where length(p_code) = 16 and c.verify_code = p_code
  limit 1;
$$;
revoke execute on function public.verify_certificate(text) from public;
grant execute on function public.verify_certificate(text) to anon, authenticated;
