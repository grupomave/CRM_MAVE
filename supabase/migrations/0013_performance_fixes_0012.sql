-- Corrige os 2 achados do Performance Advisor introduzidos por 0012
-- (mesmo padrão de 0010_performance_fixes.sql).

create index deals_original_owner_id_idx on deals (original_owner_id);

alter policy "deal_status_history_insert" on deal_status_history
  with check (changed_by = (select auth.uid()));
