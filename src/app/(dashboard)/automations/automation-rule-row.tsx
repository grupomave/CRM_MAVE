"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";

const ACTION_LABEL: Record<string, string> = {
  create_activity: "Criar atividade",
  notify_user: "Notificar usuário",
  assign_owner: "Atribuir responsável",
};

export function AutomationRuleRow({
  rule,
  triggerLabel,
  stageNameById,
}: {
  rule: {
    id: string;
    trigger_event: string;
    conditions_json: Record<string, unknown>;
    actions_json: { type: string }[];
    active: boolean;
  };
  triggerLabel: string;
  stageNameById: Record<string, string>;
}) {
  const router = useRouter();
  const supabase = createClient();

  const toStageId = rule.conditions_json?.to_stage_id as string | undefined;

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">
            Quando: {triggerLabel}
            {toStageId && stageNameById[toStageId] && (
              <> → {stageNameById[toStageId]}</>
            )}
          </span>
          {toStageId && !stageNameById[toStageId] && (
            // A etapa foi excluída em Configurações (a regra é desativada junto)
            <Badge variant="warning" className="w-fit">
              Etapa excluída — edite ou remova esta regra
            </Badge>
          )}
          <div className="flex gap-1">
            {rule.actions_json?.map((a, i) => (
              <Badge key={i} variant="outline">
                {ACTION_LABEL[a.type] ?? a.type}
              </Badge>
            ))}
          </div>
        </div>
        <Switch
          checked={rule.active}
          onCheckedChange={async (checked) => {
            await supabase
              .from("automation_rules")
              .update({ active: checked })
              .eq("id", rule.id);
            router.refresh();
          }}
        />
      </CardContent>
    </Card>
  );
}
