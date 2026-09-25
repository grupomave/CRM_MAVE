"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Seção recolhível das colunas laterais (Resumo, Detalhes, Visão geral...)
export function CollapsibleSection({
  title,
  action,
  defaultOpen = true,
  className,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const contentId = React.useId();

  return (
    <section className={cn("border-b border-border last:border-b-0", className)}>
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={contentId}
          className="-ml-1 flex flex-1 items-center gap-1.5 rounded-sm px-1 text-left text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronDown
            className={cn("size-4 text-muted-foreground transition-transform", !open && "-rotate-90")}
            aria-hidden
          />
          {title}
        </button>
        {action}
      </div>
      <div id={contentId} hidden={!open} className="px-4 pb-4">
        {children}
      </div>
    </section>
  );
}
