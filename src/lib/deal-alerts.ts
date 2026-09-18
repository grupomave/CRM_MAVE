// Três alertas visuais de negócio (docx "Estrutura Pipedrive" seção 5) —
// tratados separadamente porque representam problemas diferentes:
// atividade atrasada, negócio sem próxima atividade, negócio estagnado.

export interface DealAlerts {
  overdueDays: number | null;
  noUpcomingActivity: boolean;
  isStagnant: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

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
  let noUpcomingActivity = false;

  if (!nextActivityDue) {
    noUpcomingActivity = true;
  } else {
    const dueMs = new Date(nextActivityDue).getTime();
    if (dueMs < nowMs) {
      overdueDays = Math.max(1, Math.ceil((nowMs - dueMs) / DAY_MS));
    }
  }

  let isStagnant = false;
  if (rottingDays != null && lastActivityAt) {
    const daysSince = (nowMs - new Date(lastActivityAt).getTime()) / DAY_MS;
    isStagnant = daysSince > rottingDays;
  }

  return { overdueDays, noUpcomingActivity, isStagnant };
}
