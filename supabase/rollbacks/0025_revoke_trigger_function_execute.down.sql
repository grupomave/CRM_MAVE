-- Reverte 0025 (volta o EXECUTE padrão das funções de gatilho).
grant execute on function public.log_deal_stage_change() to public;
grant execute on function public.check_deal_stage_pipeline() to public;
