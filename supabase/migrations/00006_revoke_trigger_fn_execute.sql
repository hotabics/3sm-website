-- Trigeru funkcijas nav paredzētas izsaukšanai caur /rest/v1/rpc.
-- (Supabase drošības advisors: SECURITY DEFINER funkcijas pieejamas anon/authenticated.)
-- is_admin() paliek izsaucama — to izmanto RLS politikas.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.registrations_guard() from public, anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;
