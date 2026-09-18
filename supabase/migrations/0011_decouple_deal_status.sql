-- Remove o acoplamento de deals.status ao nome do estágio (bug crítico).
--
-- 0005_pipeline_status_sync.sql forçava status='open' sempre que o nome do
-- estágio não fosse literalmente 'Fechado Ganho'/'Fechado Perdido'. As
-- etapas reais do Grupo Mave (Prospecção, Apresentação, ..., Aceite,
-- Congelado) nunca batem com esses literais, então qualquer negócio
-- importado ou movimentado teria o status sobrescrito para "Aberto" —
-- inclusive negócios genuinamente Ganhos/Perdidos.
--
-- docx "Estrutura Pipedrive" seção 8: "a etapa e o status não são a mesma
-- informação". A partir de agora, status é controlado só por ação explícita
-- do usuário (marcar Ganho/Perdido/Congelar/Reabrir — ver deal_status_history
-- em 0012), nunca derivado do estágio.

drop trigger if exists deals_sync_status_before_write on deals;
drop function if exists public.sync_deal_status_with_stage();
