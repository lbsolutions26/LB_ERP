import "dotenv/config";
import pg from "pg";

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false }
});
await client.connect();
const r = await client.query(`
  select
    count(*) filter (where raw_payload->>'foto_url' like '%pedido-images%')::int as migrated,
    count(*) filter (
      where raw_payload #>> '{pedido_row,Foto}' is not null
        and btrim(raw_payload #>> '{pedido_row,Foto}') <> ''
    )::int as with_foto_field
  from documentos_venda
  where tipo_documento = 'pedido'
`);
console.log(r.rows[0]);
const s = await client.query(`
  select id, raw_payload->>'foto_url' as url
  from documentos_venda
  where raw_payload->>'foto_url' like '%pedido-images%'
  order by id desc
  limit 2
`);
console.log(s.rows);
if (s.rows[0]?.url) {
  const h = await fetch(s.rows[0].url, { method: "HEAD" });
  console.log("head", h.status, h.headers.get("content-type"));
}
await client.end();
