"use client";

import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
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
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { Combobox } from "@/components/ui/combobox";
import { CurrencyInput, DateInput } from "@/components/ui/masked-inputs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NewOrganizationDialog } from "@/components/forms/new-organization-dialog";
import { NewContactDialog } from "@/components/forms/new-contact-dialog";
import { createClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { friendlyError, toast } from "@/lib/toast";
import type { UserRole } from "@/lib/supabase/types";

const schema = z.object({
  title: z.string().trim().min(1, "Informe o nome do negócio"),
  value: z.number({ invalid_type_error: "Informe um valor" }).min(0, "O valor não pode ser negativo"),
  pipeline_id: z.string().min(1, "Selecione um funil"),
  stage_id: z.string().min(1, "Selecione uma etapa"),
  organization_id: z.string().optional(),
  contact_id: z.string().optional(),
  owner_id: z.string().optional(),
  source: z.string().optional(),
  expected_close_date: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Pipeline {
  id: string;
  name: string;
  is_default?: boolean;
}

interface Stage {
  id: string;
  name: string;
  pipeline_id: string;
}

interface Option {
  id: string;
  name: string;
}

export function NewDealDialog({
  trigger,
  pipelineId,
  defaultStageId,
  onCreated,
  open: openProp,
  onOpenChange,
}: {
  trigger?: React.ReactNode;
  pipelineId?: string;
  defaultStageId?: string;
  onCreated?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [organizations, setOrganizations] = useState<Option[]>([]);
  const [contacts, setContacts] = useState<Option[]>([]);
  const [owners, setOwners] = useState<Option[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      value: 0,
      pipeline_id: pipelineId ?? "",
      stage_id: defaultStageId ?? "",
    },
  });

  const selectedPipelineId = useWatch({ control, name: "pipeline_id" });
  const selectedOrganizationId = useWatch({ control, name: "organization_id" });
  const canChooseOwner = currentRole === "admin" || currentRole === "gestor";

  useEffect(() => {
    if (!open) return;

    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;
      setCurrentUserId(user.id);

      const [{ data: profile }, { data: pipelinesData }, organizationsData, contactsData] =
        await Promise.all([
          supabase.from("profiles").select("role").eq("id", user.id).single(),
          supabase.from("pipelines").select("id, name, is_default").order("name"),
          fetchAllRows<Option>((from, to) =>
            supabase.from("organizations").select("id, name").order("name").range(from, to),
          ),
          fetchAllRows<Option>((from, to) =>
            supabase.from("contacts").select("id, name").order("name").range(from, to),
          ),
        ]);

      setCurrentRole(profile?.role ?? null);
      setPipelines((pipelinesData ?? []) as Pipeline[]);
      setOrganizations(organizationsData);
      setContacts(contactsData);

      if (profile?.role === "admin" || profile?.role === "gestor") {
        const { data: ownersData } = await supabase
          .from("profiles")
          .select("id, full_name")
          .eq("is_active", true)
          .order("full_name");
        setOwners((ownersData ?? []).map((o) => ({ id: o.id, name: o.full_name })));
      }

      let effectivePipelineId = pipelineId;
      if (!effectivePipelineId) {
        const list = (pipelinesData ?? []) as Pipeline[];
        effectivePipelineId = (list.find((p) => p.is_default) ?? list[0])?.id;
      }
      if (effectivePipelineId && !getValues("pipeline_id")) {
        setValue("pipeline_id", effectivePipelineId);
      }
    })();
  }, [open, pipelineId, getValues, setValue]);

  useEffect(() => {
    if (!open || !selectedPipelineId) return;

    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("pipeline_stages")
        .select("id, name, pipeline_id")
        .eq("pipeline_id", selectedPipelineId)
        .order("order_index");

      setStages(data ?? []);
      const stageStillValid = data?.some((s) => s.id === getValues("stage_id"));
      if (!stageStillValid) {
        setValue(
          "stage_id",
          defaultStageId && data?.some((s) => s.id === defaultStageId)
            ? defaultStageId
            : (data?.[0]?.id ?? ""),
        );
      }
    })();
  }, [open, selectedPipelineId, defaultStageId, getValues, setValue]);

  async function onSubmit(values: FormValues) {
    if (!currentUserId) {
      toast.error("Sua sessão expirou", { description: "Entre novamente para continuar." });
      return;
    }

    const ownerId = canChooseOwner ? values.owner_id || currentUserId : currentUserId;
    const supabase = createClient();

    const { data: deal, error } = await supabase
      .from("deals")
      .insert({
        title: values.title,
        value: values.value,
        currency: "BRL",
        pipeline_id: values.pipeline_id,
        stage_id: values.stage_id,
        organization_id: values.organization_id || null,
        contact_id: values.contact_id || null,
        owner_id: ownerId,
        source: values.source || null,
        expected_close_date: values.expected_close_date || null,
        status: "open",
      })
      .select("id")
      .single();

    if (error || !deal) {
      toast.error("Não foi possível criar o negócio", { description: friendlyError(error) });
      return;
    }

    if (values.notes?.trim()) {
      await supabase.from("notes").insert({
        content: values.notes.trim(),
        deal_id: deal.id,
        author_id: currentUserId,
      });
    }

    toast.success("Negócio criado", { description: values.title });
    reset();
    setOpen(false);
    onCreated?.();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Novo negócio</DialogTitle>
          <DialogDescription>Campos com * são obrigatórios.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
            <FormField label="Nome do negócio" htmlFor="deal-title" required error={errors.title?.message}>
              <Input id="deal-title" autoFocus placeholder="Ex.: Portaria 24h — Condomínio Aurora" {...register("title")} />
            </FormField>
            <FormField label="Valor" htmlFor="deal-value" required error={errors.value?.message}>
              <Controller
                control={control}
                name="value"
                render={({ field }) => (
                  <CurrencyInput
                    id="deal-value"
                    value={field.value ?? null}
                    onValueChange={(v) => field.onChange(v ?? 0)}
                  />
                )}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Funil" htmlFor="deal-pipeline" required error={errors.pipeline_id?.message}>
              <Controller
                control={control}
                name="pipeline_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="deal-pipeline" aria-invalid={!!errors.pipeline_id}>
                      <SelectValue placeholder="Selecione o funil" />
                    </SelectTrigger>
                    <SelectContent>
                      {pipelines.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            <FormField label="Etapa" htmlFor="deal-stage" required error={errors.stage_id?.message}>
              <Controller
                control={control}
                name="stage_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="deal-stage" aria-invalid={!!errors.stage_id}>
                      <SelectValue placeholder="Selecione a etapa" />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          </div>

          <FormField label="Organização" htmlFor="deal-org">
            <div className="flex gap-2">
              <Controller
                control={control}
                name="organization_id"
                render={({ field }) => (
                  <Combobox
                    id="deal-org"
                    className="min-w-0 flex-1"
                    value={field.value ?? null}
                    onChange={(v) => field.onChange(v ?? "")}
                    options={organizations.map((o) => ({ value: o.id, label: o.name }))}
                    placeholder="Nenhuma"
                    searchPlaceholder="Buscar organização..."
                  />
                )}
              />
              <NewOrganizationDialog
                trigger={
                  <Button type="button" variant="secondary" aria-label="Nova organização">
                    <Plus />
                    <span className="hidden sm:inline">Nova</span>
                  </Button>
                }
                onCreated={(created) => {
                  if (!created) return;
                  setOrganizations((prev) => [...prev, created]);
                  setValue("organization_id", created.id);
                }}
              />
            </div>
          </FormField>

          <FormField label="Pessoa de contato" htmlFor="deal-contact">
            <div className="flex gap-2">
              <Controller
                control={control}
                name="contact_id"
                render={({ field }) => (
                  <Combobox
                    id="deal-contact"
                    className="min-w-0 flex-1"
                    value={field.value ?? null}
                    onChange={(v) => field.onChange(v ?? "")}
                    options={contacts.map((c) => ({ value: c.id, label: c.name }))}
                    placeholder="Nenhuma"
                    searchPlaceholder="Buscar pessoa..."
                  />
                )}
              />
              <NewContactDialog
                organizationId={selectedOrganizationId || undefined}
                trigger={
                  <Button type="button" variant="secondary" aria-label="Novo contato">
                    <Plus />
                    <span className="hidden sm:inline">Nova</span>
                  </Button>
                }
                onCreated={(created) => {
                  if (!created) return;
                  setContacts((prev) => [...prev, created]);
                  setValue("contact_id", created.id);
                }}
              />
            </div>
          </FormField>

          {canChooseOwner && (
            <FormField label="Responsável" htmlFor="deal-owner" hint="Em branco: você mesmo">
              <Controller
                control={control}
                name="owner_id"
                render={({ field }) => (
                  <Combobox
                    id="deal-owner"
                    value={field.value ?? null}
                    onChange={(v) => field.onChange(v ?? "")}
                    options={owners.map((o) => ({ value: o.id, label: o.name }))}
                    placeholder="Você mesmo"
                    searchPlaceholder="Buscar usuário..."
                  />
                )}
              />
            </FormField>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Origem" htmlFor="deal-source">
              <Input id="deal-source" placeholder="Indicação, site, evento..." {...register("source")} />
            </FormField>
            <FormField label="Previsão de fechamento" htmlFor="deal-close">
              <Controller
                control={control}
                name="expected_close_date"
                render={({ field }) => (
                  <DateInput id="deal-close" value={field.value ?? ""} onValueChange={field.onChange} />
                )}
              />
            </FormField>
          </div>

          <FormField label="Observações" htmlFor="deal-notes" hint="Vira a primeira anotação do negócio">
            <Textarea id="deal-notes" rows={3} {...register("notes")} />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Criar negócio
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
