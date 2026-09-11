-- Corrige 2 achados do Security Advisor do Supabase detectados após aplicar
-- as migrations 0001-0007:
--
-- 1) function_search_path_mutable: set_updated_at e
--    prevent_self_role_escalation não fixavam search_path (as demais
--    funções já tinham "set search_path = public" desde a criação).
--
-- 2) SECURITY DEFINER exposta via RPC para anon/authenticated:
--    apply_automation_actions e run_activity_overdue_check são callable
--    directly em /rest/v1/rpc/... e aceitam parâmetros arbitrários
--    (deal_id, owner_id, actions_json) sem checar RLS — um usuário
--    autenticado (ou até anônimo) poderia chamar
--    apply_automation_actions diretamente para inserir notificações para
--    qualquer user_id ou atividades em qualquer deal_id, contornando as
--    políticas de dono/equipe. As 4 funções de trigger (retornam
--    "trigger") já são bloqueadas pelo Postgres se chamadas fora de um
--    trigger, mas revogamos o EXECUTE mesmo assim (defesa em profundidade
--    — não devem aparecer como RPC público de qualquer forma).
--
-- is_admin/current_role/current_team_id/can_access_owner PRECISAM
-- continuar executáveis por "authenticated": as políticas de RLS chamam
-- essas funções durante a avaliação de USING/WITH CHECK, então revogar
-- de "authenticated" quebraria toda consulta autenticada no schema
-- (retornam só dados do próprio usuário — auth.uid() — então não têm o
-- mesmo risco de injeção). Revogamos apenas de "anon", que nunca deveria
-- chamá-las (o app exige login antes de qualquer consulta).

alter function public.set_updated_at() set search_path = public;
alter function public.prevent_self_role_escalation() set search_path = public;

revoke execute on function public.apply_automation_actions(jsonb, uuid, text, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.run_activity_overdue_check() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_deal_stage_changed() from public, anon, authenticated;
revoke execute on function public.handle_deal_created() from public, anon, authenticated;
revoke execute on function public.sync_deal_status_with_stage() from public, anon, authenticated;

revoke execute on function public.is_admin() from anon;
revoke execute on function public.current_role() from anon;
revoke execute on function public.current_team_id() from anon;
revoke execute on function public.can_access_owner(uuid) from anon;
