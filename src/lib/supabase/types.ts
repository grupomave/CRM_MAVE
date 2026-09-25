/**
 * Tipos escritos à mão a partir do schema em supabase/migrations.
 * Assim que o projeto Supabase existir, regenerar com:
 *   supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts
 */

export type UserRole = "admin" | "gestor" | "vendedor";
export type EntityType = "deal" | "contact" | "organization";
export type CustomFieldType = "text" | "number" | "date" | "select" | "checkbox";
export type ActivityType = "task" | "call" | "meeting" | "email";
export type LeadStatus = "new" | "contacted" | "qualified" | "disqualified" | "converted";
export type TriggerEvent =
  | "deal_stage_changed"
  | "deal_created"
  | "activity_overdue";
export type NotificationType =
  | "mention"
  | "deal_assigned"
  | "activity_due"
  | "automation";
export type LostReason =
  | "sem_retorno"
  | "preco"
  | "concorrente"
  | "sem_interesse"
  | "contratacao_adiada"
  | "fora_perfil"
  | "dados_incorretos"
  | "outro";
export type ProposalStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "in_review"
  | "negotiation"
  | "approved"
  | "rejected";

export const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, string> = {
  draft: "Rascunho",
  sent: "Enviado",
  viewed: "Visualizado",
  in_review: "Em análise",
  negotiation: "Negociação",
  approved: "Aprovado",
  rejected: "Recusado",
};

export const LOST_REASON_LABEL: Record<LostReason, string> = {
  sem_retorno: "Sem retorno",
  preco: "Preço",
  concorrente: "Fechou com concorrente",
  sem_interesse: "Não possui interesse",
  contratacao_adiada: "Contratação adiada",
  fora_perfil: "Fora do perfil",
  dados_incorretos: "Dados incorretos",
  outro: "Outro motivo",
};

export const DEAL_STATUS_LABEL: Record<"open" | "won" | "lost", string> = {
  open: "Aberto",
  won: "Ganho",
  lost: "Perdido",
};

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          cnpj: string | null;
          address: string | null;
          sector: string | null;
          owner_id: string;
          created_at: string;
          legal_name: string | null;
          company_size: string | null;
          nature: "publica" | "privada" | null;
          city: string | null;
          state: string | null;
          website: string | null;
          linkedin_url: string | null;
          instagram_url: string | null;
          phone: string | null;
          services_of_interest: string | null;
          notes: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["organizations"]["Row"]> & {
          name: string;
          owner_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["organizations"]["Row"]>;
        Relationships: [];
      };
      contacts: {
        Row: {
          id: string;
          name: string;
          email: string | null;
          phone: string | null;
          organization_id: string | null;
          owner_id: string;
          created_at: string;
          job_title: string | null;
          whatsapp: string | null;
          contact_preference: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["contacts"]["Row"]> & {
          name: string;
          owner_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["contacts"]["Row"]>;
        Relationships: [];
      };
      pipelines: {
        Row: { id: string; name: string; is_default: boolean };
        Insert: Partial<Database["public"]["Tables"]["pipelines"]["Row"]> & {
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["pipelines"]["Row"]>;
        Relationships: [];
      };
      pipeline_stages: {
        Row: {
          id: string;
          pipeline_id: string;
          name: string;
          order_index: number;
          rotting_days: number | null;
        };
        Insert: Partial<Database["public"]["Tables"]["pipeline_stages"]["Row"]> & {
          pipeline_id: string;
          name: string;
          order_index: number;
        };
        Update: Partial<Database["public"]["Tables"]["pipeline_stages"]["Row"]>;
        Relationships: [];
      };
      deals: {
        Row: {
          id: string;
          title: string;
          value: number;
          currency: string;
          pipeline_id: string;
          stage_id: string;
          contact_id: string | null;
          organization_id: string | null;
          owner_id: string;
          status: "open" | "won" | "lost";
          expected_close_date: string | null;
          source: string | null;
          created_at: string;
          updated_at: string;
          lost_reason: LostReason | null;
          original_owner_id: string | null;
          last_activity_at: string | null;
          frozen_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["deals"]["Row"]> & {
          title: string;
          pipeline_id: string;
          stage_id: string;
          owner_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["deals"]["Row"]>;
        Relationships: [];
      };
      deal_status_history: {
        Row: {
          id: string;
          deal_id: string;
          from_status: "open" | "won" | "lost";
          to_status: "open" | "won" | "lost";
          reason: LostReason | null;
          changed_by: string;
          changed_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["deal_status_history"]["Row"]
        > & {
          deal_id: string;
          from_status: "open" | "won" | "lost";
          to_status: "open" | "won" | "lost";
          changed_by: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["deal_status_history"]["Row"]
        >;
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          name: string;
          contact_info: string | null;
          source: string | null;
          status: "new" | "contacted" | "qualified" | "disqualified" | "converted";
          converted_deal_id: string | null;
          owner_id: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["leads"]["Row"]> & {
          name: string;
          owner_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["leads"]["Row"]>;
        Relationships: [];
      };
      activities: {
        Row: {
          id: string;
          type: ActivityType;
          subject: string;
          due_date: string | null;
          done: boolean;
          deal_id: string | null;
          contact_id: string | null;
          owner_id: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["activities"]["Row"]> & {
          type: ActivityType;
          subject: string;
          owner_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["activities"]["Row"]>;
        Relationships: [];
      };
      notes: {
        Row: {
          id: string;
          content: string;
          deal_id: string | null;
          contact_id: string | null;
          mentioned_user_ids: string[] | null;
          author_id: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["notes"]["Row"]> & {
          content: string;
          author_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["notes"]["Row"]>;
        Relationships: [];
      };
      custom_fields: {
        Row: {
          id: string;
          entity_type: EntityType;
          label: string;
          field_type: CustomFieldType;
          options_json: string[] | null;
          required: boolean;
          order_index: number;
        };
        Insert: Partial<Database["public"]["Tables"]["custom_fields"]["Row"]> & {
          entity_type: EntityType;
          label: string;
          field_type: CustomFieldType;
        };
        Update: Partial<Database["public"]["Tables"]["custom_fields"]["Row"]>;
        Relationships: [];
      };
      custom_field_values: {
        Row: {
          id: string;
          custom_field_id: string;
          entity_type: EntityType;
          entity_id: string;
          value: string | null;
        };
        Insert: Partial<
          Database["public"]["Tables"]["custom_field_values"]["Row"]
        > & {
          custom_field_id: string;
          entity_type: EntityType;
          entity_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["custom_field_values"]["Row"]>;
        Relationships: [];
      };
      attachments: {
        Row: {
          id: string;
          entity_type: EntityType;
          entity_id: string;
          file_name: string;
          storage_path: string;
          size_bytes: number;
          uploaded_by: string;
          created_at: string;
          category: string | null;
          expires_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["attachments"]["Row"]> & {
          entity_type: EntityType;
          entity_id: string;
          file_name: string;
          storage_path: string;
          uploaded_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["attachments"]["Row"]>;
        Relationships: [];
      };
      deal_stage_history: {
        Row: {
          id: string;
          deal_id: string;
          from_stage_id: string | null;
          to_stage_id: string;
          changed_by: string;
          changed_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["deal_stage_history"]["Row"]
        > & {
          deal_id: string;
          to_stage_id: string;
          changed_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["deal_stage_history"]["Row"]>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: NotificationType;
          entity_type: EntityType | null;
          entity_id: string | null;
          message: string;
          read: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["notifications"]["Row"]> & {
          user_id: string;
          type: NotificationType;
          message: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Row"]>;
        Relationships: [];
      };
      automation_rules: {
        Row: {
          id: string;
          trigger_event: TriggerEvent;
          conditions_json: Record<string, unknown>;
          actions_json: Record<string, unknown>[];
          active: boolean;
        };
        Insert: Partial<Database["public"]["Tables"]["automation_rules"]["Row"]> & {
          trigger_event: TriggerEvent;
        };
        Update: Partial<Database["public"]["Tables"]["automation_rules"]["Row"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          role: UserRole;
          team_id: string | null;
          avatar_url: string | null;
          is_active: boolean;
          must_change_password: boolean;
          phone: string | null;
          preferences: Record<string, unknown>;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & {
          id: string;
          full_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      teams: {
        Row: { id: string; name: string; manager_id: string | null };
        Insert: Partial<Database["public"]["Tables"]["teams"]["Row"]> & {
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["teams"]["Row"]>;
        Relationships: [];
      };
      proposals: {
        Row: {
          id: string;
          deal_id: string;
          status: ProposalStatus;
          valid_until: string | null;
          requires_approval: boolean;
          approved_by: string | null;
          approved_at: string | null;
          current_version_id: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["proposals"]["Row"]> & {
          deal_id: string;
          created_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["proposals"]["Row"]>;
        Relationships: [];
      };
      whatsapp_click_logs: {
        Row: {
          id: string;
          contact_id: string | null;
          deal_id: string | null;
          clicked_by: string;
          clicked_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["whatsapp_click_logs"]["Row"]> & {
          clicked_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["whatsapp_click_logs"]["Row"]>;
        Relationships: [];
      };
      proposal_versions: {
        Row: {
          id: string;
          proposal_id: string;
          version_number: number;
          value: number;
          scope: string | null;
          conditions: string | null;
          file_name: string | null;
          storage_path: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["proposal_versions"]["Row"]> & {
          proposal_id: string;
          version_number: number;
          created_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["proposal_versions"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
