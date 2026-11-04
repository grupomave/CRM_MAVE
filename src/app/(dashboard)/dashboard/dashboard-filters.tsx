"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { DateInput } from "@/components/ui/masked-inputs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Option {
  id: string;
  name: string;
}

export function DashboardFilters({
  pipelines,
  pipelineId,
  from,
  to,
}: {
  pipelines: Option[];
  pipelineId: string;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [pending, startTransition] = useTransition();
  const [rangeError, setRangeError] = useState<string | null>(null);

  function update(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    // Garante que a URL sempre carregue o período completo (o padrão do servidor muda por dia)
    if (!params.get("from")) params.set("from", from);
    if (!params.get("to")) params.set("to", to);
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  function updateRange(key: "from" | "to", iso: string) {
    const nextFrom = key === "from" ? iso : from;
    const nextTo = key === "to" ? iso : to;
    if (nextFrom > nextTo) {
      setRangeError("A data inicial não pode ser maior que a data final.");
      return;
    }
    setRangeError(null);
    update({ [key]: iso });
  }

  return (
    <div className="flex flex-col items-end gap-1">
    <div className="flex flex-wrap items-end gap-2" aria-busy={pending}>
      <div className="flex flex-col gap-1">
        <label className="text-caption font-medium text-muted-foreground">Funil</label>
        <Select value={pipelineId} onValueChange={(v) => update({ pipeline: v })}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pipelines.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-caption font-medium text-muted-foreground">Período de</label>
        <DateInput
          value={from}
          onValueChange={(iso) => iso && updateRange("from", iso)}
          className="w-36"
          aria-label={"Início do período"}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-caption font-medium text-muted-foreground">até</label>
        <DateInput
          value={to}
          onValueChange={(iso) => iso && updateRange("to", iso)}
          className="w-36"
          aria-label={"Fim do período"}
        />
      </div>
    </div>
      {rangeError ? (
        <p role="alert" className="text-caption text-destructive">
          {rangeError}
        </p>
      ) : pending ? (
        <p role="status" className="text-caption text-muted-foreground">
          Atualizando indicadores…
        </p>
      ) : null}
    </div>
  );
}
