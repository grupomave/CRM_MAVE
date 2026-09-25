"use client";

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

  function update(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
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
          onValueChange={(iso) => iso && update({ from: iso })}
          className="w-36"
          aria-label={"Início do período"}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-caption font-medium text-muted-foreground">até</label>
        <DateInput
          value={to}
          onValueChange={(iso) => iso && update({ to: iso })}
          className="w-36"
          aria-label={"Fim do período"}
        />
      </div>
    </div>
  );
}
