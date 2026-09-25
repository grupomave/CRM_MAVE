import type { PipelineDeal } from "@/components/pipeline/types";
import {
  compareValues,
  getBoolParam,
  getEnumParam,
  getNumberParam,
  getParam,
  getSortParam,
  matchesSearch,
  type RawParams,
  type SortState,
} from "./params";

export const DEAL_STATUS_LABEL: Record<PipelineDeal["status"], string> = {
  open: "Aberto",
  won: "Ganho",
  lost: "Perdido",
};

export const DEAL_STATUS_BADGE: Record<PipelineDeal["status"], "info" | "success" | "destructive"> = {
  open: "info",
  won: "success",
  lost: "destructive",
};

const STATUSES = ["all", "open", "won", "lost"] as const;
export const DEAL_SORT_KEYS = [
  "title",
  "organization",
  "stage",
  "status",
  "value",
  "owner",
  "expected_close",
  "updated_at",
] as const;
export type DealSortKey = (typeof DEAL_SORT_KEYS)[number];

export interface DealFilters {
  q: string;
  status: (typeof STATUSES)[number];
  stage: string;
  owner: string;
  source: string;
  min: number | null;
  max: number | null;
  overdue: boolean;
  noActivity: boolean;
  stagnant: boolean;
  sort: SortState<DealSortKey>;
}

export const DEFAULT_DEAL_SORT: SortState<DealSortKey> = { key: "updated_at", dir: "desc" };

// Sem parâmetro "status" na URL, a tela mostra só negócios em aberto (o
// Kanban só faz sentido para abertos — docx §3).
export function parseDealFilters(params: RawParams): DealFilters {
  return {
    q: getParam(params, "q"),
    status: getEnumParam(params, "status", STATUSES, "open"),
    stage: getParam(params, "stage"),
    owner: getParam(params, "owner"),
    source: getParam(params, "source"),
    min: getNumberParam(params, "min"),
    max: getNumberParam(params, "max"),
    overdue: getBoolParam(params, "overdue"),
    noActivity: getBoolParam(params, "noact"),
    stagnant: getBoolParam(params, "stagnant"),
    sort: getSortParam(params, DEAL_SORT_KEYS, DEFAULT_DEAL_SORT),
  };
}

export function filterDeals(rows: PipelineDeal[], f: DealFilters): PipelineDeal[] {
  return rows.filter((d) => {
    if (f.status !== "all" && d.status !== f.status) return false;
    if (f.stage && d.stage_id !== f.stage) return false;
    if (f.owner && d.owner_id !== f.owner) return false;
    if (f.source && d.source !== f.source) return false;
    if (f.min !== null && d.value < f.min) return false;
    if (f.max !== null && d.value > f.max) return false;
    if (f.overdue && !d.overdue_days) return false;
    if (f.noActivity && !d.no_upcoming_activity) return false;
    if (f.stagnant && !d.is_stagnant) return false;
    return matchesSearch(f.q, d.title, d.organization_name, d.contact_name, d.owner_name);
  });
}

export function sortDeals(
  rows: PipelineDeal[],
  sort: SortState<DealSortKey>,
  stageOrder: Map<string, number>,
): PipelineDeal[] {
  const value = (d: PipelineDeal) => {
    switch (sort.key) {
      case "title":
        return d.title;
      case "organization":
        return d.organization_name;
      case "stage":
        return stageOrder.get(d.stage_id) ?? null;
      case "status":
        return DEAL_STATUS_LABEL[d.status];
      case "value":
        return d.value;
      case "owner":
        return d.owner_name;
      case "expected_close":
        return d.expected_close_date;
      case "updated_at":
        return d.updated_at;
    }
  };
  return [...rows].sort((a, b) => compareValues(value(a), value(b), sort.dir));
}

export function applyDealFilters(
  rows: PipelineDeal[],
  f: DealFilters,
  stageOrder: Map<string, number>,
) {
  return sortDeals(filterDeals(rows, f), f.sort, stageOrder);
}
