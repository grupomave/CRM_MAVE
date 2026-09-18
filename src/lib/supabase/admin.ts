import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Cliente com a service role key — ignora RLS por completo.
 * NUNCA importar este arquivo de um client component ("use client") ou de
 * qualquer código que rode no navegador: a service role key dá acesso total
 * ao banco. Uso permitido apenas em server actions ("use server") que já
 * validaram que quem chamou é admin (ver src/lib/actions/users.ts).
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
