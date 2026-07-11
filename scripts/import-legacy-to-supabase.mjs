import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import pkg from "pg";

const { Client } = pkg;

dotenv.config();

const CONFIG_PATH = path.join(process.cwd(), "supabase", "legacy-sheets-urls.json");

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Defina ${name} no arquivo .env`);
  }
  return value;
}

async function ensureConfig() {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.sheets) || !parsed.sheets.length) {
      throw new Error("Config sem sheets.");
    }
    return parsed;
  } catch (error) {
    throw new Error(`Arquivo de URLs invalido ou ausente em ${CONFIG_PATH}. ${error.message}`);
  }
}

async function main() {
  const dryRun = !process.argv.includes("--apply");
  await ensureConfig();

  const connectionString = requireEnv("SUPABASE_DB_URL");
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    console.log(`Modo: ${dryRun ? "dry-run" : "apply"}`);
    console.log("Pipeline preparado. Aguardando mapeamento final de colunas apos analise das URLs.");
    console.log("Proximo passo: rodar npm run legacy:analyze com as URLs reais.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
