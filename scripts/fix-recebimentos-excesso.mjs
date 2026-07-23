/**
 * Corrige recebimentos em excesso: quando a soma dos recebimentos de uma parcela
 * (ou do pedido) ultrapassa o valor da parcela/pedido.
 *
 * Estratégia:
 * 1) Por parcela: se sum(recebimentos) > valor_parcela, remove os mais recentes
 *    (prioriza manter o mais antigo / com observacao de criacao) ate caber.
 * 2) Recalcula valor_recebido e status da parcela.
 * 3) Recalcula valor_aberto e status da conta.
 *
 * Uso:
 *   node scripts/fix-recebimentos-excesso.mjs           # dry-run
 *   node scripts/fix-recebimentos-excesso.mjs --apply  # aplica
 */
import dotenv from "dotenv";
import pkg from "pg";
import dns from "dns/promises";

const { Client } = pkg;
dotenv.config();

const apply = process.argv.includes("--apply");
const empresaId = process.env.IMPORT_EMPRESA_ID || "4d2805ae-a9fb-4e22-a162-d1c8fc4e6049";

async function connect() {
  const base = new URL(process.env.SUPABASE_DB_URL);
  const password = decodeURIComponent(base.password);
  const ref = "ozbmqyehblqznnbmzgib";
  const candidates = [
    { host: "aws-1-sa-east-1.pooler.supabase.com", port: 6543, user: `postgres.${ref}` },
    { host: "aws-0-sa-east-1.pooler.supabase.com", port: 6543, user: `postgres.${ref}` },
    { host: base.hostname, port: Number(base.port || 5432), user: decodeURIComponent(base.username) }
  ];

  for (const c of candidates) {
    try {
      await dns.lookup(c.host, { family: 4 });
      const client = new Client({
        host: c.host,
        port: c.port,
        user: c.user,
        password,
        database: "postgres",
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000
      });
      await client.connect();
      return client;
    } catch (_e) {
      // try next
    }
  }
  throw new Error("Nao foi possivel conectar ao Postgres (pooler/direct).");
}

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

async function main() {
  const client = await connect();
  console.log(`Empresa: ${empresaId}`);
  console.log(`Modo: ${apply ? "APPLY" : "DRY-RUN"}`);

  try {
    // Diagnostico: pedidos do mes corrente (SP) com recebido > total
    const excessoMes = await client.query(
      `
      with bounds as (
        select
          date_trunc('month', timezone('America/Sao_Paulo', now()))::date as mes_ini,
          (date_trunc('month', timezone('America/Sao_Paulo', now())) + interval '1 month')::date as mes_fim
      ),
      docs as (
        select d.id, d.total, d.data_emissao, d.status
        from public.documentos_venda d, bounds b
        where d.empresa_id = $1
          and d.tipo_documento = 'pedido'
          and lower(coalesce(d.status,'')) <> 'cancelado'
          and timezone('America/Sao_Paulo', d.data_emissao)::date >= b.mes_ini
          and timezone('America/Sao_Paulo', d.data_emissao)::date < b.mes_fim
      ),
      rec as (
        select cr.documento_id,
               sum(r.valor)::numeric as recebido,
               count(r.id)::int as n_rec
        from public.recebimentos r
        join public.contas_receber_parcelas p on p.id = r.parcela_id
        join public.contas_receber cr on cr.id = p.conta_receber_id
        where r.empresa_id = $1
          and cr.documento_id is not null
        group by cr.documento_id
      )
      select d.id as documento_id,
             d.total::numeric as total_pedido,
             coalesce(rec.recebido,0)::numeric as recebido_total,
             coalesce(rec.n_rec,0)::int as n_recebimentos,
             (coalesce(rec.recebido,0) - d.total)::numeric as excesso
      from docs d
      left join rec on rec.documento_id = d.id
      where coalesce(rec.recebido,0) > d.total + 0.009
      order by excesso desc
      `,
      [empresaId]
    );

    console.log("\n=== Pedidos do mes (SP) com recebido TOTAL > total do pedido ===");
    console.table(
      excessoMes.rows.map((r) => ({
        pedido: Number(r.documento_id),
        total: Number(r.total_pedido),
        recebido: Number(r.recebido_total),
        n_rec: Number(r.n_recebimentos),
        excesso: Number(r.excesso)
      }))
    );
    const somaExcessoMes = excessoMes.rows.reduce((s, r) => s + Number(r.excesso || 0), 0);
    console.log(`Soma excesso (mes): R$ ${somaExcessoMes.toFixed(2)} em ${excessoMes.rows.length} pedidos`);

    // Parcelas com sum(recebimentos) > valor_parcela (qualquer periodo)
    const parcelasExcesso = await client.query(
      `
      select p.id as parcela_id,
             p.conta_receber_id,
             p.numero_parcela,
             p.valor_parcela::numeric,
             p.valor_recebido::numeric as valor_recebido_campo,
             p.status,
             cr.documento_id,
             cr.numero_titulo,
             coalesce(sum(r.valor),0)::numeric as sum_recebimentos,
             count(r.id)::int as n_recebimentos,
             (coalesce(sum(r.valor),0) - p.valor_parcela)::numeric as excesso
      from public.contas_receber_parcelas p
      join public.contas_receber cr on cr.id = p.conta_receber_id
      left join public.recebimentos r on r.parcela_id = p.id and r.empresa_id = p.empresa_id
      where p.empresa_id = $1
      group by p.id, p.conta_receber_id, p.numero_parcela, p.valor_parcela, p.valor_recebido, p.status,
               cr.documento_id, cr.numero_titulo
      having coalesce(sum(r.valor),0) > p.valor_parcela + 0.009
      order by excesso desc
      `,
      [empresaId]
    );

    console.log("\n=== Parcelas com sum(recebimentos) > valor_parcela (todas) ===");
    console.table(
      parcelasExcesso.rows.slice(0, 40).map((r) => ({
        parcela: Number(r.parcela_id),
        doc: r.documento_id != null ? Number(r.documento_id) : null,
        titulo: r.numero_titulo,
        valor_parcela: Number(r.valor_parcela),
        sum_rec: Number(r.sum_recebimentos),
        n: Number(r.n_recebimentos),
        excesso: Number(r.excesso),
        status: r.status
      }))
    );
    console.log(`Total parcelas com excesso: ${parcelasExcesso.rows.length}`);

    // Detalhe dos recebimentos dessas parcelas
    const parcelaIds = parcelasExcesso.rows.map((r) => Number(r.parcela_id));
    let toDelete = [];

    if (parcelaIds.length) {
      const recs = await client.query(
        `
        select r.id, r.parcela_id, r.valor::numeric, r.data_recebimento, r.observacoes, r.created_at
        from public.recebimentos r
        where r.empresa_id = $1
          and r.parcela_id = any($2::bigint[])
        order by r.parcela_id, r.created_at asc nulls last, r.id asc
        `,
        [empresaId, parcelaIds]
      );

      const byParcela = new Map();
      for (const row of recs.rows) {
        const pid = Number(row.parcela_id);
        if (!byParcela.has(pid)) byParcela.set(pid, []);
        byParcela.get(pid).push(row);
      }

      for (const p of parcelasExcesso.rows) {
        const pid = Number(p.parcela_id);
        const limite = round2(p.valor_parcela);
        const list = byParcela.get(pid) || [];
        // Preferir manter: 1) mais antigo 2) com obs de criacao
        const ranked = [...list].sort((a, b) => {
          const aCreate = /cria[cç][aã]o|automaticamente|importado/i.test(String(a.observacoes || "")) ? 0 : 1;
          const bCreate = /cria[cç][aã]o|automaticamente|importado/i.test(String(b.observacoes || "")) ? 0 : 1;
          if (aCreate !== bCreate) return aCreate - bCreate;
          const ta = new Date(a.created_at || a.data_recebimento || 0).getTime();
          const tb = new Date(b.created_at || b.data_recebimento || 0).getTime();
          if (ta !== tb) return ta - tb;
          return Number(a.id) - Number(b.id);
        });

        let acc = 0;
        const keep = [];
        const drop = [];
        for (const r of ranked) {
          const v = round2(r.valor);
          if (acc + v <= limite + 0.009) {
            keep.push(r);
            acc = round2(acc + v);
          } else if (acc < limite - 0.009 && acc + v > limite + 0.009) {
            // Recebimento que estoura sozinho: reduzir valor em vez de apagar (se apply)
            drop.push({ ...r, action: "trim", newValor: round2(limite - acc) });
            acc = limite;
          } else {
            drop.push({ ...r, action: "delete" });
          }
        }
        toDelete.push({
          parcela_id: pid,
          documento_id: p.documento_id != null ? Number(p.documento_id) : null,
          valor_parcela: limite,
          keep: keep.map((r) => ({ id: Number(r.id), valor: Number(r.valor), obs: r.observacoes })),
          drop: drop.map((r) => ({
            id: Number(r.id),
            valor: Number(r.valor),
            action: r.action,
            newValor: r.newValor,
            obs: r.observacoes
          }))
        });
      }
    }

    const deleteIds = toDelete.flatMap((x) => x.drop.filter((d) => d.action === "delete").map((d) => d.id));
    const trimList = toDelete.flatMap((x) => x.drop.filter((d) => d.action === "trim"));
    const sumDelete = toDelete
      .flatMap((x) => x.drop)
      .reduce((s, d) => s + (d.action === "delete" ? d.valor : Math.max(0, d.valor - (d.newValor || 0))), 0);

    console.log("\n=== Plano de correcao ===");
    console.log(`Recebimentos a apagar: ${deleteIds.length}`);
    console.log(`Recebimentos a reduzir: ${trimList.length}`);
    console.log(`Valor removido (aprox): R$ ${round2(sumDelete).toFixed(2)}`);
    console.log("Amostra plano (5 parcelas):");
    console.log(JSON.stringify(toDelete.slice(0, 5), null, 2));

    if (!apply) {
      console.log("\nDry-run concluido. Rode com --apply para aplicar.");
      return;
    }

    if (!deleteIds.length && !trimList.length) {
      console.log("Nada a corrigir.");
      return;
    }

    await client.query("begin");
    try {
      if (deleteIds.length) {
        const del = await client.query(
          `delete from public.recebimentos
           where empresa_id = $1 and id = any($2::bigint[])
           returning id`,
          [empresaId, deleteIds]
        );
        console.log(`Apagados: ${del.rowCount}`);
      }

      for (const t of trimList) {
        if (t.newValor != null && t.newValor > 0.009) {
          await client.query(
            `update public.recebimentos
             set valor = $3,
                 observacoes = trim(both from coalesce(observacoes,'') || ' | valor ajustado (excesso)')
             where empresa_id = $1 and id = $2`,
            [empresaId, t.id, t.newValor]
          );
        } else {
          await client.query(
            `delete from public.recebimentos where empresa_id = $1 and id = $2`,
            [empresaId, t.id]
          );
        }
      }
      console.log(`Ajustes de valor: ${trimList.length}`);

      // Recalcula parcelas afetadas
      const affectedParcelas = toDelete.map((x) => x.parcela_id);
      await client.query(
        `
        update public.contas_receber_parcelas p
        set valor_recebido = coalesce(s.total, 0),
            status = case
              when coalesce(s.total, 0) <= 0.00001 then 'pendente'
              when coalesce(s.total, 0) + 0.009 >= p.valor_parcela then 'recebido'
              else 'parcial'
            end,
            updated_at = now()
        from (
          select p2.id as parcela_id, coalesce(sum(r.valor),0) as total
          from public.contas_receber_parcelas p2
          left join public.recebimentos r on r.parcela_id = p2.id and r.empresa_id = p2.empresa_id
          where p2.empresa_id = $1
            and p2.id = any($2::bigint[])
          group by p2.id
        ) s
        where p.empresa_id = $1
          and p.id = s.parcela_id
        `,
        [empresaId, affectedParcelas]
      );

      // Recalcula contas afetadas
      await client.query(
        `
        update public.contas_receber cr
        set valor_aberto = greatest(0, cr.valor_original - coalesce(s.recebido, 0)),
            status = case
              when coalesce(s.recebido, 0) <= 0.00001 then 'aberto'
              when coalesce(s.recebido, 0) + 0.009 >= cr.valor_original then 'recebido'
              else 'parcial'
            end,
            updated_at = now()
        from (
          select p.conta_receber_id,
                 coalesce(sum(r.valor),0) as recebido
          from public.contas_receber_parcelas p
          left join public.recebimentos r on r.parcela_id = p.id and r.empresa_id = p.empresa_id
          where p.empresa_id = $1
            and p.id = any($2::bigint[])
          group by p.conta_receber_id
        ) s
        where cr.empresa_id = $1
          and cr.id = s.conta_receber_id
        `,
        [empresaId, affectedParcelas]
      );

      await client.query("commit");
      console.log("Correcao aplicada com sucesso.");
    } catch (e) {
      await client.query("rollback");
      throw e;
    }

    // Revalida
    const after = await client.query(
      `
      with bounds as (
        select
          date_trunc('month', timezone('America/Sao_Paulo', now()))::date as mes_ini,
          (date_trunc('month', timezone('America/Sao_Paulo', now())) + interval '1 month')::date as mes_fim
      ),
      docs as (
        select d.id, d.total
        from public.documentos_venda d, bounds b
        where d.empresa_id = $1
          and d.tipo_documento = 'pedido'
          and lower(coalesce(d.status,'')) <> 'cancelado'
          and timezone('America/Sao_Paulo', d.data_emissao)::date >= b.mes_ini
          and timezone('America/Sao_Paulo', d.data_emissao)::date < b.mes_fim
      ),
      rec as (
        select cr.documento_id, sum(r.valor)::numeric as recebido
        from public.recebimentos r
        join public.contas_receber_parcelas p on p.id = r.parcela_id
        join public.contas_receber cr on cr.id = p.conta_receber_id
        where r.empresa_id = $1
        group by cr.documento_id
      )
      select count(*)::int as n,
             coalesce(sum(greatest(0, coalesce(rec.recebido,0) - d.total)),0)::numeric as excesso_restante
      from docs d
      left join rec on rec.documento_id = d.id
      where coalesce(rec.recebido,0) > d.total + 0.009
      `,
      [empresaId]
    );
    console.log("Apos correcao (pedidos do mes com excesso):", after.rows[0]);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
