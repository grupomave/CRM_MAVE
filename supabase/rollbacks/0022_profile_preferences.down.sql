-- Reverte 0022_profile_preferences.sql. Descarta as preferências salvas
-- (densidade do Kanban e colunas recolhidas); nenhum dado de negócio é afetado.

alter table profiles drop constraint if exists profiles_preferences_is_object;
alter table profiles drop column if exists preferences;
