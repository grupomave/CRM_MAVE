import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Carregando o funil">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-7 w-36" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-9 w-36" />
        </div>
      </div>
      <Skeleton className="h-9 w-64" />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 6 }).map((_, col) => (
          <div key={col} className="flex w-64 shrink-0 flex-col gap-2 rounded-lg border border-border bg-muted/40 p-2">
            <Skeleton className="h-10 bg-border/60" />
            {Array.from({ length: 4 - (col % 3) }).map((_, i) => (
              <Skeleton key={i} className="h-20 bg-card" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
