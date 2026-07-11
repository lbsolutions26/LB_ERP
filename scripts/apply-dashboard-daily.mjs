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
    const sql = await fs.readFile("supabase/dashboard-daily-current-month.sql", "utf8");
    await client.query(sql);
    console.log("dashboard_daily_current_month criada/atualizada.");

    const started = Date.now();
    const r = await client.query(
      "select public.dashboard_daily_current_month($1::uuid) as dias",
      [empresaId]
    );
    const elapsed = Date.now() - started;
    const dias = r.rows[0]?.dias || [];
    console.log(`Retorno em ${elapsed}ms com ${dias.length} dias.`);
    console.log("Primeiros 5:", dias.slice(0, 5));
    console.log("Ultimos 5:", dias.slice(-5));
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
