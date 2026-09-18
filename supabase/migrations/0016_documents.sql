-- Módulo de Documentos (prompt.md seção 3.6) — repositório central sobre a
-- tabela "attachments" que já existe: categoria/tags e controle de validade,
-- para dar busca e alerta de vencimento cruzando negócios/contatos/organizações.

alter table attachments
  add column category text,
  add column expires_at date;

create index attachments_category_idx on attachments (category);
create index attachments_expires_at_idx on attachments (expires_at);
