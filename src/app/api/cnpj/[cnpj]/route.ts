import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isValidCNPJ, maskCEP, maskPhoneBR } from "@/lib/masks";
import type { CnpjData } from "@/lib/cnpj";

// Consulta o CNPJ na web: BrasilAPI (principal) e CNPJ.ws pública (reserva).
// Exige usuário logado para a rota não virar um proxy aberto.

const SMALL_WORDS = new Set(["de", "da", "do", "das", "dos", "e", "em", "a", "o"]);

// A Receita devolve tudo em MAIÚSCULAS; converte para "Título" mantendo siglas curtas e preposições
function titleCase(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

function phoneFrom(raw: unknown): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? maskPhoneBR(digits) : null;
}

async function getJson(url: string): Promise<{ status: number; body: any }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { Accept: "application/json" }, cache: "no-store" });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

function fromBrasilApi(b: any): CnpjData {
  const street = [b.descricao_tipo_de_logradouro, b.logradouro].filter(Boolean).join(" ");
  return {
    legal_name: titleCase(b.razao_social),
    name: titleCase(b.nome_fantasia) ?? titleCase(b.razao_social),
    address: titleCase(street),
    address_number: text(b.numero),
    address_complement: titleCase(b.complemento),
    neighborhood: titleCase(b.bairro),
    zip_code: b.cep ? maskCEP(String(b.cep)) : null,
    city: titleCase(b.municipio),
    state: text(b.uf)?.toUpperCase() ?? null,
    email: text(b.email)?.toLowerCase() ?? null,
    phone: phoneFrom(b.ddd_telefone_1),
    status: text(b.descricao_situacao_cadastral)?.toUpperCase() ?? null,
    activity: titleCase(b.cnae_fiscal_descricao),
  };
}

function fromCnpjWs(b: any): CnpjData {
  const e = b.estabelecimento ?? {};
  const street = [e.tipo_logradouro, e.logradouro].filter(Boolean).join(" ");
  return {
    legal_name: titleCase(b.razao_social),
    name: titleCase(e.nome_fantasia) ?? titleCase(b.razao_social),
    address: titleCase(street),
    address_number: text(e.numero),
    address_complement: titleCase(e.complemento),
    neighborhood: titleCase(e.bairro),
    zip_code: e.cep ? maskCEP(String(e.cep)) : null,
    city: titleCase(e.cidade?.nome),
    state: text(e.estado?.sigla)?.toUpperCase() ?? null,
    email: text(e.email)?.toLowerCase() ?? null,
    phone: phoneFrom(`${e.ddd1 ?? ""}${e.telefone1 ?? ""}`),
    status: text(e.situacao_cadastral)?.toUpperCase() ?? null,
    activity: titleCase(e.atividade_principal?.descricao),
  };
}

export async function GET(_req: Request, { params }: { params: Promise<{ cnpj: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sessão expirada" }, { status: 401 });

  const { cnpj } = await params;
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14 || !isValidCNPJ(digits)) {
    return NextResponse.json({ error: "CNPJ inválido — confira os dígitos" }, { status: 400 });
  }

  try {
    const primary = await getJson(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
    if (primary.status === 200 && primary.body?.razao_social) {
      return NextResponse.json(fromBrasilApi(primary.body));
    }
    if (primary.status === 404) {
      return NextResponse.json({ error: "CNPJ não encontrado na Receita Federal" }, { status: 404 });
    }
  } catch {
    // cai para a consulta reserva
  }

  try {
    const fallback = await getJson(`https://publica.cnpj.ws/cnpj/${digits}`);
    if (fallback.status === 200 && fallback.body?.razao_social) {
      return NextResponse.json(fromCnpjWs(fallback.body));
    }
    if (fallback.status === 404) {
      return NextResponse.json({ error: "CNPJ não encontrado na Receita Federal" }, { status: 404 });
    }
  } catch {
    // sem resposta
  }

  return NextResponse.json(
    { error: "Serviço de consulta indisponível no momento. Preencha os dados manualmente ou tente de novo." },
    { status: 502 },
  );
}
