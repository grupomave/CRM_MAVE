import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";

// Esqueleto padrão das listagens (Leads, Pessoas, Organizações, Atividades...)
export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Carregando">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-9 w-44" />
      </div>
      <TableSkeleton rows={10} columns={6} />
    </div>
  );
}
