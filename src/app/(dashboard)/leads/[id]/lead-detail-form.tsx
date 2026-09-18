"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import type { LeadStatus } from "@/lib/supabase/types";

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "Novo",
  contacted: "Contatado",
  qualified: "Qualificado",
  disqualified: "Desqualificado",
  converted: "Convertido",
};

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
  const [saved, setSaved] = useState(false);
  const [converting, setConverting] = useState(false);
  const [pipelineId, setPipelineId] = useState(
    pipelines.find((p) => p.is_default)?.id ?? pipelines[0]?.id ?? "",
  );
  const [stages, setStages] = useState<{ id: string; name: string }[]>([]);
  const [stageId, setStageId] = useState("");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (!converting || !pipelineId) return;
    (async () => {
      const { data } = await supabase
        .from("pipeline_stages")
        .select("id, name")
        .eq("pipeline_id", pipelineId)
        .order("order_index");
      setStages(data ?? []);
      setStageId(data?.[0]?.id ?? "");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [converting, pipelineId]);

  function set<K extends keyof Lead>(key: K, value: Lead[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSave() {
    setSaving(true);
    const { error } = await supabase
      .from("leads")
      .update({
        name: form.name.trim() || lead.name,
        contact_info: form.contact_info,
        source: form.source,
        status: form.status,
      })
      .eq("id", lead.id);
    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    }
  }

  async function onDelete() {
    if (!window.confirm("Excluir este lead? Essa ação não pode ser desfeita.")) return;
    await supabase.from("leads").delete().eq("id", lead.id);
    router.push("/leads");
    router.refresh();
  }

  async function onConfirmConvert() {
    if (!pipelineId || !stageId) return;

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

    if (error || !deal) return;

    await supabase.from("notes").insert({
      deal_id: deal.id,
      author_id: lead.owner_id,
      content: `Convertido do lead "${lead.name}"${form.contact_info ? ` — contato: ${form.contact_info}` : ""}.`,
    });

    await supabase
      .from("leads")
      .update({ status: "converted", converted_deal_id: deal.id })
      .eq("id", lead.id);

    router.push(`/deals/${deal.id}`);
  }

  if (form.status === "converted" && form.converted_deal_id) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          <p className="text-sm text-foreground">
            Este lead já foi convertido em negócio.
          </p>
          <Link href={`/deals/${form.converted_deal_id}`}>
            <Button variant="outline">Ver negócio</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Nome</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Contato (e-mail/telefone)</Label>
            <Input
              value={form.contact_info ?? ""}
              onChange={(e) => set("contact_info", e.target.value || null)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Origem</Label>
            <Input
              value={form.source ?? ""}
              onChange={(e) => set("source", e.target.value || null)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v as LeadStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABEL)
                  .filter(([value]) => value !== "converted")
                  .map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={onSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
          {saved && <span className="text-sm text-success">Salvo!</span>}
          <Button variant="destructive" onClick={onDelete} className="ml-auto">
            Excluir lead
          </Button>
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-4">
          {!converting ? (
            <Button variant="outline" onClick={() => setConverting(true)} className="self-start">
              Converter em negócio
            </Button>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1.5">
                <Label>Funil</Label>
                <Select value={pipelineId} onValueChange={setPipelineId}>
                  <SelectTrigger className="w-56">
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
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Etapa inicial</Label>
                <Select value={stageId} onValueChange={setStageId}>
                  <SelectTrigger className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={onConfirmConvert}>Confirmar conversão</Button>
              <Button variant="ghost" onClick={() => setConverting(false)}>
                Cancelar
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
