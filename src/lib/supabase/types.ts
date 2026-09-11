/**
 * Tipos escritos à mão a partir do schema em supabase/migrations.
 * Assim que o projeto Supabase existir, regenerar com:
 *   supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts
 */

export type UserRole = "admin" | "gestor" | "vendedor";
export type EntityType = "deal" | "contact" | "organization";
export type CustomFieldType = "text" | "number" | "date" | "select" | "checkbox";
export type ActivityType = "task" | "call" | "meeting" | "email";
export type TriggerEvent =
  | "deal_stage_changed"
  | "deal_created"
  | "activity_overdue";
export type NotificationType =
  | "mention"
  | "deal_assigned"
  | "activity_due"
  | "automation";

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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
