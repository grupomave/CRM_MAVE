// Leitura tipada dos parâmetros de URL das listagens. Usado tanto no cliente
// (useSearchParams) quanto no servidor (searchParams da página e rota de
// exportação), para que filtros, busca e ordenação tenham UMA definição só.

export type RawParams =
  | URLSearchParams
  | Record<string, string | string[] | undefined>
  | null
  | undefined;

export function getParam(params: RawParams, key: string): string {
  if (!params) return "";
  if (params instanceof URLSearchParams) return params.get(key) ?? "";
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export function getEnumParam<T extends string>(
  params: RawParams,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = getParam(params, key);
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function getNumberParam(params: RawParams, key: string): number | null {
  const value = getParam(params, key);
  if (value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function getBoolParam(params: RawParams, key: string): boolean {
  return getParam(params, key) === "1";
}

export type SortDir = "asc" | "desc";

export interface SortState<K extends string> {
  key: K;
  dir: SortDir;
}

export function getSortParam<K extends string>(
  params: RawParams,
  allowed: readonly K[],
  fallback: SortState<K>,
): SortState<K> {
  const key = getParam(params, "sort");
  const dir = getParam(params, "dir");
  if (!(allowed as readonly string[]).includes(key)) return fallback;
  return { key: key as K, dir: dir === "asc" ? "asc" : "desc" };
}

export const PAGE_SIZES = [25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 50;

export function getPagination(params: RawParams) {
  const size = getNumberParam(params, "size");
  const pageSize = (PAGE_SIZES as readonly number[]).includes(size ?? -1)
    ? (size as number)
    : DEFAULT_PAGE_SIZE;
  const page = Math.max(1, Math.floor(getNumberParam(params, "page") ?? 1));
  return { page, pageSize };
}

// Normaliza texto para busca: minúsculas e sem acentos ("São" casa com "sao")
export function normalize(text: string | null | undefined) {
  return (text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function matchesSearch(term: string, ...fields: (string | null | undefined)[]) {
  const needle = normalize(term.trim());
  if (!needle) return true;
  return normalize(fields.filter(Boolean).join(" ")).includes(needle);
}

const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

// Comparador genérico: nulos sempre no fim, texto com collation pt-BR
export function compareValues(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
  dir: SortDir,
) {
  const aNull = a === null || a === undefined || a === "";
  const bNull = b === null || b === undefined || b === "";
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;
  const result =
    typeof a === "number" && typeof b === "number"
      ? a - b
      : collator.compare(String(a), String(b));
  return dir === "asc" ? result : -result;
}

export function paginate<T>(rows: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * pageSize;
  return { rows: rows.slice(start, start + pageSize), page: current, totalPages };
}
