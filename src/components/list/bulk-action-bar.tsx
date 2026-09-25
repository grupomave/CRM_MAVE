"use client";

import { useCallback, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Seleção de linhas. Os ids selecionados sobrevivem à troca de página, mas
// são descartados quando deixam de existir no resultado filtrado.
export function useRowSelection(visibleIds: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const validSelected = useMemo(() => {
    const valid = new Set(visibleIds);
    return new Set([...selected].filter((id) => valid.has(id)));
  }, [selected, visibleIds]);

  const toggle = useCallback((id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const setMany = useCallback((ids: string[], checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  // Estado do checkbox "selecionar todos" para as linhas da página atual
  function headerState(pageIds: string[]): boolean | "indeterminate" {
    const count = pageIds.filter((id) => validSelected.has(id)).length;
    if (count === 0) return false;
    return count === pageIds.length ? true : "indeterminate";
  }

  return { selected: validSelected, toggle, setMany, clear, headerState };
}

// Barra de ações em massa: aparece fixa no rodapé ao selecionar linhas
export function BulkActionBar({
  count,
  totalFiltered,
  onSelectAllFiltered,
  onClear,
  children,
}: {
  count: number;
  totalFiltered?: number;
  onSelectAllFiltered?: () => void;
  onClear: () => void;
  children?: React.ReactNode;
}) {
  const visible = count > 0;
  return (
    <div
      role="region"
      aria-label="Ações em massa"
      aria-hidden={!visible}
      inert={!visible}
      className={cn(
        "fixed inset-x-0 bottom-4 z-40 mx-auto flex w-[calc(100%-2rem)] max-w-2xl flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-lg transition-all duration-200",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
      )}
    >
      <span className="numeric px-1 text-sm font-medium text-foreground">
        {count} {count === 1 ? "selecionado" : "selecionados"}
      </span>
      {onSelectAllFiltered && totalFiltered !== undefined && count < totalFiltered && (
        <Button variant="link" size="xs" onClick={onSelectAllFiltered}>
          Selecionar todos os {totalFiltered}
        </Button>
      )}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {children}
        <Button variant="ghost" size="icon-sm" onClick={onClear} aria-label="Limpar seleção">
          <X />
        </Button>
      </div>
    </div>
  );
}
