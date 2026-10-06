// Três alertas visuais de negócio (docx "Estrutura Pipedrive" seção 5) —
// tratados separadamente porque representam problemas diferentes:
// atividade atrasada, negócio sem próxima atividade, negócio estagnado.

export interface DealAlerts {
  overdueDays: number | null;
  /** Há quanto tempo está atrasada, por extenso: "há 35 min", "há 3 h", "há 2 dias" */
  overdueLabel: string | null;
  /** Versão curta para selos e tabelas: "35 min", "3 h", "2 d" */
  overdueShort: string | null;
  noUpcomingActivity: boolean;
  isStagnant: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MIN_MS = 60 * 1000;

/** Tempo de atraso legível: minutos até 1 h, horas até 2 dias, depois dias */
export function formatOverdue(dueIso: string | null | undefined, now: Date = new Date()) {
  if (!dueIso) return null;
  const diff = now.getTime() - new Date(dueIso).getTime();
  if (!(diff > 0)) return null;
  if (diff < HOUR_MS) {
    const m = Math.max(1, Math.floor(diff / MIN_MS));
    return { label: `há ${m} min`, short: `${m} min` };
  }
  if (diff < 2 * DAY_MS) {
    const h = Math.floor(diff / HOUR_MS);
    return { label: `há ${h} h`, short: `${h} h` };
  }
  const d = Math.floor(diff / DAY_MS);
  return { label: `há ${d} dias`, short: `${d} d` };
}

export function computeDealAlerts({
  nextActivityDue,
  lastActivityAt,
  rottingDays,
  now = new Date(),
}: {
  nextActivityDue: string | null;
  lastActivityAt: string | null;
  rottingDays: number | null;
  now?: Date;
}): DealAlerts {
  const nowMs = now.getTime();

  let overdueDays: number | null = null;
  let overdueLabel: string | null = null;
  let overdueShort: string | null = null;
  let noUpcomingActivity = false;

  if (!nextActivityDue) {
    noUpcomingActivity = true;
  } else {
    const dueMs = new Date(nextActivityDue).getTime();
    if (dueMs < nowMs) {
      overdueDays = Math.max(1, Math.ceil((nowMs - dueMs) / DAY_MS));
      const overdue = formatOverdue(nextActivityDue, now);
      overdueLabel = overdue?.label ?? null;
      overdueShort = overdue?.short ?? null;
    }
  }

  let isStagnant = false;
  if (rottingDays != null && lastActivityAt) {
    const daysSince = (nowMs - new Date(lastActivityAt).getTime()) / DAY_MS;
    isStagnant = daysSince > rottingDays;
  }

  return { overdueDays, overdueLabel, overdueShort, noUpcomingActivity, isStagnant };
}
