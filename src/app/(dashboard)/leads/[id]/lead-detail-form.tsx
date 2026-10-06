"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRightLeft, CheckCircle2, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { MaskedInput } from "@/components/ui/masked-inputs";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { friendlyError, toast } from "@/lib/toast";
import { LEAD_STATUS_LABEL } from "@/lib/filters/leads";
import { isValidPhoneBR } from "@/lib/masks";
import type { CatalogItem } from "@/lib/data/catalogs";
import type { OwnerOption } from "@/lib/data/lists";
import type { LeadStatus } from "@/lib/supabase/types";

const NONE = "__none__";

interface Lead {
  id: string;
  name: string;
  contact_info: string | null;
  source: string | null;
  source_id: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  status: LeadStatus;
  converted_deal_id: string | null;
  owner_id: string;
}

interface Pipeline {
  id: string;
  name: string;
  is_default: boolean;
}

export function LeadDetailForm({
  lead,
  pipelines,
  sources,
  owners,
  canReassign,
}: {
  lead: Lead;
  pipelines: Pipeline[];
  sources: CatalogItem[];
  owners: OwnerOption[];
  canReassign: boolean;
}) {
  const [form, setForm] = useState(lead);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const [converting, setConverting] = useState(false);
  const [convertBusy, setConvertBusy] = useState(false);
  const [pipelineId, setPipelineId] = useState(
    pipelines.find((p) => p.is_default)?.id ?? pipelines[0]?.id ?? "",
  );
  const [stages, setStages] = useState<{ id: string; name: string }[]>([]);
  const [stageId, setStageId] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!converting || !pipelineId) return;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("pipeline_stages")
        .select("id, name")
        .eq("pipeline_id", pipelineId)
        .order("order_index");
      setStages(data ?? []);
      setStageId(data?.[0]?.id ?? "");
    })();
  }, [converting, pipelineId]);

  function set<K extends keyof Lead>(key: K, value: Lead[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const nameError = !form.name.trim() ? "Informe o nome do lead" : undefined;
  // Só valida o que foi alterado (dados importados antigos não bloqueiam o salvar)
  const phoneError = (value: string | null, original: string | null) =>
    value !== original && value && !isValidPhoneBR(value) ? "Telefone incompleto — use DDD + número" : undefined;
  const errors = {
    phone: phoneError(form.phone, lead.phone),
    mobile: phoneError(form.mobile, lead.mobile),
    email:
      form.email !== lead.email && form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)
        ? "E-mail inválido"
        : undefined,
  };
  const dirty = JSON.stringify(form) !== JSON.stringify(lead);

  async function onSave() {
    setTouched(true);
    if (nameError || errors.phone || errors.mobile || errors.email) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("leads")
      .update({
        name: form.name.trim(),
        contact_info: form.contact_info,
        source_id: form.source_id,
        source: sources.find((s) => s.id === form.source_id)?.name ?? form.source,
        phone: form.phone || null,
        mobile: form.mobile || null,
        email: form.email?.trim() || null,
        status: form.status,
        ...(canReassign ? { owner_id: form.owner_id } : {}),
      })
      .eq("id", lead.id);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar", { description: friendlyError(error) });
      return;
    }
    toast.success("Lead atualizado");
    router.refresh();
  }

  async function onDelete() {
    const ok = await confirmDialog({
      title: "Excluir este lead?",
      description: "Essa ação não pode ser desfeita.",
      confirmLabel: "Excluir lead",
      destructive: true,
    });
    if (!ok) return;
    const supabase = createClient();
    const { error } = await supabase.from("leads").delete().eq("id", lead.id);
    if (error) {
      toast.error("Não foi possível excluir", { description: friendlyError(error) });
      return;
    }
    toast.success("Lead excluído");
    router.push("/leads");
    router.refresh();
  }

  async function onConfirmConvert() {
    if (!pipelineId || !stageId) return;
    setConvertBusy(true);
    const supabase = createClient();

    const { data: deal, error } = await supabase
      .from("deals")
      .insert({
        title: form.name,
        value: 0,
        currency: "BRL",
        pipeline_id: pipelineId,
        stage_id: stageId,
        owner_id: form.owner_id,
        source: sources.find((s) => s.id === form.source_id)?.name ?? form.source,
        status: "open",
      })
      .select("id")
      .single();

    if (error || !deal) {
      setConvertBusy(false);
      toast.error("Não foi possível converter o lead", { description: friendlyError(error) });
      return;
    }

    const [{ error: noteError }, { error: leadError }] = await Promise.all([
      supabase.from("notes").insert({
        deal_id: deal.id,
        author_id: form.owner_id,
        content: `Convertido do lead "${lead.name}"${
          [form.mobile && `smartphone: ${form.mobile}`, form.phone && `telefone: ${form.phone}`, form.email && `e-mail: ${form.email}`, form.contact_info && `contato: ${form.contact_info}`]
            .filter(Boolean)
            .join(" · ")
            ? ` — ${[form.mobile && `smartphone: ${form.mobile}`, form.phone && `telefone: ${form.phone}`, form.email && `e-mail: ${form.email}`, form.contact_info && `contato: ${form.contact_info}`].filter(Boolean).join(" · ")}`
            : ""
        }.`,
      }),
      supabase.from("leads").update({ status: "converted", converted_deal_id: deal.id }).eq("id", lead.id),
    ]);

    if (leadError) {
      toast.warning("Negócio criado, mas o lead não foi marcado como convertido", {
        description: "Marque o status do lead manualmente para evitar duplicidade.",
      });
    } else if (noteError) {
      toast.warning("Lead convertido, mas a anotação de origem não foi salva");
    } else {
      toast.success("Lead convertido em negócio");
    }
    router.push(`/deals/${deal.id}`);
  }

  if (form.status === "converted" && form.converted_deal_id) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm text-foreground">
            <CheckCircle2 className="size-4 text-success" />
            Este lead já foi convertido em negócio.
          </p>
          <Button variant="secondary" asChild>
            <Link href={`/deals/${form.converted_deal_id}`}>Ver negócio</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <Card>
        <CardHeader>
          <CardTitle>Dados do lead</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Nome" htmlFor="lead-name" required error={touched ? nameError : undefined}>
              <Input id="lead-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
            </FormField>
            <FormField label="Telefone" htmlFor="lead-phone" error={touched ? errors.phone : undefined}>
              <MaskedInput
                id="lead-phone"
                mask="phone"
                value={form.phone ?? ""}
                onChange={(e) => set("phone", e.target.value || null)}
              />
            </FormField>
            <FormField label="Smartphone" htmlFor="lead-mobile" hint="Celular / WhatsApp" error={touched ? errors.mobile : undefined}>
              <div className="flex items-center gap-2">
                <MaskedInput
                  id="lead-mobile"
                  mask="phone"
                  value={form.mobile ?? ""}
                  onChange={(e) => set("mobile", e.target.value || null)}
                />
                <WhatsAppButton phone={form.mobile} />
              </div>
            </FormField>
            <FormField label="E-mail" htmlFor="lead-email" error={touched ? errors.email : undefined}>
              <Input
                id="lead-email"
                type="email"
                value={form.email ?? ""}
                onChange={(e) => set("email", e.target.value || null)}
              />
            </FormField>
            <FormField label="Origem" htmlFor="lead-source">
              <Select
                value={form.source_id ?? NONE}
                onValueChange={(v) => set("source_id", v === NONE ? null : v)}
              >
                <SelectTrigger id="lead-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>
                    {form.source && !form.source_id ? `${form.source} (não cadastrada)` : "Não informada"}
                  </SelectItem>
                  {sources.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Responsável" htmlFor="lead-owner">
              <Select value={form.owner_id} onValueChange={(v) => set("owner_id", v)} disabled={!canReassign}>
                <SelectTrigger id="lead-owner">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {owners.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Status" htmlFor="lead-status">
              <Select value={form.status} onValueChange={(v) => set("status", v as LeadStatus)}>
                <SelectTrigger id="lead-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LEAD_STATUS_LABEL)
                    .filter(([value]) => value !== "converted")
                    .map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <Button onClick={onSave} loading={saving} disabled={!dirty}>
              Salvar alterações
            </Button>
            {dirty && (
              <Button variant="ghost" onClick={() => setForm(lead)} disabled={saving}>
                Descartar
              </Button>
            )}
            <Button variant="destructive-outline" onClick={onDelete} className="ml-auto">
              <Trash2 />
              Excluir lead
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Qualificado?</CardTitle>
          <CardDescription>Converta em negócio para acompanhar no funil de vendas.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setConverting(true)} className="w-full">
            <ArrowRightLeft />
            Converter em negócio
          </Button>
        </CardContent>
      </Card>

      <Dialog open={converting} onOpenChange={setConverting}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Converter em negócio</DialogTitle>
            <DialogDescription>
              Um negócio “{form.name}” será criado no funil escolhido, com o mesmo responsável.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <FormField label="Funil" htmlFor="convert-pipeline" required>
              <Select value={pipelineId} onValueChange={setPipelineId}>
                <SelectTrigger id="convert-pipeline">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Etapa inicial" htmlFor="convert-stage" required>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger id="convert-stage">
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
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConverting(false)}>
              Cancelar
            </Button>
            <Button onClick={onConfirmConvert} loading={convertBusy} disabled={!pipelineId || !stageId}>
              Converter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
