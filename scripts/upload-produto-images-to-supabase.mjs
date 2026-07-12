import "dotenv/config";
import fs from "fs";
import path from "path";
import pg from "pg";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://ozbmqyehblqznnbmzgib.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_g872H96RYf2WrL_xJUooLQ_5bFoJ63h";

const BUCKET = "produto-images";
const imagesDir = "scripts/_produto_images";
const dryRun = process.argv.includes("--dry-run");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function contentTypeFor(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

function basenameFromPath(value) {
  return String(value || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .pop()
    .toLowerCase();
}

function publicUrlFor(objectPath) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${objectPath}`;
}

async function uploadFile(localPath, objectPath) {
  const body = fs.readFileSync(localPath);
  const contentType = contentTypeFor(path.basename(localPath));
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectPath}`;

  // upsert via x-upsert
  let res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_KEY}`,
      apikey: SUPABASE_KEY,
      "Content-Type": contentType,
      "x-upsert": "true"
    },
    body
  });

  if (res.status === 400 || res.status === 409) {
    res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${SUPABASE_KEY}`,
        apikey: SUPABASE_KEY,
        "Content-Type": contentType,
        "x-upsert": "true"
      },
      body
    });
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`upload failed ${res.status}: ${text.slice(0, 300)}`);
  }
}

const localFiles = fs
  .readdirSync(imagesDir)
  .filter((name) => /\.(jpe?g|png|gif|webp)$/i.test(name));

const byBase = new Map(localFiles.map((name) => [name.toLowerCase(), name]));

function findLocalFile(baseName) {
  const base = String(baseName || "").toLowerCase();
  if (!base) return null;
  if (byBase.has(base)) return byBase.get(base);

  // Arquivos no Drive as vezes vem com prefixo hex: 0b012564.Imagem...
  for (const name of localFiles) {
    const lower = name.toLowerCase();
    if (lower === base || lower.endsWith(base) || lower.endsWith(`_${base}`) || lower.includes(base)) {
      return name;
    }
  }

  const core = base.match(/(\d+\.imagem\.\d+\.[a-z0-9]+)$/i);
  if (core) {
    for (const name of localFiles) {
      if (name.toLowerCase().includes(core[1].toLowerCase())) return name;
    }
  }
  return null;
}

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false }
});
await client.connect();

const { rows: produtos } = await client.query(`
  select id, empresa_id, nome, imagem_path
  from produto_catalogo
  where imagem_path is not null and btrim(imagem_path) <> ''
  order by id
`);

let uploaded = 0;
let updated = 0;
let skipped = 0;
let missingLocal = 0;
const failures = [];

for (const produto of produtos) {
  const current = String(produto.imagem_path || "");
  // ja migrado para storage publico
  if (current.includes("/storage/v1/object/public/produto-images/")) {
    skipped += 1;
    continue;
  }

  const base = basenameFromPath(current);
  const localName = findLocalFile(base);
  if (!localName) {
    missingLocal += 1;
    console.log(`missing local for product ${produto.id}: ${current}`);
    continue;
  }

  const objectPath = `${produto.empresa_id}/${produto.id}/${localName}`;
  const localPath = path.join(imagesDir, localName);
  const publicUrl = publicUrlFor(objectPath);

  try {
    if (!dryRun) {
      await uploadFile(localPath, objectPath);
      uploaded += 1;
      await client.query(
        `update produto_catalogo set imagem_path = $1 where id = $2 and empresa_id = $3`,
        [publicUrl, produto.id, produto.empresa_id]
      );
      updated += 1;
    }
    console.log(`ok product ${produto.id} -> ${publicUrl}`);
    await sleep(40);
  } catch (error) {
    failures.push({ id: produto.id, error: error.message, localName });
    console.log(`FAIL product ${produto.id}: ${error.message}`);
  }
}

console.log(
  JSON.stringify(
    {
      dryRun,
      totalProductsWithImage: produtos.length,
      localFiles: localFiles.length,
      uploaded,
      updated,
      skipped,
      missingLocal,
      failures: failures.length
    },
    null,
    2
  )
);

if (failures.length) {
  fs.writeFileSync("scripts/_upload-failures.json", JSON.stringify(failures, null, 2));
}

await client.end();
