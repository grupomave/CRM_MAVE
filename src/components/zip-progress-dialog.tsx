"use client";

import { FileArchive } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ZipProgress } from "@/lib/attachments-download";

// Progresso da geração do .zip (baixando arquivos -> compactando)
export function ZipProgressDialog({ progress, onCancel }: { progress: ZipProgress; onCancel: () => void }) {
  const open = progress.phase !== "idle";
  const label =
    progress.phase === "downloading"
      ? `Baixando ${progress.done} de ${progress.total} ${progress.total === 1 ? "arquivo" : "arquivos"}`
      : "Compactando";

  return (
    <Dialog open={open}>
      <DialogContent size="sm" hideClose onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileArchive className="size-5 text-primary" />
            Gerando .zip
          </DialogTitle>
          <DialogDescription className="truncate">{progress.zipName}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground">{label}...</span>
            <span className="numeric text-muted-foreground">{progress.percent}%</span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress.percent}
            aria-label={label}
            className="h-2 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
