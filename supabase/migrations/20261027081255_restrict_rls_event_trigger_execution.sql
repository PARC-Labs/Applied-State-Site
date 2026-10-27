-- Restrict execution of the production event-trigger helper discovered by
-- Supabase security advisors. Event triggers still invoke their function.
--
-- This helper is present in production, but a clean local test database may
-- not have it; the guard preserves reproducibility in both environments.
do $migration$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable()
      from public, anon, authenticated;
  end if;
end
$migration$;
