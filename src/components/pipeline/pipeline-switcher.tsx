"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PipelineOption } from "./types";

export function PipelineSwitcher({
  pipelines,
  selectedPipelineId,
}: {
  pipelines: PipelineOption[];
  selectedPipelineId: string | null;
}) {
  const router = useRouter();

  if (pipelines.length <= 1) {
    return (
      <span className="text-sm font-medium text-foreground">
        {pipelines[0]?.name ?? "Nenhum funil"}
      </span>
    );
  }

  return (
    <Select
      value={selectedPipelineId ?? undefined}
      onValueChange={(value) => router.push(`/pipeline?pipeline=${value}`)}
    >
      <SelectTrigger className="w-56" aria-label="Funil">
        <SelectValue placeholder="Selecione o funil" />
      </SelectTrigger>
      <SelectContent>
        {pipelines.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name}
            {p.is_default ? " (padrão)" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
