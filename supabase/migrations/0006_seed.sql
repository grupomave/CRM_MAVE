-- Pipeline padrão e estágios (prompt.md seção 3.3). Não semeia negócios,
-- contatos ou usuários de exemplo — dependem de um auth.users real.

insert into pipelines (id, name, is_default)
values ('00000000-0000-0000-0000-000000000001', 'Pipeline padrão', true);

insert into pipeline_stages (pipeline_id, name, order_index, rotting_days)
values
  ('00000000-0000-0000-0000-000000000001', 'Novo Lead', 0, 14),
  ('00000000-0000-0000-0000-000000000001', 'Qualificação', 1, 14),
  ('00000000-0000-0000-0000-000000000001', 'Proposta Enviada', 2, 10),
  ('00000000-0000-0000-0000-000000000001', 'Negociação', 3, 10),
  ('00000000-0000-0000-0000-000000000001', 'Fechado Ganho', 4, null),
  ('00000000-0000-0000-0000-000000000001', 'Fechado Perdido', 5, null);
