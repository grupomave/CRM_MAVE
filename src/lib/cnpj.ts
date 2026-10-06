// Consulta de CNPJ (dados públicos da Receita Federal). A busca roda no servidor
// (src/app/api/cnpj/[cnpj]/route.ts); aqui ficam o formato normalizado e o
// helper usado pelos formulários de organização.

export interface CnpjData {
  /** Razão social */
  legal_name: string | null;
  /** Nome fantasia (se vazio na Receita, usa a razão social) */
  name: string | null;
  address: string | null;
  address_number: string | null;
  address_complement: string | null;
  neighborhood: string | null;
  zip_code: string | null;
  city: string | null;
  state: string | null;
  email: string | null;
  phone: string | null;
  /** Situação cadastral (ex.: ATIVA, BAIXADA) */
  status: string | null;
  /** Atividade principal (CNAE) — ajuda a escolher o segmento */
  activity: string | null;
}

export async function fetchCnpjData(cnpj: string, signal?: AbortSignal): Promise<CnpjData> {
  const digits = cnpj.replace(/\D/g, "");
  const res = await fetch(`/api/cnpj/${digits}`, { signal });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? "Não foi possível consultar o CNPJ");
  return body as CnpjData;
}
