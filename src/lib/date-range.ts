// Helpers de período/mês compartilhados entre Relatórios e o Dashboard —
// extraídos de reports/page.tsx para não duplicar a mesma lógica de
// agrupamento mensal em mais de um lugar.
export function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

const saoPauloDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// Dia (aaaa-mm-dd) no horário de Brasília — o servidor roda em UTC, então
// iso.slice(0, 10) jogaria atividades das 21h em diante para o dia seguinte.
export function dayKeyInSaoPaulo(value: string | Date) {
  return saoPauloDay.format(typeof value === "string" ? new Date(value) : value);
}

// Mês (aaaa-mm) de um timestamp no horário de Brasília. Datas sem hora
// ("aaaa-mm-dd") são usadas como estão, sem conversão de fuso.
export function monthKey(iso: string) {
  if (/^\d{4}-\d{2}(-\d{2})?$/.test(iso)) return iso.slice(0, 7);
  return dayKeyInSaoPaulo(iso).slice(0, 7);
}

export function monthLabel(key: string) {
  const [year, month] = key.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

export function monthRange(fromIso: string, toIso: string) {
  const months: string[] = [];
  const cursor = new Date(fromIso.slice(0, 7) + "-01T00:00:00");
  const end = new Date(toIso.slice(0, 7) + "-01T00:00:00");
  while (cursor <= end && months.length < 60) {
    months.push(cursor.toISOString().slice(0, 7));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

// Janela padrão usada tanto pelos Relatórios (filtro inicial) quanto pelo
// Dashboard (sem filtro de período próprio): últimos 12 meses até hoje.
// Calculada no dia de Brasília: o servidor roda em UTC, e usar
// toISOString() adiantava o período em um dia depois das 21h.
export function defaultTwelveMonthRange(today: Date = new Date()) {
  const to = dayKeyInSaoPaulo(today);
  const [year, month] = to.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1 - 11, 1));
  const from = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}-01`;
  return { from, to };
}

// Início e fim do dia de Brasília em ISO (UTC-3, sem horário de verão)
export function saoPauloDayBounds(date: Date = new Date()) {
  const key = dayKeyInSaoPaulo(date);
  return {
    start: new Date(`${key}T00:00:00-03:00`).toISOString(),
    end: new Date(`${key}T23:59:59.999-03:00`).toISOString(),
  };
}
