import "dotenv/config";
import pg from "pg";

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false }
});
await client.connect();
const r = await client.query(`
  select
    count(*)::int as total,
    count(*) filter (where imagem_path like '%/storage/v1/object/public/produto-images/%')::int as migrated,
    count(*) filter (where imagem_path like 'Produto_Images/%')::int as still_legacy
  from produto_catalogo
  where imagem_path is not null and btrim(imagem_path) <> ''
`);
console.log(r.rows[0]);
const sample = await client.query(`
  select id, left(imagem_path, 140) as path
  from produto_catalogo
  where imagem_path like '%storage%'
  order by id
  limit 3
`);
console.log(sample.rows);

// verify public URL responds
const url = sample.rows[0]?.path;
if (url) {
  const res = await fetch(url, { method: "HEAD" });
  console.log("sample head", res.status, res.headers.get("content-type"));
}

await client.end();
