// Preferências de interface por usuário, salvas em profiles.preferences
// (migration 0022). Tudo opcional: valores ausentes caem no padrão.

export type KanbanDensity = "compact" | "comfortable";

export interface UserPreferences {
  kanbanDensity?: KanbanDensity;
  /** Etapas recolhidas no Kanban, por funil: { [pipelineId]: stageId[] } */
  collapsedStages?: Record<string, string[]>;
}

export function parsePreferences(raw: unknown): UserPreferences {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const value = raw as Record<string, unknown>;
  const prefs: UserPreferences = {};
  if (value.kanbanDensity === "compact" || value.kanbanDensity === "comfortable") {
    prefs.kanbanDensity = value.kanbanDensity;
  }
  if (value.collapsedStages && typeof value.collapsedStages === "object") {
    const collapsed: Record<string, string[]> = {};
    for (const [pipelineId, ids] of Object.entries(value.collapsedStages as Record<string, unknown>)) {
      if (Array.isArray(ids)) collapsed[pipelineId] = ids.filter((id): id is string => typeof id === "string");
    }
    prefs.collapsedStages = collapsed;
  }
  return prefs;
}
