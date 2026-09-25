// Métricas de tempo do negócio (tela de detalhe). Ficam fora dos
// componentes porque dependem do relógio (Date.now), o que o React
// Compiler não permite durante a renderização.

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysSince(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return null;
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / DAY_MS));
}

export interface StageChange {
  to_stage_id: string | null;
  changed_at: string;
}

// Dias acumulados em cada etapa, a partir do histórico de mudanças.
// Antes do primeiro registro, o negócio estava na etapa de origem da 1ª
// mudança (ou na etapa atual, se nunca mudou) desde a criação.
export function computeStageDays({
  createdAt,
  currentStageId,
  firstFromStageId,
  changes,
  now = Date.now(),
}: {
  createdAt: string;
  currentStageId: string;
  firstFromStageId: string | null;
  changes: StageChange[];
  now?: number;
}) {
  const ordered = [...changes].sort(
    (a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime(),
  );
  const totals = new Map<string, number>();
  let stage: string | null = ordered.length ? firstFromStageId : currentStageId;
  let since = new Date(createdAt).getTime();

  for (const change of ordered) {
    const at = new Date(change.changed_at).getTime();
    if (stage) totals.set(stage, (totals.get(stage) ?? 0) + Math.max(0, at - since));
    stage = change.to_stage_id;
    since = at;
  }
  if (stage) totals.set(stage, (totals.get(stage) ?? 0) + Math.max(0, now - since));

  const days = new Map<string, number>();
  for (const [id, ms] of totals) days.set(id, Math.floor(ms / DAY_MS));
  const enteredCurrentAt = ordered.length ? ordered[ordered.length - 1].changed_at : createdAt;
  return { days, daysInCurrent: daysSince(enteredCurrentAt, now) ?? 0 };
}
