"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { SortState } from "@/lib/filters/params";

// Cabeçalho de coluna ordenável: 1º clique ordena, 2º inverte.
export function SortableHead<K extends string>({
  sortKey,
  sort,
  onSort,
  align = "left",
  defaultDir = "asc",
  className,
  children,
}: {
  sortKey: K;
  sort: SortState<K>;
  onSort: (next: SortState<K>) => void;
  align?: "left" | "right";
  defaultDir?: "asc" | "desc";
  className?: string;
  children: React.ReactNode;
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ChevronsUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead
      align={align}
      className={className}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() =>
          onSort({
            key: sortKey,
            dir: active ? (sort.dir === "asc" ? "desc" : "asc") : defaultDir,
          })
        }
        className={cn(
          "-mx-1 inline-flex items-center gap-1 rounded-sm px-1 py-0.5 transition-colors hover:text-foreground",
          active && "text-foreground",
          align === "right" && "flex-row-reverse",
        )}
      >
        {children}
        <Icon className={cn("size-3.5", !active && "opacity-50")} aria-hidden />
      </button>
    </TableHead>
  );
}
