"use client";

import { useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type ParamValue = string | number | boolean | null | undefined;

// Estado das listagens (busca, filtros, ordenação, página) guardado na URL.
// Usa history.replaceState — integrado ao router do Next — para atualizar
// useSearchParams sem nova requisição ao servidor a cada tecla digitada.
// A URL fica compartilhável e é a fonte da exportação para Excel.
export function useListParams() {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const update = useCallback(
    (updates: Record<string, ParamValue>) => {
      const next = new URLSearchParams(window.location.search);
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === undefined || value === "" || value === false) {
          next.delete(key);
        } else {
          next.set(key, value === true ? "1" : String(value));
        }
      }
      // Qualquer mudança de filtro/busca/ordem volta para a 1ª página
      if (!("page" in updates)) next.delete("page");
      const qs = next.toString();
      window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname],
  );

  const clear = useCallback(
    (keys: string[]) => update(Object.fromEntries(keys.map((k) => [k, null]))),
    [update],
  );

  return { params: searchParams, update, clear };
}
