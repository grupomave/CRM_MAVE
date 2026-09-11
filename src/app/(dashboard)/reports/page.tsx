import { createClient } from "@/lib/supabase/server";
import { FunnelChart, OwnerPerformanceChart } from "./reports-charts";

export default async function ReportsPage() {
  const supabase = await createClient();

  const [stagesRes, dealsRes, wonDealsRes] = await Promise.all([
    supabase.from("pipeline_stages").select("id, name, order_index").order("order_index"),
    supabase.from("deals").select("stage_id, value, status").eq("status", "open"),
    supabase
      .from("deals")
      .select("value, profiles ( full_name )")
      .eq("status", "won"),
  ]);

  const stages = stagesRes.data ?? [];
  const deals = dealsRes.data ?? [];

  const funnelData = stages.map((s) => ({
    stage: s.name,
    total: deals
      .filter((d) => d.stage_id === s.id)
      .reduce((sum, d) => sum + (d.value ?? 0), 0),
  }));

  const wonByOwner = new Map<string, number>();
  for (const d of (wonDealsRes.data ?? []) as any[]) {
    const owner = d.profiles?.full_name ?? "—";
    wonByOwner.set(owner, (wonByOwner.get(owner) ?? 0) + (d.value ?? 0));
  }
  const ownerData = Array.from(wonByOwner.entries()).map(([owner, won]) => ({
    owner,
    won,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          Relatórios / Insights
        </h1>
        <p className="text-sm text-muted-foreground">
          Funil de conversão e desempenho por vendedor
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FunnelChart data={funnelData} />
        <OwnerPerformanceChart data={ownerData} />
      </div>
    </div>
  );
}
