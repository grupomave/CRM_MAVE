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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";

const schema = z.object({
  name: z.string().min(1, "Informe o nome"),
  legal_name: z.string().optional(),
  cnpj: z.string().optional(),
  sector: z.string().optional(),
  company_size: z.string().optional(),
  nature: z.enum(["publica", "privada"]).optional(),
  phone: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  website: z.string().optional(),
  linkedin_url: z.string().optional(),
  instagram_url: z.string().optional(),
  address: z.string().optional(),
  services_of_interest: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function NewOrganizationDialog({
  trigger,
  onCreated,
}: {
  trigger: React.ReactNode;
  onCreated?: (created?: { id: string; name: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
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
      .from("organizations")
      .insert({
        name: values.name,
        legal_name: values.legal_name || null,
        cnpj: values.cnpj || null,
        sector: values.sector || null,
        company_size: values.company_size || null,
        nature: values.nature || null,
        phone: values.phone || null,
        city: values.city || null,
        state: values.state || null,
        website: values.website || null,
        linkedin_url: values.linkedin_url || null,
        instagram_url: values.instagram_url || null,
        address: values.address || null,
        services_of_interest: values.services_of_interest || null,
        notes: values.notes || null,
        owner_id: user.id,
      })
      .select("id, name")
      .single();

    if (error) {
      setSubmitError("Não foi possível criar a organização.");
      return;
    }

    reset();
    setOpen(false);
    onCreated?.(data ?? undefined);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova organização</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nome fantasia</Label>
            <Input id="name" {...register("name")} autoFocus />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="legal_name">Razão social</Label>
              <Input id="legal_name" {...register("legal_name")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input id="cnpj" {...register("cnpj")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sector">Setor</Label>
              <Input id="sector" {...register("sector")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="company_size">Porte (nº de funcionários)</Label>
              <Input id="company_size" {...register("company_size")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Natureza</Label>
              <Select
                value={watch("nature") ?? "none"}
                onValueChange={(v) =>
                  setValue("nature", v === "none" ? undefined : (v as "publica" | "privada"))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  <SelectItem value="publica">Pública</SelectItem>
                  <SelectItem value="privada">Privada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" {...register("phone")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="city">Cidade</Label>
              <Input id="city" {...register("city")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="state">Estado</Label>
              <Input id="state" {...register("state")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="website">Site</Label>
              <Input id="website" {...register("website")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="linkedin_url">LinkedIn</Label>
              <Input id="linkedin_url" {...register("linkedin_url")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="instagram_url">Instagram</Label>
              <Input id="instagram_url" {...register("instagram_url")} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="address">Endereço</Label>
            <Input id="address" {...register("address")} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="services_of_interest">Serviços de interesse</Label>
            <Input
              id="services_of_interest"
              {...register("services_of_interest")}
              placeholder="ex.: Portaria, Limpeza e Vigilância"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" {...register("notes")} rows={2} />
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
