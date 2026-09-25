import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface KpiDelta {
  /** Variação: fração (0.12 = +12%) ou pontos percentuais quando unit="pp" */
  value: number | null;
  unit?: "percent" | "pp";
  /** false quando subir é ruim (ex.: clientes perdidos) */
  positiveIsGood?: boolean;
  label?: string;
}

function formatDelta(delta: KpiDelta) {
  if (delta.value === null || !Number.isFinite(delta.value)) return "—";
  const sign = delta.value > 0 ? "+" : "";
  if (delta.unit === "pp") return `${sign}${(delta.value * 100).toFixed(0)} p.p.`;
  return `${sign}${(delta.value * 100).toFixed(0)}%`;
}

// Card de indicador padrão: rótulo + ícone, valor, variação e período.
export function KpiCard({
  label,
  value,
  icon: Icon,
  period,
  hint,
  delta,
  tone = "default",
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  period?: string;
  hint?: string;
  delta?: KpiDelta;
  tone?: "default" | "warning" | "danger";
}) {
  const direction =
    delta?.value === null || delta?.value === undefined || delta.value === 0
      ? "flat"
      : delta.value > 0
        ? "up"
        : "down";
  const good = direction === "flat" ? null : (direction === "up") === (delta?.positiveIsGood ?? true);
  const DeltaIcon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : ArrowRight;

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {Icon && (
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-md",
              tone === "default" && "bg-primary-subtle text-primary",
              tone === "warning" && "bg-warning-subtle text-warning-strong",
              tone === "danger" && "bg-destructive-subtle text-destructive-strong",
            )}
          >
            <Icon className="size-4" aria-hidden />
          </span>
        )}
      </div>
      <p className="numeric text-display text-foreground">{value}</p>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption">
        {delta && (
          <span
            className={cn(
              "numeric inline-flex items-center gap-0.5 rounded-sm px-1 py-0.5 font-medium",
              good === null && "bg-muted text-muted-foreground",
              good === true && "bg-success-subtle text-success-strong",
              good === false && "bg-destructive-subtle text-destructive-strong",
            )}
            title={delta.label}
          >
            <DeltaIcon className="size-3.5" aria-hidden />
            {formatDelta(delta)}
          </span>
        )}
        {(hint || period) && (
          <span className="text-muted-foreground">
            {hint}
            {hint && period ? " · " : ""}
            {period}
          </span>
        )}
      </div>
    </Card>
  );
}
