"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, CalendarRange, KanbanSquare, List, Plus, Rows2, Rows3, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { NewDealDialog } from "@/components/forms/new-deal-dialog";
import { ExportExcelButton } from "@/components/list/export-excel-button";
import { useListParams } from "@/components/list/use-list-params";
import { BulkActionBar, useRowSelection } from "@/components/list/bulk-action-bar";
import { BulkOwnerButton } from "@/components/list/bulk-owner-dialog";
import { applyDealFilters, parseDealFilters } from "@/lib/filters/deals";
import { getEnumParam, getPagination } from "@/lib/filters/params";
import { createClient } from "@/lib/supabase/client";
import { friendlyError, toast } from "@/lib/toast";
import { usePreferences } from "@/lib/use-preferences";
import type { KanbanDensity, UserPreferences } from "@/lib/preferences";
import { cn, formatCurrencyBRL } from "@/lib/utils";
import { KanbanBoard } from "./kanban-board";
import { PipelineSwitcher } from "./pipeline-switcher";
import { DEAL_FILTER_KEYS, FilterChips, PipelineFilters, dealFilterChips } from "./pipeline-filters";
import { DealsTable } from "./deals-table";
import { MoveToPipelineDialog, type MoveDealsTarget } from "./move-to-pipeline-dialog";
import type { OwnerOption, PipelineDeal, PipelineOption, PipelineStage } from "./types";

const VIEW_MODES = ["kanban", "list", "forecast"] as const;
type ViewMode = (typeof VIEW_MODES)[number];

export function PipelineBoard({
  pipelines,
  selectedPipelineId,
  stages,
  initialDeals,
  owners,
  canReassign = false,
  userId = null,
  initialPreferences = {},
}: {
  pipelines: PipelineOption[];
  selectedPipelineId: string | null;
  stages: PipelineStage[];
  initialDeals: PipelineDeal[];
  owners: OwnerOption[];
  canReassign?: boolean;
  userId?: string | null;
  initialPreferences?: UserPreferences;
}) {
  const router = useRouter();

  // Estado local (para movimentos otimistas) que acompanha os dados do
  // servidor a cada router.refresh(): quando a prop muda, o estado é
  // substituído durante a renderização (padrão recomendado pelo React).
  const [deals, setDeals] = useState(initialDeals);
  const [syncedFrom, setSyncedFrom] = useState(initialDeals);
  if (syncedFrom !== initialDeals) {
    setSyncedFrom(initialDeals);
    setDeals(initialDeals);
  }

  // Cópia sempre atual para ações assíncronas (ex.: "Desfazer" do toast)
  const dealsRef = useRef(deals);
  useEffect(() => {
    dealsRef.current = deals;
  }, [deals]);

  const { params, update, clear } = useListParams();
  const filters = useMemo(() => parseDealFilters(params), [params]);
  const { page, pageSize } = getPagination(params);
  const view: ViewMode = getEnumParam(params, "view", VIEW_MODES, "kanban");
  const setView = (next: ViewMode) => update({ view: next === "kanban" ? null : next, page: null });

  const { prefs, update: updatePrefs } = usePreferences(userId, initialPreferences);
  const density: KanbanDensity = prefs.kanbanDensity ?? "compact";
  const collapsedIds = useMemo(
    () => new Set(selectedPipelineId ? (prefs.collapsedStages?.[selectedPipelineId] ?? []) : []),
    [prefs.collapsedStages, selectedPipelineId],
  );

  const [createStageId, setCreateStageId] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<MoveDealsTarget | null>(null);

  // Negócios movidos para outro funil saem deste quadro na hora
  function handleMovedToPipeline(ids: string[]) {
    const moved = new Set(ids);
    setDeals((prev) => prev.filter((d) => !moved.has(d.id)));
    selection.clear();
    setMoveTarget(null);
    router.refresh();
  }

  // Tempo real: outro usuário moveu/alterou/excluiu um negócio
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`pipeline-deals-${selectedPipelineId ?? "none"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "deals" }, (payload) => {
        if (payload.eventType === "UPDATE") {
          const updated = payload.new as {
            id: string;
            pipeline_id: string;
            stage_id: string;
            value: number;
            status: PipelineDeal["status"];
            title: string;
          };
          setDeals((prev) =>
            updated.pipeline_id !== selectedPipelineId
              ? prev.filter((d) => d.id !== updated.id)
              : prev.map((d) =>
                  d.id === updated.id
                    ? {
                        ...d,
                        stage_id: updated.stage_id,
                        value: Number(updated.value),
                        status: updated.status,
                        title: updated.title,
                      }
                    : d,
                ),
          );
        } else if (payload.eventType === "DELETE") {
          const removed = payload.old as { id?: string };
          if (removed.id) setDeals((prev) => prev.filter((d) => d.id !== removed.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedPipelineId]);

  const sources = useMemo(
    () =>
      Array.from(new Set(deals.map((d) => d.source).filter(Boolean) as string[])).sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    [deals],
  );

  const stageOrder = useMemo(() => new Map(stages.map((s, i) => [s.id, i])), [stages]);
  const filteredDeals = useMemo(
    () => applyDealFilters(deals, filters, stageOrder),
    [deals, filters, stageOrder],
  );
  const filteredIds = useMemo(() => filteredDeals.map((d) => d.id), [filteredDeals]);
  const selection = useRowSelection(filteredIds);
  const chips = dealFilterChips(filters, update, { stages, owners });

  // O Kanban só faz sentido para negócios abertos — ganhos/perdidos não têm
  // "próxima coluna" (docx §3: fechados só aparecem na Lista).
  const kanbanDeals = useMemo(() => filteredDeals.filter((d) => d.status === "open"), [filteredDeals]);

  // Move um negócio de etapa (arrastar, menu do card ou teclado):
  // otimista, com rollback e aviso se o banco recusar.
  async function moveDeal(dealId: string, newStageId: string) {
    const deal = dealsRef.current.find((d) => d.id === dealId);
    if (!deal || deal.stage_id === newStageId) return;
    const previousStageId = deal.stage_id;
    const stageName = stages.find((s) => s.id === newStageId)?.name ?? "";

    setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage_id: newStageId } : d)));
    dealsRef.current = dealsRef.current.map((d) => (d.id === dealId ? { ...d, stage_id: newStageId } : d));

    const supabase = createClient();
    const { error } = await supabase.from("deals").update({ stage_id: newStageId }).eq("id", dealId);

    if (error) {
      setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage_id: previousStageId } : d)));
      dealsRef.current = dealsRef.current.map((d) => (d.id === dealId ? { ...d, stage_id: previousStageId } : d));
      toast.error("Não foi possível mover o negócio", { description: friendlyError(error) });
      return;
    }

    // O histórico é gravado pelo gatilho deals_log_stage_change (migration 0024)
    toast.success(`“${deal.title}” movido para ${stageName}`, {
      action: { label: "Desfazer", onClick: () => moveDeal(dealId, previousStageId) },
    });
  }

  function toggleCollapse(stageId: string) {
    if (!selectedPipelineId) return;
    updatePrefs((current) => {
      const list = current.collapsedStages?.[selectedPipelineId] ?? [];
      const next = list.includes(stageId) ? list.filter((id) => id !== stageId) : [...list, stageId];
      return { ...current, collapsedStages: { ...current.collapsedStages, [selectedPipelineId]: next } };
    });
  }

  const newDealButton = (
    <Button onClick={() => setCreateStageId(stages[0]?.id ?? "")} disabled={stages.length === 0}>
      <Plus />
      Novo negócio
    </Button>
  );

  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        // No desktop o Kanban ocupa a altura da janela e cada coluna rola sozinha
        view === "kanban" && "md:h-[calc(100dvh-6.5rem)]",
      )}
    >
      <PageHeader
        title="Negócios"
        actions={
          <>
            <PipelineSwitcher pipelines={pipelines} selectedPipelineId={selectedPipelineId} />
            <ExportExcelButton entity="negocios" />
            {newDealButton}
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Visualização" className="flex items-center gap-1 rounded-md bg-muted p-1">
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

        {view === "kanban" && (
          <div role="radiogroup" aria-label="Densidade dos cards" className="flex items-center gap-1 rounded-md bg-muted p-1">
            <DensityButton
              icon={Rows3}
              label="Compacto"
              active={density === "compact"}
              onClick={() => updatePrefs((p) => ({ ...p, kanbanDensity: "compact" }))}
            />
            <DensityButton
              icon={Rows2}
              label="Confortável"
              active={density === "comfortable"}
              onClick={() => updatePrefs((p) => ({ ...p, kanbanDensity: "comfortable" }))}
            />
          </div>
        )}
      </div>

      <PipelineFilters owners={owners} stages={stages} sources={sources} filters={filters} update={update} />

      <FilterChips chips={chips} onClearAll={() => clear(DEAL_FILTER_KEYS)} />

      {stages.length === 0 && (
        <Card>
          <EmptyState
            icon={KanbanSquare}
            title="Este funil ainda não tem etapas"
            description="Cadastre as etapas em Configurações > Pipelines e estágios."
          />
        </Card>
      )}

      {view === "kanban" && stages.length > 0 && (
        <KanbanBoard
          stages={stages}
          deals={kanbanDeals}
          density={density}
          collapsedIds={collapsedIds}
          onToggleCollapse={toggleCollapse}
          onMove={moveDeal}
          onMoveToPipeline={(deal) => setMoveTarget({ ids: [deal.id], title: deal.title })}
          onCreate={(stageId) => setCreateStageId(stageId)}
        />
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
            chips.length > 0 ? (
              <Button variant="secondary" size="sm" onClick={() => clear(DEAL_FILTER_KEYS)}>
                Limpar filtros
              </Button>
            ) : (
              newDealButton
            )
          }
        />
      )}

      {view === "forecast" && <ForecastView deals={filteredDeals} />}

      {view === "list" && (
        <BulkActionBar
          count={selection.selected.size}
          totalFiltered={filteredDeals.length}
          onSelectAllFiltered={() => selection.setMany(filteredIds, true)}
          onClear={selection.clear}
        >
          {pipelines.length > 1 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setMoveTarget({
                  ids: [...selection.selected],
                  totalValue: deals
                    .filter((d) => selection.selected.has(d.id))
                    .reduce((sum, d) => sum + d.value, 0),
                })
              }
            >
              <ArrowRightLeft />
              Mover para outro funil
            </Button>
          )}
          {canReassign && (
            <BulkOwnerButton table="deals" ids={[...selection.selected]} owners={owners} onDone={selection.clear} />
          )}
        </BulkActionBar>
      )}

      <MoveToPipelineDialog
        target={moveTarget}
        pipelines={pipelines}
        currentPipelineId={selectedPipelineId}
        onClose={() => setMoveTarget(null)}
        onMoved={() => moveTarget && handleMovedToPipeline(moveTarget.ids)}
      />

      <NewDealDialog
        open={createStageId !== null}
        onOpenChange={(open) => !open && setCreateStageId(null)}
        pipelineId={selectedPipelineId ?? undefined}
        defaultStageId={createStageId || stages[0]?.id}
        onCreated={() => router.refresh()}
      />
    </div>
  );
}

// Previsão: negócios agrupados pelo mês previsto de fechamento
function ForecastView({ deals }: { deals: PipelineDeal[] }) {
  const groups = new Map<string, PipelineDeal[]>();
  for (const deal of deals) {
    const key = deal.expected_close_date ? deal.expected_close_date.slice(0, 7) : "sem";
    groups.set(key, [...(groups.get(key) ?? []), deal]);
  }
  const keys = [...groups.keys()].sort((a, b) => (a === "sem" ? 1 : b === "sem" ? -1 : a.localeCompare(b)));

  if (keys.length === 0) {
    return (
      <Card>
        <EmptyState icon={CalendarRange} title="Nenhum negócio para prever com esses filtros" />
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {keys.map((key) => {
        const group = groups.get(key) ?? [];
        const label =
          key === "sem"
            ? "Sem previsão"
            : new Date(`${key}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
        return (
          <Card key={key} className="flex flex-col gap-1 p-4">
            <h3 className="text-sm font-semibold capitalize text-foreground">{label}</h3>
            <p className="numeric text-subtitle text-primary">
              {formatCurrencyBRL(group.reduce((s, d) => s + d.value, 0))}
            </p>
            <p className="numeric text-caption text-muted-foreground">
              {group.length} {group.length === 1 ? "negócio" : "negócios"}
            </p>
          </Card>
        );
      })}
    </div>
  );
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
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-sm px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
        active && "bg-card text-foreground shadow-xs",
      )}
    >
      <Icon className="size-4" />
      {children}
    </button>
  );
}

function DensityButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof KanbanSquare;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <SimpleTooltip content={`Cards: ${label.toLowerCase()}`}>
      <button
        type="button"
        role="radio"
        aria-checked={active}
        aria-label={`Cards ${label.toLowerCase()}`}
        onClick={onClick}
        className={cn(
          "flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-caption font-medium text-muted-foreground transition-colors hover:text-foreground",
          active && "bg-card text-foreground shadow-xs",
        )}
      >
        <Icon className="size-4" />
        <span className="hidden lg:inline">{label}</span>
      </button>
    </SimpleTooltip>
  );
}
