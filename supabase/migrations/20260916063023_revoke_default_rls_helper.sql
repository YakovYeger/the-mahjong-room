-- New Supabase projects may install this SECURITY DEFINER event-trigger helper
-- with EXECUTE granted to browser roles. The event trigger itself does not need
-- those callers to invoke the function through the Data API.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
    grant execute on function public.rls_auto_enable() to service_role;
  end if;
end;
$$;
