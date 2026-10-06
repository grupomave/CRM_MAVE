-- Reverte 0029. Perde origens/segmentos cadastrados e os novos campos de leads/organizações.
-- (organizations.sector e leads.source/contact_info continuam intactos.)
-- As colunas novas de audit_logs (deal_id, organization_id, contact_id, owner_id) são
-- mantidas de propósito: a função audit_log_trigger() da 0029 as preenche, e o histórico
-- do Workflow é guardado para sempre. Para voltar a função à 0028, reaplique o corpo dela.
drop table if exists digest_log;
drop table if exists digest_settings;
drop trigger if exists audit_segments on segments;
drop trigger if exists audit_lead_sources on lead_sources;
drop policy if exists "audit_logs_gestor_select" on audit_logs;
alter table organizations drop column if exists segment_id, drop column if exists address_number,
  drop column if exists address_complement, drop column if exists neighborhood,
  drop column if exists zip_code, drop column if exists email;
alter table leads drop column if exists source_id, drop column if exists phone,
  drop column if exists mobile, drop column if exists email;
drop table if exists segments;
drop table if exists lead_sources;
