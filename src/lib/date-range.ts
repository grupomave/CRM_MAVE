// Helpers de período/mês compartilhados entre Relatórios e o Dashboard —
// extraídos de reports/page.tsx para não duplicar a mesma lógica de
// agrupamento mensal em mais de um lugar.
export function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function monthKey(iso: string) {
  return iso.slice(0, 7); // YYYY-MM
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
export function defaultTwelveMonthRange(today: Date = new Date()) {
  const defaultFrom = new Date(today);
  defaultFrom.setMonth(defaultFrom.getMonth() - 11);
  defaultFrom.setDate(1);
  return { from: isoDate(defaultFrom), to: isoDate(today) };
}
