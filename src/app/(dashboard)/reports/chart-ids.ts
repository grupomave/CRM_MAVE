// Ids estáveis usados para casar cada gráfico renderizado em
// export-charts-basket.tsx com as seções de PDF/Excel que pedem sua imagem
// (ver page.tsx e export-button.tsx). Arquivo neutro (sem "use client") para
// poder ser importado tanto do server component quanto dos client components.
export const CHART_IDS = {
  funnel: "chart-funnel",
  monthly: "chart-monthly",
  ownerWon: "chart-owner-won",
  lossReasons: "chart-loss-reasons",
  lossOwner: "chart-loss-owner",
  sourcePipeline: "chart-source-pipeline",
  regionSales: "chart-region-sales",
  leadsStatus: "chart-leads-status",
} as const;
