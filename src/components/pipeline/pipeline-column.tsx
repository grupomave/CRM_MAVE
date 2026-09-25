"use client";

import { useDroppable } from "@dnd-kit/core";
import { ChevronsLeftRight, ChevronsRightLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { cn, formatCurrencyBRL } from "@/lib/utils";
import type { KanbanDensity } from "@/lib/preferences";
import { DealCard } from "./deal-card";
import type { PipelineDeal, PipelineStage } from "./types";

export const PAGE_STEP = 30;

const compactBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function PipelineColumn({
  stage,
  stages,
  deals,
  density,
  collapsed,
  visibleCount,
  activeFromStageId,
  fullWidth = false,
  dragDisabled = false,
  onToggleCollapse,
  onShowMore,
  onCreate,
  onMove,
}: {
  stage: PipelineStage;
  stages: PipelineStage[];
  deals: PipelineDeal[];
  density: KanbanDensity;
  collapsed: boolean;
  visibleCount: number;
  /** Etapa de origem do card sendo arrastado (para o placeholder) */
  activeFromStageId: string | null;
  fullWidth?: boolean;
  dragDisabled?: boolean;
  onToggleCollapse?: () => void;
  onShowMore: () => void;
  onCreate: () => void;
  onMove: (dealId: string, stageId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id, data: { name: stage.name } });
  const total = deals.reduce((sum, d) => sum + d.value, 0);
  const alertCount = deals.filter((d) => d.overdue_days || d.no_upcoming_activity || d.is_stagnant).length;
  const isDropTarget = isOver && activeFromStageId !== null && activeFromStageId !== stage.id;
  const visible = deals.slice(0, visibleCount);
  const remaining = deals.length - visible.length;

  if (collapsed) {
    return (
      <section
        ref={setNodeRef}
        aria-label={`Etapa ${stage.name} (recolhida), ${deals.length} negócios`}
        className={cn(
          "flex h-full w-11 shrink-0 flex-col items-center gap-3 rounded-lg border border-border bg-muted/50 py-2 transition-colors",
          isDropTarget && "border-primary bg-primary-subtle ring-2 ring-primary/30",
        )}
      >
        <SimpleTooltip content="Expandir etapa" side="right">
          <Button variant="ghost" size="icon-xs" onClick={onToggleCollapse} aria-label={`Expandir ${stage.name}`}>
            <ChevronsLeftRight />
          </Button>
        </SimpleTooltip>
        <span className="numeric rounded-full bg-card px-1.5 text-micro font-semibold text-muted-foreground">
          {deals.length}
        </span>
        <span className="vertical-text truncate text-caption font-semibold text-foreground">{stage.name}</span>
      </section>
    );
  }

  return (
    <section
      ref={setNodeRef}
      aria-label={`Etapa ${stage.name}, ${deals.length} negócios`}
      className={cn(
        "flex min-h-0 shrink-0 flex-col rounded-lg border border-border bg-muted/50 transition-[border-color,background-color,box-shadow]",
        fullWidth ? "w-full" : density === "compact" ? "h-full w-64" : "h-full w-72",
        isDropTarget && "border-primary bg-primary-subtle/60 ring-2 ring-primary/30",
      )}
    >
      {/* Cabeçalho fixo: fica fora da área que rola */}
      <header className="flex shrink-0 flex-col gap-0.5 border-b border-border px-3 pb-2 pt-2.5">
        <div className="flex items-center gap-1.5">
          <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground" title={stage.name}>
            {stage.name}
          </h3>
          <span className="numeric rounded-full bg-card px-1.5 text-micro font-semibold text-muted-foreground">
            {deals.length}
          </span>
          {onToggleCollapse && (
            <SimpleTooltip content="Recolher etapa">
              <Button
                variant="ghost"
                size="icon-xs"
                className="-mr-1.5"
                onClick={onToggleCollapse}
                aria-label={`Recolher ${stage.name}`}
              >
                <ChevronsRightLeft />
              </Button>
            </SimpleTooltip>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 text-caption">
          <SimpleTooltip content={formatCurrencyBRL(total)}>
            <span className="numeric font-medium text-muted-foreground">{compactBRL.format(total)}</span>
          </SimpleTooltip>
          {alertCount > 0 && (
            <span className="numeric text-micro font-medium text-destructive">
              {alertCount} com alerta
            </span>
          )}
        </div>
      </header>

      <div
        className={cn(
          "scrollbar-thin flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2",
          fullWidth && "overflow-visible",
        )}
      >
        {isDropTarget && (
          <div
            aria-hidden
            className="flex h-14 shrink-0 items-center justify-center rounded-md border-2 border-dashed border-primary/50 text-caption font-medium text-primary"
          >
            Soltar aqui
          </div>
        )}
        {visible.map((deal) => (
          <DealCard
            key={deal.id}
            deal={deal}
            density={density}
            stages={stages}
            onMove={onMove}
            dragDisabled={dragDisabled}
          />
        ))}
        {remaining > 0 && (
          <Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground" onClick={onShowMore}>
            Mostrar mais {Math.min(remaining, PAGE_STEP)} de {remaining}
          </Button>
        )}
        {deals.length === 0 && !isDropTarget && (
          <div className="flex flex-col items-center gap-2 px-2 py-6 text-center">
            <p className="text-caption text-muted-foreground">Nenhum negócio nesta etapa</p>
            <Button variant="ghost" size="xs" onClick={onCreate}>
              <Plus />
              Criar negócio
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
