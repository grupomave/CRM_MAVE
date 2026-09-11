"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const schema = z.object({
  name: z.string().min(1, "Informe o nome"),
  cnpj: z.string().optional(),
  sector: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function NewOrganizationDialog({
  trigger,
  onCreated,
}: {
  trigger: React.ReactNode;
  onCreated?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setSubmitError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSubmitError("Sessão expirada, faça login novamente.");
      return;
    }

    const { error } = await supabase.from("organizations").insert({
      name: values.name,
      cnpj: values.cnpj || null,
      sector: values.sector || null,
      owner_id: user.id,
    });

    if (error) {
      setSubmitError("Não foi possível criar a organização.");
      return;
    }

    reset();
    setOpen(false);
    onCreated?.();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova organização</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" {...register("name")} autoFocus />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cnpj">CNPJ</Label>
            <Input id="cnpj" {...register("cnpj")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sector">Setor</Label>
            <Input id="sector" {...register("sector")} />
          </div>
          {submitError && (
            <p className="text-sm text-destructive">{submitError}</p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Criando..." : "Criar organização"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
