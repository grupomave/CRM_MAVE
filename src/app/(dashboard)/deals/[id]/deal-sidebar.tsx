"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, CalendarDays, ExternalLink, Megaphone, UserRound, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { Input } from "@/components/ui/input";
import { CurrencyInput, DateInput } from "@/components/ui/masked-inputs";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { createClient } from "@/lib/supabase/client";
import { friendlyError, toast } from "@/lib/toast";
import { formatDate } from "@/lib/utils";
import { DEAL_STATUS_LABEL, LOST_REASON_LABEL } from "@/lib/supabase/types";
import type { Database } from "@/lib/supabase/types";
import { ACTIVITY_TYPE_LABEL, type DealDetail, type DealOverview, type Option } from "./types";

type DealUpdate = Database["public"]["Tables"]["deals"]["Update"];

const ACTIVITY_COLORS: Record<string, string> = {
  call: "bg-chart-1",
  meeting: "bg-chart-2",
  task: "bg-chart-3",
  email: "bg-chart-4",
};

function FieldRow({
  icon: Icon,
  label,
  htmlFor,
  children,
}: {
  icon: typeof Building2;
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="flex items-center gap-1.5 text-caption font-medium text-muted-foreground">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </label>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="numeric font-medium text-foreground">{value}</span>
    </div>
  );
}

export function DealSidebar({
  deal,
  overview,
  organizations,
  contacts,
  owners,
  canEditOwner,
}: {
  deal: DealDetail;
  overview: DealOverview;
  organizations: Option[];
  contacts: Option[];
  owners: Option[];
  canEditOwner: boolean;
}) {
  const router = useRouter();

  async function updateField(payload: DealUpdate, success?: string) {
    const supabase = createClient();
    const { error } = await supabase.from("deals").update(payload).eq("id", deal.id);
    if (error) {
      toast.error("Não foi possível salvar", { description: friendlyError(error) });
      return;
    }
    if (success) toast.success(success);
    router.refresh();
  }

  const totalActivities = Object.values(overview.activityCounts).reduce((s, n) => s + n, 0);
  const activityEntries = Object.entries(overview.activityCounts).sort((a, b) => b[1] - a[1]);

  return (
    <Card className="overflow-hidden">
      <CollapsibleSection title="Resumo">
        <div className="flex flex-col gap-4">
          <FieldRow icon={Wallet} label="Valor" htmlFor="deal-value">
            <CurrencyInput
              id="deal-value"
              value={deal.value}
              onCommit={(value) => updateField({ value: value ?? 0 }, "Valor atualizado")}
            />
          </FieldRow>

          <FieldRow icon={Building2} label="Organização" htmlFor="deal-org">
            <div className="flex items-center gap-1">
              <Combobox
                id="deal-org"
                className="min-w-0 flex-1"
                value={deal.organization_id}
                onChange={(v) => updateField({ organization_id: v }, "Organização atualizada")}
                options={organizations.map((o) => ({ value: o.id, label: o.label, description: o.description }))}
                placeholder="Vincular organização"
                searchPlaceholder="Buscar organização..."
              />
              {deal.organization_id && (
                <Link
                  href={`/contacts/organizations/${deal.organization_id}`}
                  aria-label="Abrir organização"
                  className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <ExternalLink className="size-4" />
                </Link>
              )}
            </div>
          </FieldRow>

          <FieldRow icon={UserRound} label="Pessoa de contato" htmlFor="deal-contact">
            <div className="flex items-center gap-1">
              <Combobox
                id="deal-contact"
                className="min-w-0 flex-1"
                value={deal.contact_id}
                onChange={(v) => updateField({ contact_id: v }, "Contato atualizado")}
                options={contacts.map((c) => ({ value: c.id, label: c.label, description: c.description }))}
                placeholder="Vincular pessoa"
                searchPlaceholder="Buscar pessoa..."
              />
              {deal.contact_id && (
                <Link
                  href={`/contacts/people/${deal.contact_id}`}
                  aria-label="Abrir pessoa"
                  className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <ExternalLink className="size-4" />
                </Link>
              )}
              <WhatsAppButton
                phone={deal.contacts?.whatsapp ?? deal.contacts?.phone}
                contactId={deal.contact_id ?? undefined}
                dealId={deal.id}
              />
            </div>
          </FieldRow>

          <FieldRow icon={CalendarDays} label="Previsão de fechamento" htmlFor="deal-close">
            <DateInput
              id="deal-close"
              value={deal.expected_close_date}
              onValueChange={(iso) =>
                updateField({ expected_close_date: iso || null }, "Previsão de fechamento atualizada")
              }
            />
          </FieldRow>

          <FieldRow icon={UserRound} label="Responsável" htmlFor="deal-owner">
            {canEditOwner ? (
              <Combobox
                id="deal-owner"
                value={deal.owner_id}
                allowClear={false}
                onChange={(v) => v && updateField({ owner_id: v }, "Responsável atualizado")}
                options={owners.map((o) => ({ value: o.id, label: o.label }))}
                searchPlaceholder="Buscar usuário..."
              />
            ) : (
              <span className="text-sm font-medium">{deal.profiles?.full_name ?? "—"}</span>
            )}
          </FieldRow>

          <FieldRow icon={Megaphone} label="Origem" htmlFor="deal-source">
            <Input
              id="deal-source"
              defaultValue={deal.source ?? ""}
              placeholder="Indicação, site, evento..."
              onBlur={(e) => {
                const next = e.target.value.trim() || null;
                if (next !== deal.source) updateField({ source: next }, "Origem atualizada");
              }}
            />
          </FieldRow>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Detalhes">
        <div className="flex flex-col gap-2.5">
          <Stat
            label="Status"
            value={
              <Badge variant={deal.status === "won" ? "success" : deal.status === "lost" ? "destructive" : "info"}>
                {DEAL_STATUS_LABEL[deal.status]}
              </Badge>
            }
          />
          {deal.status === "lost" && deal.lost_reason && (
            <Stat label="Motivo da perda" value={LOST_REASON_LABEL[deal.lost_reason]} />
          )}
          {deal.frozen_at && <Stat label="Congelado em" value={formatDate(deal.frozen_at)} />}
          <Stat label="Criado em" value={formatDate(deal.created_at)} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Visão geral">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2.5">
            <Stat
              label="Idade do negócio"
              value={`${overview.ageDays} ${overview.ageDays === 1 ? "dia" : "dias"}`}
            />
            <Stat
              label="Inativo há"
              value={
                overview.daysSinceLastActivity === null
                  ? "—"
                  : `${overview.daysSinceLastActivity} ${overview.daysSinceLastActivity === 1 ? "dia" : "dias"}`
              }
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-caption font-medium text-muted-foreground">Atividades por tipo</p>
            {totalActivities === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma atividade registrada.</p>
            ) : (
              <>
                <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                  {activityEntries.map(([type, count]) => (
                    <div
                      key={type}
                      className={ACTIVITY_COLORS[type] ?? "bg-chart-6"}
                      style={{ width: `${(count / totalActivities) * 100}%` }}
                    />
                  ))}
                </div>
                <ul className="flex flex-col gap-1">
                  {activityEntries.map(([type, count]) => (
                    <li key={type} className="flex items-center gap-2 text-sm">
                      <span className={`size-2 rounded-full ${ACTIVITY_COLORS[type] ?? "bg-chart-6"}`} aria-hidden />
                      <span className="flex-1 text-foreground">{ACTIVITY_TYPE_LABEL[type] ?? type}</span>
                      <span className="numeric w-6 text-right text-muted-foreground">{count}</span>
                      <span className="numeric w-10 text-right text-muted-foreground">
                        {Math.round((count / totalActivities) * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </CollapsibleSection>
    </Card>
  );
}
