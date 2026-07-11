import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parse } from "csv-parse/sync";

const DEFAULT_CONFIG_PATH = path.join(process.cwd(), "supabase", "legacy-sheets-urls.json");

const KEY_NAME_HINTS = [
  /(^|_)id$/i,
  /(^|_)(pedido|orcamento|cliente|produto|forma|pagamento)(_|$)/i,
  /(codigo|code|legacy)/i
];

function normalizeValue(value) {
  if (value == null) return "";
  return String(value).trim();
}

function looksLikeKeyColumn(columnName, distinctValues, rowCount) {
  const nameMatch = KEY_NAME_HINTS.some((rx) => rx.test(columnName));
  const uniqueness = rowCount > 0 ? distinctValues.size / rowCount : 0;
  return nameMatch || uniqueness > 0.85;
}

function overlapRatio(setA, setB) {
  if (!setA.size || !setB.size) return 0;
  let common = 0;
  for (const value of setA) {
    if (setB.has(value)) common += 1;
  }
  return common / Math.min(setA.size, setB.size);
}

async function fetchCsv(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Falha ao baixar ${url}: HTTP ${response.status}`);
  }
  return response.text();
}

async function main() {
  const configPathArg = process.argv.find((arg) => arg.startsWith("--config="));
  const configPath = configPathArg ? configPathArg.slice("--config=".length) : DEFAULT_CONFIG_PATH;

  const configRaw = await fs.readFile(configPath, "utf8");
  const config = JSON.parse(configRaw);

  if (!Array.isArray(config.sheets) || !config.sheets.length) {
    throw new Error("Config invalida: informe sheets com name e url.");
  }

  const datasets = [];

  for (const sheet of config.sheets) {
    const name = String(sheet.name || "").trim();
    const url = String(sheet.url || "").trim();
    if (!name || !url) continue;

    const csvText = await fetchCsv(url);
    const rows = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      relax_column_count: true,
      trim: true
    });

    const columns = rows.length ? Object.keys(rows[0]) : [];
    const columnStats = columns.map((column) => {
      const values = new Set();
      let nonEmpty = 0;
      for (const row of rows) {
        const value = normalizeValue(row[column]);
        if (!value) continue;
        nonEmpty += 1;
        values.add(value);
      }
      return {
        column,
        nonEmpty,
        distinct: values.size,
        keyCandidate: looksLikeKeyColumn(column, values, rows.length),
        sample: Array.from(values).slice(0, 5)
      };
    });

    datasets.push({
      name,
      url,
      rows,
      columns,
      columnStats
    });
  }

  const relationships = [];

  for (let i = 0; i < datasets.length; i += 1) {
    for (let j = 0; j < datasets.length; j += 1) {
      if (i === j) continue;
      const left = datasets[i];
      const right = datasets[j];

      for (const leftCol of left.columnStats.filter((c) => c.keyCandidate)) {
        const leftSet = new Set(left.rows.map((r) => normalizeValue(r[leftCol.column])).filter(Boolean));
        if (!leftSet.size) continue;

        for (const rightCol of right.columnStats.filter((c) => c.keyCandidate)) {
          const rightSet = new Set(right.rows.map((r) => normalizeValue(r[rightCol.column])).filter(Boolean));
          if (!rightSet.size) continue;

          const score = overlapRatio(leftSet, rightSet);
          if (score >= 0.5) {
            relationships.push({
              fromSheet: left.name,
              fromColumn: leftCol.column,
              toSheet: right.name,
              toColumn: rightCol.column,
              overlapScore: Number(score.toFixed(4)),
              commonValuesEstimate: Math.round(score * Math.min(leftSet.size, rightSet.size))
            });
          }
        }
      }
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    configPath,
    sheets: datasets.map((d) => ({
      name: d.name,
      url: d.url,
      rowCount: d.rows.length,
      columns: d.columnStats
    })),
    relationships: relationships.sort((a, b) => b.overlapScore - a.overlapScore)
  };

  const outputDir = path.join(process.cwd(), "supabase");
  await fs.mkdir(outputDir, { recursive: true });

  const jsonPath = path.join(outputDir, "legacy-sheets-analysis.json");
  await fs.writeFile(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  const lines = [];
  lines.push("# Analise de Relacoes - Google Sheets");
  lines.push("");
  lines.push(`Gerado em: ${summary.generatedAt}`);
  lines.push("");
  lines.push("## Fontes");
  lines.push("");
  for (const sheet of summary.sheets) {
    lines.push(`- ${sheet.name}: ${sheet.rowCount} linhas`);
  }
  lines.push("");
  lines.push("## Relacoes candidatas (por sobreposicao de valores)");
  lines.push("");
  if (!summary.relationships.length) {
    lines.push("Nenhuma relacao forte detectada automaticamente.");
  } else {
    for (const rel of summary.relationships) {
      lines.push(`- ${rel.fromSheet}.${rel.fromColumn} -> ${rel.toSheet}.${rel.toColumn} (score=${rel.overlapScore})`);
    }
  }
  lines.push("");

  const mdPath = path.join(outputDir, "legacy-sheets-analysis.md");
  await fs.writeFile(mdPath, `${lines.join("\n")}\n`, "utf8");

  console.log(`Analise gerada em: ${jsonPath}`);
  console.log(`Resumo gerado em: ${mdPath}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
