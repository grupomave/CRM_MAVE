import {
  compareValues,
  getEnumParam,
  getParam,
  getSortParam,
  matchesSearch,
  type RawParams,
  type SortState,
} from "./params";

export interface PersonRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  job_title: string | null;
  created_at: string;
  owner_id: string;
  owner_name: string | null;
  organization_id: string | null;
  organization_name: string | null;
}

export const PERSON_SORT_KEYS = ["name", "email", "organization", "owner", "created_at"] as const;
export type PersonSortKey = (typeof PERSON_SORT_KEYS)[number];

const ORG_FILTERS = ["all", "with", "without"] as const;

export interface PersonFilters {
  q: string;
  owner: string;
  org: (typeof ORG_FILTERS)[number];
  sort: SortState<PersonSortKey>;
}

export const DEFAULT_PERSON_SORT: SortState<PersonSortKey> = { key: "name", dir: "asc" };

export function parsePersonFilters(params: RawParams): PersonFilters {
  return {
    q: getParam(params, "q"),
    owner: getParam(params, "owner"),
    org: getEnumParam(params, "org", ORG_FILTERS, "all"),
    sort: getSortParam(params, PERSON_SORT_KEYS, DEFAULT_PERSON_SORT),
  };
}

export function applyPersonFilters(rows: PersonRow[], f: PersonFilters): PersonRow[] {
  const filtered = rows.filter((p) => {
    if (f.owner && p.owner_id !== f.owner) return false;
    if (f.org === "with" && !p.organization_id) return false;
    if (f.org === "without" && p.organization_id) return false;
    return matchesSearch(
      f.q,
      p.name,
      p.email,
      p.phone,
      p.whatsapp,
      p.job_title,
      p.organization_name,
    );
  });

  const value = (p: PersonRow) => {
    switch (f.sort.key) {
      case "name":
        return p.name;
      case "email":
        return p.email;
      case "organization":
        return p.organization_name;
      case "owner":
        return p.owner_name;
      case "created_at":
        return p.created_at;
    }
  };
  return filtered.sort((a, b) => compareValues(value(a), value(b), f.sort.dir));
}
