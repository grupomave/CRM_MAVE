"use client";

import { useEffect, useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { friendlyError, toast } from "@/lib/toast";
import { formatCurrencyBRL } from "@/lib/utils";

export interface MoveDealsTarget {
  ids: string[];
  /** Título quando é um negócio só; para vários, mostra a quantidade */
  title?: string;
  totalValue?: number;
}

// Move um ou vários negócios para outro funil (etapa de destino
// obrigatória). A função move_deals_to_pipeline roda com a RLS do usuário e
// o histórico "de funil/etapa -> para funil/etapa" é gravado por gatilho.
export function MoveToPipelineDialog({
  target,
  pipelines,
  currentPipelineId,
  onClose,
  onMoved,
}: {
  target: MoveDealsTarget | null;
  pipelines: { id: string; name: string }[];
  currentPipelineId?: string | null;
  onClose: () => void;
  onMoved: (result: { moved: number; pipelineId: string; stageId: string }) => void;
}) {
  const [pipelineId, setPipelineId] = useState("");
  const [stageId, setStageId] = useState("");
  const [stages, setStages] = useState<{ id: string; name: string }[]>([]);
  const [loadingStages, setLoadingStages] = useState(false);
  const [busy, setBusy] = useState(false);
  const [openFor, setOpenFor] = useState<MoveDealsTarget | null>(null);

  if (target !== openFor) {
    setOpenFor(target);
    setPipelineId("");
    setStageId("");
    setStages([]);
    setBusy(false);
  }

  useEffect(() => {
    if (!pipelineId) return;
    let cancelled = false;
    (async () => {
      setLoadingStages(true);
      const { data } = await createClient()
        .from("pipeline_stages")
        .select("id, name")
        .eq("pipeline_id", pipelineId)
        .order("order_index");
      if (cancelled) return;
      setStages(data ?? []);
      setStageId(data?.[0]?.id ?? "");
      setLoadingStages(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [pipelineId]);

  if (!target) return null;
  const count = target.ids.length;
  const options = pipelines.filter((p) => p.id !== currentPipelineId);

  async function move() {
    if (!target || !stageId) return;
    setBusy(true);
    const { data, error } = await createClient().rpc("move_deals_to_pipeline", {
      p_deal_ids: target.ids,
      p_target_stage_id: stageId,
    });
    setBusy(false);
    if (error) {
      toast.error("Não foi possível mover", { description: friendlyError(error, error.message) });
      return;
    }
    const result = data as { moved: number; requested: number } | null;
    const moved = result?.moved ?? 0;
    const pipelineName = pipelines.find((p) => p.id === pipelineId)?.name ?? "outro funil";
    const stageName = stages.find((s) => s.id === stageId)?.name ?? "";
    if (moved < count) {
      toast.warning(`${moved} de ${count} negócios movidos para ${pipelineName}`, {
        description: "Os demais não puderam ser movidos por falta de permissão.",
      });
    } else {
      toast.success(
        count === 1 && target.title
          ? `“${target.title}” movido para ${pipelineName}`
          : `${moved} negócios movidos para ${pipelineName}`,
        { description: `Etapa: ${stageName}` },
      );
    }
    onMoved({ moved, pipelineId, stageId });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="size-5 text-primary" />
            Mover para outro funil
          </DialogTitle>
          <DialogDescription>
            {count === 1 && target.title ? (
              <>“{target.title}”</>
            ) : (
              <>
                <span className="numeric">{count}</span> negócios selecionados
              </>
            )}
            {target.totalValue !== undefined && count > 1 && (
              <> · <span className="numeric">{formatCurrencyBRL(target.totalValue)}</span></>
            )}
            . A mudança fica registrada no histórico de cada negócio.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <FormField label="Funil de destino" htmlFor="move-pipeline" required>
            <Select value={pipelineId} onValueChange={setPipelineId}>
              <SelectTrigger id="move-pipeline">
                <SelectValue placeholder="Escolha o funil" />
              </SelectTrigger>
              <SelectContent>
                {options.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField
            label="Etapa de destino"
            htmlFor="move-stage"
            required
            hint={pipelineId && !loadingStages && stages.length === 0 ? "Este funil não tem etapas." : undefined}
          >
            <Select value={stageId} onValueChange={setStageId} disabled={!pipelineId || loadingStages}>
              <SelectTrigger id="move-stage">
                <SelectValue placeholder={pipelineId ? "Escolha a etapa" : "Escolha o funil primeiro"} />
              </SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={move} loading={busy} disabled={!stageId}>
            Mover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
