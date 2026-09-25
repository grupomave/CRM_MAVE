import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card, CardAction, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export interface RelatedItem {
  id: string;
  href: string;
  title: string;
  subtitle?: string | null;
  trailing?: React.ReactNode;
}

// Card de registros relacionados nas telas de detalhe (pessoas de uma
// organização, negócios de uma pessoa...).
export function RelatedList({
  title,
  icon,
  items,
  emptyText,
  action,
}: {
  title: string;
  icon: LucideIcon;
  items: RelatedItem[];
  emptyText: string;
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 pb-3">
        <CardTitle>
          {title}
          <span className="numeric ml-1.5 font-normal text-muted-foreground">{items.length}</span>
        </CardTitle>
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      {items.length === 0 ? (
        <EmptyState compact icon={icon} title={emptyText} className="pb-5 pt-0" />
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm transition-colors hover:bg-muted/60"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium text-foreground">{item.title}</span>
                  {item.subtitle && (
                    <span className="truncate text-caption text-muted-foreground">{item.subtitle}</span>
                  )}
                </span>
                {item.trailing && <span className="flex shrink-0 items-center gap-2">{item.trailing}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
