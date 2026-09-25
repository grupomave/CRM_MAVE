"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface FilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

// Filtros ativos exibidos como "chips" removíveis + "Limpar filtros"
export function FilterChips({
  chips,
  onClearAll,
  resultLabel,
}: {
  chips: FilterChip[];
  onClearAll: () => void;
  resultLabel?: React.ReactNode;
}) {
  if (chips.length === 0 && !resultLabel) return null;
  return (
    <div className="flex min-h-7 flex-wrap items-center gap-1.5">
      {resultLabel && (
        <span className="numeric mr-1 text-caption text-muted-foreground">{resultLabel}</span>
      )}
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex h-7 items-center gap-1 rounded-full border border-border bg-card pl-2.5 pr-1 text-caption text-foreground shadow-xs"
        >
          {chip.label}
          <button
            type="button"
            onClick={chip.onRemove}
            aria-label={`Remover filtro: ${chip.label}`}
            className="flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      {chips.length > 0 && (
        <Button variant="link" size="xs" onClick={onClearAll} className="ml-1 text-caption">
          Limpar filtros
        </Button>
      )}
    </div>
  );
}
