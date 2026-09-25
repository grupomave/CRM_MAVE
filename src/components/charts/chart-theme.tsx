"use client";

// Tema compartilhado dos gráficos (Recharts): eixos, grade, legenda e
// tooltip usam os tokens do design system, então acompanham o modo escuro.

const numberFormat = new Intl.NumberFormat("pt-BR");

export const AXIS_PROPS = {
  tick: { fill: "var(--color-muted-foreground)", fontSize: 12 },
  axisLine: false,
  tickLine: false,
} as const;

export const GRID_STROKE = "var(--color-border)";

export const CURSOR = { fill: "var(--color-muted)", opacity: 0.6 };
export const LINE_CURSOR = { stroke: "var(--color-border-strong)" };

export const LEGEND_PROPS = {
  iconType: "circle" as const,
  iconSize: 8,
  wrapperStyle: { fontSize: 12, color: "var(--color-muted-foreground)", paddingTop: 8 },
};

interface TooltipPayloadItem {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

export function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter = (v: number) => numberFormat.format(v),
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  valueFormatter?: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-36 rounded-md border border-border bg-card px-3 py-2 text-caption shadow-md">
      {label !== undefined && label !== "" && <p className="mb-1 font-medium text-foreground">{label}</p>}
      <ul className="flex flex-col gap-0.5">
        {payload.map((item) => (
          <li key={String(item.dataKey ?? item.name)} className="flex items-center gap-2">
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} aria-hidden />
            {payload.length > 1 && item.name !== undefined && (
              <span className="text-muted-foreground">{item.name}</span>
            )}
            <span className="numeric ml-auto font-medium text-foreground">
              {typeof item.value === "number" ? valueFormatter(item.value) : item.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
