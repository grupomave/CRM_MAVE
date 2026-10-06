-- Reverte 0030: remove o resumo e os índices novos.
-- As colunas audit_logs.event_kind e pipeline_id (e a função workflow_event_kind) são
-- mantidas de propósito: a audit_log_trigger() da 0030 grava pipeline_id, e o histórico
-- do Workflow é guardado para sempre. Para voltar o gatilho à 0029, reaplique o corpo dela
-- antes de remover as colunas.
drop function if exists public.workflow_summary(timestamptz, timestamptz, uuid, uuid, uuid, uuid, uuid, uuid, text[], text);
drop index if exists audit_logs_kind_idx;
drop index if exists audit_logs_pipeline_idx;
