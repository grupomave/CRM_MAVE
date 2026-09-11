"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";

const schema = z.object({
  title: z.string().min(1, "Informe o nome do negócio"),
  value: z.coerce.number().min(0),
  stage_id: z.string().min(1, "Selecione um estágio"),
});

type FormValues = z.infer<typeof schema>;

interface Stage {
  id: string;
  name: string;
  pipeline_id: string;
}

export function NewDealDialog({
  trigger,
  defaultStageId,
  onCreated,
  open: openProp,
  onOpenChange,
}: {
  trigger?: React.ReactNode;
  defaultStageId?: string;
  onCreated?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [stages, setStages] = useState<Stage[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", value: 0, stage_id: defaultStageId ?? "" },
  });

  useEffect(() => {
    if (!open) return;
    supabase
      .from("pipeline_stages")
      .select("id, name, pipeline_id")
      .order("order_index")
      .then(({ data }) => {
        if (data) {
          setStages(data);
          if (!watch("stage_id") && data[0]) {
            setValue("stage_id", defaultStageId ?? data[0].id);
          }
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onSubmit(values: FormValues) {
    setSubmitError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSubmitError("Sessão expirada, faça login novamente.");
      return;
    }

    const stage = stages.find((s) => s.id === values.stage_id);

    if (!stage) {
      setSubmitError("Estágio inválido.");
      return;
    }

    const { error } = await supabase.from("deals").insert({
      title: values.title,
      value: values.value,
      currency: "BRL",
      pipeline_id: stage.pipeline_id,
      stage_id: values.stage_id,
      owner_id: user.id,
      status: "open",
    });

    if (error) {
      setSubmitError("Não foi possível criar o negócio. Tente novamente.");
      return;
    }

    reset();
    setOpen(false);
    onCreated?.();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo negócio</DialogTitle>
          <DialogDescription>
            Cria um negócio no pipeline padrão.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Nome do negócio</Label>
            <Input id="title" {...register("title")} autoFocus />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="value">Valor (R$)</Label>
            <Input id="value" type="number" step="0.01" {...register("value")} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Estágio</Label>
            <Select
              value={watch("stage_id")}
              onValueChange={(v) => setValue("stage_id", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o estágio" />
              </SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.stage_id && (
              <p className="text-xs text-destructive">
                {errors.stage_id.message}
              </p>
            )}
          </div>

          {submitError && (
            <p className="text-sm text-destructive">{submitError}</p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Criando..." : "Criar negócio"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
