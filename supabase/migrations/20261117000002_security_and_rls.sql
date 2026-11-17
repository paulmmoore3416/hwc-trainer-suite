-- HWC Trainer Suite — security helpers, auth hooks, RLS policies, audit trail, logging RPCs

revoke all on all tables in schema private from public, anon, authenticated;
grant usage on schema private to supabase_auth_admin;

-- ================================================================ helper functions
create or replace function private.is_super_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.profiles p
    join private.super_admin_emails s on s.email = lower(p.email)
    where p.id = auth.uid() and p.active
  );
$$;

create or replace function private.is_active_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active);
$$;

create or replace function private.my_role() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid() and active;
$$;

create or replace function private.can_access_facility(p_facility uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_super_admin() or exists (
    select 1
    from public.facility_members m
    join public.profiles p on p.id = m.profile_id
    where m.profile_id = auth.uid() and m.facility_id = p_facility and p.active
  );
$$;

create or replace function private.is_facility_admin(p_facility uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_super_admin() or exists (
    select 1
    from public.facility_members m
    join public.profiles p on p.id = m.profile_id
    where m.profile_id = auth.uid() and m.facility_id = p_facility and p.active and p.role = 'admin'
  );
$$;

create or replace function private.shares_facility(p_profile uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.facility_members a
    join public.facility_members b on a.facility_id = b.facility_id
    where a.profile_id = auth.uid() and b.profile_id = p_profile
  );
$$;

grant execute on all functions in schema private to authenticated;

-- ================================================================ invite-only registration
create or replace function private.enforce_invite_only() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from private.super_admin_emails where email = lower(new.email)) then
    return new;
  end if;
  if exists (select 1 from public.invitations i
             where i.email = lower(new.email) and i.status = 'pending' and i.expires_at > now()) then
    return new;
  end if;
  raise exception 'HWC Trainer Suite registration is by invitation only' using errcode = 'P0001';
end $$;

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  inv    public.invitations;
  v_role public.app_role := 'instructor';
begin
  select * into inv from public.invitations
   where email = lower(new.email) and status = 'pending'
   order by created_at desc limit 1;

  if exists (select 1 from private.super_admin_emails where email = lower(new.email)) then
    v_role := 'super_admin';
  elsif inv.id is not null then
    v_role := inv.role;
  end if;

  insert into public.profiles (id, email, full_name, role, invited_by)
  values (new.id, lower(new.email),
          coalesce(nullif(inv.full_name, ''), new.raw_user_meta_data ->> 'full_name', ''),
          v_role, inv.invited_by)
  on conflict (id) do nothing;

  if inv.id is not null and coalesce(array_length(inv.facility_ids, 1), 0) > 0 then
    insert into public.facility_members (profile_id, facility_id)
    select new.id, f from unnest(inv.facility_ids) f
     where exists (select 1 from public.facilities where id = f)
    on conflict do nothing;
  end if;
  return new;
end $$;

grant execute on function private.enforce_invite_only() to supabase_auth_admin;
grant execute on function private.handle_new_user() to supabase_auth_admin;

drop trigger if exists enforce_invite_only on auth.users;
create trigger enforce_invite_only before insert on auth.users
  for each row execute function private.enforce_invite_only();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ================================================================ profile guard (role / active / email)
create or replace function private.guard_profile_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.role = 'super_admin' and new.role is distinct from old.role
     and not exists (select 1 from private.super_admin_emails where email = lower(new.email)) then
    raise exception 'The super_admin role is reserved';
  end if;
  if auth.uid() is null
     or private.is_super_admin()
     or current_setting('hwc.privileged', true) = 'on' then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.active is distinct from old.active
     or new.email is distinct from old.email
     or new.invited_by is distinct from old.invited_by then
    raise exception 'You are not permitted to change role, status or email';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function private.guard_profile_update();

-- ================================================================ audit trail
create or replace function private.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb;
  v_new jsonb;
begin
  if tg_op in ('UPDATE', 'DELETE') then v_old := to_jsonb(old) - 'data_url'; end if;
  if tg_op in ('INSERT', 'UPDATE') then v_new := to_jsonb(new) - 'data_url'; end if;
  if tg_op = 'UPDATE' and (v_old - 'updated_at' - 'last_sign_in_at') = (v_new - 'updated_at' - 'last_sign_in_at') then
    return new;
  end if;
  insert into public.audit_log (table_name, record_id, action, old_data, new_data, actor_id, actor_email)
  values (tg_table_name,
          coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'profile_id', v_old ->> 'profile_id', v_new ->> 'key', v_old ->> 'key'),
          lower(tg_op), v_old, v_new, auth.uid(), auth.jwt() ->> 'email');
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['facilities', 'profiles', 'facility_members', 'invitations', 'lookup_values', 'students',
                           'training_sessions', 'enrollments', 'certificates', 'training_incidents', 'app_settings']
  loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.audit_row()',
                   t || '_audit', t);
  end loop;
end $$;

-- ================================================================ RLS
do $$
declare t text;
begin
  foreach t in array array['facilities', 'profiles', 'facility_members', 'signatures', 'invitations', 'lookup_values',
                           'students', 'training_sessions', 'enrollments', 'certificates', 'training_incidents',
                           'app_settings', 'audit_log', 'app_errors', 'auth_events']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
revoke all on sequence public.certificate_seq from anon;

-- facilities
create policy facilities_select on public.facilities for select to authenticated
  using ((select private.is_active_user()) and private.can_access_facility(id));
create policy facilities_write on public.facilities for all to authenticated
  using ((select private.is_super_admin())) with check ((select private.is_super_admin()));

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid())
         or (select private.is_super_admin())
         or ((select private.is_active_user()) and private.shares_facility(id)));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select private.is_super_admin()))
  with check (id = (select auth.uid()) or (select private.is_super_admin()));

-- facility members
create policy members_select on public.facility_members for select to authenticated
  using ((select private.is_active_user()) and (profile_id = (select auth.uid()) or private.can_access_facility(facility_id)));
create policy members_insert on public.facility_members for insert to authenticated
  with check (private.is_facility_admin(facility_id));
create policy members_delete on public.facility_members for delete to authenticated
  using (private.is_facility_admin(facility_id));

-- signatures
create policy signatures_select on public.signatures for select to authenticated
  using (owner_id = (select auth.uid())
         or (select private.is_super_admin())
         or ((select private.is_active_user())
             and exists (select 1 from public.certificates c where c.signature_id = signatures.id)));
create policy signatures_insert on public.signatures for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select private.is_active_user()));
create policy signatures_delete on public.signatures for delete to authenticated
  using (owner_id = (select auth.uid()) or (select private.is_super_admin()));

-- invitations (created only by the invite-user Edge Function with the service role)
create policy invitations_select on public.invitations for select to authenticated
  using ((select private.is_super_admin())
         or invited_by = (select auth.uid())
         or ((select private.my_role()) = 'admin'
             and exists (select 1 from unnest(facility_ids) f where private.can_access_facility(f))));
create policy invitations_update on public.invitations for update to authenticated
  using ((select private.is_super_admin()) or invited_by = (select auth.uid()))
  with check ((select private.is_super_admin()) or invited_by = (select auth.uid()));
revoke insert, update, delete on public.invitations from authenticated;
grant update (status) on public.invitations to authenticated;

-- lookups & settings
create policy lookups_select on public.lookup_values for select to authenticated
  using ((select private.is_active_user()));
create policy lookups_write on public.lookup_values for all to authenticated
  using ((select private.is_super_admin())) with check ((select private.is_super_admin()));
create policy settings_select on public.app_settings for select to authenticated
  using ((select private.is_active_user()));
create policy settings_write on public.app_settings for all to authenticated
  using ((select private.is_super_admin())) with check ((select private.is_super_admin()));

-- facility-scoped business tables
do $$
declare t text;
begin
  foreach t in array array['students', 'training_sessions', 'certificates', 'training_incidents']
  loop
    execute format($f$
      create policy %1$s_select on public.%1$I for select to authenticated
        using ((select private.is_active_user()) and private.can_access_facility(facility_id));
      create policy %1$s_insert on public.%1$I for insert to authenticated
        with check ((select private.is_active_user()) and private.can_access_facility(facility_id));
      create policy %1$s_update on public.%1$I for update to authenticated
        using ((select private.is_active_user()) and private.can_access_facility(facility_id))
        with check ((select private.is_active_user()) and private.can_access_facility(facility_id));
      create policy %1$s_delete on public.%1$I for delete to authenticated
        using (private.is_facility_admin(facility_id));
    $f$, t);
  end loop;
end $$;

-- enrollments inherit their session's facility
create policy enrollments_select on public.enrollments for select to authenticated
  using (exists (select 1 from public.training_sessions s where s.id = session_id));
create policy enrollments_insert on public.enrollments for insert to authenticated
  with check (exists (select 1 from public.training_sessions s where s.id = session_id)
              and exists (select 1 from public.students st where st.id = student_id));
create policy enrollments_update on public.enrollments for update to authenticated
  using (exists (select 1 from public.training_sessions s where s.id = session_id))
  with check (exists (select 1 from public.training_sessions s where s.id = session_id));
create policy enrollments_delete on public.enrollments for delete to authenticated
  using (exists (select 1 from public.training_sessions s where s.id = session_id));

-- logs: super admin only
create policy audit_select on public.audit_log for select to authenticated using ((select private.is_super_admin()));
create policy errors_select on public.app_errors for select to authenticated using ((select private.is_super_admin()));
create policy errors_update on public.app_errors for update to authenticated
  using ((select private.is_super_admin())) with check ((select private.is_super_admin()));
create policy errors_delete on public.app_errors for delete to authenticated using ((select private.is_super_admin()));
create policy auth_events_select on public.auth_events for select to authenticated using ((select private.is_super_admin()));
revoke insert on public.audit_log, public.app_errors, public.auth_events from authenticated;

-- ================================================================ RPCs
create or replace function public.my_context() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'profile', to_jsonb(p),
    'is_super_admin', private.is_super_admin(),
    'facilities', coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name, 'short_code', f.short_code) order by f.name)
      from public.facilities f
      where f.active and (private.is_super_admin()
                          or exists (select 1 from public.facility_members m where m.profile_id = p.id and m.facility_id = f.id))
    ), '[]'::jsonb)
  )
  from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.log_client_error(
  p_level text, p_message text, p_stack text default null, p_route text default null,
  p_context jsonb default null, p_user_agent text default null, p_source text default 'client'
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    if (select count(*) from public.app_errors where user_id is null and created_at > now() - interval '1 minute') >= 120 then
      return;
    end if;
  elsif (select count(*) from public.app_errors where user_id = v_uid and created_at > now() - interval '1 minute') >= 30 then
    return;
  end if;
  insert into public.app_errors (level, source, message, stack, route, user_id, user_email, user_agent, context)
  values (case when p_level in ('debug', 'info', 'warn', 'error', 'fatal') then p_level else 'error' end,
          left(coalesce(p_source, 'client'), 40),
          left(coalesce(nullif(p_message, ''), '(no message)'), 2000),
          left(p_stack, 8000), left(p_route, 500), v_uid, auth.jwt() ->> 'email', left(p_user_agent, 400),
          case when p_context is null or length(p_context::text) > 8000 then null else p_context end);
end $$;

create or replace function public.log_auth_event(
  p_event text, p_email text default null, p_detail jsonb default null, p_user_agent text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
begin
  if v_uid is null then
    if p_event not in ('sign_in_failed', 'password_reset_requested') then return; end if;
    if (select count(*) from public.auth_events where user_id is null and created_at > now() - interval '1 minute') >= 60 then
      return;
    end if;
    v_email := lower(left(p_email, 254));
  else
    if p_event not in ('sign_in', 'sign_out', 'password_set') then return; end if;
    select email into v_email from public.profiles where id = v_uid;
  end if;

  insert into public.auth_events (event, email, user_id, actor_id, detail, user_agent)
  values (p_event, v_email, v_uid, v_uid,
          case when length(coalesce(p_detail::text, '')) > 2000 then null else p_detail end,
          left(p_user_agent, 400));

  if v_uid is not null and p_event in ('sign_in', 'password_set') then
    update public.profiles set last_sign_in_at = now() where id = v_uid;
    if exists (select 1 from public.invitations where email = v_email and status = 'pending') then
      update public.invitations set status = 'accepted', accepted_at = now() where email = v_email and status = 'pending';
      insert into public.auth_events (event, email, user_id, actor_id) values ('invite_accepted', v_email, v_uid, v_uid);
    end if;
  end if;
end $$;

create or replace function public.set_user_active(p_user uuid, p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_target public.profiles;
begin
  select * into v_target from public.profiles where id = p_user;
  if v_target.id is null then raise exception 'User not found'; end if;
  if v_target.id = auth.uid() then raise exception 'You cannot change your own status'; end if;
  if exists (select 1 from private.super_admin_emails where email = lower(v_target.email)) then
    raise exception 'Super admin accounts cannot be deactivated';
  end if;
  if not (private.is_super_admin()
          or (private.my_role() = 'admin' and v_target.role = 'instructor' and private.shares_facility(p_user))) then
    raise exception 'Not authorized';
  end if;
  perform set_config('hwc.privileged', 'on', true);
  update public.profiles set active = p_active where id = p_user;
  perform set_config('hwc.privileged', 'off', true);
  insert into public.auth_events (event, email, user_id, actor_id)
  values (case when p_active then 'user_reactivated' else 'user_deactivated' end, v_target.email, p_user, auth.uid());
end $$;

create or replace function public.set_user_role(p_user uuid, p_role public.app_role) returns void
language plpgsql security definer set search_path = '' as $$
declare v_target public.profiles;
begin
  if not private.is_super_admin() then raise exception 'Not authorized'; end if;
  select * into v_target from public.profiles where id = p_user;
  if v_target.id is null then raise exception 'User not found'; end if;
  if exists (select 1 from private.super_admin_emails where email = lower(v_target.email)) then
    raise exception 'Super admin roles are fixed';
  end if;
  if p_role = 'super_admin' then raise exception 'The super_admin role is reserved'; end if;
  update public.profiles set role = p_role where id = p_user;
  insert into public.auth_events (event, email, user_id, actor_id, detail)
  values ('role_changed', v_target.email, p_user, auth.uid(), jsonb_build_object('from', v_target.role, 'to', p_role));
end $$;

-- Public certificate verification (QR code). Returns only what is printed on the certificate.
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
    'status', case when c.status = 'revoked' then 'revoked'
                   when c.expiration_date < current_date then 'expired'
                   else 'valid' end)
  from public.certificates c
  where length(p_code) = 16 and c.verify_code = p_code
  limit 1;
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.my_context() to authenticated;
grant execute on function public.log_client_error(text, text, text, text, jsonb, text, text) to anon, authenticated;
grant execute on function public.log_auth_event(text, text, jsonb, text) to anon, authenticated;
grant execute on function public.set_user_active(uuid, boolean) to authenticated;
grant execute on function public.set_user_role(uuid, public.app_role) to authenticated;
grant execute on function public.verify_certificate(text) to anon, authenticated;
