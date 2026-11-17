-- Split "for all" super-admin write policies so SELECT is evaluated by a single permissive policy (performance advisor).
do $$
declare t text; p text;
begin
  foreach t in array array['facilities', 'lookup_values', 'app_settings']
  loop
    p := case t when 'facilities' then 'facilities_write' when 'lookup_values' then 'lookups_write' else 'settings_write' end;
    execute format('drop policy if exists %I on public.%I', p, t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select private.is_super_admin()))', t || '_insert_super', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select private.is_super_admin())) with check ((select private.is_super_admin()))', t || '_update_super', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select private.is_super_admin()))', t || '_delete_super', t);
  end loop;
end $$;
