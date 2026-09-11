"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OwnerOption } from "./types";

export interface PipelineFiltersState {
  ownerId: string;
  source: string;
  minValue: string;
  maxValue: string;
}

export function PipelineFilters({
  owners,
  sources,
  filters,
  onChange,
}: {
  owners: OwnerOption[];
  sources: string[];
  filters: PipelineFiltersState;
  onChange: (next: PipelineFiltersState) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
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
  );
}
