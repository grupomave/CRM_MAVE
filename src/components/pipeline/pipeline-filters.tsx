"use client";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { OwnerOption, PipelineStage } from "./types";

export interface PipelineFiltersState {
  search: string;
  ownerId: string;
  source: string;
  status: "all" | "open" | "won" | "lost";
  stageId: string;
  minValue: string;
  maxValue: string;
  onlyOverdue: boolean;
  onlyNoUpcoming: boolean;
  onlyStagnant: boolean;
}

const STATUS_LABEL: Record<PipelineFiltersState["status"], string> = {
  all: "Todos os status",
  open: "Aberto",
  won: "Ganho",
  lost: "Perdido",
};

export function PipelineFilters({
  owners,
  stages,
  sources,
  filters,
  onChange,
}: {
  owners: OwnerOption[];
  stages: PipelineStage[];
  sources: string[];
  filters: PipelineFiltersState;
  onChange: (next: PipelineFiltersState) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por negócio, organização, contato..."
          className="w-64"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
        />

        <Select
          value={filters.status}
          onValueChange={(v) => onChange({ ...filters, status: v as PipelineFiltersState["status"] })}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.stageId}
          onValueChange={(v) => onChange({ ...filters, stageId: v })}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Etapa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as etapas</SelectItem>
            {stages.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.ownerId}
          onValueChange={(v) => onChange({ ...filters, ownerId: v })}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os responsáveis</SelectItem>
            {owners.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.source}
          onValueChange={(v) => onChange({ ...filters, source: v })}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as origens</SelectItem>
            {sources.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="number"
          placeholder="Valor mín."
          className="w-32"
          value={filters.minValue}
          onChange={(e) => onChange({ ...filters, minValue: e.target.value })}
        />
        <Input
          type="number"
          placeholder="Valor máx."
          className="w-32"
          value={filters.maxValue}
          onChange={(e) => onChange({ ...filters, maxValue: e.target.value })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Alertas:</span>
        <FilterToggle
          active={filters.onlyOverdue}
          onClick={() => onChange({ ...filters, onlyOverdue: !filters.onlyOverdue })}
          variant="destructive"
        >
          Atividade atrasada
        </FilterToggle>
        <FilterToggle
          active={filters.onlyNoUpcoming}
          onClick={() => onChange({ ...filters, onlyNoUpcoming: !filters.onlyNoUpcoming })}
          variant="warning"
        >
          Sem próxima atividade
        </FilterToggle>
        <FilterToggle
          active={filters.onlyStagnant}
          onClick={() => onChange({ ...filters, onlyStagnant: !filters.onlyStagnant })}
          variant="stagnant"
        >
          Estagnado
        </FilterToggle>
      </div>
    </div>
  );
}

function FilterToggle({
  active,
  onClick,
  variant,
  children,
}: {
  active: boolean;
  onClick: () => void;
  variant: "destructive" | "warning" | "stagnant";
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick}>
      <Badge
        variant={active ? variant : "outline"}
        className={cn("cursor-pointer select-none", !active && "text-muted-foreground")}
      >
        {children}
      </Badge>
    </button>
  );
}
