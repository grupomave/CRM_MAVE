"use client";

import { useDroppable } from "@dnd-kit/core";
import { formatCurrencyBRL, cn } from "@/lib/utils";
import { DealCard } from "./deal-card";
import type { PipelineDeal, PipelineStage } from "./types";

export function PipelineColumn({
  stage,
  deals,
}: {
  stage: PipelineStage;
  deals: PipelineDeal[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const total = deals.reduce((sum, d) => sum + d.value, 0);
  const alertCount = deals.filter(
    (d) => d.overdue_days || d.no_upcoming_activity || d.is_stagnant,
  ).length;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-lg border border-border bg-muted/40 transition-colors",
        isOver && "border-primary bg-primary/5",
      )}
    >
      <div className="flex flex-col gap-1 border-b border-border p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">{stage.name}</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {deals.length}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            {formatCurrencyBRL(total)}
          </span>
          {alertCount > 0 && (
            <span className="text-xs font-medium text-destructive">
              {alertCount} com alerta
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2 p-2">
        {deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} />
        ))}
        {deals.length === 0 && (
          <p className="p-3 text-center text-xs text-muted-foreground">
            Nenhum negócio neste estágio
          </p>
        )}
      </div>
    </div>
  );
}
