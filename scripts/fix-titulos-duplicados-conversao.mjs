/**
 * Remove títulos que ficaram no orçamento após conversão para pedido
 * (cenário: financeiro no orçamento + novo financeiro no pedido).
 *
 * Se o pedido já tem título: apaga o do orçamento.
 * Se só o orçamento tem: move para o pedido (documento_id + renomeia DOC-*).
 *
 * Uso:
 *   node scripts/fix-titulos-duplicados-conversao.mjs
 *   node scripts/fix-titulos-duplicados-conversao.mjs --apply
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
    // 1) Orçamentos com pedido_convertido_id e títulos
    const rows = await client.query(
      `
      select d.id as orc_id,
             nullif(d.raw_payload->>'pedido_convertido_id','')::bigint as pedido_id,
             (select count(*)::int from contas_receber cr
               where cr.empresa_id = d.empresa_id and cr.documento_id = d.id) as contas_orc,
             (select count(*)::int from contas_receber cr
               where cr.empresa_id = d.empresa_id
                 and cr.documento_id = nullif(d.raw_payload->>'pedido_convertido_id','')::bigint) as contas_ped
      from documentos_venda d
      where d.empresa_id = $1
        and (
          d.tipo_documento = 'orcamento'
          or (d.raw_payload ? 'pedido_convertido_id')
          or (d.raw_payload ? 'orcamento_origem_id')
        )
      `,
      [empresaId]
    );

    // Também: pedidos com orcamento_origem_id cujo orçamento ainda tem contas
    const fromPedidos = await client.query(
      `
      select nullif(p.raw_payload->>'orcamento_origem_id','')::bigint as orc_id,
             p.id as pedido_id,
             (select count(*)::int from contas_receber cr
               where cr.empresa_id = p.empresa_id
                 and cr.documento_id = nullif(p.raw_payload->>'orcamento_origem_id','')::bigint) as contas_orc,
             (select count(*)::int from contas_receber cr
               where cr.empresa_id = p.empresa_id and cr.documento_id = p.id) as contas_ped
      from documentos_venda p
      where p.empresa_id = $1
        and p.tipo_documento = 'pedido'
        and p.raw_payload ? 'orcamento_origem_id'
      `,
      [empresaId]
    );

    const map = new Map();
    for (const r of [...rows.rows, ...fromPedidos.rows]) {
      const orcId = Number(r.orc_id);
      const pedId = Number(r.pedido_id);
      if (!Number.isFinite(orcId) || !Number.isFinite(pedId) || orcId <= 0 || pedId <= 0) continue;
      const key = `${orcId}->${pedId}`;
      map.set(key, {
        orc_id: orcId,
        pedido_id: pedId,
        contas_orc: Number(r.contas_orc || 0),
        contas_ped: Number(r.contas_ped || 0)
      });
    }

    const actions = [];
    for (const item of map.values()) {
      if (item.contas_orc <= 0) continue;
      if (item.contas_ped > 0) {
        actions.push({ ...item, action: "delete_orcamento_finance" });
      } else {
        actions.push({ ...item, action: "move_orcamento_to_pedido" });
      }
    }

    console.log("Ações:");
    console.table(actions);

    if (!actions.length) {
      console.log("Nenhum título duplicado de conversão encontrado.");
      return;
    }
    if (!apply) {
      console.log("Dry-run OK. Rode com --apply para corrigir.");
      return;
    }

    await client.query("begin");
    try {
      for (const a of actions) {
        if (a.action === "delete_orcamento_finance") {
          // apaga recebimentos -> parcelas -> contas do orçamento
          await client.query(
            `
            delete from public.recebimentos r
            using public.contas_receber_parcelas p, public.contas_receber cr
            where r.parcela_id = p.id
              and p.conta_receber_id = cr.id
              and r.empresa_id = $1
              and cr.empresa_id = $1
              and cr.documento_id = $2
            `,
            [empresaId, a.orc_id]
          );
          await client.query(
            `
            delete from public.contas_receber_parcelas p
            using public.contas_receber cr
            where p.conta_receber_id = cr.id
              and p.empresa_id = $1
              and cr.documento_id = $2
            `,
            [empresaId, a.orc_id]
          );
          await client.query(
            `delete from public.contas_receber where empresa_id = $1 and documento_id = $2`,
            [empresaId, a.orc_id]
          );
          console.log(`Apagado financeiro do orçamento #${a.orc_id} (pedido #${a.pedido_id} já tinha título)`);
        } else if (a.action === "move_orcamento_to_pedido") {
          await client.query(
            `
            update public.contas_receber
            set documento_id = $3,
                numero_titulo = regexp_replace(coalesce(numero_titulo, ''), '^DOC-\\d+', 'DOC-' || $3::text),
                updated_at = now()
            where empresa_id = $1
              and documento_id = $2
            `,
            [empresaId, a.orc_id, a.pedido_id]
          );
          console.log(`Movido financeiro orçamento #${a.orc_id} → pedido #${a.pedido_id}`);
        }
      }
      await client.query("commit");
      console.log("Correção aplicada.");
    } catch (e) {
      await client.query("rollback");
      throw e;
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
