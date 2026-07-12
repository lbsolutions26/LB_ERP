import fs from "fs";
import path from "path";

const listPath = "scripts/_pedido-drive-files.json";
const outDir = "scripts/_pedido_images";
const files = JSON.parse(fs.readFileSync(listPath, "utf8"));
fs.mkdirSync(outDir, { recursive: true });

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function downloadOne(file, attempt = 1) {
  const target = path.join(outDir, file.name);
  if (fs.existsSync(target) && fs.statSync(target).size > 1000) {
    return { status: "skip", file };
  }

  const url = `https://drive.google.com/uc?export=download&id=${file.id}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    },
    redirect: "follow"
  });

  const contentType = res.headers.get("content-type") || "";
  const buf = Buffer.from(await res.arrayBuffer());

  if (!res.ok || contentType.includes("text/html") || buf.length < 500) {
    if (attempt < 5) {
      await sleep(1800 * attempt);
      return downloadOne(file, attempt + 1);
    }
    return {
      status: "fail",
      file,
      reason: `http=${res.status} type=${contentType} size=${buf.length}`
    };
  }

  fs.writeFileSync(target, buf);
  return { status: "ok", file, bytes: buf.length };
}

let ok = 0;
let skip = 0;
let fail = 0;
const failures = [];

for (let i = 0; i < files.length; i += 1) {
  const file = files[i];
  process.stdout.write(`[${i + 1}/${files.length}] ${file.name} ... `);
  try {
    const result = await downloadOne(file);
    if (result.status === "ok") {
      ok += 1;
      console.log(`ok ${result.bytes}b`);
    } else if (result.status === "skip") {
      skip += 1;
      console.log("skip");
    } else {
      fail += 1;
      failures.push(result);
      console.log(`FAIL ${result.reason}`);
    }
  } catch (error) {
    fail += 1;
    failures.push({ status: "fail", file, reason: error.message });
    console.log(`ERR ${error.message}`);
  }
  await sleep(300);
}

console.log(JSON.stringify({ ok, skip, fail, total: files.length }, null, 2));
if (failures.length) {
  fs.writeFileSync("scripts/_pedido-download-failures.json", JSON.stringify(failures, null, 2));
}
