import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

function Breadcrumbs({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Trilha de navegação" className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 flex-wrap items-center gap-1 text-caption text-muted-foreground">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex min-w-0 items-center gap-1">
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="truncate rounded-sm transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={cn("truncate", last && "text-foreground")}
                  aria-current={last ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
              {!last && <ChevronRight className="size-3 shrink-0" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// Cabeçalho padrão de todas as telas: trilha, título, descrição e ações
// principais alinhadas à direita (empilham abaixo do título no mobile).
function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  meta,
  className,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  /** Conteúdo ao lado do título (badges de status, por exemplo) */
  meta?: React.ReactNode;
  className?: string;
  /** Conteúdo abaixo do cabeçalho (abas, barra de etapas...) */
  children?: React.ReactNode;
}) {
  return (
    <header className={cn("flex flex-col gap-3", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 max-w-full shrink-0 flex-col gap-1 md:max-w-1/2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="min-w-0 break-words text-title text-foreground">{title}</h1>
            {meta}
          </div>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && (
          // As ações quebram linha em vez de estourar a largura (tablets)
          <div className="flex min-w-0 flex-1 flex-wrap items-end gap-2 md:justify-end">{actions}</div>
        )}
      </div>
      {children}
    </header>
  );
}

export { PageHeader, Breadcrumbs };
