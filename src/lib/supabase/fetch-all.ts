// O Supabase (PostgREST) tem um teto de linhas por requisição configurado no
// servidor — passar .limit(N) não ultrapassa esse teto, só .range() pagina de
// verdade. Usado nas listas de organizações/contatos, que já passam de 1.000
// registros (o teto padrão do PostgREST) e ficavam cortadas silenciosamente.
export async function fetchAllRows<T>(
  queryPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await queryPage(from, from + pageSize - 1);
    if (error || !data) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}
