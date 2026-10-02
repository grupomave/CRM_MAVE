-- Reverte 0026. As colunas/enum antigos não foram removidos, então basta
-- descartar as estruturas novas (perde motivos criados depois da migration).
alter table deals drop column lost_reason_id;
alter table deal_status_history drop column reason_id, drop column reason_name;
drop table lost_reasons;
