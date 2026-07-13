import "dotenv/config";
import fs from "fs";
import pg from "pg";

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false }
});

await client.connect();
try {
  const sql = fs.readFileSync("supabase/add-compras-module.sql", "utf8");
  await client.query(sql);

  const tables = await client.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in (
        'fornecedores',
        'notas_entrada',
        'notas_entrada_itens',
        'contas_pagar',
        'contas_pagar_parcelas',
        'pagamentos'
      )
    order by table_name
  `);

  console.log("tables:", tables.rows.map((r) => r.table_name));
  console.log("ok");
} finally {
  await client.end();
}
