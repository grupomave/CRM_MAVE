"use client";

import { useDroppable } from "@dnd-kit/core";
import { ChevronsLeftRight, ChevronsRightLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { cn, formatCurrencyBRL } from "@/lib/utils";
import type { KanbanDensity } from "@/lib/preferences";
import { DealCard } from "./deal-card";
import type { PipelineDeal, PipelineStage } from "./types";

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
  activeFromStageId,
  fullWidth = false,
  dragDisabled = false,
  onToggleCollapse,
  onCreate,
  onMove,
  onMoveToPipeline,
}: {
  stage: PipelineStage;
  stages: PipelineStage[];
  deals: PipelineDeal[];
  density: KanbanDensity;
  collapsed: boolean;
  /** Etapa de origem do card sendo arrastado (para o placeholder) */
  activeFromStageId: string | null;
  fullWidth?: boolean;
  dragDisabled?: boolean;
  onToggleCollapse?: () => void;
  onCreate: () => void;
  onMove: (dealId: string, stageId: string) => void;
  onMoveToPipeline?: (deal: PipelineDeal) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id, data: { name: stage.name } });
  const total = deals.reduce((sum, d) => sum + d.value, 0);
  const alertCount = deals.filter((d) => d.overdue_days || d.no_upcoming_activity || d.is_stagnant).length;
  const isDropTarget = isOver && activeFromStageId !== null && activeFromStageId !== stage.id;
  const compact = density === "compact";

  if (collapsed) {
    return (
      <section
        ref={setNodeRef}
        aria-label={`Etapa ${stage.name} (recolhida), ${deals.length} negócios`}
        className={cn(
          "flex w-11 shrink-0 flex-col items-center gap-3 rounded-lg border border-border bg-muted/50 py-2 transition-colors",
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
        "flex shrink-0 flex-col rounded-lg border border-border bg-muted/50 transition-[border-color,background-color,box-shadow]",
        fullWidth ? "w-full" : compact ? "w-48" : "w-72",
        isDropTarget && "border-primary bg-primary-subtle/60 ring-2 ring-primary/30",
      )}
    >
      {/* Roda do mouse sobre o cabeçalho rola o quadro na horizontal */}
      <header
        data-wheel-x
        className={cn(
          "flex shrink-0 flex-col gap-0.5 border-b border-border",
          compact ? "px-2 pb-1.5 pt-2" : "px-3 pb-2 pt-2.5",
        )}
      >
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
              {compact ? `${alertCount} ${alertCount === 1 ? "alerta" : "alertas"}` : `${alertCount} com alerta`}
            </span>
          )}
        </div>
      </header>

      {/* Sem rolagem própria: a coluna cresce e a página rola na vertical */}
      <div className={cn("flex flex-1 flex-col", compact ? "gap-1.5 p-1.5" : "gap-2 p-2")}>
        {isDropTarget && (
          <div
            aria-hidden
            className="flex h-14 shrink-0 items-center justify-center rounded-md border-2 border-dashed border-primary/50 text-caption font-medium text-primary"
          >
            Soltar aqui
          </div>
        )}
        {deals.map((deal) => (
          <DealCard
            key={deal.id}
            deal={deal}
            density={density}
            stages={stages}
            onMove={onMove}
            onMoveToPipeline={onMoveToPipeline}
            dragDisabled={dragDisabled}
          />
        ))}
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
