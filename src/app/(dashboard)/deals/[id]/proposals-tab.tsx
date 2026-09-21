"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { formatCurrencyBRL, uniqueSuffix } from "@/lib/utils";
import { PROPOSAL_STATUS_LABEL, type ProposalStatus } from "@/lib/supabase/types";

interface ProposalVersion {
  id: string;
  proposal_id: string;
  version_number: number;
  value: number;
  scope: string | null;
  conditions: string | null;
  file_name: string | null;
  storage_path: string | null;
  created_at: string;
  profiles: { full_name: string } | null;
}

interface Proposal {
  id: string;
  status: ProposalStatus;
  valid_until: string | null;
  requires_approval: boolean;
  approved_at: string | null;
  approved_by_name: string | null;
  created_at: string;
  versions: ProposalVersion[];
}

export function ProposalsTab({
  dealId,
  proposals,
}: {
  dealId: string;
  proposals: Proposal[];
}) {
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  return (
    <div className="flex flex-col gap-3">
      {!creating ? (
        <Button className="self-start" onClick={() => setCreating(true)}>
          Nova proposta
        </Button>
      ) : (
        <NewProposalForm
          dealId={dealId}
          onDone={() => {
            setCreating(false);
            router.refresh();
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {proposals.map((p) => (
        <ProposalCard key={p.id} proposal={p} onChanged={() => router.refresh()} />
      ))}

      {proposals.length === 0 && !creating && (
        <p className="text-sm text-muted-foreground">
          Nenhuma proposta criada para este negócio.
        </p>
      )}
    </div>
  );
}

function NewProposalForm({
  dealId,
  onDone,
  onCancel,
}: {
  dealId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const supabase = createClient();
  const [value, setValue] = useState("0");
  const [scope, setScope] = useState("");
  const [conditions, setConditions] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setSaving(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Sessão expirada.");
      setSaving(false);
      return;
    }

    const { data: proposal, error: proposalError } = await supabase
      .from("proposals")
      .insert({
        deal_id: dealId,
        valid_until: validUntil || null,
        requires_approval: requiresApproval,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (proposalError || !proposal) {
      setError("Não foi possível criar a proposta.");
      setSaving(false);
      return;
    }

    let storagePath: string | null = null;
    if (file) {
      storagePath = `proposal/${proposal.id}/1-${uniqueSuffix()}-${file.name}`;
      await supabase.storage.from("attachments").upload(storagePath, file);
    }

    const { data: version, error: versionError } = await supabase
      .from("proposal_versions")
      .insert({
        proposal_id: proposal.id,
        version_number: 1,
        value: Number(value) || 0,
        scope: scope || null,
        conditions: conditions || null,
        file_name: file?.name ?? null,
        storage_path: storagePath,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (!versionError && version) {
      await supabase
        .from("proposals")
        .update({ current_version_id: version.id })
        .eq("id", proposal.id);
    }

    setSaving(false);
    onDone();
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Valor</Label>
            <Input type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Validade</Label>
            <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Escopo</Label>
          <Textarea value={scope} onChange={(e) => setScope(e.target.value)} rows={2} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Condições</Label>
          <Textarea value={conditions} onChange={(e) => setConditions(e.target.value)} rows={2} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Arquivo (opcional)</Label>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            checked={requiresApproval}
            onCheckedChange={(v) => setRequiresApproval(v === true)}
          />
          <Label className="font-normal">Exige aprovação interna antes do envio</Label>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button onClick={onSubmit} disabled={saving}>
            {saving ? "Criando..." : "Criar proposta"}
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ProposalCard({
  proposal,
  onChanged,
}: {
  proposal: Proposal;
  onChanged: () => void;
}) {
  const supabase = createClient();
  const [addingVersion, setAddingVersion] = useState(false);
  const latest = proposal.versions[0];

  const now = new Date();
  const isExpired = proposal.valid_until && new Date(proposal.valid_until) < now;
  const isExpiringSoon =
    proposal.valid_until &&
    !isExpired &&
    new Date(proposal.valid_until).getTime() - now.getTime() < 7 * 86400000;

  async function updateStatus(status: ProposalStatus) {
    await supabase.from("proposals").update({ status }).eq("id", proposal.id);
    onChanged();
  }

  async function approve() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("proposals")
      .update({ approved_by: user.id, approved_at: new Date().toISOString() })
      .eq("id", proposal.id);
    onChanged();
  }

  async function download(path: string, name: string) {
    const { data } = await supabase.storage.from("attachments").createSignedUrl(path, 60);
    if (data?.signedUrl) {
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = name;
      a.click();
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-primary">
              {formatCurrencyBRL(latest?.value ?? 0)}
            </span>
            <Badge variant="outline">v{latest?.version_number ?? 1}</Badge>
            {proposal.valid_until && (
              <Badge variant={isExpired ? "destructive" : isExpiringSoon ? "warning" : "outline"}>
                Válida até {new Date(proposal.valid_until).toLocaleDateString("pt-BR")}
              </Badge>
            )}
          </div>
          <Select value={proposal.status} onValueChange={(v) => updateStatus(v as ProposalStatus)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PROPOSAL_STATUS_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {proposal.requires_approval && (
          <div className="flex items-center gap-2 text-sm">
            {proposal.approved_at ? (
              <Badge variant="success">
                Aprovada por {proposal.approved_by_name ?? "—"} em{" "}
                {new Date(proposal.approved_at).toLocaleDateString("pt-BR")}
              </Badge>
            ) : (
              <>
                <Badge variant="warning">Aguardando aprovação interna</Badge>
                <Button size="sm" variant="outline" onClick={approve}>
                  Aprovar
                </Button>
              </>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          {proposal.versions.map((v) => (
            <div
              key={v.id}
              className="flex flex-col gap-1 rounded-md border border-border p-2 text-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  v{v.version_number} — {formatCurrencyBRL(v.value)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {v.profiles?.full_name ?? "—"} em{" "}
                  {new Date(v.created_at).toLocaleDateString("pt-BR")}
                </span>
              </div>
              {v.scope && <p className="text-xs text-muted-foreground">Escopo: {v.scope}</p>}
              {v.conditions && (
                <p className="text-xs text-muted-foreground">Condições: {v.conditions}</p>
              )}
              {v.storage_path && v.file_name && (
                <button
                  className="flex w-fit items-center gap-1 text-xs text-primary hover:underline"
                  onClick={() => download(v.storage_path!, v.file_name!)}
                >
                  <FileText className="size-3" />
                  {v.file_name}
                  <Download className="size-3" />
                </button>
              )}
            </div>
          ))}
        </div>

        {!addingVersion ? (
          <Button variant="outline" size="sm" className="self-start" onClick={() => setAddingVersion(true)}>
            Nova versão
          </Button>
        ) : (
          <NewVersionForm
            proposalId={proposal.id}
            nextVersion={(proposal.versions[0]?.version_number ?? 0) + 1}
            onDone={() => {
              setAddingVersion(false);
              onChanged();
            }}
            onCancel={() => setAddingVersion(false)}
          />
        )}
      </CardContent>
    </Card>
  );
}

function NewVersionForm({
  proposalId,
  nextVersion,
  onDone,
  onCancel,
}: {
  proposalId: string;
  nextVersion: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const supabase = createClient();
  const [value, setValue] = useState("0");
  const [scope, setScope] = useState("");
  const [conditions, setConditions] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit() {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    let storagePath: string | null = null;
    if (file) {
      storagePath = `proposal/${proposalId}/${nextVersion}-${uniqueSuffix()}-${file.name}`;
      await supabase.storage.from("attachments").upload(storagePath, file);
    }

    const { data: version } = await supabase
      .from("proposal_versions")
      .insert({
        proposal_id: proposalId,
        version_number: nextVersion,
        value: Number(value) || 0,
        scope: scope || null,
        conditions: conditions || null,
        file_name: file?.name ?? null,
        storage_path: storagePath,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (version) {
      await supabase
        .from("proposals")
        .update({ current_version_id: version.id })
        .eq("id", proposalId);
    }

    setSaving(false);
    onDone();
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Input
          type="number"
          step="0.01"
          placeholder="Valor"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </div>
      <Textarea placeholder="Escopo" value={scope} onChange={(e) => setScope(e.target.value)} rows={2} />
      <Textarea
        placeholder="Condições"
        value={conditions}
        onChange={(e) => setConditions(e.target.value)}
        rows={2}
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={onSubmit} disabled={saving}>
          {saving ? "Salvando..." : `Salvar v${nextVersion}`}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
