import "server-only";

import { createClient } from "@/lib/supabase/server";

// Listas cadastráveis (Configurações): origens de lead e segmentos de organização.
// Qualquer usuário lê; admin e gestor editam (RLS na migration 0029).

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface CatalogItem {
  id: string;
  name: string;
  is_active: boolean;
  order_index: number;
}

export type CatalogTable = "lead_sources" | "segments";

export async function loadCatalog(supabase: Supabase, table: CatalogTable): Promise<CatalogItem[]> {
  const { data } = await supabase
    .from(table)
    .select("id, name, is_active, order_index")
    .order("order_index")
    .order("name");
  return (data ?? []) as CatalogItem[];
}

/** Itens ativos + o item atualmente selecionado (mesmo se já desativado) */
export function selectableItems(items: CatalogItem[], currentId?: string | null) {
  return items.filter((i) => i.is_active || i.id === currentId);
}
