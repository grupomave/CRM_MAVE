import type { LostReason } from "@/lib/supabase/types";

export type DealStatus = "open" | "won" | "lost";

export interface DealDetail {
  id: string;
  title: string;
  value: number;
  currency: string;
  status: DealStatus;
  expected_close_date: string | null;
  source: string | null;
  stage_id: string;
  pipeline_id: string;
  organization_id: string | null;
  contact_id: string | null;
  owner_id: string;
  lost_reason: LostReason | null;
  frozen_at: string | null;
  created_at: string;
  last_activity_at: string | null;
  organizations: { id: string; name: string } | null;
  contacts: { id: string; name: string; phone: string | null; whatsapp: string | null } | null;
  profiles: { full_name: string } | null;
}

export interface StageOption {
  id: string;
  name: string;
  order_index: number;
  rotting_days: number | null;
}

export interface ActivityItem {
  id: string;
  type: string;
  subject: string;
  due_date: string | null;
  done: boolean;
}

export interface Option {
  id: string;
  label: string;
  description?: string | null;
}

export type TimelineKind = "note" | "activity" | "stage" | "status" | "file";

export interface TimelineItem {
  id: string;
  kind: TimelineKind;
  title: string;
  body?: string | null;
  at: string;
  actor: string | null;
}

export interface DealOverview {
  ageDays: number;
  daysSinceLastActivity: number | null;
  activityCounts: Record<string, number>;
}

export const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  task: "Tarefa",
  call: "Ligação",
  meeting: "Reunião",
  email: "E-mail",
};
