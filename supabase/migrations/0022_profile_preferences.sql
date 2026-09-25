-- Preferências de interface por usuário (Fase 1 — Kanban): densidade dos
-- cards ("compacto"/"confortavel") e colunas recolhidas por funil. Ficam no
-- banco para acompanhar o usuário em qualquer dispositivo.
--
-- Formato (jsonb, todas as chaves opcionais):
--   { "kanbanDensity": "compact" | "comfortable",
--     "collapsedStages": { "<pipeline_id>": ["<stage_id>", ...] } }
--
-- Segurança: a policy "profiles_update" já permite que cada usuário altere
-- só a própria linha, e o gatilho prevent_self_role_escalation continua
-- bloqueando mudança de papel/equipe — nenhuma policy nova é necessária.
--
-- Reversão: supabase/rollbacks/0022_profile_preferences.down.sql

alter table profiles
  add column if not exists preferences jsonb not null default '{}'::jsonb;

-- Evita que um cliente grave algo que não seja um objeto JSON
alter table profiles
  add constraint profiles_preferences_is_object
  check (jsonb_typeof(preferences) = 'object');
