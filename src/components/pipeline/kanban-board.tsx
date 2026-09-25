"use client";

import { useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatCurrencyBRL } from "@/lib/utils";
import { useMediaQuery } from "@/lib/use-media-query";
import type { KanbanDensity } from "@/lib/preferences";
import { DealCardOverlay } from "./deal-card";
import { PAGE_STEP, PipelineColumn } from "./pipeline-column";
import type { PipelineDeal, PipelineStage } from "./types";

// Teclado: com o card "pego" (Espaço), ← e → saltam direto para o centro
// da coluna vizinha em vez de andar pixel a pixel.
const columnCoordinates: KeyboardCoordinateGetter = (event, { context }) => {
  const { collisionRect, droppableRects, droppableContainers } = context;
  if (!collisionRect) return undefined;
  if (event.code !== "ArrowRight" && event.code !== "ArrowLeft") return undefined;
  event.preventDefault();

  const columns = droppableContainers
    .getEnabled()
    .map((c) => droppableRects.get(c.id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .sort((a, b) => a.left - b.left);
  const center = collisionRect.left + collisionRect.width / 2;
  const target =
    event.code === "ArrowRight"
      ? columns.find((r) => r.left > center)
      : [...columns].reverse().find((r) => r.left + r.width < center);
  if (!target) return undefined;
  return {
    x: target.left + target.width / 2 - collisionRect.width / 2,
    y: Math.max(target.top + 64, collisionRect.top),
  };
};

export function KanbanBoard({
  stages,
  deals,
  density,
  collapsedIds,
  onToggleCollapse,
  onMove,
  onMoveToPipeline,
  onCreate,
}: {
  stages: PipelineStage[];
  deals: PipelineDeal[];
  density: KanbanDensity;
  collapsedIds: Set<string>;
  onToggleCollapse: (stageId: string) => void;
  onMove: (dealId: string, stageId: string) => void;
  onMoveToPipeline?: (deal: PipelineDeal) => void;
  onCreate: (stageId: string) => void;
}) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [activeDealId, setActiveDealId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState<Record<string, number>>({});
  const [mobileStageId, setMobileStageId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Delay + tolerância no toque: deslizar rápido rola a página; só um
    // toque mais longo inicia o arraste.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnCoordinates }),
  );

  const dealsByStage = useMemo(() => {
    const map = new Map<string, PipelineDeal[]>();
    for (const s of stages) map.set(s.id, []);
    for (const d of deals) map.get(d.stage_id)?.push(d);
    return map;
  }, [stages, deals]);

  const stageName = (id: unknown) => stages.find((s) => s.id === id)?.name ?? "";
  const dealTitle = (id: unknown) => deals.find((d) => d.id === id)?.title ?? "negócio";
  const activeDeal = activeDealId ? deals.find((d) => d.id === activeDealId) : undefined;

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Negócio ${dealTitle(active.id)} selecionado.`,
    onDragOver: ({ active, over }) =>
      over ? `${dealTitle(active.id)} sobre a etapa ${stageName(over.id)}.` : `${dealTitle(active.id)} fora das etapas.`,
    onDragEnd: ({ active, over }) =>
      over ? `${dealTitle(active.id)} movido para ${stageName(over.id)}.` : `${dealTitle(active.id)} solto fora das etapas.`,
    onDragCancel: ({ active }) => `Movimento de ${dealTitle(active.id)} cancelado.`,
  };

  function handleDragStart(event: DragStartEvent) {
    setActiveDealId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDealId(null);
    if (!event.over) return;
    onMove(String(event.active.id), String(event.over.id));
  }

  const showMore = (stageId: string) =>
    setVisibleCount((prev) => ({ ...prev, [stageId]: (prev[stageId] ?? PAGE_STEP) + PAGE_STEP }));

  // ---------- Mobile: uma etapa por vez ----------
  if (!isDesktop) {
    const current = stages.find((s) => s.id === mobileStageId) ?? stages[0];
    if (!current) return null;
    const index = stages.findIndex((s) => s.id === current.id);
    const go = (delta: number) => {
      const next = stages[index + delta];
      if (next) setMobileStageId(next.id);
    };

    return (
      <div className="flex flex-col gap-3">
        <nav aria-label="Etapas" className="scrollbar-thin -mx-4 overflow-x-auto px-4">
          <ol className="flex gap-1.5 pb-1">
            {stages.map((s) => {
              const active = s.id === current.id;
              const count = dealsByStage.get(s.id)?.length ?? 0;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    aria-current={active ? "step" : undefined}
                    onClick={() => setMobileStageId(s.id)}
                    className={cn(
                      "flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-caption font-medium transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground",
                    )}
                  >
                    {s.name}
                    <span className="numeric opacity-80">{count}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="icon-sm" onClick={() => go(-1)} disabled={index === 0} aria-label="Etapa anterior">
            <ChevronLeft />
          </Button>
          <p className="numeric text-caption text-muted-foreground">
            Etapa {index + 1} de {stages.length} · deslize para trocar
          </p>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => go(1)}
            disabled={index === stages.length - 1}
            aria-label="Próxima etapa"
          >
            <ChevronRight />
          </Button>
        </div>

        <div
          onTouchStart={(e) => {
            const t = e.touches[0];
            touchStart.current = { x: t.clientX, y: t.clientY };
          }}
          onTouchEnd={(e) => {
            const start = touchStart.current;
            touchStart.current = null;
            if (!start) return;
            const t = e.changedTouches[0];
            const dx = t.clientX - start.x;
            const dy = t.clientY - start.y;
            if (Math.abs(dx) > 60 && Math.abs(dy) < 40) go(dx < 0 ? 1 : -1);
          }}
        >
          {/* No celular o card se move pelo menu "⋯ > Mover para etapa" */}
          <DndContext id="pipeline-kanban-mobile">
            <PipelineColumn
              stage={current}
              stages={stages}
              deals={dealsByStage.get(current.id) ?? []}
              density={density}
              collapsed={false}
              visibleCount={visibleCount[current.id] ?? PAGE_STEP}
              activeFromStageId={null}
              fullWidth
              dragDisabled
              onShowMore={() => showMore(current.id)}
              onCreate={() => onCreate(current.id)}
              onMove={onMove}
              onMoveToPipeline={onMoveToPipeline}
            />
          </DndContext>
        </div>
      </div>
    );
  }

  // ---------- Desktop / tablet: quadro horizontal ----------
  const totalValue = deals.reduce((s, d) => s + d.value, 0);

  return (
    <DndContext
      id="pipeline-kanban"
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDealId(null)}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "Para mover um negócio, pressione Espaço. Use as setas esquerda e direita para escolher a etapa e Espaço novamente para soltar. Esc cancela.",
        },
      }}
    >
      <div className="relative flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="numeric text-caption text-muted-foreground">
            {deals.length} {deals.length === 1 ? "negócio em aberto" : "negócios em aberto"} ·{" "}
            {formatCurrencyBRL(totalValue)}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              size="icon-xs"
              aria-label="Rolar etapas para a esquerda"
              onClick={() => scrollRef.current?.scrollBy({ left: -300, behavior: "smooth" })}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="secondary"
              size="icon-xs"
              aria-label="Rolar etapas para a direita"
              onClick={() => scrollRef.current?.scrollBy({ left: 300, behavior: "smooth" })}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
        <div
          ref={scrollRef}
          className="scrollbar-thin flex min-h-0 flex-1 gap-2.5 overflow-x-auto overscroll-x-contain pb-2 motion-safe:scroll-smooth"
        >
          {stages.map((stage) => (
            <PipelineColumn
              key={stage.id}
              stage={stage}
              stages={stages}
              deals={dealsByStage.get(stage.id) ?? []}
              density={density}
              collapsed={collapsedIds.has(stage.id)}
              visibleCount={visibleCount[stage.id] ?? PAGE_STEP}
              activeFromStageId={activeDeal?.stage_id ?? null}
              onToggleCollapse={() => onToggleCollapse(stage.id)}
              onShowMore={() => showMore(stage.id)}
              onCreate={() => onCreate(stage.id)}
              onMove={onMove}
              onMoveToPipeline={onMoveToPipeline}
            />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
        {activeDeal ? (
          <div className={density === "compact" ? "w-60" : "w-68"}>
            <DealCardOverlay deal={activeDeal} density={density} stages={stages} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
