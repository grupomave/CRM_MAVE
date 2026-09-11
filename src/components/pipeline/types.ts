export interface PipelineStage {
  id: string;
  name: string;
  order_index: number;
  pipeline_id: string;
}

export interface PipelineDeal {
  id: string;
  title: string;
  value: number;
  stage_id: string;
  owner_id: string;
  source: string | null;
  expected_close_date: string | null;
  updated_at: string;
  organization_name: string | null;
  owner_name: string;
  next_activity_subject: string | null;
  next_activity_due: string | null;
}

export interface OwnerOption {
  id: string;
  full_name: string;
}
