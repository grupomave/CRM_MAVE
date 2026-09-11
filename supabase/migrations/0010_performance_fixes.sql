-- Corrige os achados do Performance Advisor após aplicar 0001-0009.

-- 1) teams.manager_id ficou com duas foreign keys simultâneas: a original
--    de 0002_tables.sql (para auth.users, antes de profiles existir) e a
--    adicionada logo em seguida (para profiles). A segunda é a correta;
--    a primeira é redundante e só existe por acidente de ordem de criação.
alter table teams drop constraint teams_manager_id_fkey;

-- 2) Índices cobrindo foreign keys sem índice (evita seq scan em joins e
--    em "on delete" cascades/set null).
create index activities_contact_id_idx on activities (contact_id);
create index attachments_uploaded_by_idx on attachments (uploaded_by);
create index contacts_organization_id_idx on contacts (organization_id);
create index custom_field_values_custom_field_id_idx on custom_field_values (custom_field_id);
create index deal_stage_history_changed_by_idx on deal_stage_history (changed_by);
create index deal_stage_history_deal_id_idx on deal_stage_history (deal_id);
create index deal_stage_history_from_stage_id_idx on deal_stage_history (from_stage_id);
create index deal_stage_history_to_stage_id_idx on deal_stage_history (to_stage_id);
create index deals_contact_id_idx on deals (contact_id);
create index deals_organization_id_idx on deals (organization_id);
create index deals_pipeline_id_idx on deals (pipeline_id);
create index leads_converted_deal_id_idx on leads (converted_deal_id);
create index leads_owner_id_idx on leads (owner_id);
create index notes_author_id_idx on notes (author_id);
create index notes_contact_id_idx on notes (contact_id);
create index notes_deal_id_idx on notes (deal_id);
create index pipeline_stages_pipeline_id_idx on pipeline_stages (pipeline_id);
create index profiles_team_id_idx on profiles (team_id);
create index teams_manager_id_idx on teams (manager_id);

-- 3) auth_rls_initplan: auth.uid()/auth.role() chamados sem "select" dentro
--    de USING/WITH CHECK são reavaliados linha a linha; o padrão
--    recomendado pela Supabase é envolver em "(select auth.<fn>())" para o
--    planner resolver uma vez só por consulta.

alter policy "profiles_select" on profiles using (
  id = (select auth.uid())
  or public.is_admin()
  or (public.current_role() = 'gestor' and team_id = public.current_team_id())
);

alter policy "profiles_update" on profiles
  using (id = (select auth.uid()) or public.is_admin())
  with check (id = (select auth.uid()) or public.is_admin());

alter policy "deal_stage_history_insert" on deal_stage_history
  with check (changed_by = (select auth.uid()));

alter policy "notifications_select_own" on notifications
  using (user_id = (select auth.uid()));

alter policy "notifications_update_own" on notifications
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy "custom_field_values_authenticated" on custom_field_values
  using ((select auth.role()) = 'authenticated')
  with check ((select auth.role()) = 'authenticated');
