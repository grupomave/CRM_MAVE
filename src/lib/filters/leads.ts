import type { LeadStatus } from "@/lib/supabase/types";
import {
  compareValues,
  getEnumParam,
  getParam,
  getSortParam,
  matchesSearch,
  type RawParams,
  type SortState,
} from "./params";

export interface LeadRow {
  id: string;
  name: string;
  contact_info: string | null;
  source: string | null;
  status: LeadStatus;
  created_at: string;
  owner_id: string;
  owner_name: string | null;
}

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "Novo",
  contacted: "Contatado",
  qualified: "Qualificado",
  disqualified: "Desqualificado",
  converted: "Convertido",
};

export const LEAD_STATUS_BADGE: Record<
  LeadStatus,
  "info" | "warning" | "success" | "neutral" | "default"
> = {
  new: "info",
  contacted: "default",
  qualified: "success",
  disqualified: "neutral",
  converted: "success",
};

const STATUSES = ["all", "new", "contacted", "qualified", "disqualified", "converted"] as const;
export const LEAD_SORT_KEYS = ["name", "status", "source", "owner", "created_at"] as const;
export type LeadSortKey = (typeof LEAD_SORT_KEYS)[number];

export interface LeadFilters {
  q: string;
  status: (typeof STATUSES)[number];
  source: string;
  owner: string;
  sort: SortState<LeadSortKey>;
}

export const DEFAULT_LEAD_SORT: SortState<LeadSortKey> = { key: "created_at", dir: "desc" };

export function parseLeadFilters(params: RawParams): LeadFilters {
  return {
    q: getParam(params, "q"),
    status: getEnumParam(params, "status", STATUSES, "all"),
    source: getParam(params, "source"),
    owner: getParam(params, "owner"),
    sort: getSortParam(params, LEAD_SORT_KEYS, DEFAULT_LEAD_SORT),
  };
}

export function applyLeadFilters(rows: LeadRow[], f: LeadFilters): LeadRow[] {
  const filtered = rows.filter((l) => {
    if (f.status !== "all" && l.status !== f.status) return false;
    if (f.source && l.source !== f.source) return false;
    if (f.owner && l.owner_id !== f.owner) return false;
    return matchesSearch(f.q, l.name, l.contact_info, l.source);
  });

  const value = (l: LeadRow) => {
    switch (f.sort.key) {
      case "name":
        return l.name;
      case "status":
        return LEAD_STATUS_LABEL[l.status];
      case "source":
        return l.source;
      case "owner":
        return l.owner_name;
      case "created_at":
        return l.created_at;
    }
  };
  return filtered.sort((a, b) => compareValues(value(a), value(b), f.sort.dir));
}
