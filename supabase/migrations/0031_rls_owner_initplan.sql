-- Desempenho da RLS por responsável.
--
-- As políticas chamavam can_access_owner(owner_id) para CADA linha (função SECURITY DEFINER,
-- que o Postgres não consegue expandir): cada chamada refazia consultas em profiles para saber
-- se o usuário é admin/gestor. Ler 1.000 negócios com organização e contato custava ~740 ms
-- (contra ~15 ms sem RLS).
--
-- A nova regra tem exatamente o mesmo significado, mas as partes que não dependem da linha
-- (usuário atual, é admin, ids da equipe do gestor) viram subconsultas avaliadas UMA vez por
-- comando (InitPlan / hashed subplan):
--   acessa se for o responsável, OU admin, OU gestor da equipe do responsável.

create or replace function public.accessible_owner_ids()
returns setof uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  -- ids dos perfis da equipe do gestor logado (vazio para quem não é gestor)
  select p.id
  from profiles p
  where public.current_role() = 'gestor'
    and p.team_id = public.current_team_id();
$$;

revoke all on function public.accessible_owner_ids() from public, anon;
grant execute on function public.accessible_owner_ids() to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['deals', 'organizations', 'contacts', 'activities', 'leads']
  loop
    execute format('drop policy %I on public.%I', t || '_access', t);
    execute format(
      $p$create policy %I on public.%I for all
         using (
           owner_id = (select auth.uid())
           or (select public.is_admin())
           or owner_id in (select public.accessible_owner_ids())
         )
         with check (
           owner_id = (select auth.uid())
           or (select public.is_admin())
           or owner_id in (select public.accessible_owner_ids())
         )$p$,
      t || '_access', t);
  end loop;
end $$;
