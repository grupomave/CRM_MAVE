-- Corrige achado de segurança da rodada de QA (17/09): a policy
-- proposals_access (FOR ALL) usa can_access_owner(owner_id do negócio),
-- que é true para o próprio dono do negócio. Como a tela de propostas não
-- tem checagem de papel nenhuma no cliente, isso permitia que o vendedor
-- dono do negócio aprovasse a própria proposta marcada como
-- "exige aprovação interna" — o que anula o propósito do campo.
--
-- Mesmo padrão já usado em prevent_self_role_escalation (0003_rls.sql):
-- um trigger BEFORE UPDATE que bloqueia a mudança de approved_by/
-- approved_at quando quem está alterando não é admin nem gestor,
-- independentemente de RLS já liberar o UPDATE por outro motivo (edição
-- do próprio negócio).

create or replace function public.prevent_unauthorized_proposal_approval()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.approved_by is distinct from old.approved_by
      or new.approved_at is distinct from old.approved_at)
     and not (is_admin() or public."current_role"() = 'gestor') then
    raise exception 'Apenas administradores ou gestores podem aprovar propostas.';
  end if;
  return new;
end;
$$;

create trigger proposals_prevent_unauthorized_approval
  before update on proposals
  for each row execute function prevent_unauthorized_proposal_approval();
