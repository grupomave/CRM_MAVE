-- 0008 revogou EXECUTE de "anon" nessas 4 funções, mas isso não teve
-- efeito: toda função ganha EXECUTE para o role PUBLIC automaticamente na
-- criação, e "anon"/"authenticated" herdam esse grant via PUBLIC — revogar
-- só de "anon" não remove o acesso que vem por PUBLIC. É preciso revogar
-- de PUBLIC e then conceder de volta só para "authenticated" (que as
-- políticas de RLS realmente precisam).

revoke execute on function public.is_admin() from public;
revoke execute on function public.current_role() from public;
revoke execute on function public.current_team_id() from public;
revoke execute on function public.can_access_owner(uuid) from public;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.current_role() to authenticated;
grant execute on function public.current_team_id() to authenticated;
grant execute on function public.can_access_owner(uuid) to authenticated;
