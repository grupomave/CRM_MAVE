-- Mesma correção da 0031 para as anotações (notes): a política chamava
-- can_access_owner(author_id) por linha (ler as 2.272 anotações levava ~535 ms).
-- Agora o usuário atual, "é admin" e os ids da equipe do gestor são avaliados uma vez por consulta.

drop policy notes_access on public.notes;

create policy notes_access on public.notes for all
  using (
    author_id = (select auth.uid())
    or (select public.is_admin())
    or author_id in (select public.accessible_owner_ids())
  )
  with check (
    author_id = (select auth.uid())
    or (select public.is_admin())
    or author_id in (select public.accessible_owner_ids())
  );
