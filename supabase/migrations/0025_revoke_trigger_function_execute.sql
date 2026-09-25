-- Ajuste da 0024 apontado pelo Supabase Advisor: funções de gatilho não
-- devem ficar expostas em /rest/v1/rpc (mesmo padrão das migrations
-- 0008/0009). Gatilhos continuam funcionando: o EXECUTE só importa para
-- chamadas diretas.
--
-- Reversão: supabase/rollbacks/0025_revoke_trigger_function_execute.down.sql

revoke execute on function public.log_deal_stage_change() from public, anon, authenticated;
revoke execute on function public.check_deal_stage_pipeline() from public, anon, authenticated;
