import "dotenv/config";
import fs from "fs";
import pg from "pg";

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false }
});

await client.connect();
try {
  const sql = fs.readFileSync("supabase/add-estoque-module.sql", "utf8");
  await client.query(sql);

  const tables = await client.query(`
    select column_name, data_type
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'estoque_movimentos'
    order by ordinal_position
  `);

  const cols = await client.query(`
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'produto_catalogo'
      and column_name in ('estoque_maximo', 'lead_time_dias', 'classe_abc', 'classe_abc_atualizado_em')
    order by column_name
  `);

  const fn = await client.query(`
    select proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and proname = 'registrar_estoque_movimento'
  `);

  console.log("estoque_movimentos columns:", tables.rows.length);
  console.log("produto_catalogo new cols:", cols.rows.map((r) => r.column_name));
  console.log("function:", fn.rows.map((r) => r.proname));
  console.log("ok");
} finally {
  await client.end();
}
