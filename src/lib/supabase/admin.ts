import { createClient } from "@supabase/supabase-js";

/**
 * Service-role klients — apiet RLS. Lietot TIKAI servera pusē
 * (cron, webhook, admin-only mutācijas, kur lietotāja kontekstā nepietiek).
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
