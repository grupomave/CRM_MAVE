"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
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
import { FormField } from "@/components/ui/form-field";
import { MaskedInput } from "@/components/ui/masked-inputs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { friendlyError, toast } from "@/lib/toast";
import { isValidPhoneBR } from "@/lib/masks";
import type { CatalogItem } from "@/lib/data/catalogs";
import type { OwnerOption } from "@/lib/data/lists";

const NONE = "__none__";
const optionalPhone = z
  .string()
  .optional()
  .refine((v) => !v || isValidPhoneBR(v), "Telefone incompleto — use DDD + número");

const schema = z.object({
  name: z.string().trim().min(1, "Informe o nome do lead"),
  source_id: z.string().optional(),
  phone: optionalPhone,
  mobile: optionalPhone,
  email: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "E-mail inválido"),
  owner_id: z.string().min(1, "Selecione o responsável"),
});

type FormValues = z.infer<typeof schema>;

export function LeadsToolbar({
  sources,
  owners,
  currentUserId,
  canReassign,
}: {
  sources: CatalogItem[];
  owners: OwnerOption[];
  currentUserId: string;
  canReassign: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { owner_id: currentUserId },
  });

  async function onSubmit(values: FormValues) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sua sessão expirou", { description: "Entre novamente para continuar." });
      return;
    }

    const source = sources.find((s) => s.id === values.source_id);
    const { error } = await supabase.from("leads").insert({
      name: values.name,
      source_id: source?.id ?? null,
      source: source?.name ?? null,
      phone: values.phone || null,
      mobile: values.mobile || null,
      email: values.email || null,
      status: "new",
      owner_id: canReassign ? values.owner_id : user.id,
    });

    if (error) {
      toast.error("Não foi possível criar o lead", { description: friendlyError(error) });
      return;
    }

    toast.success("Lead criado", { description: values.name });
    reset({ owner_id: currentUserId });
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Novo lead
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo lead</DialogTitle>
          <DialogDescription>
            Registre o contato para qualificar depois e, se fizer sentido, converter em negócio.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <FormField label="Nome" htmlFor="lead-name" required error={errors.name?.message}>
            <Input id="lead-name" autoFocus placeholder="Nome da pessoa ou empresa" {...register("name")} />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Telefone" htmlFor="lead-phone" error={errors.phone?.message}>
              <MaskedInput id="lead-phone" mask="phone" {...register("phone")} />
            </FormField>
            <FormField label="Smartphone" htmlFor="lead-mobile" hint="Celular / WhatsApp" error={errors.mobile?.message}>
              <MaskedInput id="lead-mobile" mask="phone" {...register("mobile")} />
            </FormField>
          </div>
          <FormField label="E-mail" htmlFor="lead-email" error={errors.email?.message}>
            <Input id="lead-email" type="email" placeholder="nome@empresa.com.br" {...register("email")} />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Origem" htmlFor="lead-source">
              <Controller
                control={control}
                name="source_id"
                render={({ field }) => (
                  <Select
                    value={field.value || NONE}
                    onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
                  >
                    <SelectTrigger id="lead-source">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Não informada</SelectItem>
                      {sources.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField label="Responsável" htmlFor="lead-owner" required error={errors.owner_id?.message}>
              <Controller
                control={control}
                name="owner_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={!canReassign}>
                    <SelectTrigger id="lead-owner">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {owners.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Criar lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
