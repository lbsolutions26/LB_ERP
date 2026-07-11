import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import pkg from "pg";

const { Client } = pkg;

dotenv.config();

const BUSINESS_TABLES = [
  "recebimentos",
  "contas_receber_parcelas",
  "contas_receber",
  "documento_venda_itens",
  "documentos_venda",
  "despesas",
  "formas_pagamento",
  "produto_catalogo",
  "produto_categorias",
  "clientes",
  "orcamento_itens",
  "orcamentos",
  "pedido_itens",
  "pedidos",
  "produtos"
];

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Defina ${name} no arquivo .env`);
  }
  return value;
}

function qIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

async function getTableCounts(client, tables) {
  const result = {};
  for (const table of tables) {
    const { rows } = await client.query(`select count(*)::bigint as total from public.${qIdent(table)};`);
    result[table] = Number(rows[0]?.total || 0);
  }
  return result;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const connectionString = requireEnv("SUPABASE_DB_URL");
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  await client.connect();

  try {
    const { rows: existingRows } = await client.query(
      `
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_type = 'BASE TABLE'
        and table_name = any($1::text[])
      order by table_name;
      `,
      [BUSINESS_TABLES]
    );

    const existing = existingRows.map((r) => r.table_name);
    if (!existing.length) {
      throw new Error("Nenhuma tabela de negocio alvo encontrada no schema public.");
    }

    const before = await getTableCounts(client, existing);

    if (apply) {
      await client.query("begin");
      try {
        const truncateList = existing.map((t) => `public.${qIdent(t)}`).join(", ");
        await client.query(`truncate table ${truncateList} restart identity cascade;`);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }

    const after = apply ? await getTableCounts(client, existing) : before;

    const report = {
      generatedAt: new Date().toISOString(),
      mode: apply ? "apply" : "dry-run",
      tablesTargeted: existing,
      countsBefore: before,
      countsAfter: after,
      preserved: ["empresas", "usuarios_empresas", "platform_admins", "auth.users"]
    };

    const outputDir = path.join(process.cwd(), "supabase");
    await fs.mkdir(outputDir, { recursive: true });
    const reportPath = path.join(outputDir, "reset-business-report.json");
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    console.log(`Modo: ${report.mode}`);
    console.log(`Tabelas alvo: ${existing.join(", ")}`);
    console.log(`Relatorio: ${reportPath}`);

    if (!apply) {
      console.log("Dry-run concluido. Use --apply para executar a limpeza.");
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
