import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildExport, EXPORT_ENTITIES, type ExportEntity } from "@/lib/export/entities";
import { exportFileName, xlsxStream } from "@/lib/export/xlsx-stream";

// GET /api/export/{leads|organizacoes|pessoas|negocios}?<mesmos parâmetros da tela>
// Devolve um .xlsx com TODOS os registros que batem com os filtros, a busca
// e a ordenação atuais (sem paginação), respeitando a RLS do usuário.
export async function GET(request: NextRequest, { params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  if (!(EXPORT_ENTITIES as readonly string[]).includes(entity)) {
    return Response.json({ error: "Tipo de exportação inválido." }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401 });
  }

  try {
    const result = await buildExport(entity as ExportEntity, supabase, request.nextUrl.searchParams);
    const filename = exportFileName(result.filePrefix);
    const stream = xlsxStream({ sheetName: result.sheetName, columns: result.columns, rows: result.rows });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Export-Count": String(result.rows.length),
      },
    });
  } catch (error) {
    console.error("Falha na exportação", entity, error);
    return Response.json(
      { error: "Não foi possível gerar a planilha. Tente novamente em instantes." },
      { status: 500 },
    );
  }
}
