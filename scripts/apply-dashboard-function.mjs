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
    const sql = await fs.readFile("supabase/dashboard-monthly-cash.sql", "utf8");
    await client.query(sql);
    console.log("Funcao criada/atualizada com sucesso.");

    const r = await client.query(
      "select * from public.dashboard_monthly_cash($1::uuid, 24) order by mes",
      [empresaId]
    );
    console.log("Retorno da funcao:");
    console.table(r.rows.slice(0, 10));
    console.log(`Total de meses: ${r.rows.length}`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
