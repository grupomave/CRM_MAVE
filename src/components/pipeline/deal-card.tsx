"use client";

import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import {
  AlertTriangle,
  ArrowRightLeft,
  Building2,
  CalendarX,
  Clock,
  ExternalLink,
  MoreHorizontal,
  Snowflake,
  UserRound,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger, SimpleTooltip } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, formatCurrencyBRL, formatDate } from "@/lib/utils";
import type { KanbanDensity } from "@/lib/preferences";
import type { PipelineDeal, PipelineStage } from "./types";

const shortBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

function alertBorder(deal: PipelineDeal) {
  if (deal.overdue_days) return "border-l-destructive";
  if (deal.is_stagnant) return "border-l-stagnant";
  if (deal.no_upcoming_activity) return "border-l-warning";
  return "border-l-transparent";
}

// Indicador de próxima atividade: atrasada, sem atividade ou data agendada
function ActivityIndicator({ deal }: { deal: PipelineDeal }) {
  if (deal.overdue_days) {
    return (
      <SimpleTooltip content={`Atividade atrasada há ${deal.overdue_days} ${deal.overdue_days === 1 ? "dia" : "dias"}`}>
        <span className="numeric inline-flex items-center gap-0.5 text-micro font-medium text-destructive">
          <CalendarX className="size-3.5" aria-hidden />
          {deal.overdue_days}d
          <span className="sr-only">de atraso</span>
        </span>
      </SimpleTooltip>
    );
  }
  if (deal.no_upcoming_activity) {
    return (
      <SimpleTooltip content="Sem próxima atividade agendada">
        <span className="inline-flex text-warning">
          <AlertTriangle className="size-3.5" aria-label="Sem próxima atividade" />
        </span>
      </SimpleTooltip>
    );
  }
  if (deal.next_activity_due) {
    return (
      <SimpleTooltip content={`Próxima atividade: ${deal.next_activity_subject ?? ""}`}>
        <span className="numeric inline-flex items-center gap-0.5 text-micro text-muted-foreground">
          <Clock className="size-3.5" aria-hidden />
          {shortDate.format(new Date(deal.next_activity_due))}
        </span>
      </SimpleTooltip>
    );
  }
  return null;
}

function DealDetails({ deal, stageName }: { deal: PipelineDeal; stageName?: string }) {
  const rows: [string, string | null][] = [
    ["Organização", deal.organization_name],
    ["Contato", deal.contact_name],
    ["Responsável", deal.owner_name],
    ["Etapa", stageName ?? null],
    ["Valor", formatCurrencyBRL(deal.value)],
    ["Previsão", deal.expected_close_date ? formatDate(`${deal.expected_close_date}T12:00:00`) : null],
    [
      "Próxima atividade",
      deal.next_activity_subject
        ? `${deal.next_activity_subject}${deal.next_activity_due ? ` · ${formatDate(deal.next_activity_due)}` : ""}`
        : null,
    ],
  ];
  return (
    <div className="flex max-w-64 flex-col gap-1">
      <p className="font-semibold">{deal.title}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="opacity-70">{k}</dt>
              <dd className="numeric">{v}</dd>
            </div>
          ))}
      </dl>
    </div>
  );
}

function DealCardMenu({
  deal,
  stages,
  onMove,
}: {
  deal: PipelineDeal;
  stages: PipelineStage[];
  onMove: (dealId: string, stageId: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Ações de ${deal.title}`}
          // Não inicia arraste ao abrir o menu
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className="-mr-1 -mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 data-[state=open]:opacity-100 md:opacity-0 md:group-hover/card:opacity-100"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onPointerDown={(e) => e.stopPropagation()}>
        <DropdownMenuItem asChild>
          <Link href={`/deals/${deal.id}`}>
            <ExternalLink />
            Abrir negócio
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <ArrowRightLeft />
            Mover para etapa
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {stages.map((s) => (
              <DropdownMenuItem
                key={s.id}
                disabled={s.id === deal.stage_id}
                onSelect={() => onMove(deal.id, s.id)}
              >
                {s.name}
                {s.id === deal.stage_id && <span className="ml-auto text-caption text-muted-foreground">atual</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DealCardBody({
  deal,
  density,
  stages,
  onMove,
  interactive = true,
}: {
  deal: PipelineDeal;
  density: KanbanDensity;
  stages: PipelineStage[];
  onMove?: (dealId: string, stageId: string) => void;
  interactive?: boolean;
}) {
  const compact = density === "compact";
  const stageName = stages.find((s) => s.id === deal.stage_id)?.name;

  return (
    <div className={cn("flex flex-col", compact ? "gap-1 p-2.5" : "gap-2 p-3")}>
      <div className="flex items-start gap-1">
        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <Link
              href={`/deals/${deal.id}`}
              onClick={(e) => e.stopPropagation()}
              draggable={false}
              className={cn(
                "min-w-0 flex-1 text-sm font-medium leading-snug text-foreground hover:text-primary hover:underline",
                compact ? "truncate" : "line-clamp-2",
              )}
            >
              {deal.title}
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" align="start">
            <DealDetails deal={deal} stageName={stageName} />
          </TooltipContent>
        </Tooltip>
        {interactive && onMove && <DealCardMenu deal={deal} stages={stages} onMove={onMove} />}
      </div>

      {deal.organization_name && (
        <p className="flex min-w-0 items-center gap-1 text-caption text-muted-foreground">
          <Building2 className="size-3 shrink-0" aria-hidden />
          <span className="truncate">{deal.organization_name}</span>
        </p>
      )}

      {!compact && deal.contact_name && (
        <p className="flex min-w-0 items-center gap-1 text-caption text-muted-foreground">
          <UserRound className="size-3 shrink-0" aria-hidden />
          <span className="truncate">{deal.contact_name}</span>
        </p>
      )}

      {!compact && deal.next_activity_subject && (
        <p className="flex min-w-0 items-center gap-1 text-caption text-muted-foreground">
          <Clock className="size-3 shrink-0" aria-hidden />
          <span className="truncate">{deal.next_activity_subject}</span>
        </p>
      )}

      <div className="flex items-center gap-2 pt-0.5">
        <span className="numeric text-caption font-semibold text-foreground">
          {compact ? shortBRL.format(deal.value) : formatCurrencyBRL(deal.value)}
        </span>
        <ActivityIndicator deal={deal} />
        {deal.is_stagnant && (
          <SimpleTooltip content="Estagnado: sem atividade além do prazo da etapa">
            <span className="inline-flex text-stagnant">
              <Snowflake className="size-3.5" aria-label="Estagnado" />
            </span>
          </SimpleTooltip>
        )}
        <span className="ml-auto">
          <UserAvatar name={deal.owner_name} size="xs" />
        </span>
      </div>

      {!compact && (deal.overdue_days || deal.no_upcoming_activity || deal.is_stagnant) && (
        <div className="flex flex-wrap gap-1">
          {deal.overdue_days && <Badge variant="destructive">Atrasado</Badge>}
          {deal.no_upcoming_activity && <Badge variant="warning">Sem próxima atividade</Badge>}
          {deal.is_stagnant && <Badge variant="stagnant">Estagnado</Badge>}
        </div>
      )}
    </div>
  );
}

export function DealCard({
  deal,
  density,
  stages,
  onMove,
  dragDisabled = false,
}: {
  deal: PipelineDeal;
  density: KanbanDensity;
  stages: PipelineStage[];
  onMove: (dealId: string, stageId: string) => void;
  dragDisabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: deal.id,
    disabled: dragDisabled,
    data: { stageId: deal.stage_id, title: deal.title },
  });

  return (
    <Card
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      aria-roledescription="negócio arrastável"
      aria-label={`${deal.title}, ${formatCurrencyBRL(deal.value)}`}
      className={cn(
        "group/card relative gap-0 border-l-2 py-0 outline-none transition-[box-shadow,opacity] hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring",
        !dragDisabled && "cursor-grab active:cursor-grabbing",
        alertBorder(deal),
        isDragging && "border-dashed opacity-40 shadow-none",
      )}
    >
      <DealCardBody deal={deal} density={density} stages={stages} onMove={onMove} />
    </Card>
  );
}

export function DealCardOverlay({
  deal,
  density,
  stages,
}: {
  deal: PipelineDeal;
  density: KanbanDensity;
  stages: PipelineStage[];
}) {
  return (
    <Card
      className={cn(
        "w-full cursor-grabbing gap-0 border-l-2 py-0 shadow-lg ring-1 ring-primary/30 motion-safe:rotate-1",
        alertBorder(deal),
      )}
    >
      <DealCardBody deal={deal} density={density} stages={stages} interactive={false} />
    </Card>
  );
}
