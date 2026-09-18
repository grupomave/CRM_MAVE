"use client";

import { useState } from "react";
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
import { createClient } from "@/lib/supabase/client";

const schema = z.object({
  name: z.string().min(1, "Informe o nome"),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function NewContactDialog({
  trigger,
  onCreated,
  open: openProp,
  onOpenChange,
  organizationId,
}: {
  trigger?: React.ReactNode;
  onCreated?: (created?: { id: string; name: string }) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  organizationId?: string;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
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

    const { data, error } = await supabase
      .from("contacts")
      .insert({
        name: values.name,
        email: values.email || null,
        phone: values.phone || null,
        organization_id: organizationId ?? null,
        owner_id: user.id,
      })
      .select("id, name")
      .single();

    if (error) {
      setSubmitError("Não foi possível criar o contato. Tente novamente.");
      return;
    }

    reset();
    setOpen(false);
    onCreated?.(data ?? undefined);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo contato</DialogTitle>
          <DialogDescription>Cadastra uma nova pessoa.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            // O DialogContent do Radix é portalizado para fora do form pai no
            // DOM, mas o React ainda propaga o evento pela árvore de
            // componentes — sem isso, este submit também disparava o submit
            // do formulário pai (ex.: "Novo negócio") antes deste terminar.
            e.stopPropagation();
            handleSubmit(onSubmit)(e);
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" {...register("name")} autoFocus />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" {...register("email")} />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Telefone</Label>
            <Input id="phone" {...register("phone")} />
          </div>
          {submitError && (
            <p className="text-sm text-destructive">{submitError}</p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Criando..." : "Criar contato"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
