export interface PipelineStage {
  id: string;
  name: string;
  order_index: number;
  pipeline_id: string;
  rotting_days: number | null;
}

export interface PipelineDeal {
  id: string;
  title: string;
  value: number;
  stage_id: string;
  owner_id: string;
  source: string | null;
  status: "open" | "won" | "lost";
  expected_close_date: string | null;
  updated_at: string;
  organization_name: string | null;
  contact_name: string | null;
  owner_name: string;
  next_activity_subject: string | null;
  next_activity_due: string | null;
  overdue_days: number | null;
  no_upcoming_activity: boolean;
  is_stagnant: boolean;
}

export interface OwnerOption {
  id: string;
  full_name: string;
}

export interface PipelineOption {
  id: string;
  name: string;
  is_default: boolean;
}
