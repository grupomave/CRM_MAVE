-- Corrige 2 achados de segurança da rodada de QA (17/09):
--
-- 1) attachments_access (tabela) checava can_access_owner(uploaded_by) —
--    ou seja, quem pode ver/editar um anexo era definido por QUEM ENVIOU
--    o arquivo, não pelo negócio/contato/organização a que ele pertence.
--    Se um negócio muda de dono, o novo dono não via os anexos antigos e
--    o dono anterior continuava enxergando anexos de um negócio que não
--    era mais dele.
--
-- 2) attachments_bucket_select (storage.objects) só checava
--    "auth.role() = 'authenticated'" — qualquer usuário logado conseguia
--    gerar uma signed URL e baixar qualquer arquivo do bucket
--    'attachments', sem checagem nenhuma de dono/negócio/equipe. Foi o
--    achado mais sério da rodada de QA.
--
-- A correção: uma função can_access_attachment(entity_type, entity_id)
-- que resolve o dono real olhando para deals/contacts/organizations (o
-- mesmo padrão de can_access_owner: dono, gestor da equipe do dono, ou
-- admin) e usa ela tanto na tabela attachments quanto no bucket de
-- storage, via join pelo storage_path.

create or replace function public.can_access_attachment(_entity_type entity_type, _entity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case _entity_type
    when 'deal' then exists (
      select 1 from deals d where d.id = _entity_id and can_access_owner(d.owner_id)
    )
    when 'contact' then exists (
      select 1 from contacts c where c.id = _entity_id and can_access_owner(c.owner_id)
    )
    when 'organization' then exists (
      select 1 from organizations o where o.id = _entity_id and can_access_owner(o.owner_id)
    )
    else false
  end;
$$;

revoke execute on function public.can_access_attachment(entity_type, uuid) from public;
grant execute on function public.can_access_attachment(entity_type, uuid) to authenticated;

-- 1) Tabela attachments: passa a checar o dono da entidade, não de quem enviou.
drop policy "attachments_access" on attachments;
create policy "attachments_access" on attachments for all
  using (can_access_attachment(entity_type, entity_id))
  with check (can_access_attachment(entity_type, entity_id));

-- 2) Bucket de storage: passa a checar a mesma regra via join com a
--    tabela attachments (storage.objects.name = attachments.storage_path).
--    INSERT/DELETE seguem como estavam — o upload acontece antes de a
--    linha em "attachments" existir, então não dá pra checar o dono
--    nesse momento; a leitura (download via signed URL) é o vetor que
--    importa e é o que esta policy fecha.
drop policy "attachments_bucket_select" on storage.objects;
create policy "attachments_bucket_select" on storage.objects for select
  using (
    bucket_id = 'attachments'
    and exists (
      select 1 from attachments a
      where a.storage_path = storage.objects.name
        and can_access_attachment(a.entity_type, a.entity_id)
    )
  );
