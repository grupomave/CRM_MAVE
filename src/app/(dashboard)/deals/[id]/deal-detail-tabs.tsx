"use client";

import { useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  User as UserIcon,
  AlertTriangle,
  Snowflake,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NewActivityDialog } from "@/components/forms/new-activity-dialog";
import { EntityFilesTab, type EntityAttachment } from "@/components/entity-files-tab";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { ProposalsTab } from "./proposals-tab";
import { DealReportButton } from "./deal-report-button";
import { createClient } from "@/lib/supabase/client";
import {
  LOST_REASON_LABEL,
  DEAL_STATUS_LABEL,
  type LostReason,
} from "@/lib/supabase/types";
import type { DealAlerts } from "@/lib/deal-alerts";

interface Deal {
  id: string;
  title: string;
  value: number;
  currency: string;
  status: string;
  expected_close_date: string | null;
  source: string | null;
  stage_id: string;
  pipeline_id: string;
  organization_id: string | null;
  contact_id: string | null;
  owner_id: string;
  lost_reason: LostReason | null;
  frozen_at: string | null;
  organizations: { id: string; name: string } | null;
  contacts: { id: string; name: string; phone: string | null; whatsapp: string | null } | null;
  profiles: { full_name: string } | null;
}

interface Option {
  id: string;
  name?: string;
  full_name?: string;
}

interface Stage {
  id: string;
  name: string;
  order_index: number;
}

interface Activity {
  id: string;
  type: string;
  subject: string;
  due_date: string | null;
  done: boolean;
}

interface Note {
  id: string;
  content: string;
  created_at: string;
  profiles: { full_name: string } | null;
}

type Attachment = EntityAttachment;

interface HistoryEntry {
  id: string;
  kind: "stage" | "status";
  label: string;
  changed_at: string;
  profiles: { full_name: string } | null;
}

interface DealOverviewStats {
  ageDays: number;
  daysSinceLastActivity: number | null;
  activityCounts: Record<string, number>;
}

const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  task: "Tarefa",
  call: "Ligação",
  meeting: "Reunião",
  email: "E-mail",
};

export function DealDetailTabs({
  deal,
  alerts,
  overview,
  stages,
  activities,
  notes,
  attachments,
  history,
  organizations,
  contacts,
  owners,
  canEditOwner,
  proposals,
}: {
  deal: Deal;
  alerts: DealAlerts;
  overview: DealOverviewStats;
  stages: Stage[];
  activities: Activity[];
  notes: Note[];
  attachments: Attachment[];
  history: HistoryEntry[];
  organizations: Option[];
  contacts: Option[];
  owners: Option[];
  canEditOwner: boolean;
  proposals: ComponentProps<typeof ProposalsTab>["proposals"];
}) {
  const router = useRouter();
  const supabase = createClient();

  async function updateDealField(field: string, value: string | null) {
    const payload: Record<string, string | null> = { [field]: value };
    await supabase
      .from("deals")
      .update(payload as any)
      .eq("id", deal.id);
    router.refresh();
  }

  async function updateDealValue(raw: string) {
    const parsed = Number(raw.replace(",", "."));
    if (Number.isNaN(parsed) || parsed < 0) return;
    await supabase.from("deals").update({ value: parsed }).eq("id", deal.id);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-foreground">{deal.title}</h1>
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-semibold text-primary">R$</span>
            <Input
              type="number"
              step="0.01"
              min={0}
              defaultValue={deal.value}
              className="h-8 w-40 border-none bg-transparent px-1 text-lg font-semibold text-primary shadow-none focus-visible:ring-1"
              onBlur={(e) => updateDealValue(e.target.value)}
            />
          </div>
        </div>
        <Select
          value={deal.stage_id}
          onValueChange={async (value) => {
            await supabase.from("deals").update({ stage_id: value }).eq("id", deal.id);
            router.refresh();
          }}
        >
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

      {(alerts.overdueDays || alerts.noUpcomingActivity || alerts.isStagnant) && (
        <div className="flex flex-wrap gap-1">
          {alerts.overdueDays && (
            <Badge variant="destructive">
              Atrasado há {alerts.overdueDays}{" "}
              {alerts.overdueDays === 1 ? "dia" : "dias"}
            </Badge>
          )}
          {alerts.noUpcomingActivity && (
            <Badge variant="warning">
              <AlertTriangle className="size-3" />
              Sem próxima atividade
            </Badge>
          )}
          {alerts.isStagnant && (
            <Badge variant="stagnant">
              <Snowflake className="size-3" />
              Estagnado
            </Badge>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <DealActions deal={deal} onChanged={() => router.refresh()} />
        <DealReportButton
          data={{
            deal: {
              title: deal.title,
              value: deal.value,
              status: deal.status,
              expected_close_date: deal.expected_close_date,
              source: deal.source,
              lost_reason: deal.lost_reason,
              organizations: deal.organizations,
              contacts: deal.contacts,
              profiles: deal.profiles,
            },
            activities,
            attachments,
          }}
        />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="activities">Atividades</TabsTrigger>
          <TabsTrigger value="proposals">Propostas</TabsTrigger>
          <TabsTrigger value="notes">Notas</TabsTrigger>
          <TabsTrigger value="files">Arquivos</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex flex-col gap-4">
          <Card>
            <CardContent className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
              <Field label="Idade do negócio" value={`${overview.ageDays} ${overview.ageDays === 1 ? "dia" : "dias"}`} />
              <Field
                label="Sem atividade há"
                value={
                  overview.daysSinceLastActivity == null
                    ? "—"
                    : `${overview.daysSinceLastActivity} ${overview.daysSinceLastActivity === 1 ? "dia" : "dias"}`
                }
              />
              {Object.keys(overview.activityCounts).length === 0 ? (
                <div className="col-span-2 flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">Atividades</span>
                  <span className="text-sm text-muted-foreground">Nenhuma registrada</span>
                </div>
              ) : (
                <div className="col-span-2 flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">Atividades por tipo</span>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(overview.activityCounts).map(([type, count]) => (
                      <Badge key={type} variant="outline">
                        {ACTIVITY_TYPE_LABEL[type] ?? type}: {count}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Organização</span>
                <div className="flex items-center gap-1.5">
                  <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                  <Select
                    value={deal.organization_id ?? "none"}
                    onValueChange={(v) =>
                      updateDealField("organization_id", v === "none" ? null : v)
                    }
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Nenhuma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {organizations.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {deal.organization_id && (
                    <Link
                      href={`/contacts/organizations/${deal.organization_id}`}
                      className="text-xs text-primary hover:underline"
                    >
                      abrir
                    </Link>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Contato</span>
                <div className="flex items-center gap-1.5">
                  <UserIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  <Select
                    value={deal.contact_id ?? "none"}
                    onValueChange={(v) =>
                      updateDealField("contact_id", v === "none" ? null : v)
                    }
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Nenhum" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {contacts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {deal.contact_id && (
                    <Link
                      href={`/contacts/people/${deal.contact_id}`}
                      className="text-xs text-primary hover:underline"
                    >
                      abrir
                    </Link>
                  )}
                  <WhatsAppButton
                    phone={deal.contacts?.whatsapp ?? deal.contacts?.phone}
                    contactId={deal.contact_id ?? undefined}
                    dealId={deal.id}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Responsável</span>
                {canEditOwner ? (
                  <Select
                    value={deal.owner_id}
                    onValueChange={(v) => updateDealField("owner_id", v)}
                  >
                    <SelectTrigger className="h-8 text-sm">
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
                ) : (
                  <span className="text-sm font-medium">
                    {deal.profiles?.full_name ?? "—"}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Origem</span>
                <Input
                  defaultValue={deal.source ?? ""}
                  placeholder="Indicação, site..."
                  className="h-8 text-sm"
                  onBlur={(e) => updateDealField("source", e.target.value || null)}
                />
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">
                  Previsão de fechamento
                </span>
                <Input
                  type="date"
                  defaultValue={deal.expected_close_date ?? ""}
                  className="h-8 text-sm"
                  onChange={(e) =>
                    updateDealField("expected_close_date", e.target.value || null)
                  }
                />
              </div>

              <Field
                label="Status"
                value={
                  DEAL_STATUS_LABEL[deal.status as "open" | "won" | "lost"] ??
                  deal.status
                }
              />
              {deal.status === "lost" && deal.lost_reason && (
                <Field
                  label="Motivo da perda"
                  value={LOST_REASON_LABEL[deal.lost_reason]}
                />
              )}
              {deal.frozen_at && (
                <Field
                  label="Congelado em"
                  value={new Date(deal.frozen_at).toLocaleDateString("pt-BR")}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activities">
          <div className="flex flex-col gap-3">
            <NewActivityDialog
              trigger={<Button className="self-start">Nova atividade</Button>}
              dealId={deal.id}
              onCreated={() => router.refresh()}
            />
            <div className="flex flex-col gap-2">
              {activities.map((a) => (
                <Card key={a.id}>
                  <CardContent className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{a.type}</Badge>
                      <span className="text-sm">{a.subject}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {a.due_date && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(a.due_date).toLocaleString("pt-BR")}
                        </span>
                      )}
                      {a.done && <Badge variant="success">concluída</Badge>}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {activities.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma atividade vinculada a este negócio.
                </p>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="proposals">
          <ProposalsTab dealId={deal.id} proposals={proposals} />
        </TabsContent>

        <TabsContent value="notes">
          <NotesTab dealId={deal.id} notes={notes} />
        </TabsContent>

        <TabsContent value="files">
          <EntityFilesTab entityType="deal" entityId={deal.id} attachments={attachments} />
        </TabsContent>

        <TabsContent value="history">
          <div className="flex flex-col gap-2">
            {history.map((h) => (
              <Card key={h.id}>
                <CardContent className="flex items-center justify-between p-3 text-sm">
                  <span className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {h.kind === "stage" ? "Etapa" : "Status"}
                    </Badge>
                    {h.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {h.profiles?.full_name ?? "—"} em{" "}
                    {new Date(h.changed_at).toLocaleString("pt-BR")}
                  </span>
                </CardContent>
              </Card>
            ))}
            {history.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhuma mudança de estágio registrada ainda.
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DealActions({
  deal,
  onChanged,
}: {
  deal: Deal;
  onChanged: () => void;
}) {
  const supabase = createClient();
  const [pickingLostReason, setPickingLostReason] = useState(false);
  const [lostReason, setLostReason] = useState<LostReason | "">("");
  const [busy, setBusy] = useState(false);

  async function changeStatus(
    toStatus: "open" | "won" | "lost",
    reason?: LostReason,
  ) {
    setBusy(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase
      .from("deals")
      .update({
        status: toStatus,
        lost_reason: toStatus === "lost" ? reason ?? null : null,
      })
      .eq("id", deal.id);

    if (user) {
      await supabase.from("deal_status_history").insert({
        deal_id: deal.id,
        from_status: deal.status as "open" | "won" | "lost",
        to_status: toStatus,
        reason: toStatus === "lost" ? reason ?? null : null,
        changed_by: user.id,
      });
    }

    setBusy(false);
    setPickingLostReason(false);
    setLostReason("");
    onChanged();
  }

  async function toggleFrozen() {
    setBusy(true);
    await supabase
      .from("deals")
      .update({ frozen_at: deal.frozen_at ? null : new Date().toISOString() })
      .eq("id", deal.id);
    setBusy(false);
    onChanged();
  }

  if (pickingLostReason) {
    return (
      <Card>
        <CardContent className="flex flex-wrap items-end gap-2 p-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Motivo da perda</span>
            <Select
              value={lostReason}
              onValueChange={(v) => setLostReason(v as LostReason)}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LOST_REASON_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="destructive"
            disabled={!lostReason || busy}
            onClick={() => changeStatus("lost", lostReason as LostReason)}
          >
            Confirmar perda
          </Button>
          <Button variant="ghost" onClick={() => setPickingLostReason(false)}>
            Cancelar
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {deal.status === "open" && (
        <>
          <Button
            className="bg-success text-success-foreground hover:brightness-95"
            disabled={busy}
            onClick={() => changeStatus("won")}
          >
            Marcar como Ganho
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={() => setPickingLostReason(true)}
          >
            Marcar como Perdido
          </Button>
          <Button variant="outline" disabled={busy} onClick={toggleFrozen}>
            {deal.frozen_at ? "Reativar negócio" : "Congelar negócio"}
          </Button>
        </>
      )}
      {deal.status === "lost" && (
        <Button variant="outline" disabled={busy} onClick={() => changeStatus("open")}>
          Reabrir negócio
        </Button>
      )}
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  value,
}: {
  icon?: typeof Building2;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 text-sm font-medium">
        {Icon && <Icon className="size-3.5 text-muted-foreground" />}
        {value}
      </span>
    </div>
  );
}

function NotesTab({ dealId, notes }: { dealId: string; notes: Note[] }) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function addNote() {
    if (!content.trim()) return;
    setSubmitting(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("notes").insert({
        content,
        deal_id: dealId,
        author_id: user.id,
      });
      setContent("");
      router.refresh();
    }
    setSubmitting(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Textarea
          placeholder="Escreva uma nota..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <Button className="self-end" disabled={submitting} onClick={addNote}>
          {submitting ? "Salvando..." : "Adicionar nota"}
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        {notes.map((n) => (
          <Card key={n.id}>
            <CardContent className="flex flex-col gap-1 p-3">
              <p className="text-sm">{n.content}</p>
              <span className="text-xs text-muted-foreground">
                {n.profiles?.full_name ?? "—"} em{" "}
                {new Date(n.created_at).toLocaleString("pt-BR")}
              </span>
            </CardContent>
          </Card>
        ))}
        {notes.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma nota ainda.</p>
        )}
      </div>
    </div>
  );
}

