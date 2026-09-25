"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRightLeft, CheckCircle2, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
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
import type { LeadStatus } from "@/lib/supabase/types";

interface Lead {
  id: string;
  name: string;
  contact_info: string | null;
  source: string | null;
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
}: {
  lead: Lead;
  pipelines: Pipeline[];
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
  const dirty = JSON.stringify(form) !== JSON.stringify(lead);

  async function onSave() {
    setTouched(true);
    if (nameError) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("leads")
      .update({
        name: form.name.trim(),
        contact_info: form.contact_info,
        source: form.source,
        status: form.status,
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
        owner_id: lead.owner_id,
        source: form.source,
        status: "open",
      })
      .select("id")
      .single();

    if (error || !deal) {
      setConvertBusy(false);
      toast.error("Não foi possível converter o lead", { description: friendlyError(error) });
      return;
    }

    await supabase.from("notes").insert({
      deal_id: deal.id,
      author_id: lead.owner_id,
      content: `Convertido do lead "${lead.name}"${form.contact_info ? ` — contato: ${form.contact_info}` : ""}.`,
    });

    await supabase
      .from("leads")
      .update({ status: "converted", converted_deal_id: deal.id })
      .eq("id", lead.id);

    toast.success("Lead convertido em negócio");
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
            <FormField label="Contato" htmlFor="lead-contact" hint="E-mail ou telefone">
              <Input
                id="lead-contact"
                value={form.contact_info ?? ""}
                onChange={(e) => set("contact_info", e.target.value || null)}
              />
            </FormField>
            <FormField label="Origem" htmlFor="lead-source">
              <Input
                id="lead-source"
                placeholder="Site, indicação, evento..."
                value={form.source ?? ""}
                onChange={(e) => set("source", e.target.value || null)}
              />
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
