"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ChevronLeft, ChevronRight, KanbanSquare, List, Plus, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useListParams } from "@/components/list/use-list-params";
import { BulkActionBar, useRowSelection } from "@/components/list/bulk-action-bar";
import { BulkOwnerButton } from "@/components/list/bulk-owner-dialog";
import { applyDealFilters, parseDealFilters } from "@/lib/filters/deals";
import { getEnumParam, getPagination } from "@/lib/filters/params";
import { NewDealDialog } from "@/components/forms/new-deal-dialog";
import { createClient } from "@/lib/supabase/client";
import { formatCurrencyBRL, cn } from "@/lib/utils";
import { DealCardOverlay } from "./deal-card";
import { PipelineColumn } from "./pipeline-column";
import { PipelineSwitcher } from "./pipeline-switcher";
import {
  DEAL_FILTER_KEYS,
  FilterChips,
  PipelineFilters,
  dealFilterChips,
} from "./pipeline-filters";
import { DealsTable } from "./deals-table";
import type {
  OwnerOption,
  PipelineDeal,
  PipelineOption,
  PipelineStage,
} from "./types";

const VIEW_MODES = ["kanban", "list", "forecast"] as const;
type ViewMode = (typeof VIEW_MODES)[number];

export function PipelineBoard({
  pipelines,
  selectedPipelineId,
  stages,
  initialDeals,
  owners,
  canReassign = false,
}: {
  pipelines: PipelineOption[];
  selectedPipelineId: string | null;
  stages: PipelineStage[];
  initialDeals: PipelineDeal[];
  owners: OwnerOption[];
  canReassign?: boolean;
}) {
  const [deals, setDeals] = useState(initialDeals);
  const { params, update, clear } = useListParams();
  const filters = useMemo(() => parseDealFilters(params), [params]);
  const { page, pageSize } = getPagination(params);
  const view: ViewMode = getEnumParam(params, "view", VIEW_MODES, "kanban");
  const setView = (next: ViewMode) => update({ view: next === "kanban" ? null : next, page: null });
  const [activeDealId, setActiveDealId] = useState<string | null>(null);
  const supabase = createClient();
  const boardScrollRef = useRef<HTMLDivElement>(null);

  function scrollBoardBy(amount: number) {
    boardScrollRef.current?.scrollBy({ left: amount, behavior: "smooth" });
  }

  function handleBoardKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      scrollBoardBy(320);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      scrollBoardBy(-320);
    }
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Delay + tolerance no toque: um "tap-and-swipe" rapido ainda rola a
    // pagina normalmente; so um toque mais sustentado inicia o arraste.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  useEffect(() => {
    const channel = supabase
      .channel("pipeline-deals")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deals" },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            const updated = payload.new as {
              id: string;
              stage_id: string;
              value: number;
              status: "open" | "won" | "lost";
            };
            setDeals((prev) =>
              prev.map((d) =>
                d.id === updated.id
                  ? { ...d, stage_id: updated.stage_id, value: updated.value, status: updated.status }
                  : d,
              ),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sources = useMemo(
    () =>
      Array.from(new Set(deals.map((d) => d.source).filter(Boolean))) as string[],
    [deals],
  );

  const stageOrder = useMemo(
    () => new Map(stages.map((s, i) => [s.id, i])),
    [stages],
  );

  const filteredDeals = useMemo(
    () => applyDealFilters(deals, filters, stageOrder),
    [deals, filters, stageOrder],
  );
  const filteredIds = useMemo(() => filteredDeals.map((d) => d.id), [filteredDeals]);
  const selection = useRowSelection(filteredIds);
  const chips = dealFilterChips(filters, update, { stages, owners });

  // O Kanban só faz sentido para negócios abertos — ganhos/perdidos não têm
  // "próxima coluna" (docx §3: fechados só aparecem na Lista).
  const kanbanDeals = useMemo(
    () => filteredDeals.filter((d) => d.status === "open"),
    [filteredDeals],
  );

  const activeDeal = activeDealId
    ? deals.find((d) => d.id === activeDealId)
    : undefined;

  function handleDragStart(event: DragStartEvent) {
    setActiveDealId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveDealId(null);
    const { active, over } = event;
    if (!over) return;

    const dealId = String(active.id);
    const newStageId = String(over.id);
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage_id === newStageId) return;

    const previousStageId = deal.stage_id;

    setDeals((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, stage_id: newStageId } : d)),
    );

    const { error } = await supabase
      .from("deals")
      .update({ stage_id: newStageId })
      .eq("id", dealId);

    if (error) {
      setDeals((prev) =>
        prev.map((d) => (d.id === dealId ? { ...d, stage_id: previousStageId } : d)),
      );
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await supabase.from("deal_stage_history").insert({
        deal_id: dealId,
        from_stage_id: previousStageId,
        to_stage_id: newStageId,
        changed_by: user.id,
      });
    }
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title="Negócios"
        actions={
          <>
            <PipelineSwitcher pipelines={pipelines} selectedPipelineId={selectedPipelineId} />
            <NewDealDialog
              trigger={
                <Button>
                  <Plus />
                  Novo negócio
                </Button>
              }
              pipelineId={selectedPipelineId ?? undefined}
              defaultStageId={stages[0]?.id}
              onCreated={() => window.location.reload()}
            />
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-md bg-muted p-1">
          <ViewButton icon={KanbanSquare} active={view === "kanban"} onClick={() => setView("kanban")}>
            Kanban
          </ViewButton>
          <ViewButton icon={List} active={view === "list"} onClick={() => setView("list")}>
            Lista
          </ViewButton>
          <ViewButton icon={TrendingUp} active={view === "forecast"} onClick={() => setView("forecast")}>
            Previsão
          </ViewButton>
        </div>
      </div>

      <PipelineFilters
        owners={owners}
        stages={stages}
        sources={sources}
        filters={filters}
        update={update}
      />

      <FilterChips chips={chips} onClearAll={() => clear(DEAL_FILTER_KEYS)} />

      {stages.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum pipeline padrão encontrado. Rode as migrations do Supabase
          (supabase/migrations) e marque um pipeline como is_default.
        </p>
      )}

      {view === "kanban" && (
        <DndContext
          id="pipeline-kanban"
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveDealId(null)}
        >
          <div className="relative">
            <div className="sticky top-24 z-10 flex h-0 items-center justify-between overflow-visible">
              <button
                type="button"
                aria-label="Rolar para a esquerda"
                onClick={() => scrollBoardBy(-320)}
                className="hidden -translate-y-1/2 rounded-full border border-border bg-card p-1.5 shadow-md hover:bg-muted md:flex"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Rolar para a direita"
                onClick={() => scrollBoardBy(320)}
                className="hidden -translate-y-1/2 rounded-full border border-border bg-card p-1.5 shadow-md hover:bg-muted md:flex"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
            <div
              ref={boardScrollRef}
              onKeyDown={handleBoardKeyDown}
              tabIndex={0}
              className="flex gap-3 overflow-x-auto pb-2 focus:outline-none"
            >
              {stages.map((stage) => (
                <PipelineColumn
                  key={stage.id}
                  stage={stage}
                  deals={kanbanDeals.filter((d) => d.stage_id === stage.id)}
                />
              ))}
            </div>
          </div>
          <DragOverlay>
            {activeDeal ? <DealCardOverlay deal={activeDeal} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {view === "list" && (
        <DealsTable
          deals={filteredDeals}
          stages={stages}
          filters={filters}
          page={page}
          pageSize={pageSize}
          selection={selection}
          update={update}
          emptyAction={
            chips.length > 0 && (
              <Button variant="secondary" size="sm" onClick={() => clear(DEAL_FILTER_KEYS)}>
                Limpar filtros
              </Button>
            )
          }
        />
      )}

      {view === "forecast" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(groupByExpectedMonth(filteredDeals)).map(
            ([month, group]) => (
              <div key={month} className="rounded-lg border border-border p-4">
                <h4 className="text-sm font-semibold capitalize">{month}</h4>
                <p className="mt-1 text-lg font-bold text-primary">
                  {formatCurrencyBRL(group.reduce((s, d) => s + d.value, 0))}
                </p>
                <p className="text-xs text-muted-foreground">
                  {group.length} negócio(s)
                </p>
              </div>
            ),
          )}
        </div>
      )}
      {view === "list" && (
        <BulkActionBar
          count={selection.selected.size}
          totalFiltered={filteredDeals.length}
          onSelectAllFiltered={() => selection.setMany(filteredIds, true)}
          onClear={selection.clear}
        >
          {canReassign && (
            <BulkOwnerButton
              table="deals"
              ids={[...selection.selected]}
              owners={owners}
              onDone={selection.clear}
            />
          )}
        </BulkActionBar>
      )}
    </div>
  );
}

function groupByExpectedMonth(deals: PipelineDeal[]) {
  const groups: Record<string, PipelineDeal[]> = {};
  for (const deal of deals) {
    const key = deal.expected_close_date
      ? new Date(deal.expected_close_date).toLocaleDateString("pt-BR", {
          month: "long",
          year: "numeric",
        })
      : "Sem previsão";
    groups[key] = groups[key] ? [...groups[key], deal] : [deal];
  }
  return groups;
}

function ViewButton({
  icon: Icon,
  active,
  onClick,
  children,
}: {
  icon: typeof KanbanSquare;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-medium text-muted-foreground",
        active && "bg-card text-foreground shadow-xs",
      )}
    >
      <Icon className="size-4" />
      {children}
    </button>
  );
}
