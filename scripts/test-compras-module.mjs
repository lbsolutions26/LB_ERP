import "dotenv/config";
import pg from "pg";

const empresaId = process.env.IMPORT_EMPRESA_ID || "4d2805ae-a9fb-4e22-a162-d1c8fc4e6049";
const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false }
});

await client.connect();
try {
  await client.query("begin");

  const forn = await client.query(
    `
    insert into public.fornecedores (empresa_id, nome, documento, cidade, uf)
    values ($1, 'Fornecedor Teste QA', '00.000.000/0001-99', 'Sao Paulo', 'SP')
    returning id, nome
  `,
    [empresaId]
  );
  const fornecedorId = forn.rows[0].id;
  console.log("fornecedor:", forn.rows[0]);

  const prod = await client.query(
    `
    select id, nome, estoque_atual from public.produto_catalogo
    where empresa_id = $1 and coalesce(controla_estoque, true) = true
    order by id limit 1
  `,
    [empresaId]
  );
  if (!prod.rows.length) throw new Error("sem produto");
  const produtoId = prod.rows[0].id;
  const saldoAntes = Number(prod.rows[0].estoque_atual || 0);

  const nota = await client.query(
    `
    insert into public.notas_entrada (
      empresa_id, fornecedor_id, numero_nf, serie, data_entrada, status,
      valor_produtos, valor_total, parcelas, vencimento_primeira
    ) values ($1, $2, 'NF-TEST', '1', current_date, 'rascunho', 100, 100, 2, current_date)
    returning id
  `,
    [empresaId, fornecedorId]
  );
  const notaId = nota.rows[0].id;

  await client.query(
    `
    insert into public.notas_entrada_itens (
      empresa_id, nota_id, produto_id, descricao, quantidade, valor_unitario, valor_total
    ) values ($1, $2, $3, 'Item teste', 5, 20, 100)
  `,
    [empresaId, notaId, produtoId]
  );

  // Simula lancamento financeiro
  const conta = await client.query(
    `
    insert into public.contas_pagar (
      empresa_id, nota_entrada_id, fornecedor_id, numero_titulo,
      valor_original, valor_aberto, status
    ) values ($1, $2, $3, $4, 100, 100, 'aberto')
    returning id
  `,
    [empresaId, notaId, fornecedorId, `NF-${notaId}`]
  );

  await client.query(
    `
    insert into public.contas_pagar_parcelas (
      empresa_id, conta_pagar_id, numero_parcela, vencimento, valor_parcela, status
    ) values
      ($1, $2, 1, current_date, 50, 'pendente'),
      ($1, $2, 2, current_date + 30, 50, 'pendente')
  `,
    [empresaId, conta.rows[0].id]
  );

  // Entrada de estoque
  await client.query(
    `
    update public.produto_catalogo
    set estoque_atual = coalesce(estoque_atual,0) + 5
    where id = $1 and empresa_id = $2
  `,
    [produtoId, empresaId]
  );

  await client.query(
    `
    insert into public.estoque_movimentos (
      empresa_id, produto_id, tipo, quantidade, saldo_anterior, saldo_posterior, motivo
    ) values ($1, $2, 'entrada', 5, $3, $4, 'teste nf')
  `,
    [empresaId, produtoId, saldoAntes, saldoAntes + 5]
  );

  const check = await client.query(
    `
    select
      (select count(*) from fornecedores where empresa_id = $1) as forn,
      (select count(*) from notas_entrada where empresa_id = $1) as notas,
      (select count(*) from contas_pagar where empresa_id = $1) as cp,
      (select count(*) from contas_pagar_parcelas where empresa_id = $1) as cpp
  `,
    [empresaId]
  );
  console.log("counts during test:", check.rows[0]);

  await client.query("rollback");
  console.log("rollback ok");
  console.log("TESTE COMPRAS OK");
} catch (e) {
  try {
    await client.query("rollback");
  } catch (_r) {
    /* ignore */
  }
  console.error(e);
  process.exit(1);
} finally {
  await client.end();
}
