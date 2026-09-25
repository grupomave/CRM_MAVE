import { createClient } from "@/lib/supabase/server";
import { AutomationsToolbar } from "./automations-toolbar";
import { AutomationRuleRow } from "./automation-rule-row";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Automações" };

const TRIGGER_LABEL: Record<string, string> = {
  deal_stage_changed: "Negócio muda de estágio",
  deal_created: "Negócio criado",
  activity_overdue: "Atividade atrasada",
};

export default async function AutomationsPage() {
  const supabase = await createClient();
  const [rulesRes, stagesRes] = await Promise.all([
    supabase
      .from("automation_rules")
      .select("id, trigger_event, conditions_json, actions_json, active"),
    supabase.from("pipeline_stages").select("id, name"),
  ]);

  const stageNameById = new Map(
    (stagesRes.data ?? []).map((s) => [s.id, s.name]),
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Automações"
        description="Regras “quando X acontece, faça Y”"
        actions={<AutomationsToolbar />}
      />

      <div className="flex flex-col gap-2">
        {(rulesRes.data ?? []).map((rule) => (
          <AutomationRuleRow
            key={rule.id}
            rule={rule as any}
            triggerLabel={TRIGGER_LABEL[rule.trigger_event] ?? rule.trigger_event}
            stageNameById={Object.fromEntries(stageNameById)}
          />
        ))}
        {(rulesRes.data ?? []).length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhuma automação criada ainda.
          </p>
        )}
      </div>
    </div>
  );
}
