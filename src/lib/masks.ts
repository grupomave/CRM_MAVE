// Máscaras e validações brasileiras (sem dependência externa). Todas as
// funções de máscara são "progressivas": podem ser chamadas a cada tecla.

export function onlyDigits(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

export function maskCPF(value: string) {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function maskCNPJ(value: string) {
  const d = onlyDigits(value).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

// CPF até 11 dígitos, CNPJ a partir do 12º
export function maskCpfCnpj(value: string) {
  return onlyDigits(value).length <= 11 ? maskCPF(value) : maskCNPJ(value);
}

// Fixo (10 dígitos) ou celular (11, com o 9º dígito)
export function maskPhoneBR(value: string) {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function maskCEP(value: string) {
  const d = onlyDigits(value).slice(0, 8);
  return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function maskDateBR(value: string) {
  const d = onlyDigits(value).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

export const BR_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

// ---- Validações ---------------------------------------------------------

function allSameDigits(d: string) {
  return /^(\d)\1+$/.test(d);
}

export function isValidCPF(value: string) {
  const d = onlyDigits(value);
  if (d.length !== 11 || allSameDigits(d)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

export function isValidCNPJ(value: string) {
  const d = onlyDigits(value);
  if (d.length !== 14 || allSameDigits(d)) return false;
  const calc = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, w, i) => acc + Number(d[i]) * w, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

// Aceita DDD + número (10/11 dígitos) ou com o DDI 55 na frente (12/13),
// formato comum nos telefones importados do Pipedrive.
export function isValidPhoneBR(value: string) {
  const d = onlyDigits(value);
  return d.length === 10 || d.length === 11 || ((d.length === 12 || d.length === 13) && d.startsWith("55"));
}

// Máscara ao digitar que não destrói números internacionais: se o usuário
// começar com "+", o valor fica como digitado.
export function maskPhoneInput(value: string) {
  return value.trimStart().startsWith("+") ? value : maskPhoneBR(value);
}

// ---- Datas dd/mm/aaaa <-> ISO (aaaa-mm-dd) ------------------------------

export function isoToDateBR(iso: string | null | undefined) {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : "";
}

// Retorna "" para vazio e null para data inválida
export function dateBRToIso(value: string): string | null {
  const d = onlyDigits(value);
  if (d.length === 0) return "";
  if (d.length !== 8) return null;
  const day = Number(d.slice(0, 2));
  const month = Number(d.slice(2, 4));
  const year = Number(d.slice(4));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    year < 1900 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${d.slice(4)}-${d.slice(2, 4)}-${d.slice(0, 2)}`;
}

// ---- Moeda (R$) ----------------------------------------------------------

const brl = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Formata o número sem o símbolo: 1234.5 -> "1.234,50"
export function formatMoneyInput(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return brl.format(value);
}

// Digitação "de caixa eletrônico": cada dígito entra pela direita (centavos)
export function maskMoneyInput(raw: string) {
  const d = onlyDigits(raw).replace(/^0+(?=\d)/, "").slice(0, 13);
  if (!d) return "";
  return brl.format(Number(d) / 100);
}

export function parseMoneyInput(value: string): number | null {
  const d = onlyDigits(value);
  if (!d) return null;
  return Number(d) / 100;
}
