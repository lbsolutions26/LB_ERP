import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import pkg from "pg";
import { parse } from "csv-parse/sync";

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

function getEnv(name, fallback = "") {
  const value = process.env[name];
  return value == null ? fallback : String(value).trim();
}

function asText(value) {
  if (value == null) return "";
  return String(value).trim();
}

function parseBool(value, fallback = true) {
  const text = asText(value).toLowerCase();
  if (!text) return fallback;
  if (["sim", "s", "yes", "y", "true", "1"].includes(text)) return true;
  if (["nao", "não", "n", "no", "false", "0"].includes(text)) return false;
  return fallback;
}

function parseNumber(value, fallback = 0) {
  const raw = asText(value);
  if (!raw) return fallback;

  let normalized = raw
    .replace(/\s+/g, "")
    .replace(/R\$/gi, "")
    .replace(/%/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");

  normalized = normalized.replace(/[^0-9.-]/g, "");
  if (!normalized || normalized === "-" || normalized === ".") return fallback;

  const num = Number(normalized);
  return Number.isFinite(num) ? num : fallback;
}

function parseDatePtBr(value) {
  const raw = asText(value);
  if (!raw) return new Date().toISOString();

  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    const hour = Number(match[4] || 0);
    const minute = Number(match[5] || 0);
    const second = Number(match[6] || 0);

    const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return new Date().toISOString();
}

function normalizePaymentType(value) {
  const text = asText(value);
  const lowered = text.toLowerCase();
  if (!text) return { nome: "Nao informado", tipo: "outro" };
  if (lowered.includes("pix")) return { nome: text, tipo: "pix" };
  if (lowered.includes("deb")) return { nome: text, tipo: "debito" };
  if (lowered.includes("cred")) return { nome: text, tipo: "credito" };
  if (lowered.includes("parcel")) return { nome: text, tipo: "parcelado" };
  if (lowered.includes("dinheiro")) return { nome: text, tipo: "dinheiro" };
  return { nome: text, tipo: "outro" };
}

async function fetchCsvRows(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Falha ao baixar ${url}: HTTP ${response.status}`);
  }
  const text = await response.text();
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_column_count: true,
    trim: true
  });
}

function getSheetByName(config, name) {
  return config.sheets.find((sheet) => asText(sheet.name).toLowerCase() === name.toLowerCase()) || null;
}

async function batchInsert(client, table, columns, rows, chunkSize = 300) {
  if (!rows.length) return;

  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const chunk = rows.slice(offset, offset + chunkSize);
    const values = [];
    const placeholders = [];

    for (const row of chunk) {
      const rowPlaceholders = [];
      for (const col of columns) {
        values.push(row[col]);
        rowPlaceholders.push(`$${values.length}`);
      }
      placeholders.push(`(${rowPlaceholders.join(",")})`);
    }

    await client.query(
      `insert into public.${table} (${columns.join(",")}) values ${placeholders.join(",")}`,
      values
    );
  }
}

async function main() {
  const dryRun = !process.argv.includes("--apply");
  const config = await ensureConfig();

  const connectionString = requireEnv("SUPABASE_DB_URL");
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    const forcedEmpresaId = getEnv("IMPORT_EMPRESA_ID");
    const empresasResult = await client.query("select id, nome from public.empresas order by created_at asc");

    if (!empresasResult.rows.length) {
      throw new Error("Nenhuma empresa encontrada para importacao.");
    }

    let empresaId;
    if (forcedEmpresaId) {
      const found = empresasResult.rows.find((row) => String(row.id) === forcedEmpresaId);
      if (!found) {
        throw new Error(`IMPORT_EMPRESA_ID ${forcedEmpresaId} nao existe em public.empresas.`);
      }
      empresaId = found.id;
    } else if (empresasResult.rows.length === 1) {
      empresaId = empresasResult.rows[0].id;
    } else {
      const options = empresasResult.rows.map((row) => `${row.nome} (${row.id})`).join(", ");
      throw new Error(`Multiplas empresas encontradas. Defina IMPORT_EMPRESA_ID para evitar importacao no tenant errado. Opcoes: ${options}`);
    }

    const clientesSheet = getSheetByName(config, "clientes");
    const produtosSheet = getSheetByName(config, "produtos");
    const pedidosSheet = getSheetByName(config, "pedidos");
    const itensSheet = getSheetByName(config, "pedido_itens");
    const pgtoSheet = getSheetByName(config, "tipos_pagamento");

    if (!clientesSheet || !produtosSheet || !pedidosSheet || !itensSheet || !pgtoSheet) {
      throw new Error("Faltam planilhas obrigatorias: clientes, produtos, pedidos, pedido_itens, tipos_pagamento.");
    }

    const [clientesRows, produtosRows, pedidosRows, itensRows, pgtoRows] = await Promise.all([
      fetchCsvRows(clientesSheet.url),
      fetchCsvRows(produtosSheet.url),
      fetchCsvRows(pedidosSheet.url),
      fetchCsvRows(itensSheet.url),
      fetchCsvRows(pgtoSheet.url)
    ]);

    const nowIso = new Date().toISOString();
    const report = {
      generatedAt: nowIso,
      mode: dryRun ? "dry-run" : "apply",
      empresaId,
      sourceCounts: {
        clientes: clientesRows.length,
        produtos: produtosRows.length,
        pedidos: pedidosRows.length,
        pedido_itens: itensRows.length,
        tipos_pagamento: pgtoRows.length
      },
      imported: {},
      placeholders: {
        clientesSemNome: 0,
        produtosSemNome: 0,
        itensSemProduto: 0,
        documentosSemItens: 0,
        pedidosSemClienteVinculado: 0,
        pedidosSemTipoPgto: 0
      }
    };

    const paymentRows = pgtoRows.map((row) => {
      const idLegacy = asText(row["ID_PGTO"]);
      const descRaw = asText(row["Descrição PGTO"]);
      const parsed = normalizePaymentType(descRaw);
      return {
        empresa_id: empresaId,
        id_legacy: idLegacy || null,
        nome: parsed.nome || "Nao informado",
        tipo: parsed.tipo,
        taxa_percentual: parseNumber(row["Taxa"], null),
        ativo: true,
        configuracoes: JSON.stringify({
          source: "legacy_sheet",
          original_row: row
        }),
        created_at: nowIso
      };
    });

    const clientesPrepared = clientesRows.map((row) => {
      const legacyId = asText(row["ID Cliente"]);
      const nome = asText(row.Nome) || `Cliente sem nome (legacy ${legacyId || "sem_id"})`;
      if (!asText(row.Nome)) report.placeholders.clientesSemNome += 1;
      return {
        legacyId,
        insert: {
          empresa_id: empresaId,
          nome,
          telefone: asText(row.Telefone) || null,
          email: asText(row["E-mail"]) || null,
          created_at: nowIso
        }
      };
    });

    const categoriasMap = new Map();
    for (const row of produtosRows) {
      const nomeCategoria = asText(row.Categoria) || "Sem categoria";
      if (!categoriasMap.has(nomeCategoria)) {
        categoriasMap.set(nomeCategoria, {
          empresa_id: empresaId,
          nome: nomeCategoria,
          created_at: nowIso
        });
      }
    }

    if (dryRun) {
      report.imported = {
        formas_pagamento: paymentRows.length,
        clientes: clientesPrepared.length,
        produto_categorias: categoriasMap.size,
        produto_catalogo: produtosRows.length,
        documentos_venda: pedidosRows.length,
        documento_venda_itens: itensRows.length,
        contas_receber: pedidosRows.length,
        contas_receber_parcelas: pedidosRows.length
      };
    } else {
      await client.query("begin");
      try {
        const { rows: formasExistentes } = await client.query(
          "select id, id_legacy, nome from public.formas_pagamento where empresa_id = $1",
          [empresaId]
        );

        const formaByLegacy = new Map();
        const formaByNome = new Map();
        for (const fp of formasExistentes) {
          if (fp.id_legacy) formaByLegacy.set(String(fp.id_legacy), Number(fp.id));
          formaByNome.set(String(fp.nome || "").toLowerCase(), Number(fp.id));
        }

        const formasToInsert = paymentRows.filter((row) => {
          const byLegacy = row.id_legacy ? formaByLegacy.get(row.id_legacy) : null;
          const byNome = formaByNome.get(row.nome.toLowerCase());
          return !byLegacy && !byNome;
        });

        if (formasToInsert.length) {
          await batchInsert(
            client,
            "formas_pagamento",
            ["empresa_id", "id_legacy", "nome", "tipo", "taxa_percentual", "configuracoes", "ativo", "created_at"],
            formasToInsert
          );
        }

        const { rows: formasFinal } = await client.query(
          "select id, id_legacy, nome from public.formas_pagamento where empresa_id = $1",
          [empresaId]
        );
        const formaPagamentoByNome = new Map();
        for (const fp of formasFinal) {
          formaPagamentoByNome.set(String(fp.nome || "").toLowerCase(), Number(fp.id));
        }

        const clienteInserts = clientesPrepared.map((item) => item.insert);
        await batchInsert(
          client,
          "clientes",
          ["empresa_id", "nome", "telefone", "email", "created_at"],
          clienteInserts
        );

        const { rows: clientesFinal } = await client.query(
          "select id, nome, telefone, email from public.clientes where empresa_id = $1 order by id asc",
          [empresaId]
        );

        const clienteIdByLegacy = new Map();
        const clienteIdBySignature = new Map();
        for (let i = 0; i < clientesPrepared.length; i += 1) {
          const prepared = clientesPrepared[i];
          const inserted = clientesFinal[i];
          if (!inserted) continue;
          if (prepared.legacyId) clienteIdByLegacy.set(prepared.legacyId, Number(inserted.id));
          const sig = `${(prepared.insert.nome || "").toLowerCase()}|${(prepared.insert.telefone || "").toLowerCase()}|${(prepared.insert.email || "").toLowerCase()}`;
          clienteIdBySignature.set(sig, Number(inserted.id));
        }

        const categoriaRows = Array.from(categoriasMap.values());
        await batchInsert(client, "produto_categorias", ["empresa_id", "nome", "created_at"], categoriaRows);

        const { rows: categoriasFinal } = await client.query(
          "select id, nome from public.produto_categorias where empresa_id = $1",
          [empresaId]
        );
        const categoriaIdByNome = new Map(categoriasFinal.map((c) => [String(c.nome), Number(c.id)]));

        const produtoInserts = produtosRows.map((row) => {
          const legacyId = asText(row["Produto ID"]);
          const nomeOriginal = asText(row.Produto);
          if (!nomeOriginal) report.placeholders.produtosSemNome += 1;
          const nome = nomeOriginal || `Produto sem nome (legacy ${legacyId || "sem_id"})`;
          const categoriaNome = asText(row.Categoria) || "Sem categoria";

          return {
            empresa_id: empresaId,
            categoria_id: categoriaIdByNome.get(categoriaNome) || null,
            external_id: legacyId || null,
            nome,
            descricao: asText(row["Descrição"]) || null,
            imagem_path: asText(row.Imagem) || null,
            preco_venda: parseNumber(row["Preço"], 0),
            custo: asText(row.Custo) ? parseNumber(row.Custo, 0) : null,
            margem_percentual: asText(row.Margem) ? parseNumber(row.Margem, 0) : null,
            controla_estoque: parseBool(row["Atualiza Estoque?"], true),
            estoque_atual: Math.trunc(parseNumber(row["Quantidade Disponível"], 0)),
            estoque_minimo: Math.trunc(parseNumber(row["Estoque Mínimo"], 0)),
            ativo: parseBool(row.Ativo, true),
            origem: "legacy_sheet",
            legacy_payload: JSON.stringify(row),
            created_at: nowIso,
            updated_at: nowIso
          };
        });

        await batchInsert(
          client,
          "produto_catalogo",
          [
            "empresa_id",
            "categoria_id",
            "external_id",
            "nome",
            "descricao",
            "imagem_path",
            "preco_venda",
            "custo",
            "margem_percentual",
            "controla_estoque",
            "estoque_atual",
            "estoque_minimo",
            "ativo",
            "origem",
            "legacy_payload",
            "created_at",
            "updated_at"
          ],
          produtoInserts
        );

        const { rows: produtosFinal } = await client.query(
          "select id, external_id, nome from public.produto_catalogo where empresa_id = $1",
          [empresaId]
        );
        const produtoIdByLegacy = new Map();
        const produtoIdByNome = new Map();
        for (const prod of produtosFinal) {
          if (prod.external_id) produtoIdByLegacy.set(String(prod.external_id), Number(prod.id));
          produtoIdByNome.set(String(prod.nome || "").toLowerCase(), Number(prod.id));
        }

        const documentos = [];
        for (const row of pedidosRows) {
          const pedidoId = asText(row.PedidoID);
          const tipoVenda = asText(row.Tipo_Venda).toLowerCase();
          const tipoDocumento = tipoVenda.includes("or") ? "orcamento" : "pedido";
          const clienteLegacy = asText(row.Cliente);
          const clienteId = clienteIdByLegacy.get(clienteLegacy) || null;
          if (!clienteId && clienteLegacy) report.placeholders.pedidosSemClienteVinculado += 1;

          const tipoPgto = asText(row["Tipo PGTO"]);
          if (!tipoPgto) report.placeholders.pedidosSemTipoPgto += 1;

          const total = parseNumber(row["Preço Total"], parseNumber(row["Preço Unitário"], 0));
          documentos.push({
            empresa_id: empresaId,
            tipo_documento: tipoDocumento,
            origem: "legacy_sheet",
            origem_legacy_id: pedidoId || null,
            cliente_id: clienteId,
            cliente_legacy_id: clienteLegacy || null,
            data_emissao: parseDatePtBr(row["Data Venda"]),
            status: "fechado",
            subtotal: total,
            desconto: 0,
            total,
            custo_total: asText(row["Custo Total"]) ? parseNumber(row["Custo Total"], 0) : null,
            margem_percentual: asText(row["Margem no Pedido"]) ? parseNumber(row["Margem no Pedido"], 0) : null,
            observacoes: asText(row["Descrição"]) || null,
            raw_payload: JSON.stringify({
              source: "legacy_sheet",
              pedido_row: row
            }),
            created_at: nowIso,
            updated_at: nowIso,
            _tipo_pgto_nome: tipoPgto
          });
        }

        await batchInsert(
          client,
          "documentos_venda",
          [
            "empresa_id",
            "tipo_documento",
            "origem",
            "origem_legacy_id",
            "cliente_id",
            "cliente_legacy_id",
            "data_emissao",
            "status",
            "subtotal",
            "desconto",
            "total",
            "custo_total",
            "margem_percentual",
            "observacoes",
            "raw_payload",
            "created_at",
            "updated_at"
          ],
          documentos
        );

        const { rows: docsFinal } = await client.query(
          "select id, origem_legacy_id, tipo_documento, total, data_emissao from public.documentos_venda where empresa_id = $1 and origem = 'legacy_sheet'",
          [empresaId]
        );
        const docByLegacy = new Map();
        for (const doc of docsFinal) {
          docByLegacy.set(String(doc.origem_legacy_id || ""), doc);
        }

        const itemInserts = [];
        const itemCountByDocId = new Map();

        for (const row of itensRows) {
          const pedidoId = asText(row.PedidoID);
          const doc = docByLegacy.get(pedidoId);
          if (!doc) continue;

          const produtoLegacy = asText(row["Produto ID"]);
          const produtoNome = asText(row.Produto);
          const produtoId = produtoIdByLegacy.get(produtoLegacy) || produtoIdByNome.get(produtoNome.toLowerCase()) || null;

          if (!produtoId) report.placeholders.itensSemProduto += 1;

          const quantidade = parseNumber(row.Quantidade, 1) || 1;
          const valorUnitario = parseNumber(row["Preço Unitário"], 0);
          const valorTotal = parseNumber(row.Total, quantidade * valorUnitario);

          itemInserts.push({
            empresa_id: empresaId,
            documento_id: Number(doc.id),
            produto_id: produtoId,
            descricao_item: produtoNome || `Item sem descricao (pedido ${pedidoId || "sem_id"})`,
            marca: null,
            modelo: null,
            cor: null,
            acessorios: null,
            foto_ref: null,
            quantidade,
            valor_unitario: valorUnitario,
            valor_total: valorTotal,
            custo_unitario: asText(row["Custo Unitário"]) ? parseNumber(row["Custo Unitário"], 0) : null,
            custo_total: asText(row["Custo Total"]) ? parseNumber(row["Custo Total"], 0) : null,
            margem_percentual: asText(row["Margem do Pedido"]) ? parseNumber(row["Margem do Pedido"], 0) : null,
            raw_payload: JSON.stringify(row),
            created_at: nowIso
          });

          itemCountByDocId.set(Number(doc.id), (itemCountByDocId.get(Number(doc.id)) || 0) + 1);
        }

        for (const doc of docsFinal) {
          if ((itemCountByDocId.get(Number(doc.id)) || 0) > 0) continue;
          report.placeholders.documentosSemItens += 1;
          itemInserts.push({
            empresa_id: empresaId,
            documento_id: Number(doc.id),
            produto_id: null,
            descricao_item: "Item legado sem detalhamento",
            marca: null,
            modelo: null,
            cor: null,
            acessorios: null,
            foto_ref: null,
            quantidade: 1,
            valor_unitario: Number(doc.total || 0),
            valor_total: Number(doc.total || 0),
            custo_unitario: null,
            custo_total: null,
            margem_percentual: null,
            raw_payload: JSON.stringify({ source: "placeholder_no_items" }),
            created_at: nowIso
          });
        }

        await batchInsert(
          client,
          "documento_venda_itens",
          [
            "empresa_id",
            "documento_id",
            "produto_id",
            "descricao_item",
            "marca",
            "modelo",
            "cor",
            "acessorios",
            "foto_ref",
            "quantidade",
            "valor_unitario",
            "valor_total",
            "custo_unitario",
            "custo_total",
            "margem_percentual",
            "raw_payload",
            "created_at"
          ],
          itemInserts
        );

        const contaInserts = [];
        for (const doc of documentos) {
          const matchedDoc = docByLegacy.get(String(doc.origem_legacy_id || ""));
          if (!matchedDoc) continue;
          contaInserts.push({
            empresa_id: empresaId,
            documento_id: Number(matchedDoc.id),
            cliente_id: doc.cliente_id,
            origem: "venda",
            numero_titulo: doc.origem_legacy_id || null,
            emissao: doc.data_emissao,
            valor_original: Number(doc.total || 0),
            valor_aberto: Number(doc.total || 0),
            status: "aberto",
            observacoes: "Importado do legado",
            created_at: nowIso,
            updated_at: nowIso
          });
        }

        await batchInsert(
          client,
          "contas_receber",
          [
            "empresa_id",
            "documento_id",
            "cliente_id",
            "origem",
            "numero_titulo",
            "emissao",
            "valor_original",
            "valor_aberto",
            "status",
            "observacoes",
            "created_at",
            "updated_at"
          ],
          contaInserts
        );

        const { rows: contasFinal } = await client.query(
          "select id, documento_id from public.contas_receber where empresa_id = $1",
          [empresaId]
        );
        const contaByDocumentoId = new Map(contasFinal.map((c) => [Number(c.documento_id), Number(c.id)]));

        const parcelasInserts = [];
        for (const doc of documentos) {
          const matchedDoc = docByLegacy.get(String(doc.origem_legacy_id || ""));
          if (!matchedDoc) continue;
          const contaId = contaByDocumentoId.get(Number(matchedDoc.id));
          if (!contaId) continue;

          const formaNome = asText(doc._tipo_pgto_nome).toLowerCase();
          const formaId = formaNome ? (formaPagamentoByNome.get(formaNome) || null) : null;

          parcelasInserts.push({
            empresa_id: empresaId,
            conta_receber_id: contaId,
            numero_parcela: 1,
            vencimento: doc.data_emissao,
            valor_parcela: Number(doc.total || 0),
            valor_recebido: 0,
            status: "pendente",
            forma_pagamento_id: formaId,
            observacoes: "Parcela unica importada do legado",
            created_at: nowIso,
            updated_at: nowIso
          });
        }

        await batchInsert(
          client,
          "contas_receber_parcelas",
          [
            "empresa_id",
            "conta_receber_id",
            "numero_parcela",
            "vencimento",
            "valor_parcela",
            "valor_recebido",
            "status",
            "forma_pagamento_id",
            "observacoes",
            "created_at",
            "updated_at"
          ],
          parcelasInserts
        );

        await client.query("commit");

        report.imported = {
          formas_pagamento: paymentRows.length,
          clientes: clienteInserts.length,
          produto_categorias: categoriaRows.length,
          produto_catalogo: produtoInserts.length,
          documentos_venda: documentos.length,
          documento_venda_itens: itemInserts.length,
          contas_receber: contaInserts.length,
          contas_receber_parcelas: parcelasInserts.length
        };
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }

    const reportPath = path.join(process.cwd(), "supabase", "legacy-import-report.json");
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    console.log(`Modo: ${dryRun ? "dry-run" : "apply"}`);
    console.log(`Empresa alvo: ${empresaId}`);
    console.log(`Relatorio: ${reportPath}`);
    console.log("Resumo importado:", report.imported);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
