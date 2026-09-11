"use client";

import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Building2, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatCurrencyBRL, initials } from "@/lib/utils";
import type { PipelineDeal } from "./types";

export function DealCard({ deal }: { deal: PipelineDeal }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: deal.id });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`cursor-grab touch-none gap-0 py-0 active:cursor-grabbing ${
        isDragging ? "z-10 opacity-60 shadow-md" : ""
      }`}
    >
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
        <div className="flex items-center justify-end">
          <Avatar className="size-6">
            <AvatarFallback className="text-[10px]">
              {initials(deal.owner_name)}
            </AvatarFallback>
          </Avatar>
        </div>
      </CardContent>
    </Card>
  );
}
