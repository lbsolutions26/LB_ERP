import dotenv from "dotenv";
import pkg from "pg";

const { Client } = pkg;

dotenv.config();

const empresaId = process.env.IMPORT_EMPRESA_ID || "d5dd8ff4-8e1e-45c2-b212-912b32384c2f";

async function main() {
  const client = new Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  try {
    const resumo = await client.query(
      `select min(data_emissao) as min_data, max(data_emissao) as max_data, count(*)::int as total
       from public.documentos_venda
       where empresa_id = $1`,
      [empresaId]
    );

    const meses = await client.query(
      `select to_char(date_trunc('month', data_emissao), 'YYYY-MM') as mes, count(*)::int as total
       from public.documentos_venda
       where empresa_id = $1
       group by 1
       order by 1
       limit 12`,
      [empresaId]
    );

    console.log(resumo.rows[0]);
    console.log(meses.rows);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
