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
import { Textarea } from "@/components/ui/textarea";
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
import type { UserRole } from "@/lib/supabase/types";

const schema = z.object({
  title: z.string().min(1, "Informe o nome do negócio"),
  value: z.coerce.number().min(0),
  pipeline_id: z.string().min(1, "Selecione um funil"),
  stage_id: z.string().min(1, "Selecione um estágio"),
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
    defaultValues: {
      title: "",
      value: 0,
      pipeline_id: pipelineId ?? "",
      stage_id: defaultStageId ?? "",
    },
  });

  const selectedPipelineId = watch("pipeline_id");

  useEffect(() => {
    if (!open) return;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;
      setCurrentUserId(user.id);

      const [{ data: profile }, { data: pipelinesData }, organizationsData, contactsData] =
        await Promise.all([
          supabase.from("profiles").select("role").eq("id", user.id).single(),
          supabase.from("pipelines").select("id, name, is_default").order("name"),
          fetchAllRows((from, to) =>
            supabase.from("organizations").select("id, name").order("name").range(from, to),
          ),
          fetchAllRows((from, to) =>
            supabase.from("contacts").select("id, name").order("name").range(from, to),
          ),
        ]);

      setCurrentRole(profile?.role ?? null);
      setPipelines(pipelinesData ?? []);
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
        const defaultPipeline =
          pipelinesData?.find((p: any) => p.is_default) ?? pipelinesData?.[0];
        effectivePipelineId = defaultPipeline?.id;
      }
      if (effectivePipelineId && !watch("pipeline_id")) {
        setValue("pipeline_id", effectivePipelineId);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pipelineId]);

  useEffect(() => {
    if (!open || !selectedPipelineId) return;

    (async () => {
      const { data } = await supabase
        .from("pipeline_stages")
        .select("id, name, pipeline_id")
        .eq("pipeline_id", selectedPipelineId)
        .order("order_index");

      setStages(data ?? []);
      const currentStage = watch("stage_id");
      const stageStillValid = data?.some((s) => s.id === currentStage);
      if (!stageStillValid) {
        setValue("stage_id", defaultStageId && data?.some((s) => s.id === defaultStageId)
          ? defaultStageId
          : data?.[0]?.id ?? "");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedPipelineId]);

  async function onSubmit(values: FormValues) {
    setSubmitError(null);

    if (!currentUserId) {
      setSubmitError("Sessão expirada, faça login novamente.");
      return;
    }

    const ownerId =
      currentRole === "admin" || currentRole === "gestor"
        ? values.owner_id || currentUserId
        : currentUserId;

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
      setSubmitError("Não foi possível criar o negócio. Tente novamente.");
      return;
    }

    if (values.notes?.trim()) {
      await supabase.from("notes").insert({
        content: values.notes.trim(),
        deal_id: deal.id,
        author_id: currentUserId,
      });
    }

    reset();
    setOpen(false);
    onCreated?.();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo negócio</DialogTitle>
          <DialogDescription>
            Cria um negócio no funil selecionado.
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

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Funil</Label>
              <Select
                value={watch("pipeline_id")}
                onValueChange={(v) => setValue("pipeline_id", v)}
              >
                <SelectTrigger>
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
              {errors.pipeline_id && (
                <p className="text-xs text-destructive">
                  {errors.pipeline_id.message}
                </p>
              )}
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
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Organização</Label>
            <div className="flex gap-2">
              <Select
                value={watch("organization_id") ?? ""}
                onValueChange={(v) => setValue("organization_id", v)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <NewOrganizationDialog
                trigger={
                  <Button type="button" variant="outline">
                    Nova
                  </Button>
                }
                onCreated={(created) => {
                  if (!created) return;
                  setOrganizations((prev) => [...prev, created]);
                  setValue("organization_id", created.id);
                }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Contato</Label>
            <div className="flex gap-2">
              <Select
                value={watch("contact_id") ?? ""}
                onValueChange={(v) => setValue("contact_id", v)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <NewContactDialog
                organizationId={watch("organization_id")}
                trigger={
                  <Button type="button" variant="outline">
                    Novo
                  </Button>
                }
                onCreated={(created) => {
                  if (!created) return;
                  setContacts((prev) => [...prev, created]);
                  setValue("contact_id", created.id);
                }}
              />
            </div>
          </div>

          {(currentRole === "admin" || currentRole === "gestor") && (
            <div className="flex flex-col gap-1.5">
              <Label>Responsável</Label>
              <Select
                value={watch("owner_id") ?? ""}
                onValueChange={(v) => setValue("owner_id", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Você mesmo" />
                </SelectTrigger>
                <SelectContent>
                  {owners.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="source">Origem</Label>
              <Input id="source" {...register("source")} placeholder="Indicação, site..." />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expected_close_date">Previsão de fechamento</Label>
              <Input id="expected_close_date" type="date" {...register("expected_close_date")} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" {...register("notes")} rows={3} />
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
