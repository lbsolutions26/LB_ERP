import fs from "node:fs/promises";
import dotenv from "dotenv";
import pkg from "pg";

const { Client } = pkg;
dotenv.config();

const empresaId = process.env.IMPORT_EMPRESA_ID || "4d2805ae-a9fb-4e22-a162-d1c8fc4e6049";

async function main() {
  const client = new Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  try {
    const sql = await fs.readFile("supabase/dashboard-snapshot.sql", "utf8");
    await client.query(sql);
    console.log("dashboard_snapshot criada/atualizada.");

    const started = Date.now();
    const r = await client.query(
      "select public.dashboard_snapshot($1::uuid, 11) as snapshot",
      [empresaId]
    );
    const elapsed = Date.now() - started;
    console.log(`Retorno em ${elapsed}ms:`);
    const snap = r.rows[0]?.snapshot || {};
    console.log("counts:", snap.counts);
    console.log("monthly (primeiros 4 meses):", (snap.monthly || []).slice(0, 4));
    console.log("total meses:", (snap.monthly || []).length);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
