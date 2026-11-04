// O Supabase (PostgREST) tem um teto de linhas por requisição configurado no
// servidor — passar .limit(N) não ultrapassa esse teto, só .range() pagina de
// verdade. Usado nas listas de organizações/contatos, que já passam de 1.000
// registros (o teto padrão do PostgREST) e ficavam cortadas silenciosamente.
//
// As páginas são buscadas em "ondas" paralelas: a primeira onda tem `firstWave` páginas
// (use 3+ em tabelas que se sabe passarem de 2.000 linhas) e as seguintes `wave` páginas.
// Para ao encontrar uma página incompleta, então tabelas pequenas continuam em 1 consulta.
export async function fetchAllRows<T>(
  queryPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  options: { pageSize?: number; firstWave?: number; wave?: number } = {},
): Promise<T[]> {
  const pageSize = options.pageSize ?? 1000;
  const wave = Math.max(1, options.wave ?? 4);
  const rows: T[] = [];
  let page = 0;
  let size = Math.max(1, options.firstWave ?? 1);

  while (true) {
    const results = await Promise.all(
      Array.from({ length: size }, (_, i) => {
        const from = (page + i) * pageSize;
        return queryPage(from, from + pageSize - 1);
      }),
    );

    let done = false;
    for (const { data, error } of results) {
      // Um erro não pode virar "lista vazia" silenciosa: sobe para o error.tsx
      // da rota, que mostra a tela de erro com "Tentar novamente".
      if (error) {
        const message =
          typeof error === "object" && error !== null && "message" in error
            ? String((error as { message: unknown }).message)
            : String(error);
        throw new Error(`Falha ao carregar dados: ${message}`);
      }
      if (!data) {
        done = true;
        break;
      }
      rows.push(...data);
      if (data.length < pageSize) {
        done = true;
        break;
      }
    }
    if (done) break;
    page += size;
    size = wave;
  }

  return rows;
}
