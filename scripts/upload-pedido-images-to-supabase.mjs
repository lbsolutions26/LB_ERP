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

const BUCKET = "pedido-images";
const imagesDir = "scripts/_pedido_images";
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

async function ensureBucket(client) {
  await client.query(`
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'pedido-images',
      'pedido-images',
      true,
      10485760,
      array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    )
    on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

    drop policy if exists "pedido_images_public_read" on storage.objects;
    create policy "pedido_images_public_read"
    on storage.objects for select to public
    using (bucket_id = 'pedido-images');

    drop policy if exists "pedido_images_auth_insert" on storage.objects;
    create policy "pedido_images_auth_insert"
    on storage.objects for insert to authenticated
    with check (bucket_id = 'pedido-images');

    drop policy if exists "pedido_images_temp_public_insert" on storage.objects;
    create policy "pedido_images_temp_public_insert"
    on storage.objects for insert to public
    with check (bucket_id = 'pedido-images');

    drop policy if exists "pedido_images_temp_public_update" on storage.objects;
    create policy "pedido_images_temp_public_update"
    on storage.objects for update to public
    using (bucket_id = 'pedido-images')
    with check (bucket_id = 'pedido-images');
  `);
}

async function uploadFile(localPath, objectPath) {
  const body = fs.readFileSync(localPath);
  const contentType = contentTypeFor(path.basename(localPath));
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectPath}`;

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
  for (const name of localFiles) {
    const lower = name.toLowerCase();
    if (lower === base || lower.endsWith(base) || lower.includes(base)) return name;
  }
  const core = base.match(/([0-9a-f]+\.foto\.\d+\.[a-z0-9]+)$/i) || base.match(/(\d+\.foto\.\d+\.[a-z0-9]+)$/i);
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
await ensureBucket(client);

const { rows: docs } = await client.query(`
  select id, empresa_id, raw_payload
  from documentos_venda
  where tipo_documento = 'pedido'
    and raw_payload #>> '{pedido_row,Foto}' is not null
    and btrim(raw_payload #>> '{pedido_row,Foto}') <> ''
  order by id
`);

let uploaded = 0;
let updated = 0;
let skipped = 0;
let missingLocal = 0;
const failures = [];

for (const doc of docs) {
  const current = String(doc.raw_payload?.pedido_row?.Foto || "");
  if (current.includes("/storage/v1/object/public/pedido-images/")) {
    skipped += 1;
    continue;
  }

  const base = basenameFromPath(current);
  const localName = findLocalFile(base);
  if (!localName) {
    missingLocal += 1;
    console.log(`missing local for doc ${doc.id}: ${current}`);
    continue;
  }

  const objectPath = `${doc.empresa_id}/${doc.id}/${localName}`;
  const localPath = path.join(imagesDir, localName);
  const publicUrl = publicUrlFor(objectPath);

  try {
    if (!dryRun) {
      await uploadFile(localPath, objectPath);
      uploaded += 1;

      const newPayload = {
        ...(doc.raw_payload || {}),
        pedido_row: {
          ...((doc.raw_payload && doc.raw_payload.pedido_row) || {}),
          Foto: publicUrl
        },
        foto_url: publicUrl,
        foto_legacy_path: current
      };

      await client.query(
        `update documentos_venda
         set raw_payload = $1::jsonb,
             updated_at = now()
         where id = $2 and empresa_id = $3`,
        [JSON.stringify(newPayload), doc.id, doc.empresa_id]
      );
      updated += 1;
    }
    console.log(`ok doc ${doc.id} -> ${publicUrl}`);
    await sleep(40);
  } catch (error) {
    failures.push({ id: doc.id, error: error.message, localName });
    console.log(`FAIL doc ${doc.id}: ${error.message}`);
  }
}

console.log(
  JSON.stringify(
    {
      dryRun,
      totalDocsWithFoto: docs.length,
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
  fs.writeFileSync("scripts/_pedido-upload-failures.json", JSON.stringify(failures, null, 2));
}

// drop temp write policies
await client.query(`
  drop policy if exists "pedido_images_temp_public_insert" on storage.objects;
  drop policy if exists "pedido_images_temp_public_update" on storage.objects;
`);

await client.end();
