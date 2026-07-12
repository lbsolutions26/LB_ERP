import "dotenv/config";
import pg from "pg";

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false }
});
await client.connect();
await client.query(`
  drop policy if exists "produto_images_temp_public_insert" on storage.objects;
  drop policy if exists "produto_images_temp_public_update" on storage.objects;
`);
console.log("temp policies dropped");
await client.end();
