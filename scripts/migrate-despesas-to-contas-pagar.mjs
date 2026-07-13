import "dotenv/config";
import pg from "pg";

/**
 * Importa despesas legadas (public.despesas) para o caixa unificado:
 * contas_pagar + contas_pagar_parcelas (+ pagamentos se já pagas).
 *
 * Idempotente: usa numero_titulo = LEGACY-DESP-{id}
 * e raw em observacoes com marker.
 *
 * Uso:
 *   node scripts/migrate-despesas-to-contas-pagar.mjs
 *   node scripts/migrate-despesas-to-contas-pagar.mjs --dry-run
 */

const dryRun = process.argv.includes("--dry-run");
const empresaFilter = process.env.IMPORT_EMPRESA_ID || null;

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false }
});

function isPago(status) {
  const s = String(status || "").toLowerCase();
  return s === "pago" || s === "quitado" || s === "recebido" || s === "pago_total";
}

function formatDateYmd(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

await client.connect();
try {
  const cols = await client.query(`
    select column_name, data_type
    from information_schema.columns
    where table_schema = 'public' and table_name = 'despesas'
    order by ordinal_position
  `);
  console.log("despesas columns:", cols.rows.map((r) => r.column_name).join(", "));

  const countSql = empresaFilter
    ? `select count(*)::int as n from public.despesas where empresa_id = $1`
    : `select count(*)::int as n from public.despesas`;
  const total = await client.query(countSql, empresaFilter ? [empresaFilter] : []);
  console.log("total despesas:", total.rows[0].n, dryRun ? "(dry-run)" : "");

  const existing = await client.query(`
    select numero_titulo
    from public.contas_pagar
    where numero_titulo like 'LEGACY-DESP-%'
  `);
  const already = new Set(existing.rows.map((r) => r.numero_titulo));
  console.log("já importados:", already.size);

  const listSql = empresaFilter
    ? `select * from public.despesas where empresa_id = $1 order by id`
    : `select * from public.despesas order by id`;
  const { rows: despesas } = await client.query(listSql, empresaFilter ? [empresaFilter] : []);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  if (!dryRun) await client.query("begin");

  try {
    for (const d of despesas) {
      const titulo = `LEGACY-DESP-${d.id}`;
      if (already.has(titulo)) {
        skipped += 1;
        continue;
      }

      const valor = Number(d.valor || 0);
      if (!(valor > 0)) {
        skipped += 1;
        continue;
      }

      const pago = isPago(d.status);
      const dataRef = d.data_despesa || d.created_at || new Date();
      const venc = formatDateYmd(dataRef);
      const desc = String(d.descricao || "Despesa legada").trim();
      const cat = d.categoria ? String(d.categoria).trim() : null;
      const obsParts = [desc];
      if (cat) obsParts.push(`Cat.: ${cat}`);
      obsParts.push(`Importado de despesas#${d.id}`);
      if (d.status) obsParts.push(`Status original: ${d.status}`);

      if (dryRun) {
        console.log("would import", titulo, desc, valor, pago ? "PAGO" : "ABERTO");
        created += 1;
        continue;
      }

      try {
        const contaRes = await client.query(
          `
          insert into public.contas_pagar (
            empresa_id, nota_entrada_id, fornecedor_id, origem, numero_titulo,
            emissao, valor_original, valor_aberto, status, observacoes
          ) values (
            $1, null, null, 'despesa_manual', $2,
            $3::timestamptz, $4, $5, $6, $7
          )
          returning id
        `,
          [
            d.empresa_id,
            titulo,
            dataRef,
            Number(valor.toFixed(2)),
            pago ? 0 : Number(valor.toFixed(2)),
            pago ? "pago" : "aberto",
            obsParts.join(" | ")
          ]
        );
        const contaId = contaRes.rows[0].id;

        const parcRes = await client.query(
          `
          insert into public.contas_pagar_parcelas (
            empresa_id, conta_pagar_id, numero_parcela, vencimento,
            valor_parcela, valor_pago, status, observacoes
          ) values (
            $1, $2, 1, $3::date, $4, $5, $6, $7
          )
          returning id
        `,
          [
            d.empresa_id,
            contaId,
            venc,
            Number(valor.toFixed(2)),
            pago ? Number(valor.toFixed(2)) : 0,
            pago ? "pago" : "pendente",
            desc
          ]
        );

        if (pago) {
          await client.query(
            `
            insert into public.pagamentos (
              empresa_id, parcela_id, data_pagamento, valor, observacoes
            ) values ($1, $2, $3::date, $4, $5)
          `,
            [
              d.empresa_id,
              parcRes.rows[0].id,
              venc,
              Number(valor.toFixed(2)),
              `Migração despesa legada #${d.id}`
            ]
          );
        }

        created += 1;
      } catch (err) {
        errors += 1;
        console.error("erro em", titulo, err.message);
      }
    }

    if (!dryRun) await client.query("commit");
  } catch (e) {
    if (!dryRun) await client.query("rollback");
    throw e;
  }

  console.log({ created, skipped, errors, dryRun });
  console.log(dryRun ? "DRY-RUN OK" : "MIGRAÇÃO OK");
} finally {
  await client.end();
}
