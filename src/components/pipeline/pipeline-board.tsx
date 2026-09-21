"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ChevronLeft, ChevronRight, KanbanSquare, List, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NewDealDialog } from "@/components/forms/new-deal-dialog";
import { createClient } from "@/lib/supabase/client";
import { formatCurrencyBRL, cn } from "@/lib/utils";
import { DealCardOverlay } from "./deal-card";
import { PipelineColumn } from "./pipeline-column";
import { PipelineSwitcher } from "./pipeline-switcher";
import {
  PipelineFilters,
  type PipelineFiltersState,
} from "./pipeline-filters";
import type {
  OwnerOption,
  PipelineDeal,
  PipelineOption,
  PipelineStage,
} from "./types";

type ViewMode = "kanban" | "list" | "forecast";

const STATUS_LABEL: Record<PipelineDeal["status"], string> = {
  open: "Aberto",
  won: "Ganho",
  lost: "Perdido",
};

const DEFAULT_FILTERS: PipelineFiltersState = {
  search: "",
  ownerId: "all",
  source: "all",
  status: "open",
  stageId: "all",
  minValue: "",
  maxValue: "",
  onlyOverdue: false,
  onlyNoUpcoming: false,
  onlyStagnant: false,
};

export function PipelineBoard({
  pipelines,
  selectedPipelineId,
  stages,
  initialDeals,
  owners,
}: {
  pipelines: PipelineOption[];
  selectedPipelineId: string | null;
  stages: PipelineStage[];
  initialDeals: PipelineDeal[];
  owners: OwnerOption[];
}) {
  const [deals, setDeals] = useState(initialDeals);
  const [filters, setFilters] = useState<PipelineFiltersState>(DEFAULT_FILTERS);
  const [view, setView] = useState<ViewMode>("kanban");
  const [activeDealId, setActiveDealId] = useState<string | null>(null);
  const supabase = createClient();
  const boardScrollRef = useRef<HTMLDivElement>(null);

  function scrollBoardBy(amount: number) {
    boardScrollRef.current?.scrollBy({ left: amount, behavior: "smooth" });
  }

  function handleBoardWheel(event: React.WheelEvent<HTMLDivElement>) {
    const el = boardScrollRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    // Converte a rolagem vertical do mouse em rolagem horizontal do board,
    // já que cada coluna já rola verticalmente por conta própria.
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      event.preventDefault();
      el.scrollLeft += event.deltaY;
    }
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
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
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

  const filteredDeals = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return deals.filter((d) => {
      if (search) {
        const haystack = `${d.title} ${d.organization_name ?? ""} ${d.contact_name ?? ""} ${d.owner_name}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      if (filters.status !== "all" && d.status !== filters.status) return false;
      if (filters.stageId !== "all" && d.stage_id !== filters.stageId) return false;
      if (filters.ownerId !== "all" && d.owner_id !== filters.ownerId) return false;
      if (filters.source !== "all" && d.source !== filters.source) return false;
      if (filters.minValue && d.value < Number(filters.minValue)) return false;
      if (filters.maxValue && d.value > Number(filters.maxValue)) return false;
      if (filters.onlyOverdue && !d.overdue_days) return false;
      if (filters.onlyNoUpcoming && !d.no_upcoming_activity) return false;
      if (filters.onlyStagnant && !d.is_stagnant) return false;
      return true;
    });
  }, [deals, filters]);

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
      <PipelineSwitcher pipelines={pipelines} selectedPipelineId={selectedPipelineId} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-md bg-muted p-1">
          <ViewButton icon={KanbanSquare} active={view === "kanban"} onClick={() => setView("kanban")}>
            Kanban
          </ViewButton>
          <ViewButton icon={List} active={view === "list"} onClick={() => setView("list")}>
            Lista
          </ViewButton>
          <ViewButton icon={TrendingUp} active={view === "forecast"} onClick={() => setView("forecast")}>
            Fluxo
          </ViewButton>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <NewDealDialog
            trigger={<Button>Novo negócio</Button>}
            pipelineId={selectedPipelineId ?? undefined}
            defaultStageId={stages[0]?.id}
            onCreated={() => window.location.reload()}
          />
        </div>
      </div>

      <PipelineFilters
        owners={owners}
        stages={stages}
        sources={sources}
        filters={filters}
        onChange={setFilters}
      />

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
          <div className="relative min-h-0 flex-1">
            <button
              type="button"
              aria-label="Rolar para a esquerda"
              onClick={() => scrollBoardBy(-320)}
              className="absolute top-1/2 -left-2 z-10 hidden -translate-y-1/2 rounded-full border border-border bg-card p-1.5 shadow-md hover:bg-muted md:flex"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Rolar para a direita"
              onClick={() => scrollBoardBy(320)}
              className="absolute top-1/2 -right-2 z-10 hidden -translate-y-1/2 rounded-full border border-border bg-card p-1.5 shadow-md hover:bg-muted md:flex"
            >
              <ChevronRight className="size-4" />
            </button>
            <div
              ref={boardScrollRef}
              onWheel={handleBoardWheel}
              onKeyDown={handleBoardKeyDown}
              tabIndex={0}
              className="flex max-h-[calc(100vh-320px)] min-h-[420px] gap-3 overflow-x-auto overflow-y-hidden pb-2 focus:outline-none"
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
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Negócio</th>
                <th className="p-3">Organização</th>
                <th className="p-3">Contato</th>
                <th className="p-3">Estágio</th>
                <th className="p-3">Status</th>
                <th className="p-3">Valor</th>
                <th className="p-3">Responsável</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeals.map((d) => (
                <tr key={d.id} className="border-t border-border">
                  <td className="p-3 font-medium">
                    <Link href={`/deals/${d.id}`} className="hover:underline">
                      {d.title}
                    </Link>
                  </td>
                  <td className="p-3 text-muted-foreground">{d.organization_name ?? "—"}</td>
                  <td className="p-3 text-muted-foreground">{d.contact_name ?? "—"}</td>
                  <td className="p-3 text-muted-foreground">
                    {stages.find((s) => s.id === d.stage_id)?.name}
                  </td>
                  <td className="p-3">
                    <Badge
                      variant={
                        d.status === "won"
                          ? "success"
                          : d.status === "lost"
                            ? "destructive"
                            : "outline"
                      }
                    >
                      {STATUS_LABEL[d.status]}
                    </Badge>
                  </td>
                  <td className="p-3">{formatCurrencyBRL(d.value)}</td>
                  <td className="p-3 text-muted-foreground">{d.owner_name}</td>
                </tr>
              ))}
              {filteredDeals.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    Nenhum negócio encontrado com esses filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
