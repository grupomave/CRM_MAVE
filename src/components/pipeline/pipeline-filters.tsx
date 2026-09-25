"use client";

import { AlertTriangle, CalendarX, Snowflake } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  FilterSelect,
  FilterToggle,
  ListToolbar,
  SearchInput,
} from "@/components/list/list-toolbar";
import { FilterChips, type FilterChip } from "@/components/list/filter-chips";
import { DEAL_STATUS_LABEL, type DealFilters } from "@/lib/filters/deals";
import { formatCurrencyBRL } from "@/lib/utils";
import type { OwnerOption, PipelineStage } from "./types";

export const DEAL_FILTER_KEYS = [
  "q",
  "status",
  "stage",
  "owner",
  "source",
  "min",
  "max",
  "overdue",
  "noact",
  "stagnant",
];

type Update = (updates: Record<string, string | number | boolean | null>) => void;

export function PipelineFilters({
  owners,
  stages,
  sources,
  filters,
  update,
  actions,
}: {
  owners: OwnerOption[];
  stages: PipelineStage[];
  sources: string[];
  filters: DealFilters;
  update: Update;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <ListToolbar
        search={
          <SearchInput
            value={filters.q}
            onChange={(q) => update({ q })}
            placeholder="Buscar negócio, organização, contato..."
          />
        }
        filters={
          <>
            <FilterSelect
              label="Status"
              value={filters.status === "open" ? "" : filters.status}
              onChange={(status) => update({ status: status || null })}
              allLabel="Em aberto"
              className="sm:w-36"
              options={[
                { value: "all", label: "Todos os status" },
                { value: "won", label: DEAL_STATUS_LABEL.won },
                { value: "lost", label: DEAL_STATUS_LABEL.lost },
              ]}
            />
            <FilterSelect
              label="Etapa"
              value={filters.stage}
              onChange={(stage) => update({ stage })}
              allLabel="Todas as etapas"
              options={stages.map((s) => ({ value: s.id, label: s.name }))}
            />
            {owners.length > 1 && (
              <FilterSelect
                label="Responsável"
                value={filters.owner}
                onChange={(owner) => update({ owner })}
                allLabel="Todos os responsáveis"
                options={owners.map((o) => ({ value: o.id, label: o.full_name }))}
              />
            )}
            {sources.length > 0 && (
              <FilterSelect
                label="Origem"
                value={filters.source}
                onChange={(source) => update({ source })}
                allLabel="Todas as origens"
                options={sources.map((s) => ({ value: s, label: s }))}
              />
            )}
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                placeholder="Valor mín."
                aria-label="Valor mínimo"
                className="w-full sm:w-28"
                defaultValue={filters.min ?? ""}
                key={`min-${filters.min ?? ""}`}
                onBlur={(e) => update({ min: e.target.value || null })}
                onKeyDown={(e) => e.key === "Enter" && update({ min: e.currentTarget.value || null })}
              />
              <span className="text-caption text-muted-foreground">até</span>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                placeholder="Valor máx."
                aria-label="Valor máximo"
                className="w-full sm:w-28"
                defaultValue={filters.max ?? ""}
                key={`max-${filters.max ?? ""}`}
                onBlur={(e) => update({ max: e.target.value || null })}
                onKeyDown={(e) => e.key === "Enter" && update({ max: e.currentTarget.value || null })}
              />
            </div>
          </>
        }
        actions={actions}
      />

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-caption text-muted-foreground">Alertas:</span>
        <FilterToggle active={filters.overdue} onClick={() => update({ overdue: !filters.overdue })}>
          <CalendarX />
          Atividade atrasada
        </FilterToggle>
        <FilterToggle active={filters.noActivity} onClick={() => update({ noact: !filters.noActivity })}>
          <AlertTriangle />
          Sem próxima atividade
        </FilterToggle>
        <FilterToggle active={filters.stagnant} onClick={() => update({ stagnant: !filters.stagnant })}>
          <Snowflake />
          Estagnado
        </FilterToggle>
      </div>
    </div>
  );
}

export function dealFilterChips(
  filters: DealFilters,
  update: Update,
  lookups: { stages: PipelineStage[]; owners: OwnerOption[] },
): FilterChip[] {
  const chips: FilterChip[] = [];
  if (filters.q) chips.push({ key: "q", label: `Busca: “${filters.q}”`, onRemove: () => update({ q: null }) });
  if (filters.status !== "open")
    chips.push({
      key: "status",
      label: `Status: ${filters.status === "all" ? "Todos" : DEAL_STATUS_LABEL[filters.status]}`,
      onRemove: () => update({ status: null }),
    });
  if (filters.stage)
    chips.push({
      key: "stage",
      label: `Etapa: ${lookups.stages.find((s) => s.id === filters.stage)?.name ?? "—"}`,
      onRemove: () => update({ stage: null }),
    });
  if (filters.owner)
    chips.push({
      key: "owner",
      label: `Responsável: ${lookups.owners.find((o) => o.id === filters.owner)?.full_name ?? "—"}`,
      onRemove: () => update({ owner: null }),
    });
  if (filters.source)
    chips.push({ key: "source", label: `Origem: ${filters.source}`, onRemove: () => update({ source: null }) });
  if (filters.min !== null)
    chips.push({ key: "min", label: `Valor ≥ ${formatCurrencyBRL(filters.min)}`, onRemove: () => update({ min: null }) });
  if (filters.max !== null)
    chips.push({ key: "max", label: `Valor ≤ ${formatCurrencyBRL(filters.max)}`, onRemove: () => update({ max: null }) });
  if (filters.overdue)
    chips.push({ key: "overdue", label: "Atividade atrasada", onRemove: () => update({ overdue: null }) });
  if (filters.noActivity)
    chips.push({ key: "noact", label: "Sem próxima atividade", onRemove: () => update({ noact: null }) });
  if (filters.stagnant)
    chips.push({ key: "stagnant", label: "Estagnado", onRemove: () => update({ stagnant: null }) });
  return chips;
}

export { FilterChips };
