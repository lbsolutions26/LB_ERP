import "dotenv/config";
import fs from "fs";
import pg from "pg";

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false }
});

await client.connect();
const sql = fs.readFileSync("supabase/add-preco-formacao.sql", "utf8");
await client.query(sql);
const check = await client.query(`
  select column_name, data_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'produto_catalogo'
    and column_name = 'preco_formacao'
`);
console.log("ok", check.rows);
await client.end();
