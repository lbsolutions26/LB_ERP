/**
 * Após conversão orçamento→pedido, às vezes ficam DOIS documentos:
 * - o orçamento (às vezes virado pedido no mesmo id)
 * - o pedido novo (raw_payload.orcamento_origem_id)
 *
 * Este script reverte a origem para orçamento aprovado e garante
 * financeiro só no pedido da conversão.
 *
 * Uso:
 *   node scripts/fix-pedidos-duplicados-conversao.mjs
 *   node scripts/fix-pedidos-duplicados-conversao.mjs --apply
 */
import dotenv from "dotenv";
import pkg from "pg";

const { Client } = pkg;
dotenv.config();

const apply = process.argv.includes("--apply");
const empresaId = process.env.IMPORT_EMPRESA_ID || "4d2805ae-a9fb-4e22-a162-d1c8fc4e6049";

async function connect() {
  const url = new URL(process.env.SUPABASE_DB_URL);
  const client = new Client({
    host: "aws-1-sa-east-1.pooler.supabase.com",
    port: 6543,
    user: "postgres.ozbmqyehblqznnbmzgib",
    password: decodeURIComponent(url.password),
    database: "postgres",
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  return client;
}

async function main() {
  const client = await connect();
  console.log(`Empresa: ${empresaId}`);
  console.log(`Modo: ${apply ? "APPLY" : "DRY-RUN"}`);

  try {
    const pairs = await client.query(
      `
      select p.id as pedido_id,
             nullif(p.raw_payload->>'orcamento_origem_id','')::bigint as orc_id,
             p.total as pedido_total,
             p.status as pedido_status,
             o.id as origem_id,
             o.tipo_documento as origem_tipo,
             o.status as origem_status,
             o.total as origem_total,
             (select count(*)::int from contas_receber cr where cr.documento_id = p.id) as contas_ped,
             (select count(*)::int from contas_receber cr where cr.documento_id = o.id) as contas_orc
      from documentos_venda p
      join documentos_venda o
        on o.id = nullif(p.raw_payload->>'orcamento_origem_id','')::bigint
       and o.empresa_id = p.empresa_id
      where p.empresa_id = $1
        and p.tipo_documento = 'pedido'
        and p.raw_payload ? 'orcamento_origem_id'
      order by p.id
      `,
      [empresaId]
    );

    console.log("Pares pedido ← orçamento_origem:");
    console.table(
      pairs.rows.map((r) => ({
        pedido: Number(r.pedido_id),
        orc: Number(r.orc_id),
        ped_total: Number(r.pedido_total),
        orc_tipo: r.origem_tipo,
        orc_status: r.origem_status,
        orc_total: Number(r.origem_total),
        contas_ped: Number(r.contas_ped),
        contas_orc: Number(r.contas_orc)
      }))
    );

    const toFix = pairs.rows.filter((r) => r.origem_tipo === "pedido" || Number(r.contas_orc) > 0);
    console.log(`Para corrigir: ${toFix.length}`);

    if (!apply) {
      console.log("Dry-run. Com --apply: origem volta a orcamento aprovado e sem financeiro.");
      return;
    }

    await client.query("begin");
    try {
      for (const r of toFix) {
        const orcId = Number(r.orc_id);
        const pedId = Number(r.pedido_id);

        // Remove financeiro residual na origem
        await client.query(
          `
          delete from public.recebimentos r
          using public.contas_receber_parcelas p, public.contas_receber cr
          where r.parcela_id = p.id and p.conta_receber_id = cr.id
            and r.empresa_id = $1 and cr.documento_id = $2
          `,
          [empresaId, orcId]
        );
        await client.query(
          `
          delete from public.contas_receber_parcelas p
          using public.contas_receber cr
          where p.conta_receber_id = cr.id
            and p.empresa_id = $1 and cr.documento_id = $2
          `,
          [empresaId, orcId]
        );
        await client.query(
          `delete from public.contas_receber where empresa_id = $1 and documento_id = $2`,
          [empresaId, orcId]
        );

        // Origem volta a ser orçamento aprovado (não conta no faturamento)
        await client.query(
          `
          update public.documentos_venda
          set tipo_documento = 'orcamento',
              status = 'aprovado',
              raw_payload = coalesce(raw_payload, '{}'::jsonb)
                || jsonb_build_object(
                     'pedido_convertido_id', $3::bigint,
                     'convertido_em', coalesce(raw_payload->>'convertido_em', now()::text),
                     'dedup_fix_at', now()::text
                   )
          where empresa_id = $1 and id = $2
          `,
          [empresaId, orcId, pedId]
        );

        console.log(`Origem #${orcId} → orcamento aprovado; financeiro só no pedido #${pedId}`);
      }
      await client.query("commit");
    } catch (e) {
      await client.query("rollback");
      throw e;
    }

    const cmp = await client.query(
      `
      with bounds as (
        select date_trunc('month', timezone('America/Sao_Paulo', now()))::date as mes_ini,
               (date_trunc('month', timezone('America/Sao_Paulo', now())) + interval '1 month')::date as mes_fim
      ),
      fat as (
        select coalesce(sum(d.total),0)::numeric as total, count(*)::int as n
        from documentos_venda d, bounds b
        where d.empresa_id=$1 and d.tipo_documento='pedido'
          and lower(coalesce(d.status,''))<>'cancelado'
          and timezone('America/Sao_Paulo', d.data_emissao)::date >= b.mes_ini
          and timezone('America/Sao_Paulo', d.data_emissao)::date < b.mes_fim
      ),
      rec as (
        select coalesce(sum(r.valor),0)::numeric as total
        from recebimentos r
        join contas_receber_parcelas p on p.id=r.parcela_id
        join contas_receber cr on cr.id=p.conta_receber_id
        join documentos_venda d on d.id=cr.documento_id
        , bounds b
        where r.empresa_id=$1 and d.tipo_documento='pedido'
          and lower(coalesce(d.status,''))<>'cancelado'
          and timezone('America/Sao_Paulo', r.data_recebimento)::date >= b.mes_ini
          and timezone('America/Sao_Paulo', r.data_recebimento)::date < b.mes_fim
          and timezone('America/Sao_Paulo', d.data_emissao)::date >= b.mes_ini
          and timezone('America/Sao_Paulo', d.data_emissao)::date < b.mes_fim
      )
      select fat.total as faturamento, fat.n as n_pedidos, rec.total as recebido
      from fat, rec
      `,
      [empresaId]
    );
    console.log("Comparativo mes apos fix:", cmp.rows[0]);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
