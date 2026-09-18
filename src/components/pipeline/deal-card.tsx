"use client";

import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { Building2, Clock, AlertTriangle, Snowflake } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatCurrencyBRL, initials, cn } from "@/lib/utils";
import type { PipelineDeal } from "./types";

function borderClassFor(deal: PipelineDeal) {
  return deal.overdue_days
    ? "border-l-4 border-l-destructive"
    : deal.is_stagnant
      ? "border-l-4 border-l-violet-500"
      : deal.no_upcoming_activity
        ? "border-l-4 border-l-amber-500"
        : "";
}

function DealCardContent({ deal }: { deal: PipelineDeal }) {
  return (
    <CardContent className="flex flex-col gap-2 p-3">
      <Link
        href={`/deals/${deal.id}`}
        onClick={(e) => e.stopPropagation()}
        className="text-sm font-medium text-foreground hover:underline"
      >
        {deal.title}
      </Link>
      <span className="text-sm font-semibold text-primary">
        {formatCurrencyBRL(deal.value)}
      </span>
      {deal.organization_name && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Building2 className="size-3" />
          {deal.organization_name}
        </span>
      )}
      {deal.next_activity_subject && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3" />
          {deal.next_activity_subject}
        </span>
      )}
      {(deal.overdue_days || deal.no_upcoming_activity || deal.is_stagnant) && (
        <div className="flex flex-wrap gap-1">
          {deal.overdue_days && (
            <Badge variant="destructive">
              Atrasado há {deal.overdue_days}{" "}
              {deal.overdue_days === 1 ? "dia" : "dias"}
            </Badge>
          )}
          {deal.no_upcoming_activity && (
            <Badge variant="warning">
              <AlertTriangle className="size-3" />
              Sem próxima atividade
            </Badge>
          )}
          {deal.is_stagnant && (
            <Badge variant="stagnant">
              <Snowflake className="size-3" />
              Estagnado
            </Badge>
          )}
        </div>
      )}
      <div className="flex items-center justify-end">
        <Avatar className="size-6">
          <AvatarFallback className="text-[10px]">
            {initials(deal.owner_name)}
          </AvatarFallback>
        </Avatar>
      </div>
    </CardContent>
  );
}

export function DealCard({ deal }: { deal: PipelineDeal }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: deal.id,
  });

  return (
    <Card
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "cursor-grab touch-none gap-0 py-0 active:cursor-grabbing",
        isDragging ? "opacity-40" : "",
        borderClassFor(deal),
      )}
    >
      <DealCardContent deal={deal} />
    </Card>
  );
}

export function DealCardOverlay({ deal }: { deal: PipelineDeal }) {
  return (
    <Card
      className={cn(
        "cursor-grabbing gap-0 py-0 shadow-lg",
        borderClassFor(deal),
      )}
    >
      <DealCardContent deal={deal} />
    </Card>
  );
}
