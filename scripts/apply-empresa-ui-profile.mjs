import "dotenv/config";
import fs from "fs";
import pg from "pg";

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false }
});

await client.connect();
try {
  const sql = fs.readFileSync("supabase/add-empresa-ui-profile.sql", "utf8");
  await client.query(sql);

  const cols = await client.query(`
    select column_name, data_type, column_default
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'empresas'
      and column_name in ('tipo_empresa', 'ui_config')
    order by column_name
  `);

  const sample = await client.query(`
    select id, nome, tipo_empresa, ui_config
    from public.empresas
    order by nome
    limit 20
  `);

  console.log("empresas columns:", cols.rows);
  console.log(
    "empresas:",
    sample.rows.map((r) => ({
      nome: r.nome,
      tipo_empresa: r.tipo_empresa,
      ui_config: r.ui_config
    }))
  );
  console.log("ok");
} finally {
  await client.end();
}
