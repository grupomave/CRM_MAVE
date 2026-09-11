"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { KanbanSquare, List, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewDealDialog } from "@/components/forms/new-deal-dialog";
import { createClient } from "@/lib/supabase/client";
import { formatCurrencyBRL, cn } from "@/lib/utils";
import { PipelineColumn } from "./pipeline-column";
import {
  PipelineFilters,
  type PipelineFiltersState,
} from "./pipeline-filters";
import type { OwnerOption, PipelineDeal, PipelineStage } from "./types";

type ViewMode = "kanban" | "list" | "forecast";

const DEFAULT_FILTERS: PipelineFiltersState = {
  ownerId: "all",
  source: "all",
  minValue: "",
  maxValue: "",
};

export function PipelineBoard({
  stages,
  initialDeals,
  owners,
}: {
  stages: PipelineStage[];
  initialDeals: PipelineDeal[];
  owners: OwnerOption[];
}) {
  const [deals, setDeals] = useState(initialDeals);
  const [filters, setFilters] = useState<PipelineFiltersState>(DEFAULT_FILTERS);
  const [view, setView] = useState<ViewMode>("kanban");
  const supabase = createClient();

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
            const updated = payload.new as { id: string; stage_id: string; value: number; status: string };
            setDeals((prev) =>
              updated.status !== "open"
                ? prev.filter((d) => d.id !== updated.id)
                : prev.map((d) =>
                    d.id === updated.id
                      ? { ...d, stage_id: updated.stage_id, value: updated.value }
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
    return deals.filter((d) => {
      if (filters.ownerId !== "all" && d.owner_id !== filters.ownerId) return false;
      if (filters.source !== "all" && d.source !== filters.source) return false;
      if (filters.minValue && d.value < Number(filters.minValue)) return false;
      if (filters.maxValue && d.value > Number(filters.maxValue)) return false;
      return true;
    });
  }, [deals, filters]);

  async function handleDragEnd(event: DragEndEvent) {
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
          <PipelineFilters
            owners={owners}
            sources={sources}
            filters={filters}
            onChange={setFilters}
          />
          <NewDealDialog
            trigger={<Button>Novo negócio</Button>}
            defaultStageId={stages[0]?.id}
            onCreated={() => window.location.reload()}
          />
        </div>
      </div>

      {stages.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum pipeline padrão encontrado. Rode as migrations do Supabase
          (supabase/migrations) e marque um pipeline como is_default.
        </p>
      )}

      {view === "kanban" && (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex flex-1 gap-3 overflow-x-auto pb-2">
            {stages.map((stage) => (
              <PipelineColumn
                key={stage.id}
                stage={stage}
                deals={filteredDeals.filter((d) => d.stage_id === stage.id)}
              />
            ))}
          </div>
        </DndContext>
      )}

      {view === "list" && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Negócio</th>
                <th className="p-3">Estágio</th>
                <th className="p-3">Valor</th>
                <th className="p-3">Responsável</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeals.map((d) => (
                <tr key={d.id} className="border-t border-border">
                  <td className="p-3 font-medium">{d.title}</td>
                  <td className="p-3 text-muted-foreground">
                    {stages.find((s) => s.id === d.stage_id)?.name}
                  </td>
                  <td className="p-3">{formatCurrencyBRL(d.value)}</td>
                  <td className="p-3 text-muted-foreground">{d.owner_name}</td>
                </tr>
              ))}
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
