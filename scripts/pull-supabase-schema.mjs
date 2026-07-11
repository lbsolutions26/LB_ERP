import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import pkg from "pg";

const { Client } = pkg;

dotenv.config();

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Defina ${name} no arquivo .env`);
  }
  return value;
}

function sql(strings, ...values) {
  return strings.reduce((acc, part, i) => acc + part + (values[i] ?? ""), "");
}

async function main() {
  const connectionString = requireEnv("SUPABASE_DB_URL");
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  await client.connect();

  try {
    const tables = await client.query(sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_type = 'BASE TABLE'
      order by table_name;
    `);

    const columns = await client.query(sql`
      select
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default,
        udt_name,
        numeric_precision,
        numeric_scale,
        character_maximum_length
      from information_schema.columns
      where table_schema = 'public'
      order by table_name, ordinal_position;
    `);

    const primaryKeys = await client.query(sql`
      select
        tc.table_name,
        kcu.column_name,
        kcu.ordinal_position
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on tc.constraint_name = kcu.constraint_name
       and tc.table_schema = kcu.table_schema
      where tc.table_schema = 'public'
        and tc.constraint_type = 'PRIMARY KEY'
      order by tc.table_name, kcu.ordinal_position;
    `);

    const foreignKeys = await client.query(sql`
      select
        tc.table_name,
        kcu.column_name,
        ccu.table_name as foreign_table_name,
        ccu.column_name as foreign_column_name,
        tc.constraint_name
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on tc.constraint_name = kcu.constraint_name
       and tc.table_schema = kcu.table_schema
      join information_schema.constraint_column_usage ccu
        on ccu.constraint_name = tc.constraint_name
       and ccu.table_schema = tc.table_schema
      where tc.table_schema = 'public'
        and tc.constraint_type = 'FOREIGN KEY'
      order by tc.table_name, tc.constraint_name, kcu.ordinal_position;
    `);

    const indexes = await client.query(sql`
      select
        schemaname,
        tablename,
        indexname,
        indexdef
      from pg_indexes
      where schemaname = 'public'
      order by tablename, indexname;
    `);

    const policies = await client.query(sql`
      select
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      from pg_policies
      where schemaname = 'public'
      order by tablename, policyname;
    `);

    const byTable = new Map();
    for (const row of tables.rows) {
      byTable.set(row.table_name, {
        table: row.table_name,
        columns: [],
        primaryKeys: [],
        foreignKeys: [],
        indexes: [],
        policies: []
      });
    }

    for (const row of columns.rows) {
      byTable.get(row.table_name)?.columns.push(row);
    }

    for (const row of primaryKeys.rows) {
      byTable.get(row.table_name)?.primaryKeys.push(row.column_name);
    }

    for (const row of foreignKeys.rows) {
      byTable.get(row.table_name)?.foreignKeys.push({
        column: row.column_name,
        references: `${row.foreign_table_name}.${row.foreign_column_name}`,
        constraint: row.constraint_name
      });
    }

    for (const row of indexes.rows) {
      byTable.get(row.tablename)?.indexes.push({
        name: row.indexname,
        definition: row.indexdef
      });
    }

    for (const row of policies.rows) {
      byTable.get(row.tablename)?.policies.push({
        name: row.policyname,
        permissive: row.permissive,
        roles: row.roles,
        command: row.cmd,
        using: row.qual,
        withCheck: row.with_check
      });
    }

    const schemaDir = path.join(process.cwd(), "supabase");
    await fs.mkdir(schemaDir, { recursive: true });

    const result = {
      generatedAt: new Date().toISOString(),
      tableCount: byTable.size,
      tables: Array.from(byTable.values())
    };

    const jsonPath = path.join(schemaDir, "live-schema.json");
    await fs.writeFile(jsonPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

    const markdown = [];
    markdown.push("# Supabase Live Schema");
    markdown.push("");
    markdown.push(`Gerado em: ${result.generatedAt}`);
    markdown.push(`Total de tabelas: ${result.tableCount}`);
    markdown.push("");

    for (const table of result.tables) {
      markdown.push(`## ${table.table}`);
      markdown.push("");
      markdown.push("### Colunas");
      markdown.push("");
      markdown.push("| Coluna | Tipo | Nulo | Default |");
      markdown.push("|---|---|---|---|");
      for (const col of table.columns) {
        const isPk = table.primaryKeys.includes(col.column_name) ? " (PK)" : "";
        markdown.push(`| ${col.column_name}${isPk} | ${col.data_type} | ${col.is_nullable} | ${col.column_default ?? ""} |`);
      }
      markdown.push("");

      markdown.push("### Chaves estrangeiras");
      markdown.push("");
      if (!table.foreignKeys.length) {
        markdown.push("Sem chaves estrangeiras.");
      } else {
        for (const fk of table.foreignKeys) {
          markdown.push(`- ${fk.column} -> ${fk.references} (${fk.constraint})`);
        }
      }
      markdown.push("");

      markdown.push("### Indices");
      markdown.push("");
      if (!table.indexes.length) {
        markdown.push("Sem indices.");
      } else {
        for (const idx of table.indexes) {
          markdown.push(`- ${idx.name}: ${idx.definition}`);
        }
      }
      markdown.push("");

      markdown.push("### Politicas RLS");
      markdown.push("");
      if (!table.policies.length) {
        markdown.push("Sem politicas.");
      } else {
        for (const pol of table.policies) {
          markdown.push(`- ${pol.name} [${pol.command}] roles=${Array.isArray(pol.roles) ? pol.roles.join(",") : pol.roles}`);
        }
      }
      markdown.push("");
    }

    const mdPath = path.join(schemaDir, "live-schema.md");
    await fs.writeFile(mdPath, `${markdown.join("\n")}\n`, "utf8");

    console.log(`Schema gerado em: ${jsonPath}`);
    console.log(`Resumo gerado em: ${mdPath}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
