"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRightLeft,
  CalendarX,
  Check,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Snowflake,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import { Breadcrumbs } from "@/components/ui/page-header";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { friendlyError, toast } from "@/lib/toast";
import { cn, formatCurrencyBRL } from "@/lib/utils";
import type { DealAlerts } from "@/lib/deal-alerts";
import { DealReportButton } from "./deal-report-button";
import {
  MoveToPipelineDialog,
  type MoveDealsTarget,
} from "@/components/pipeline/move-to-pipeline-dialog";
import type { DealDetail, DealStatus, StageOption } from "./types";
import type { ComponentProps } from "react";

export function DealHeader({
  deal,
  pipelineName,
  stages,
  stageDays,
  daysInCurrent,
  daysSinceLastActivity,
  alerts,
  canManage,
  lostReasons,
  reportData,
  pipelines,
}: {
  deal: DealDetail;
  pipelineName: string;
  stages: StageOption[];
  stageDays: Record<string, number>;
  daysInCurrent: number;
  daysSinceLastActivity: number | null;
  alerts: DealAlerts;
  canManage: boolean;
  lostReasons: { id: string; name: string }[];
  reportData: ComponentProps<typeof DealReportButton>["data"];
  pipelines: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const [lostReasonId, setLostReasonId] = useState("");
  const [moveTarget, setMoveTarget] = useState<MoveDealsTarget | null>(null);
  const currentStage = stages.find((s) => s.id === deal.stage_id);
  const currentIndex = stages.findIndex((s) => s.id === deal.stage_id);
  const isOpen = deal.status === "open";

  async function moveToStage(stageId: string) {
    if (stageId === deal.stage_id || busy) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("deals").update({ stage_id: stageId }).eq("id", deal.id);
    if (error) {
      setBusy(false);
      toast.error("Não foi possível mudar a etapa", { description: friendlyError(error) });
      return;
    }
    // O histórico é gravado pelo gatilho deals_log_stage_change (migration 0024)
    setBusy(false);
    toast.success(`Movido para ${stages.find((s) => s.id === stageId)?.name}`);
    router.refresh();
  }

  async function changeStatus(toStatus: DealStatus, reason?: { id: string; name: string }) {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("deals")
      .update({ status: toStatus, lost_reason_id: toStatus === "lost" ? (reason?.id ?? null) : null })
      .eq("id", deal.id);
    if (error) {
      setBusy(false);
      toast.error("Não foi possível alterar o status", { description: friendlyError(error) });
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { error: historyError } = await supabase.from("deal_status_history").insert({
        deal_id: deal.id,
        from_status: deal.status,
        to_status: toStatus,
        reason_id: toStatus === "lost" ? (reason?.id ?? null) : null,
        reason_name: toStatus === "lost" ? (reason?.name ?? null) : null,
        changed_by: user.id,
      });
      if (historyError) toast.warning("Status alterado, mas o histórico não foi registrado");
    }
    setBusy(false);
    setLostOpen(false);
    setLostReasonId("");
    toast.success(
      toStatus === "won" ? "Negócio ganho! 🎉" : toStatus === "lost" ? "Negócio marcado como perdido" : "Negócio reaberto",
    );
    router.refresh();
  }

  async function toggleFrozen() {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("deals")
      .update({ frozen_at: deal.frozen_at ? null : new Date().toISOString() })
      .eq("id", deal.id);
    setBusy(false);
    if (error) {
      toast.error("Não foi possível atualizar o negócio", { description: friendlyError(error) });
      return;
    }
    toast.success(deal.frozen_at ? "Negócio reativado" : "Negócio congelado");
    router.refresh();
  }

  async function deleteDeal() {
    const ok = await confirmDialog({
      title: "Excluir este negócio?",
      description:
        "Atividades, anotações, propostas e histórico vinculados também serão excluídos. Essa ação não pode ser desfeita.",
      confirmLabel: "Excluir negócio",
      destructive: true,
    });
    if (!ok) return;
    const supabase = createClient();
    const { error } = await supabase.from("deals").delete().eq("id", deal.id);
    if (error) {
      toast.error("Não foi possível excluir o negócio", { description: friendlyError(error) });
      return;
    }
    toast.success("Negócio excluído");
    router.push(`/pipeline?pipeline=${deal.pipeline_id}`);
    router.refresh();
  }

  return (
    <header className="flex flex-col gap-4">
      <Breadcrumbs
        items={[
          { label: "Negócios", href: "/pipeline" },
          { label: pipelineName, href: `/pipeline?pipeline=${deal.pipeline_id}` },
          { label: currentStage?.name ?? "—" },
        ]}
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <DealTitle dealId={deal.id} title={deal.title} />
            {deal.status === "won" && <Badge variant="success">Ganho</Badge>}
            {deal.status === "lost" && (
              <Badge variant="destructive">
                Perdido{deal.lost_reasons ? ` · ${deal.lost_reasons.name}` : ""}
              </Badge>
            )}
            {deal.frozen_at && (
              <Badge variant="info">
                <Snowflake />
                Congelado
              </Badge>
            )}
            {isOpen && alerts.overdueDays && (
              <Badge variant="destructive">
                <CalendarX />
                Atividade atrasada há {alerts.overdueDays} {alerts.overdueDays === 1 ? "dia" : "dias"}
              </Badge>
            )}
            {isOpen && alerts.noUpcomingActivity && (
              <Badge variant="warning">
                <AlertTriangle />
                Sem próxima atividade
              </Badge>
            )}
            {isOpen && alerts.isStagnant && (
              <Badge variant="stagnant">
                <Snowflake />
                Estagnado
                {daysSinceLastActivity !== null &&
                  ` · sem atividade há ${daysSinceLastActivity} ${daysSinceLastActivity === 1 ? "dia" : "dias"}`}
              </Badge>
            )}
          </div>
          <p className="numeric text-subtitle text-primary">{formatCurrencyBRL(deal.value)}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-1 flex items-center gap-2">
            <UserAvatar name={deal.profiles?.full_name ?? "—"} showTooltip={false} />
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-medium text-foreground">{deal.profiles?.full_name ?? "—"}</span>
              <span className="text-caption text-muted-foreground">Responsável</span>
            </div>
          </div>
          {isOpen && (
            <>
              <Button variant="success" disabled={busy} onClick={() => changeStatus("won")}>
                <ThumbsUp />
                Ganho
              </Button>
              <Button variant="destructive" disabled={busy} onClick={() => setLostOpen(true)}>
                <ThumbsDown />
                Perdido
              </Button>
            </>
          )}
          {deal.status === "lost" && (
            <Button variant="secondary" disabled={busy} onClick={() => changeStatus("open")}>
              <RotateCcw />
              Reabrir
            </Button>
          )}
          <DealReportButton data={reportData} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" aria-label="Mais ações">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {pipelines.length > 1 && (
                <>
                  <DropdownMenuItem
                    // abre depois que o menu devolve o foco ao "⋯"
                    onSelect={() => setTimeout(() => setMoveTarget({ ids: [deal.id], title: deal.title }), 0)}
                  >
                    <ArrowRightLeft />
                    Mover para outro funil
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {isOpen && (
                <DropdownMenuItem onSelect={toggleFrozen} disabled={busy}>
                  <Snowflake />
                  {deal.frozen_at ? "Reativar negócio" : "Congelar negócio"}
                </DropdownMenuItem>
              )}
              {canManage && (
                <>
                  {isOpen && <DropdownMenuSeparator />}
                  <DropdownMenuItem variant="destructive" onSelect={deleteDeal}>
                    <Trash2 />
                    Excluir negócio
                  </DropdownMenuItem>
                </>
              )}
              {!isOpen && !canManage && pipelines.length <= 1 && (
                <DropdownMenuItem disabled>Nenhuma ação disponível</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Barra de etapas: clique para mover (só negócios em aberto) */}
      <nav aria-label="Etapas do funil" className="scrollbar-thin -mx-1 overflow-x-auto px-1 pb-1">
        <ol className="flex min-w-max gap-0.5 sm:min-w-0">
          {stages.map((stage, index) => {
            const passed = index < currentIndex;
            const current = index === currentIndex;
            const days = stageDays[stage.id];
            const label = days !== undefined && (passed || current) ? `${days}d · ${stage.name}` : stage.name;
            return (
              <li key={stage.id} className="min-w-28 flex-1">
                <SimpleTooltip
                  content={
                    days !== undefined
                      ? `${stage.name} — ${days} ${days === 1 ? "dia" : "dias"} nesta etapa`
                      : stage.name
                  }
                >
                  <button
                    type="button"
                    disabled={busy}
                    aria-current={current ? "step" : undefined}
                    onClick={() => moveToStage(stage.id)}
                    className={cn(
                      "flex h-8 w-full items-center justify-center truncate px-4 text-caption font-medium transition-colors disabled:cursor-default",
                      index === 0 ? "chevron-step-first rounded-l-md" : "chevron-step",
                      current && "bg-primary text-primary-foreground",
                      passed && "bg-primary-subtle text-primary enabled:hover:bg-primary enabled:hover:text-primary-foreground",
                      !passed && !current && "bg-muted text-muted-foreground enabled:hover:bg-border enabled:hover:text-foreground",
                      deal.status === "won" && "bg-success text-success-foreground",
                    )}
                  >
                    <span className="truncate">{label}</span>
                  </button>
                </SimpleTooltip>
              </li>
            );
          })}
        </ol>
      </nav>

      <MoveToPipelineDialog
        target={moveTarget}
        pipelines={pipelines}
        currentPipelineId={deal.pipeline_id}
        onClose={() => setMoveTarget(null)}
        onMoved={() => {
          setMoveTarget(null);
          router.refresh();
        }}
      />

      <Dialog open={lostOpen} onOpenChange={setLostOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Marcar como perdido</DialogTitle>
            <DialogDescription>O motivo ajuda a entender as perdas nos relatórios.</DialogDescription>
          </DialogHeader>
          <FormField label="Motivo da perda" htmlFor="lost-reason" required>
            <Select value={lostReasonId} onValueChange={setLostReasonId}>
              <SelectTrigger id="lost-reason">
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {lostReasons.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setLostOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={!lostReasonId}
              loading={busy}
              onClick={() => changeStatus("lost", lostReasons.find((r) => r.id === lostReasonId))}
            >
              Confirmar perda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}

// Nome do negócio com edição inline: lápis -> campo; Enter salva, Esc cancela.
function DealTitle({ dealId, title }: { dealId: string; title: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [saving, setSaving] = useState(false);
  const trimmed = value.trim();

  function startEditing() {
    setValue(title);
    setEditing(true);
  }

  async function save() {
    if (saving) return;
    if (!trimmed) return;
    if (trimmed === title) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const { error } = await createClient().from("deals").update({ title: trimmed }).eq("id", dealId);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível renomear o negócio", { description: friendlyError(error) });
      return;
    }
    toast.success("Nome do negócio atualizado");
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <div className="flex min-w-0 items-center gap-1">
        <h1 className="min-w-0 break-words text-title text-foreground">{title}</h1>
        <SimpleTooltip content="Editar nome do negócio">
          <Button variant="ghost" size="icon-xs" aria-label="Editar nome do negócio" onClick={startEditing}>
            <Pencil />
          </Button>
        </SimpleTooltip>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-1">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void save();
          }
          if (e.key === "Escape") setEditing(false);
        }}
        aria-label="Nome do negócio"
        aria-invalid={!trimmed}
        maxLength={200}
        autoFocus
        disabled={saving}
        className="h-9 w-72 max-w-full text-subtitle sm:w-96"
      />
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Salvar nome"
        disabled={!trimmed}
        loading={saving}
        onClick={() => void save()}
      >
        <Check />
      </Button>
      <Button variant="ghost" size="icon-xs" aria-label="Cancelar edição" disabled={saving} onClick={() => setEditing(false)}>
        <X />
      </Button>
    </div>
  );
}
