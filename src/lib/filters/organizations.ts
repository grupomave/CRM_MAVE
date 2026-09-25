import {
  compareValues,
  getBoolParam,
  getParam,
  getSortParam,
  matchesSearch,
  type RawParams,
  type SortState,
} from "./params";

export interface OrganizationRow {
  id: string;
  name: string;
  cnpj: string | null;
  sector: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  created_at: string;
  owner_id: string;
  owner_name: string | null;
  contacts_count: number;
  open_deals_count: number;
  open_deals_value: number;
  won_deals_value: number;
}

export const ORGANIZATION_SORT_KEYS = [
  "name",
  "sector",
  "city",
  "owner",
  "contacts",
  "open_value",
  "won_value",
  "created_at",
] as const;
export type OrganizationSortKey = (typeof ORGANIZATION_SORT_KEYS)[number];

export interface OrganizationFilters {
  q: string;
  owner: string;
  state: string;
  sector: string;
  withOpenDeals: boolean;
  sort: SortState<OrganizationSortKey>;
}

export const DEFAULT_ORGANIZATION_SORT: SortState<OrganizationSortKey> = {
  key: "name",
  dir: "asc",
};

export function parseOrganizationFilters(params: RawParams): OrganizationFilters {
  return {
    q: getParam(params, "q"),
    owner: getParam(params, "owner"),
    state: getParam(params, "uf"),
    sector: getParam(params, "sector"),
    withOpenDeals: getBoolParam(params, "open"),
    sort: getSortParam(params, ORGANIZATION_SORT_KEYS, DEFAULT_ORGANIZATION_SORT),
  };
}

export function applyOrganizationFilters(
  rows: OrganizationRow[],
  f: OrganizationFilters,
): OrganizationRow[] {
  const filtered = rows.filter((o) => {
    if (f.owner && o.owner_id !== f.owner) return false;
    if (f.state && o.state !== f.state) return false;
    if (f.sector && o.sector !== f.sector) return false;
    if (f.withOpenDeals && o.open_deals_count === 0) return false;
    return matchesSearch(f.q, o.name, o.cnpj, o.sector, o.city, o.state, o.owner_name);
  });

  const value = (o: OrganizationRow) => {
    switch (f.sort.key) {
      case "name":
        return o.name;
      case "sector":
        return o.sector;
      case "city":
        return o.city;
      case "owner":
        return o.owner_name;
      case "contacts":
        return o.contacts_count;
      case "open_value":
        return o.open_deals_value;
      case "won_value":
        return o.won_deals_value;
      case "created_at":
        return o.created_at;
    }
  };
  return filtered.sort((a, b) => compareValues(value(a), value(b), f.sort.dir));
}
