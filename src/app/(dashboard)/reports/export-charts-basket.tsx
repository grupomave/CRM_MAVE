"use client";

// Renderiza uma cópia de cada gráfico fora da tela, sempre montada
// independentemente da aba ativa. É daqui que os botões de exportação (geral
// e por aba) tiram os PNGs via html2canvas — como o Radix Tabs desmonta o
// conteúdo das abas inativas, não dá pra depender do gráfico "visível".
import {
  StageFunnelChart,
  MonthlyTrendChart,
  OwnerWonChart,
  LossReasonsChart,
  LossByOwnerChart,
} from "./reports-charts";
import { SourcePipelineChart } from "./reports-pipeline";
import { RegionSalesChart } from "./reports-sales";
import { LeadsStatusChart } from "./reports-leads";
import { CHART_IDS } from "./chart-ids";

function Hidden({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div id={id} style={{ width: 640 }}>
      {children}
    </div>
  );
}

export function ExportChartsBasket({
  funnelData,
  monthlyData,
  ownerWonChartData,
  lossReasonsData,
  lossByOwnerData,
  pipelineBySourceData,
  salesByRegionData,
  leadsByStatusData,
}: {
  funnelData: { stage: string; total: number }[];
  monthlyData: { month: string; criados: number; ganhos: number; perdidos: number }[];
  ownerWonChartData: { owner: string; won: number }[];
  lossReasonsData: { reason: string; total: number }[];
  lossByOwnerData: { owner: string; lost: number }[];
  pipelineBySourceData: { source: string; value: number }[];
  salesByRegionData: { region: string; value: number }[];
  leadsByStatusData: { status: string; total: number }[];
}) {
  // Importante para o html2canvas: nada de `position: fixed` com offset
  // gigantesco (ele tenta renderizar a área inteira até o elemento e gera
  // capturas enormes). Em vez disso, os gráficos ficam em coordenadas normais
  // (0,0) dentro de um wrapper 0x0 com overflow:hidden, que os esconde
  // visualmente sem confundir o cálculo de canvas.
  return (
    <div aria-hidden style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0 }}>
        <Hidden id={CHART_IDS.funnel}>
          <StageFunnelChart data={funnelData} />
        </Hidden>
        <Hidden id={CHART_IDS.monthly}>
          <MonthlyTrendChart data={monthlyData} />
        </Hidden>
        <Hidden id={CHART_IDS.ownerWon}>
          <OwnerWonChart data={ownerWonChartData} />
        </Hidden>
        <Hidden id={CHART_IDS.lossReasons}>
          <LossReasonsChart data={lossReasonsData} />
        </Hidden>
        <Hidden id={CHART_IDS.lossOwner}>
          <LossByOwnerChart data={lossByOwnerData} />
        </Hidden>
        <Hidden id={CHART_IDS.sourcePipeline}>
          <SourcePipelineChart data={pipelineBySourceData} />
        </Hidden>
        <Hidden id={CHART_IDS.regionSales}>
          <RegionSalesChart data={salesByRegionData} />
        </Hidden>
        <Hidden id={CHART_IDS.leadsStatus}>
          <LeadsStatusChart data={leadsByStatusData} />
        </Hidden>
      </div>
    </div>
  );
}
