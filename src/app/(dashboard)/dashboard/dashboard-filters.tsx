"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
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
        <label className="text-xs text-muted-foreground">Funil</label>
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
        <label className="text-xs text-muted-foreground">Período de</label>
        <Input
          type="date"
          value={from}
          onChange={(e) => update({ from: e.target.value })}
          className="w-40"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">até</label>
        <Input
          type="date"
          value={to}
          onChange={(e) => update({ to: e.target.value })}
          className="w-40"
        />
      </div>
    </div>
  );
}
