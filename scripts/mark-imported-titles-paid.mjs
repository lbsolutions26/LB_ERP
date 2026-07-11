import dotenv from "dotenv";
import pkg from "pg";

const { Client } = pkg;

dotenv.config();

const empresaId = process.env.IMPORT_EMPRESA_ID || "4d2805ae-a9fb-4e22-a162-d1c8fc4e6049";
const excludedDocumentoId = Number(process.env.EXCLUDED_DOCUMENTO_ID || 3485);
const apply = process.argv.includes("--apply");

async function main() {
  const client = new Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  try {
    console.log(`Empresa: ${empresaId}`);
    console.log(`Documento excluido do ajuste: ${excludedDocumentoId}`);
    console.log(`Modo: ${apply ? "APPLY" : "DRY-RUN"}`);

    const preview = await client.query(
      `SELECT count(p.*)::int AS parcelas_pendentes,
              coalesce(sum(p.valor_parcela - coalesce(p.valor_recebido,0)), 0)::numeric AS valor_pendente
         FROM public.contas_receber_parcelas p
         JOIN public.contas_receber cr ON cr.id = p.conta_receber_id
        WHERE p.empresa_id = $1
          AND cr.documento_id IS DISTINCT FROM $2
          AND coalesce(p.valor_recebido, 0) < p.valor_parcela
          AND lower(coalesce(p.status, '')) NOT IN ('recebido','quitado','cancelado')`,
      [empresaId, excludedDocumentoId]
    );
    console.log("Parcelas afetadas:");
    console.table(preview.rows);

    const contasPreview = await client.query(
      `SELECT count(*)::int AS contas_afetadas
         FROM public.contas_receber cr
        WHERE cr.empresa_id = $1
          AND cr.documento_id IS DISTINCT FROM $2
          AND (cr.valor_aberto > 0 OR lower(coalesce(cr.status,'')) NOT IN ('recebido','quitado'))`,
      [empresaId, excludedDocumentoId]
    );
    console.log("Contas afetadas:");
    console.table(contasPreview.rows);

    if (!apply) {
      console.log("Dry-run concluido. Rode com --apply para aplicar as mudancas.");
      return;
    }

    await client.query("BEGIN");
    try {
      const inserted = await client.query(
        `WITH parcelas_pendentes AS (
           SELECT p.id, p.empresa_id, p.valor_parcela,
                  coalesce(p.valor_recebido, 0) AS valor_recebido,
                  p.forma_pagamento_id, p.vencimento
             FROM public.contas_receber_parcelas p
             JOIN public.contas_receber cr ON cr.id = p.conta_receber_id
            WHERE p.empresa_id = $1
              AND cr.documento_id IS DISTINCT FROM $2
              AND coalesce(p.valor_recebido, 0) < p.valor_parcela
              AND lower(coalesce(p.status, '')) NOT IN ('recebido','quitado','cancelado')
         )
         INSERT INTO public.recebimentos
           (empresa_id, parcela_id, data_recebimento, valor, forma_pagamento_id, observacoes)
         SELECT empresa_id,
                id,
                COALESCE(vencimento, now()),
                valor_parcela - valor_recebido,
                forma_pagamento_id,
                'Ajuste em massa: titulo importado marcado como pago'
           FROM parcelas_pendentes
         RETURNING id`,
        [empresaId, excludedDocumentoId]
      );
      console.log(`Recebimentos inseridos: ${inserted.rowCount}`);

      const parcelasUpdated = await client.query(
        `UPDATE public.contas_receber_parcelas p
            SET valor_recebido = p.valor_parcela,
                status = 'recebido'
           FROM public.contas_receber cr
          WHERE cr.id = p.conta_receber_id
            AND p.empresa_id = $1
            AND cr.documento_id IS DISTINCT FROM $2
            AND (coalesce(p.valor_recebido, 0) < p.valor_parcela
                 OR lower(coalesce(p.status,'')) NOT IN ('recebido','quitado','cancelado'))`,
        [empresaId, excludedDocumentoId]
      );
      console.log(`Parcelas atualizadas: ${parcelasUpdated.rowCount}`);

      const contasUpdated = await client.query(
        `UPDATE public.contas_receber cr
            SET valor_aberto = 0,
                status = 'recebido'
          WHERE cr.empresa_id = $1
            AND cr.documento_id IS DISTINCT FROM $2
            AND (cr.valor_aberto > 0 OR lower(coalesce(cr.status,'')) NOT IN ('recebido','quitado'))`,
        [empresaId, excludedDocumentoId]
      );
      console.log(`Contas atualizadas: ${contasUpdated.rowCount}`);

      await client.query("COMMIT");
      console.log("Ajuste concluido com sucesso.");
    } catch (txError) {
      await client.query("ROLLBACK");
      throw txError;
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
