"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, KanbanSquare, Plus, Star, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SimpleTooltip } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { createClient } from "@/lib/supabase/client";
import { friendlyError, toast } from "@/lib/toast";
import { cn, formatCurrencyBRL } from "@/lib/utils";

export interface SettingsPipeline {
  id: string;
  name: string;
  is_default: boolean;
}

export interface SettingsStage {
  id: string;
  name: string;
  order_index: number;
  pipeline_id: string;
  rotting_days: number | null;
}

export type StageStats = Record<string, { count: number; value: number }>;

type Columns = Record<string, string[]>;

function buildColumns(pipelines: SettingsPipeline[], stages: SettingsStage[]): Columns {
  const columns: Columns = {};
  for (const p of pipelines) columns[p.id] = [];
  for (const s of [...stages].sort((a, b) => a.order_index - b.order_index)) {
    columns[s.pipeline_id]?.push(s.id);
  }
  return columns;
}

// Exclui a etapa via função transacional; realoca os negócios para
// targetStageId (obrigatório quando há negócios). Retorna true se excluiu.
async function deleteStage(stage: SettingsStage, targetStageId: string | null) {
  const { data, error } = await createClient().rpc("delete_stage_with_reassign", {
    p_stage_id: stage.id,
    p_target_stage_id: targetStageId,
  });
  if (error) {
    toast.error("Não foi possível excluir a etapa", { description: friendlyError(error, error.message) });
    return false;
  }
  const result = data as { deals: number; automations_disabled: number } | null;
  toast.success(`Etapa “${stage.name}” excluída`, {
    description:
      [
        result?.deals ? `${result.deals} ${result.deals === 1 ? "negócio realocado" : "negócios realocados"}` : null,
        result?.automations_disabled
          ? `${result.automations_disabled} ${result.automations_disabled === 1 ? "automação desativada" : "automações desativadas"}`
          : null,
      ]
        .filter(Boolean)
        .join(" · ") || undefined,
  });
  return true;
}

interface PendingMove {
  stageId: string;
  fromPipelineId: string;
  toPipelineId: string;
  toIndex: number;
}

export function PipelinesSettings({
  pipelines,
  stages,
  stats,
  isAdmin,
}: {
  pipelines: SettingsPipeline[];
  stages: SettingsStage[];
  stats: StageStats;
  isAdmin: boolean;
}) {
  const router = useRouter();

  // Ordem local (otimista) sincronizada com o servidor a cada refresh
  const [columns, setColumns] = useState<Columns>(() => buildColumns(pipelines, stages));
  const [syncedFrom, setSyncedFrom] = useState({ pipelines, stages });
  if (syncedFrom.pipelines !== pipelines || syncedFrom.stages !== stages) {
    setSyncedFrom({ pipelines, stages });
    setColumns(buildColumns(pipelines, stages));
  }

  const snapshot = useRef<Columns | null>(null);
  const dragOrigin = useRef<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [deleting, setDeleting] = useState<SettingsStage | null>(null);
  const deleteTrigger = useRef<HTMLElement | null>(null);
  const [newPipelineName, setNewPipelineName] = useState("");
  const [creatingPipeline, setCreatingPipeline] = useState(false);

  const stageById = new Map(stages.map((s) => [s.id, s]));
  const pipelineById = new Map(pipelines.map((p) => [p.id, p]));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function findContainer(id: string): string | null {
    if (id in columns) return id;
    return Object.keys(columns).find((key) => columns[key].includes(id)) ?? null;
  }

  function restore() {
    if (snapshot.current) setColumns(snapshot.current);
    snapshot.current = null;
  }

  function onDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    snapshot.current = structuredClone(columns);
    dragOrigin.current = findContainer(id);
    setActiveId(id);
  }

  // Ao passar sobre outro funil, a etapa aparece lá (pré-visualização)
  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const activeKey = String(active.id);
    const overKey = String(over.id);
    const from = findContainer(activeKey);
    const to = findContainer(overKey);
    if (!from || !to || from === to) return;
    setColumns((prev) => {
      const fromItems = prev[from].filter((id) => id !== activeKey);
      const toItems = [...prev[to]];
      const overIndex = toItems.indexOf(overKey);
      toItems.splice(overIndex >= 0 ? overIndex : toItems.length, 0, activeKey);
      return { ...prev, [from]: fromItems, [to]: toItems };
    });
  }

  async function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    const stageId = String(active.id);
    const origin = dragOrigin.current;
    dragOrigin.current = null;
    if (!over || !origin) {
      restore();
      return;
    }
    const container = findContainer(stageId);
    if (!container) {
      restore();
      return;
    }

    if (container === origin) {
      const items = columns[container];
      const oldIndex = items.indexOf(stageId);
      const overIndex = items.indexOf(String(over.id));
      const newIndex = overIndex >= 0 ? overIndex : items.length - 1;
      if (oldIndex === newIndex) {
        snapshot.current = null;
        return;
      }
      const reordered = arrayMove(items, oldIndex, newIndex);
      setColumns((prev) => ({ ...prev, [container]: reordered }));
      await persistReorder(container, reordered);
      return;
    }

    // Mudou de funil
    const toIndex = columns[container].indexOf(stageId);
    const move = { stageId, fromPipelineId: origin, toPipelineId: container, toIndex };
    if ((stats[stageId]?.count ?? 0) > 0) {
      setPendingMove(move);
    } else {
      await persistMove(move, "with_deals");
    }
  }

  async function persistReorder(pipelineId: string, stageIds: string[]) {
    const supabase = createClient();
    const { error } = await supabase.rpc("reorder_pipeline_stages", {
      p_pipeline_id: pipelineId,
      p_stage_ids: stageIds,
    });
    if (error) {
      restore();
      toast.error("Não foi possível reordenar as etapas", { description: friendlyError(error, error.message) });
      return;
    }
    snapshot.current = null;
    toast.success("Ordem das etapas atualizada", { description: "O Kanban já reflete a nova ordem." });
    router.refresh();
  }

  async function persistMove(move: PendingMove, mode: "with_deals" | "reassign", reassignStageId?: string) {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("move_stage_to_pipeline", {
      p_stage_id: move.stageId,
      p_target_pipeline_id: move.toPipelineId,
      p_target_index: move.toIndex,
      p_mode: mode,
      p_reassign_stage_id: reassignStageId ?? null,
    });
    setPendingMove(null);
    if (error) {
      restore();
      toast.error("Não foi possível mover a etapa", { description: friendlyError(error, error.message) });
      return;
    }
    snapshot.current = null;
    const stageName = stageById.get(move.stageId)?.name ?? "Etapa";
    const target = pipelineById.get(move.toPipelineId)?.name ?? "outro funil";
    const deals = (data as { deals: number } | null)?.deals ?? 0;
    toast.success(`“${stageName}” movida para ${target}`, {
      description:
        deals === 0
          ? undefined
          : mode === "with_deals"
            ? `${deals} ${deals === 1 ? "negócio foi junto" : "negócios foram junto"}.`
            : `${deals} ${deals === 1 ? "negócio realocado" : "negócios realocados"} no funil de origem.`,
    });
    router.refresh();
  }

  async function createPipeline() {
    const name = newPipelineName.trim();
    if (!name) return;
    setCreatingPipeline(true);
    const supabase = createClient();
    const { error } = await supabase.from("pipelines").insert({ name, is_default: pipelines.length === 0 });
    setCreatingPipeline(false);
    if (error) {
      toast.error("Não foi possível criar o funil", { description: friendlyError(error) });
      return;
    }
    toast.success("Funil criado", { description: name });
    setNewPipelineName("");
    router.refresh();
  }

  async function requestDelete(stage: SettingsStage) {
    deleteTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if ((stats[stage.id]?.count ?? 0) > 0) {
      setDeleting(stage);
      return;
    }
    const ok = await confirmDialog({
      title: `Excluir a etapa “${stage.name}”?`,
      description: "Ela não tem negócios. O histórico de negócios que passaram por ela é mantido.",
      confirmLabel: "Excluir etapa",
      destructive: true,
    });
    if (ok && (await deleteStage(stage, null))) router.refresh();
  }

  const activeStage = activeId ? stageById.get(activeId) : undefined;

  return (
    <div className="flex flex-col gap-4">
      {!isAdmin && (
        <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Somente administradores podem alterar funis e etapas.
        </p>
      )}

      {isAdmin && (
        <Card>
          <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-end">
            <FormField label="Novo funil" htmlFor="new-pipeline" className="flex-1">
              <Input
                id="new-pipeline"
                placeholder="Ex.: Funil Segurança, Funil Serviços..."
                value={newPipelineName}
                onChange={(e) => setNewPipelineName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createPipeline()}
              />
            </FormField>
            <Button onClick={createPipeline} loading={creatingPipeline} disabled={!newPipelineName.trim()}>
              <Plus />
              Criar funil
            </Button>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <p className="text-caption text-muted-foreground">
          Arraste as etapas pela alça <GripVertical className="inline size-3.5 align-text-bottom" /> para
          reordenar ou para levá-las a outro funil. Os negócios acompanham a etapa.
        </p>
      )}

      <DndContext
        id="settings-stages"
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveId(null);
          dragOrigin.current = null;
          restore();
        }}
      >
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
          {pipelines.map((pipeline) => (
            <PipelineCard
              key={pipeline.id}
              pipeline={pipeline}
              stageIds={columns[pipeline.id] ?? []}
              stageById={stageById}
              stats={stats}
              isAdmin={isAdmin}
              onDelete={requestDelete}
            />
          ))}
        </div>
        <DragOverlay>
          {activeStage ? (
            <StageRowContent stage={activeStage} stats={stats[activeStage.id]} index={null} overlay />
          ) : null}
        </DragOverlay>
      </DndContext>

      {pipelines.length === 0 && (
        <Card>
          <EmptyState icon={KanbanSquare} title="Nenhum funil cadastrado" description="Crie o primeiro funil acima." />
        </Card>
      )}

      <MoveStageDialog
        move={pendingMove}
        stageById={stageById}
        pipelineById={pipelineById}
        columns={columns}
        stats={stats}
        onCancel={() => {
          setPendingMove(null);
          restore();
        }}
        onConfirm={(mode, reassignStageId) => pendingMove && persistMove(pendingMove, mode, reassignStageId)}
      />

      <DeleteStageDialog
        stage={deleting}
        pipelines={pipelines}
        columns={columns}
        stageById={stageById}
        stats={stats}
        returnFocusRef={deleteTrigger}
        onClose={() => setDeleting(null)}
        onDeleted={() => {
          setDeleting(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function PipelineCard({
  pipeline,
  stageIds,
  stageById,
  stats,
  isAdmin,
  onDelete,
}: {
  pipeline: SettingsPipeline;
  stageIds: string[];
  stageById: Map<string, SettingsStage>;
  stats: StageStats;
  isAdmin: boolean;
  onDelete: (stage: SettingsStage) => void;
}) {
  const router = useRouter();
  const { setNodeRef, isOver } = useDroppable({ id: pipeline.id, disabled: !isAdmin });
  const [editingName, setEditingName] = useState<string | null>(null);
  const [newStage, setNewStage] = useState("");
  const [adding, setAdding] = useState(false);

  const totals = stageIds.reduce(
    (acc, id) => ({ count: acc.count + (stats[id]?.count ?? 0), value: acc.value + (stats[id]?.value ?? 0) }),
    { count: 0, value: 0 },
  );

  async function rename() {
    const name = editingName?.trim();
    setEditingName(null);
    if (!name || name === pipeline.name) return;
    const { error } = await createClient().from("pipelines").update({ name }).eq("id", pipeline.id);
    if (error) toast.error("Não foi possível renomear o funil", { description: friendlyError(error) });
    else router.refresh();
  }

  async function makeDefault() {
    const supabase = createClient();
    const { error: clearError } = await supabase.from("pipelines").update({ is_default: false }).neq("id", pipeline.id);
    const { error } = clearError
      ? { error: clearError }
      : await supabase.from("pipelines").update({ is_default: true }).eq("id", pipeline.id);
    if (error) {
      toast.error("Não foi possível definir o funil padrão", { description: friendlyError(error) });
      return;
    }
    toast.success(`“${pipeline.name}” é o funil padrão`);
    router.refresh();
  }

  async function addStage() {
    const name = newStage.trim();
    if (!name) return;
    setAdding(true);
    const { error } = await createClient()
      .from("pipeline_stages")
      .insert({ pipeline_id: pipeline.id, name, order_index: stageIds.length });
    setAdding(false);
    if (error) {
      toast.error("Não foi possível adicionar a etapa", { description: friendlyError(error) });
      return;
    }
    setNewStage("");
    toast.success("Etapa adicionada", { description: name });
    router.refresh();
  }

  return (
    <Card
      ref={setNodeRef}
      className={cn("transition-[box-shadow,border-color]", isOver && "border-primary ring-2 ring-primary/25")}
    >
      <CardHeader className="flex-row flex-wrap items-center gap-2 pb-3">
        {editingName !== null ? (
          <Input
            autoFocus
            aria-label="Nome do funil"
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") rename();
              if (e.key === "Escape") setEditingName(null);
            }}
            onBlur={rename}
            className="h-8 max-w-64"
          />
        ) : (
          <button
            type="button"
            disabled={!isAdmin}
            className="rounded-sm text-subtitle text-foreground enabled:hover:underline"
            onClick={() => setEditingName(pipeline.name)}
            title={isAdmin ? "Clique para renomear" : undefined}
          >
            {pipeline.name}
          </button>
        )}
        {pipeline.is_default ? (
          <Badge>
            <Star />
            Padrão
          </Badge>
        ) : (
          isAdmin && (
            <Button variant="ghost" size="xs" onClick={makeDefault}>
              Tornar padrão
            </Button>
          )
        )}
        <span className="numeric ml-auto text-caption text-muted-foreground">
          {totals.count} {totals.count === 1 ? "negócio" : "negócios"} · {formatCurrencyBRL(totals.value)}
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <SortableContext items={stageIds} strategy={verticalListSortingStrategy}>
          <ol className="flex min-h-12 flex-col gap-1.5">
            {stageIds.map((id, index) => {
              const stage = stageById.get(id);
              if (!stage) return null;
              return (
                <SortableStageRow
                  key={id}
                  stage={stage}
                  index={index}
                  stats={stats[id]}
                  isAdmin={isAdmin}
                  onDelete={() => onDelete(stage)}
                />
              );
            })}
            {stageIds.length === 0 && (
              <li className="rounded-md border border-dashed border-border px-3 py-4 text-center text-caption text-muted-foreground">
                Nenhuma etapa. {isAdmin && "Arraste uma etapa para cá ou adicione abaixo."}
              </li>
            )}
          </ol>
        </SortableContext>

        {isAdmin && (
          <div className="flex gap-2">
            <Input
              aria-label={`Nova etapa em ${pipeline.name}`}
              placeholder="Nome da nova etapa"
              value={newStage}
              onChange={(e) => setNewStage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addStage()}
            />
            <Button variant="secondary" onClick={addStage} loading={adding} disabled={!newStage.trim()}>
              <Plus />
              Adicionar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SortableStageRow({
  stage,
  index,
  stats,
  isAdmin,
  onDelete,
}: {
  stage: SettingsStage;
  index: number;
  stats?: { count: number; value: number };
  isAdmin: boolean;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.id,
    disabled: !isAdmin,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "opacity-40")}
    >
      <StageRowContent
        stage={stage}
        stats={stats}
        index={index}
        isAdmin={isAdmin}
        onDelete={onDelete}
        handle={
          isAdmin ? (
            <button
              ref={setActivatorNodeRef}
              type="button"
              {...listeners}
              {...attributes}
              aria-label={`Mover etapa ${stage.name}`}
              aria-roledescription="etapa arrastável"
              className="flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
            >
              <GripVertical className="size-4" />
            </button>
          ) : null
        }
      />
    </li>
  );
}

function StageRowContent({
  stage,
  stats,
  index,
  isAdmin = false,
  onDelete,
  handle,
  overlay = false,
}: {
  stage: SettingsStage;
  stats?: { count: number; value: number };
  index: number | null;
  isAdmin?: boolean;
  onDelete?: () => void;
  handle?: React.ReactNode;
  overlay?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);

  async function rename() {
    const name = editing?.trim();
    setEditing(null);
    if (!name || name === stage.name) return;
    const { error } = await createClient().from("pipeline_stages").update({ name }).eq("id", stage.id);
    if (error) toast.error("Não foi possível renomear a etapa", { description: friendlyError(error) });
    else router.refresh();
  }

  async function updateRottingDays(raw: string) {
    const trimmed = raw.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (parsed !== null && (!Number.isInteger(parsed) || parsed < 0)) {
      toast.error("Informe um número inteiro de dias (ou deixe vazio)");
      return;
    }
    if (parsed === stage.rotting_days) return;
    const { error } = await createClient().from("pipeline_stages").update({ rotting_days: parsed }).eq("id", stage.id);
    if (error) toast.error("Não foi possível salvar o prazo", { description: friendlyError(error) });
    else router.refresh();
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5",
        overlay && "cursor-grabbing shadow-lg ring-1 ring-primary/30",
      )}
    >
      {handle ?? (overlay ? <GripVertical className="size-4 text-muted-foreground" /> : null)}
      {index !== null && <span className="numeric w-5 text-right text-caption text-muted-foreground">{index + 1}.</span>}
      <div className="min-w-0 flex-1">
        {editing !== null ? (
          <Input
            autoFocus
            aria-label="Nome da etapa"
            value={editing}
            onChange={(e) => setEditing(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") rename();
              if (e.key === "Escape") setEditing(null);
            }}
            onBlur={rename}
            className="h-7"
          />
        ) : (
          <button
            type="button"
            disabled={!isAdmin}
            className="max-w-full truncate rounded-sm text-left text-sm font-medium text-foreground enabled:hover:text-primary"
            onClick={() => setEditing(stage.name)}
            title={isAdmin ? "Clique para renomear" : stage.name}
          >
            {stage.name}
          </button>
        )}
      </div>
      <SimpleTooltip content={stats?.count ? formatCurrencyBRL(stats.value) : "Nenhum negócio nesta etapa"}>
        <span className="numeric shrink-0 rounded-sm bg-muted px-1.5 text-micro font-medium text-muted-foreground">
          {stats?.count ?? 0}
        </span>
      </SimpleTooltip>
      {!overlay && (
        <label className="flex shrink-0 items-center gap-1 text-micro text-muted-foreground">
          <span className="hidden sm:inline">Estagna em</span>
          <Input
            type="number"
            min={0}
            disabled={!isAdmin}
            defaultValue={stage.rotting_days ?? ""}
            placeholder="—"
            aria-label={`Dias sem atividade até ${stage.name} ficar estagnado`}
            className="h-7 w-14 px-1.5 text-caption"
            onBlur={(e) => updateRottingDays(e.target.value)}
          />
          dias
        </label>
      )}
      {isAdmin && onDelete && (
        <Button variant="ghost" size="icon-xs" onClick={onDelete} aria-label={`Excluir etapa ${stage.name}`}>
          <Trash2 />
        </Button>
      )}
    </div>
  );
}

function MoveStageDialog({
  move,
  stageById,
  pipelineById,
  columns,
  stats,
  onCancel,
  onConfirm,
}: {
  move: PendingMove | null;
  stageById: Map<string, SettingsStage>;
  pipelineById: Map<string, SettingsPipeline>;
  columns: Columns;
  stats: StageStats;
  onCancel: () => void;
  onConfirm: (mode: "with_deals" | "reassign", reassignStageId?: string) => void;
}) {
  const [mode, setMode] = useState<"with_deals" | "reassign">("with_deals");
  const [reassignTo, setReassignTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [openFor, setOpenFor] = useState<string | null>(null);

  // Reinicia as escolhas a cada novo movimento
  const moveKey = move ? `${move.stageId}-${move.toPipelineId}` : null;
  if (moveKey !== openFor) {
    setOpenFor(moveKey);
    setMode("with_deals");
    setReassignTo("");
    setBusy(false);
  }

  if (!move) return null;
  const stage = stageById.get(move.stageId);
  const from = pipelineById.get(move.fromPipelineId);
  const to = pipelineById.get(move.toPipelineId);
  const s = stats[move.stageId] ?? { count: 0, value: 0 };
  const sourceStages = (columns[move.fromPipelineId] ?? [])
    .filter((id) => id !== move.stageId)
    .map((id) => stageById.get(id))
    .filter((x): x is SettingsStage => Boolean(x));

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mover “{stage?.name}” para {to?.name}?</DialogTitle>
          <DialogDescription>
            Esta etapa tem <strong className="numeric text-foreground">{s.count}</strong>{" "}
            {s.count === 1 ? "negócio" : "negócios"}, somando{" "}
            <strong className="numeric text-foreground">{formatCurrencyBRL(s.value)}</strong>. O que fazer com eles?
          </DialogDescription>
        </DialogHeader>

        <div role="radiogroup" aria-label="Destino dos negócios" className="flex flex-col gap-2">
          <OptionCard
            checked={mode === "with_deals"}
            onSelect={() => setMode("with_deals")}
            title={`Levar a etapa com os negócios para ${to?.name}`}
            description="Os negócios passam a pertencer ao novo funil, na mesma etapa."
          />
          <OptionCard
            checked={mode === "reassign"}
            onSelect={() => setMode("reassign")}
            title="Mover só a etapa"
            description={`Os negócios continuam em ${from?.name}, em outra etapa escolhida abaixo.`}
          />
          {mode === "reassign" && (
            <FormField label={`Etapa de destino em ${from?.name}`} htmlFor="reassign-stage" required className="pl-7">
              <Select value={reassignTo} onValueChange={setReassignTo}>
                <SelectTrigger id="reassign-stage">
                  <SelectValue placeholder="Escolha a etapa" />
                </SelectTrigger>
                <SelectContent>
                  {sourceStages.map((st) => (
                    <SelectItem key={st.id} value={st.id}>
                      {st.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}
          {mode === "reassign" && sourceStages.length === 0 && (
            <p className="pl-7 text-caption text-destructive">
              O funil de origem não tem outra etapa para receber os negócios.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          <Button
            loading={busy}
            disabled={mode === "reassign" && !reassignTo}
            onClick={() => {
              setBusy(true);
              onConfirm(mode, mode === "reassign" ? reassignTo : undefined);
            }}
          >
            Mover etapa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OptionCard({
  checked,
  onSelect,
  title,
  description,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={cn(
        "flex items-start gap-3 rounded-md border p-3 text-left transition-colors",
        checked ? "border-primary bg-primary-subtle/60" : "border-border hover:border-border-strong",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
          checked ? "border-primary" : "border-border-strong",
        )}
      >
        {checked && <span className="size-2 rounded-full bg-primary" />}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{title}</span>
        <span className="text-caption text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}

function DeleteStageDialog({
  stage,
  pipelines,
  columns,
  stageById,
  stats,
  returnFocusRef,
  onClose,
  onDeleted,
}: {
  returnFocusRef: React.RefObject<HTMLElement | null>;
  stage: SettingsStage | null;
  pipelines: SettingsPipeline[];
  columns: Columns;
  stageById: Map<string, SettingsStage>;
  stats: StageStats;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [openFor, setOpenFor] = useState<string | null>(null);
  if ((stage?.id ?? null) !== openFor) {
    setOpenFor(stage?.id ?? null);
    setTarget("");
    setBusy(false);
  }

  if (!stage) return null;
  const s = stats[stage.id] ?? { count: 0, value: 0 };

  async function remove() {
    if (!stage || !target) return;
    setBusy(true);
    const ok = await deleteStage(stage, target);
    setBusy(false);
    if (ok) onDeleted();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent
        onCloseAutoFocus={(e) => {
          const trigger = returnFocusRef.current;
          if (trigger?.isConnected) {
            e.preventDefault();
            trigger.focus();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Excluir a etapa “{stage.name}”</DialogTitle>
          <DialogDescription>
            Ela tem <strong className="numeric text-foreground">{s.count}</strong>{" "}
            {s.count === 1 ? "negócio" : "negócios"} ({formatCurrencyBRL(s.value)}). Escolha para onde eles vão — nenhum
            negócio fica sem etapa.
          </DialogDescription>
        </DialogHeader>
        <FormField label="Mover os negócios para" htmlFor="delete-target" required>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger id="delete-target">
              <SelectValue placeholder="Escolha funil e etapa" />
            </SelectTrigger>
            <SelectContent>
              {pipelines.map((p) => {
                const options = (columns[p.id] ?? []).filter((id) => id !== stage.id);
                if (options.length === 0) return null;
                return (
                  <SelectGroup key={p.id}>
                    <SelectLabel>{p.name}</SelectLabel>
                    {options.map((id) => (
                      <SelectItem key={id} value={id}>
                        {stageById.get(id)?.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                );
              })}
            </SelectContent>
          </Select>
        </FormField>
        <p className="text-caption text-muted-foreground">
          Automações configuradas para esta etapa serão desativadas.
        </p>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="destructive" loading={busy} disabled={!target} onClick={remove}>
            Mover negócios e excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
