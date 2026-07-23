/**
 * Corrige orçamentos que receberam título/recebimento por engano.
 *
 * Estratégia:
 * - Orçamentos com financeiro (conta/parcela/recebimento) são convertidos em PEDIDO
 *   (eram vendas reais salvas com tipo errado).
 * - Status passa a 'fechado' se houver recebimento; senão 'aberto'.
 * - Ajusta recebimentos que passam do total do documento (ex.: 300 num pedido de 260).
 *
 * Uso:
 *   node scripts/fix-orcamentos-com-financeiro.mjs
 *   node scripts/fix-orcamentos-com-financeiro.mjs --apply
 */
import dotenv from "dotenv";
import pkg from "pg";

const { Client } = pkg;
dotenv.config();

const apply = process.argv.includes("--apply");
const empresaId = process.env.IMPORT_EMPRESA_ID || "4d2805ae-a9fb-4e22-a162-d1c8fc4e6049";

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

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
    const orcs = await client.query(
      `
      select d.id, d.total, d.status, d.tipo_documento, d.data_emissao,
             count(distinct cr.id)::int as n_contas,
             count(distinct p.id)::int as n_parcelas,
             count(r.id)::int as n_recebimentos,
             coalesce(sum(r.valor),0)::numeric as recebido
      from public.documentos_venda d
      left join public.contas_receber cr
        on cr.documento_id = d.id and cr.empresa_id = d.empresa_id
      left join public.contas_receber_parcelas p
        on p.conta_receber_id = cr.id and p.empresa_id = d.empresa_id
      left join public.recebimentos r
        on r.parcela_id = p.id and r.empresa_id = d.empresa_id
      where d.empresa_id = $1
        and d.tipo_documento = 'orcamento'
      group by d.id
      having count(distinct cr.id) > 0 or count(r.id) > 0
      order by d.id
      `,
      [empresaId]
    );

    console.log("\nOrçamentos com financeiro:");
    console.table(
      orcs.rows.map((r) => ({
        id: Number(r.id),
        total: Number(r.total),
        status: r.status,
        contas: Number(r.n_contas),
        parcelas: Number(r.n_parcelas),
        recs: Number(r.n_recebimentos),
        recebido: Number(r.recebido)
      }))
    );

    if (!orcs.rows.length) {
      console.log("Nada a corrigir.");
      return;
    }

    const ids = orcs.rows.map((r) => Number(r.id));

    // Parcelas desses docs com sum(recebimentos) > valor_parcela
    const excesso = await client.query(
      `
      select p.id as parcela_id, p.valor_parcela, cr.documento_id,
             coalesce(sum(r.valor),0)::numeric as sum_rec,
             count(r.id)::int as n
      from public.contas_receber_parcelas p
      join public.contas_receber cr on cr.id = p.conta_receber_id
      left join public.recebimentos r on r.parcela_id = p.id and r.empresa_id = p.empresa_id
      where p.empresa_id = $1
        and cr.documento_id = any($2::bigint[])
      group by p.id, p.valor_parcela, cr.documento_id
      having coalesce(sum(r.valor),0) > p.valor_parcela + 0.009
      `,
      [empresaId, ids]
    );
    console.log("\nParcelas com excesso nesses docs:");
    console.table(
      excesso.rows.map((r) => ({
        parcela: Number(r.parcela_id),
        doc: Number(r.documento_id),
        valor_parcela: Number(r.valor_parcela),
        sum_rec: Number(r.sum_rec),
        n: Number(r.n),
        excesso: round2(Number(r.sum_rec) - Number(r.valor_parcela))
      }))
    );

    if (!apply) {
      console.log("\nDry-run OK. Com --apply:");
      console.log(`- Converte ${ids.length} orçamento(s) -> pedido`);
      console.log(`- Ajusta ${excesso.rows.length} parcela(s) com excesso`);
      return;
    }

    await client.query("begin");
    try {
      // 1) Ajusta excesso de recebimentos nas parcelas (mantém o mais antigo)
      for (const row of excesso.rows) {
        const parcelaId = Number(row.parcela_id);
        const limite = round2(row.valor_parcela);
        const recs = await client.query(
          `
          select id, valor::numeric, created_at, observacoes
          from public.recebimentos
          where empresa_id = $1 and parcela_id = $2
          order by created_at asc nulls last, id asc
          `,
          [empresaId, parcelaId]
        );
        let acc = 0;
        for (const r of recs.rows) {
          const v = round2(r.valor);
          if (acc + v <= limite + 0.009) {
            acc = round2(acc + v);
            continue;
          }
          const room = round2(limite - acc);
          if (room > 0.009) {
            await client.query(
              `update public.recebimentos
               set valor = $3,
                   observacoes = trim(both from coalesce(observacoes,'') || ' | valor ajustado (excesso orcamento)')
               where empresa_id = $1 and id = $2`,
              [empresaId, Number(r.id), room]
            );
            acc = limite;
          } else {
            await client.query(
              `delete from public.recebimentos where empresa_id = $1 and id = $2`,
              [empresaId, Number(r.id)]
            );
          }
        }
        // Recalc parcela
        await client.query(
          `
          update public.contas_receber_parcelas p
          set valor_recebido = coalesce(s.total, 0),
              status = case
                when coalesce(s.total,0) <= 0.00001 then 'pendente'
                when coalesce(s.total,0) + 0.009 >= p.valor_parcela then 'recebido'
                else 'parcial'
              end,
              updated_at = now()
          from (
            select coalesce(sum(valor),0) as total
            from public.recebimentos
            where empresa_id = $1 and parcela_id = $2
          ) s
          where p.empresa_id = $1 and p.id = $2
          `,
          [empresaId, parcelaId]
        );
      }

      // 2) Recalc contas
      await client.query(
        `
        update public.contas_receber cr
        set valor_aberto = greatest(0, cr.valor_original - coalesce(s.recebido, 0)),
            status = case
              when coalesce(s.recebido,0) <= 0.00001 then 'aberto'
              when coalesce(s.recebido,0) + 0.009 >= cr.valor_original then 'recebido'
              else 'parcial'
            end,
            updated_at = now()
        from (
          select p.conta_receber_id, coalesce(sum(r.valor),0) as recebido
          from public.contas_receber_parcelas p
          left join public.recebimentos r on r.parcela_id = p.id and r.empresa_id = p.empresa_id
          where p.empresa_id = $1
            and p.conta_receber_id in (
              select id from public.contas_receber where empresa_id = $1 and documento_id = any($2::bigint[])
            )
          group by p.conta_receber_id
        ) s
        where cr.empresa_id = $1 and cr.id = s.conta_receber_id
        `,
        [empresaId, ids]
      );

      // 3) Converte orçamentos -> pedidos
      const conv = await client.query(
        `
        update public.documentos_venda d
        set tipo_documento = 'pedido',
            status = case
              when exists (
                select 1
                from public.contas_receber cr
                join public.contas_receber_parcelas p on p.conta_receber_id = cr.id
                join public.recebimentos r on r.parcela_id = p.id
                where cr.documento_id = d.id and cr.empresa_id = d.empresa_id
              ) then 'fechado'
              else coalesce(nullif(d.status, 'aprovado'), 'fechado')
            end,
            raw_payload = coalesce(d.raw_payload, '{}'::jsonb)
              || jsonb_build_object(
                   'converted_from_orcamento_fix', true,
                   'converted_at', now()
                 )
        where d.empresa_id = $1
          and d.id = any($2::bigint[])
          and d.tipo_documento = 'orcamento'
        returning d.id, d.tipo_documento, d.status, d.total
        `,
        [empresaId, ids]
      );
      console.log("Convertidos para pedido:");
      console.table(
        conv.rows.map((r) => ({
          id: Number(r.id),
          tipo: r.tipo_documento,
          status: r.status,
          total: Number(r.total)
        }))
      );

      await client.query("commit");
      console.log("\nCorrecao aplicada.");
    } catch (e) {
      await client.query("rollback");
      throw e;
    }

    // Revalida comparativo do mes
    const check = await client.query(
      `
      with bounds as (
        select date_trunc('month', timezone('America/Sao_Paulo', now()))::date as mes_ini,
               (date_trunc('month', timezone('America/Sao_Paulo', now())) + interval '1 month')::date as mes_fim
      ),
      fat as (
        select coalesce(sum(d.total),0)::numeric as total
        from public.documentos_venda d, bounds b
        where d.empresa_id = $1 and d.tipo_documento = 'pedido'
          and lower(coalesce(d.status,'')) <> 'cancelado'
          and timezone('America/Sao_Paulo', d.data_emissao)::date >= b.mes_ini
          and timezone('America/Sao_Paulo', d.data_emissao)::date < b.mes_fim
      ),
      rec as (
        select coalesce(sum(r.valor),0)::numeric as total
        from public.recebimentos r
        join public.contas_receber_parcelas p on p.id = r.parcela_id
        join public.contas_receber cr on cr.id = p.conta_receber_id
        join public.documentos_venda d on d.id = cr.documento_id
        , bounds b
        where r.empresa_id = $1
          and d.tipo_documento = 'pedido'
          and lower(coalesce(d.status,'')) <> 'cancelado'
          and timezone('America/Sao_Paulo', r.data_recebimento)::date >= b.mes_ini
          and timezone('America/Sao_Paulo', r.data_recebimento)::date < b.mes_fim
          and timezone('America/Sao_Paulo', d.data_emissao)::date >= b.mes_ini
          and timezone('America/Sao_Paulo', d.data_emissao)::date < b.mes_fim
      )
      select fat.total as faturamento, rec.total as recebido_pedidos_mes,
             (rec.total - fat.total)::numeric as recebido_menos_faturamento
      from fat, rec
      `,
      [empresaId]
    );
    console.log("Comparativo apos correcao:", check.rows[0]);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
