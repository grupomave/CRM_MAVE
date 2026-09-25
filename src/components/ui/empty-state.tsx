import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Estado vazio padrão: ícone leve + texto explicativo + ação opcional.
function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-2 px-3 py-6" : "gap-3 px-6 py-12",
        className,
      )}
    >
      {Icon && (
        <div
          className={cn(
            "flex items-center justify-center rounded-full bg-muted text-muted-foreground",
            compact ? "size-9" : "size-12",
          )}
        >
          <Icon className={compact ? "size-4" : "size-5"} aria-hidden />
        </div>
      )}
      <div className="flex max-w-sm flex-col gap-1">
        <p className={cn("font-medium text-foreground", compact ? "text-caption" : "text-sm")}>
          {title}
        </p>
        {description && (
          <p className={cn("text-muted-foreground", compact ? "text-micro" : "text-caption")}>
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export { EmptyState };
