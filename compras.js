/**
 * Módulo de Compras: fornecedores, notas de entrada, estoque e contas a pagar.
 * Recebe o contexto do app (state, els, supabase, helpers) via installComprasModule.
 */

export function installComprasModule(ctx) {
  const {
    getState,
    getEls,
    getSupabase,
    helpers
  } = ctx;

  const {
    moeda,
    escapeHtml,
    showToast,
    formatDateInput,
    registrarEstoqueMovimento,
    ensureProdutosLoaded,
    loadFormasPagamento,
    renderRowActionsMenu
  } = helpers;

  function rowActions(items, label = "Acoes") {
    if (typeof renderRowActionsMenu === "function") {
      return renderRowActionsMenu(items, { label });
    }
    // Fallback minimo se o helper nao estiver disponivel
    return items
      .map((item) => `<button type="button" class="btn btn-ghost" ${item.attrs || ""}>${escapeHtml(item.label || "")}</button>`)
      .join(" ");
  }

  function state() {
    return getState();
  }

  function els() {
    return getEls();
  }

  function sb() {
    return getSupabase();
  }

  function defaultDespesasColFilters() {
    return {
      titulo: "",
      fornecedor: "",
      origem: "",
      emissao: "",
      parcela: "",
      vencimento: "",
      valor: "",
      saldo: "",
      status: ""
    };
  }

  function ensureStateDefaults() {
    const s = state();
    if (!s.compras) {
      s.compras = {
        view: "notas",
        loaded: false,
        fornecedores: [],
        notas: [],
        contas: [],
        parcelas: [],
        pagamentos: [],
        filters: {
          notaBusca: "",
          notaStatus: "",
          fornBusca: "",
          pagarStatus: "",
          pagarBusca: "",
          despesasStatus: "",
          despesasBusca: "",
          despesasOrigem: "",
          despesasCols: defaultDespesasColFilters()
        }
      };
    }
    if (!s.compras.filters) s.compras.filters = {};
    if (!s.compras.filters.despesasCols) {
      s.compras.filters.despesasCols = defaultDespesasColFilters();
    }
    if (!Array.isArray(s.compras.pagamentos)) s.compras.pagamentos = [];
    if (!s.notaEntradaModal) {
      s.notaEntradaModal = createNotaDraft();
    }
    if (!s.fornecedorModal) {
      s.fornecedorModal = { editId: null };
    }
  }

  function origemLabel(origem) {
    const o = String(origem || "");
    if (o === "nota_entrada") return "NF / Compras";
    if (o === "despesa_manual") return "Despesa";
    return o || "–";
  }

  function getParcelasPagarRows(options = {}) {
    const busca = String(options.busca ?? "").toLowerCase();
    const statusF = options.status || "";
    const origemF = options.origem || "";
    const onlyNota = Boolean(options.onlyNota);
    const contasById = Object.fromEntries((state().compras.contas || []).map((c) => [String(c.id), c]));
    let rows = (state().compras.parcelas || []).map((p) => ({
      ...p,
      conta: contasById[String(p.conta_pagar_id)]
    }));
    if (onlyNota) {
      rows = rows.filter((r) => r.conta?.origem === "nota_entrada" || r.conta?.nota_entrada_id);
    }
    if (origemF) {
      rows = rows.filter((r) => String(r.conta?.origem || "") === origemF);
    }
    if (statusF) rows = rows.filter((r) => r.status === statusF);
    if (busca) {
      rows = rows.filter((r) => {
        const hay = `${r.conta?.numero_titulo || ""} ${r.conta?.fornecedor?.nome || ""} ${r.conta?.observacoes || ""} ${r.conta?.origem || ""}`.toLowerCase();
        return hay.includes(busca);
      });
    }
    rows.sort((a, b) => String(a.vencimento || "").localeCompare(String(b.vencimento || "")));
    return rows;
  }

  function formatDateBr(value) {
    if (!value) return "–";
    const raw = String(value).trim();
    // YYYY-MM-DD (com ou sem hora)
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
    const d = value instanceof Date ? value : new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("pt-BR");
    }
    return raw;
  }

  function formatEmissaoDisplay(value) {
    return formatDateBr(value);
  }

  function moneyFilterMatch(value, needle) {
    const n = String(needle || "").trim().toLowerCase();
    if (!n) return true;
    const formatted = moeda.format(value || 0).toLowerCase();
    const plain = String(Number(value || 0).toFixed(2)).replace(".", ",");
    return formatted.includes(n) || plain.includes(n) || String(value || "").includes(n);
  }

  function applyDespesasColumnFilters(rows) {
    ensureStateDefaults();
    const f = state().compras.filters.despesasCols || {};
    return rows.filter((r) => {
      const titulo = String(r.conta?.numero_titulo || `CP-${r.conta_pagar_id}`).toLowerCase();
      const fornecedor = String(
        r.conta?.fornecedor?.nome ||
          (r.conta?.origem === "despesa_manual" ? r.conta?.observacoes || r.conta?.numero_titulo : "") ||
          ""
      ).toLowerCase();
      const origem = String(r.conta?.origem || "");
      const emissaoBr = formatDateBr(r.conta?.emissao).toLowerCase();
      const vencBr = formatDateBr(r.vencimento).toLowerCase();
      const parcela = String(r.numero_parcela ?? "").toLowerCase();
      const status = String(r.status || "").toLowerCase();
      const saldo = Math.max(0, Number(r.valor_parcela || 0) - Number(r.valor_pago || 0));

      if (f.titulo && !titulo.includes(String(f.titulo).toLowerCase())) return false;
      if (f.fornecedor && !fornecedor.includes(String(f.fornecedor).toLowerCase())) return false;
      if (f.origem && origem !== f.origem) return false;
      if (f.emissao && !emissaoBr.includes(String(f.emissao).toLowerCase())) return false;
      if (f.parcela && !parcela.includes(String(f.parcela).toLowerCase())) return false;
      if (f.vencimento && !vencBr.includes(String(f.vencimento).toLowerCase())) return false;
      if (f.valor && !moneyFilterMatch(r.valor_parcela, f.valor)) return false;
      if (f.saldo && !moneyFilterMatch(saldo, f.saldo)) return false;
      if (f.status && status !== String(f.status).toLowerCase()) return false;
      return true;
    });
  }

  function renderParcelasIntoTable(tableEl, rows, { showOrigem = true, showEmissao = false } = {}) {
    if (!tableEl) return;
    const colSpan = 8 + (showOrigem ? 1 : 0) + (showEmissao ? 1 : 0);
    if (!rows.length) {
      tableEl.innerHTML = `<tr><td colspan="${colSpan}">Nenhuma parcela a pagar.</td></tr>`;
      return;
    }
    tableEl.innerHTML = rows
      .map((r) => {
        const saldo = Math.max(0, Number(r.valor_parcela || 0) - Number(r.valor_pago || 0));
        const vencida =
          r.status !== "pago" &&
          r.status !== "cancelado" &&
          r.vencimento &&
          new Date(`${String(r.vencimento).slice(0, 10)}T12:00:00`) < new Date(new Date().toDateString());
        const fornecedorTxt =
          r.conta?.fornecedor?.nome ||
          (r.conta?.origem === "despesa_manual" ? r.conta?.observacoes || r.conta?.numero_titulo : null) ||
          "–";
        const contaId = escapeHtml(r.conta_pagar_id);
        const parcelaId = escapeHtml(r.id);
        const menuItems = [{ label: "Editar", attrs: `data-edit-conta-pagar="${contaId}"` }];
        if (r.status !== "pago" && r.status !== "cancelado") {
          menuItems.push({ label: "Pagar", attrs: `data-pagar-parcela="${parcelaId}"`, finance: true });
        }
        return `
        <tr class="is-clickable-row" data-edit-conta-pagar="${contaId}" title="Clique para editar o título">
          <td class="pedido-actions-cell" data-stop-row-edit="1">${rowActions(menuItems, "Acoes do titulo")}</td>
          <td><span class="estoque-status ${r.status === "pago" ? "estoque-status--ok" : "estoque-status--reposicao"}">${escapeHtml(r.status)}</span></td>
          <td>${escapeHtml(r.conta?.numero_titulo || `CP-${r.conta_pagar_id}`)}</td>
          <td class="contas-pagar-col-fornecedor" title="${escapeHtml(fornecedorTxt)}">${escapeHtml(fornecedorTxt)}</td>
          ${showOrigem ? `<td>${escapeHtml(origemLabel(r.conta?.origem))}</td>` : ""}
          ${showEmissao ? `<td>${escapeHtml(formatEmissaoDisplay(r.conta?.emissao))}</td>` : ""}
          <td>${escapeHtml(r.numero_parcela)}</td>
          <td>${escapeHtml(formatDateBr(r.vencimento))}${vencida ? ' <span class="estoque-status estoque-status--zerado">vencida</span>' : ""}</td>
          <td>${moeda.format(r.valor_parcela || 0)}</td>
          <td>${moeda.format(saldo)}</td>
        </tr>`;
      })
      .join("");
  }

  function renderDespesasKpis() {
    const e = els();
    const rows = getParcelasPagarRows({});
    const now = new Date();
    const today = new Date(now.toDateString());
    const week = new Date(today);
    week.setDate(week.getDate() + 7);
    let aberto = 0;
    let vencidas = 0;
    let semana = 0;
    let pagasMes = 0;

    // Em aberto / vencidas / a vencer: usam VENCIMENTO (compromissos ainda em aberto)
    for (const r of rows) {
      const saldo = Math.max(0, Number(r.valor_parcela || 0) - Number(r.valor_pago || 0));
      if (r.status !== "pago" && r.status !== "cancelado") {
        aberto += saldo;
        if (r.vencimento) {
          const v = new Date(`${String(r.vencimento).slice(0, 10)}T12:00:00`);
          if (!Number.isNaN(v.getTime())) {
            if (v < today) vencidas += 1;
            else if (v <= week) semana += saldo;
          }
        }
      }
    }

    // Pagas no mês: usa DATA REAL DE PAGAMENTO (tabela pagamentos), não vencimento/emissão
    for (const p of state().compras.pagamentos || []) {
      if (!p?.data_pagamento) continue;
      const d = new Date(`${String(p.data_pagamento).slice(0, 10)}T12:00:00`);
      if (Number.isNaN(d.getTime())) continue;
      if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
        pagasMes += Number(p.valor || 0);
      }
    }

    if (e.despesasKpiAberto) e.despesasKpiAberto.textContent = moeda.format(aberto);
    if (e.despesasKpiVencidas) e.despesasKpiVencidas.textContent = String(vencidas);
    if (e.despesasKpiSemana) e.despesasKpiSemana.textContent = moeda.format(semana);
    if (e.despesasKpiPagasMes) e.despesasKpiPagasMes.textContent = moeda.format(pagasMes);
  }

  function createNotaItem(produto = null) {
    return {
      rowId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      produtoId: produto?.id ? String(produto.id) : "",
      descricao: produto?.nome || "",
      quantidade: 1,
      valorUnitario: Number(produto?.custo || produto?.preco || 0),
      atualizaCusto: true,
      atualizaEstoque: true
    };
  }

  function createNotaDraft() {
    return {
      notaId: null,
      fornecedorId: "",
      numeroNf: "",
      serie: "",
      chaveAcesso: "",
      dataEmissao: formatDateInput(new Date()),
      dataEntrada: formatDateInput(new Date()),
      status: "rascunho",
      valorDesconto: 0,
      valorFrete: 0,
      valorOutras: 0,
      observacoes: "",
      parcelas: 1,
      vencimentoPrimeira: formatDateInput(new Date()),
      intervaloDias: 30,
      formaPagamentoId: "",
      itens: [createNotaItem()],
      // Parcelas editáveis (como no pedido a receber)
      parcelasEditadas: []
    };
  }

  function addDaysYmd(ymd, days) {
    const base = ymd ? new Date(`${ymd}T12:00:00`) : new Date();
    if (Number.isNaN(base.getTime())) {
      const d = new Date();
      d.setDate(d.getDate() + Number(days || 0));
      return formatDateInput(d);
    }
    base.setDate(base.getDate() + Number(days || 0));
    return formatDateInput(base);
  }

  function splitAmountParts(total, n) {
    const count = Math.max(1, Math.trunc(Number(n) || 1));
    const cents = Math.round(Number(total || 0) * 100);
    const base = Math.floor(cents / count);
    const resto = cents - base * count;
    return Array.from({ length: count }, (_, i) => Number(((base + (i < resto ? 1 : 0)) / 100).toFixed(2)));
  }

  function buildNotaParcelasFromParams(draft = state().notaEntradaModal) {
    const total = getNotaTotal(draft);
    const n = Math.max(1, Math.trunc(Number(draft.parcelas || 1)));
    const intervalo = Math.max(1, Math.trunc(Number(draft.intervaloDias || 30)));
    const first = draft.vencimentoPrimeira || formatDateInput(new Date());
    const forma = draft.formaPagamentoId || "";
    const parts = splitAmountParts(total, n);
    return parts.map((valor, i) => ({
      numero: i + 1,
      vencimento: addDaysYmd(first, intervalo * i),
      valor,
      formaPagamentoId: forma,
      status: "pendente"
    }));
  }

  function ensureNotaParcelasEditadas(forceRebuild = false) {
    const draft = state().notaEntradaModal;
    if (forceRebuild || !Array.isArray(draft.parcelasEditadas) || !draft.parcelasEditadas.length) {
      draft.parcelasEditadas = buildNotaParcelasFromParams(draft);
    }
    return draft.parcelasEditadas;
  }

  function ratearTotalNasParcelasNota() {
    const draft = state().notaEntradaModal;
    const parcelas = ensureNotaParcelasEditadas();
    if (!parcelas.length) return;
    const parts = splitAmountParts(getNotaTotal(draft), parcelas.length);
    parcelas.forEach((p, i) => {
      p.valor = parts[i];
      p.numero = i + 1;
    });
    renderNotaParcelasEditor();
  }

  function addNotaParcelaEditavel() {
    const draft = state().notaEntradaModal;
    const parcelas = ensureNotaParcelasEditadas();
    const last = parcelas[parcelas.length - 1];
    const intervalo = Math.max(1, Math.trunc(Number(draft.intervaloDias || 30)));
    parcelas.push({
      numero: parcelas.length + 1,
      vencimento: addDaysYmd(last?.vencimento || draft.vencimentoPrimeira || formatDateInput(new Date()), intervalo),
      valor: 0,
      formaPagamentoId: last?.formaPagamentoId || draft.formaPagamentoId || "",
      status: "pendente"
    });
    draft.parcelas = parcelas.length;
    renderNotaParcelasEditor();
  }

  function removeNotaParcelaEditavel(index) {
    const draft = state().notaEntradaModal;
    if (!Array.isArray(draft.parcelasEditadas)) return;
    draft.parcelasEditadas.splice(index, 1);
    draft.parcelasEditadas.forEach((p, i) => {
      p.numero = i + 1;
    });
    if (!draft.parcelasEditadas.length) {
      draft.parcelasEditadas = buildNotaParcelasFromParams(draft);
    }
    draft.parcelas = draft.parcelasEditadas.length;
    renderNotaParcelasEditor();
  }

  function renderNotaParcelasTotals() {
    const e = els();
    if (!e.notaEntradaParcelasTotals) return;
    const draft = state().notaEntradaModal;
    const parcelas = draft.parcelasEditadas || [];
    const totalParcelas = parcelas.reduce((s, p) => s + Number(p.valor || 0), 0);
    const totalNota = getNotaTotal(draft);
    const diff = totalNota - totalParcelas;
    const partes = [
      `${parcelas.length} parcela${parcelas.length === 1 ? "" : "s"}`,
      `títulos ${moeda.format(totalParcelas)}`,
      `nota ${moeda.format(totalNota)}`
    ];
    if (Math.abs(diff) > 0.005) {
      partes.push(diff > 0 ? `faltam ${moeda.format(diff)}` : `excedente ${moeda.format(-diff)}`);
    }
    e.notaEntradaParcelasTotals.textContent = partes.join(" • ");
  }

  function renderNotaParcelasEditor() {
    const e = els();
    if (!e.notaEntradaParcelasList) return;
    const draft = state().notaEntradaModal;
    const readonly = draft.status === "lancada" || draft.status === "cancelada";
    ensureNotaParcelasEditadas();
    const parcelas = draft.parcelasEditadas || [];

    if (e.notaEntradaGerarParcelasBtn) e.notaEntradaGerarParcelasBtn.disabled = readonly;
    if (e.notaEntradaAddParcelaBtn) e.notaEntradaAddParcelaBtn.disabled = readonly;
    if (e.notaEntradaRatearBtn) e.notaEntradaRatearBtn.disabled = readonly;
    if (e.notaEntradaParcelas) e.notaEntradaParcelas.disabled = readonly;
    if (e.notaEntradaVenc) e.notaEntradaVenc.disabled = readonly;
    if (e.notaEntradaIntervalo) e.notaEntradaIntervalo.disabled = readonly;

    const formasHtml = ['<option value="">Selecione</option>'];
    for (const forma of state().formasPagamento || []) {
      formasHtml.push(`<option value="${forma.id}">${escapeHtml(forma.nome)}</option>`);
    }

    e.notaEntradaParcelasList.innerHTML = parcelas
      .map(
        (parcela, index) => `
      <div class="documento-payment-parcela-row" data-nota-parcela-index="${index}">
        <div class="parcela-numero">#${parcela.numero || index + 1}</div>
        <label>Vencimento
          <input type="date" data-nota-parcela-field="vencimento" value="${escapeHtml(parcela.vencimento || "")}" ${readonly ? "readonly" : ""} />
        </label>
        <label>Valor
          <input type="number" min="0" step="0.01" data-nota-parcela-field="valor" value="${Number(parcela.valor || 0).toFixed(2)}" ${readonly ? "readonly" : ""} />
        </label>
        <label>Forma
          <select data-nota-parcela-field="formaPagamentoId" ${readonly ? "disabled" : ""}>
            ${formasHtml.join("")}
          </select>
        </label>
        <label>Status
          <select data-nota-parcela-field="status" ${readonly ? "disabled" : ""}>
            <option value="pendente">Pendente</option>
            <option value="pago">Já pago</option>
          </select>
        </label>
        ${
          readonly
            ? ""
            : `<button type="button" class="btn btn-ghost" data-remove-nota-parcela="${index}" ${parcelas.length <= 1 ? "disabled" : ""}>Remover</button>`
        }
      </div>`
      )
      .join("");

    e.notaEntradaParcelasList.querySelectorAll("[data-nota-parcela-index]").forEach((row) => {
      const idx = Number(row.getAttribute("data-nota-parcela-index"));
      const p = parcelas[idx];
      if (!p) return;
      const formaSel = row.querySelector('[data-nota-parcela-field="formaPagamentoId"]');
      if (formaSel) formaSel.value = p.formaPagamentoId || "";
      const statusSel = row.querySelector('[data-nota-parcela-field="status"]');
      if (statusSel) statusSel.value = p.status === "pago" ? "pago" : "pendente";
    });

    renderNotaParcelasTotals();
  }

  function getNotaItemTotal(item) {
    return Number(item.quantidade || 0) * Number(item.valorUnitario || 0);
  }

  function getNotaSubtotal(draft = state().notaEntradaModal) {
    return (draft.itens || []).reduce((sum, item) => {
      if (!String(item.descricao || "").trim() && !item.produtoId) return sum;
      return sum + getNotaItemTotal(item);
    }, 0);
  }

  function getNotaTotal(draft = state().notaEntradaModal) {
    const sub = getNotaSubtotal(draft);
    return Math.max(
      0,
      sub - Number(draft.valorDesconto || 0) + Number(draft.valorFrete || 0) + Number(draft.valorOutras || 0)
    );
  }

  function setComprasView(view) {
    ensureStateDefaults();
    const allowed = ["notas", "fornecedores", "pagar"];
    state().compras.view = allowed.includes(view) ? view : "notas";
    const e = els();
    for (const btn of e.comprasViewButtons || []) {
      btn.classList.toggle("active", btn.getAttribute("data-compras-view") === state().compras.view);
    }
    const map = {
      notas: e.comprasNotasView,
      fornecedores: e.comprasFornecedoresView,
      pagar: e.comprasPagarView
    };
    for (const [key, el] of Object.entries(map)) {
      if (el) el.classList.toggle("hidden", key !== state().compras.view);
    }
    if (e.comprasSectionSubtitle) {
      const labels = {
        notas: "Notas de entrada, vínculo com estoque e geração de títulos a pagar.",
        fornecedores: "Cadastro de fornecedores para compras e pagamentos.",
        pagar: "Títulos e parcelas a pagar gerados pelas notas lançadas."
      };
      e.comprasSectionSubtitle.textContent = labels[state().compras.view] || labels.notas;
    }
  }

  async function loadFornecedores() {
    const { data, error } = await sb()
      .from("fornecedores")
      .select("id, nome, documento, telefone, email, cidade, uf, ativo, observacoes")
      .eq("empresa_id", state().empresaId)
      .order("nome");
    if (error) throw error;
    state().compras.fornecedores = data || [];
  }

  async function loadNotasEntrada() {
    const { data, error } = await sb()
      .from("notas_entrada")
      .select(
        "id, fornecedor_id, numero_nf, serie, data_emissao, data_entrada, status, valor_produtos, valor_desconto, valor_frete, valor_outras, valor_total, estoque_aplicado, financeiro_aplicado, observacoes, fornecedor:fornecedores(id, nome)"
      )
      .eq("empresa_id", state().empresaId)
      .order("data_entrada", { ascending: false })
      .limit(300);
    if (error) throw error;
    state().compras.notas = data || [];
  }

  async function loadContasPagar() {
    const { data: contas, error } = await sb()
      .from("contas_pagar")
      .select(
        "id, nota_entrada_id, fornecedor_id, origem, numero_titulo, emissao, valor_original, valor_aberto, status, observacoes, fornecedor:fornecedores(id, nome)"
      )
      .eq("empresa_id", state().empresaId)
      .order("emissao", { ascending: false })
      .limit(300);
    if (error) throw error;
    state().compras.contas = contas || [];

    const contaIds = (contas || []).map((c) => c.id);
    if (!contaIds.length) {
      state().compras.parcelas = [];
      state().compras.pagamentos = [];
      return;
    }

    const parcelas = [];
    const chunk = 80;
    for (let i = 0; i < contaIds.length; i += chunk) {
      const slice = contaIds.slice(i, i + chunk);
      const { data, error: pErr } = await sb()
        .from("contas_pagar_parcelas")
        .select(
          "id, conta_pagar_id, numero_parcela, vencimento, valor_parcela, valor_pago, status, forma_pagamento_id"
        )
        .eq("empresa_id", state().empresaId)
        .in("conta_pagar_id", slice)
        .order("vencimento", { ascending: true });
      if (pErr) throw pErr;
      parcelas.push(...(data || []));
    }
    state().compras.parcelas = parcelas;

    // Baixas reais (data_pagamento) — usadas no KPI "Pagas no mês"
    const parcelaIds = parcelas.map((p) => p.id).filter(Boolean);
    const pagamentos = [];
    for (let i = 0; i < parcelaIds.length; i += chunk) {
      const slice = parcelaIds.slice(i, i + chunk);
      const { data, error: payErr } = await sb()
        .from("pagamentos")
        .select("id, parcela_id, data_pagamento, valor")
        .eq("empresa_id", state().empresaId)
        .in("parcela_id", slice);
      if (payErr) {
        // tabela ausente em bases antigas: segue sem quebrar a tela
        if (String(payErr.message || "").toLowerCase().includes("does not exist")) break;
        throw payErr;
      }
      pagamentos.push(...(data || []));
    }
    state().compras.pagamentos = pagamentos;
  }

  async function ensureComprasLoaded(options = {}) {
    ensureStateDefaults();
    await ensureProdutosLoaded(options);
    if (typeof loadFormasPagamento === "function") {
      try {
        await loadFormasPagamento();
      } catch (_e) {
        /* opcional */
      }
    }
    if (state().compras.loaded && !options.force) {
      renderComprasSection();
      return;
    }
    await Promise.all([loadFornecedores(), loadNotasEntrada(), loadContasPagar()]);
    state().compras.loaded = true;
    renderComprasSection();
  }

  function renderComprasKpis() {
    const e = els();
    const notas = state().compras.notas || [];
    const rascunho = notas.filter((n) => n.status === "rascunho").length;
    const lancadas = notas.filter((n) => n.status === "lancada");
    const totalMes = lancadas
      .filter((n) => {
        if (!n.data_entrada) return false;
        const d = new Date(n.data_entrada);
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((s, n) => s + Number(n.valor_total || 0), 0);
    const aberto = (state().compras.contas || [])
      .filter((c) => c.status === "aberto" || c.status === "parcial")
      .reduce((s, c) => s + Number(c.valor_aberto || 0), 0);
    const vencidas = (state().compras.parcelas || []).filter((p) => {
      if (p.status === "pago" || p.status === "cancelado") return false;
      if (!p.vencimento) return false;
      return new Date(p.vencimento) < new Date(new Date().toDateString());
    }).length;

    if (e.comprasKpiNotas) e.comprasKpiNotas.textContent = String(notas.length);
    if (e.comprasKpiRascunho) e.comprasKpiRascunho.textContent = String(rascunho);
    if (e.comprasKpiMes) e.comprasKpiMes.textContent = moeda.format(totalMes);
    if (e.comprasKpiAberto) e.comprasKpiAberto.textContent = moeda.format(aberto);
    if (e.comprasKpiVencidas) e.comprasKpiVencidas.textContent = String(vencidas);
    if (e.comprasKpiFornecedores) {
      e.comprasKpiFornecedores.textContent = String(
        (state().compras.fornecedores || []).filter((f) => f.ativo !== false).length
      );
    }
  }

  function renderNotasTable() {
    const e = els();
    if (!e.comprasNotasTable) return;
    const busca = String(state().compras.filters.notaBusca || "").toLowerCase();
    const statusF = state().compras.filters.notaStatus || "";
    let rows = state().compras.notas || [];
    if (statusF) rows = rows.filter((n) => n.status === statusF);
    if (busca) {
      rows = rows.filter((n) => {
        const hay = `${n.numero_nf || ""} ${n.fornecedor?.nome || ""} ${n.observacoes || ""}`.toLowerCase();
        return hay.includes(busca);
      });
    }
    if (!rows.length) {
      e.comprasNotasTable.innerHTML = `<tr><td colspan="9">Nenhuma nota encontrada.</td></tr>`;
      return;
    }
    e.comprasNotasTable.innerHTML = rows
      .map((n) => {
        const statusClass =
          n.status === "lancada" ? "estoque-status--ok" : n.status === "cancelada" ? "estoque-status--zerado" : "estoque-status--reposicao";
        const id = escapeHtml(n.id);
        let menuItems = [];
        if (n.status === "rascunho") {
          menuItems = [
            { label: "Editar", attrs: `data-edit-nota="${id}"` },
            { label: "Lancar", attrs: `data-lancar-nota="${id}"`, finance: true },
            { label: "Excluir", attrs: `data-del-nota="${id}"`, danger: true }
          ];
        } else if (n.status === "lancada") {
          menuItems = [
            { label: "Ver", attrs: `data-view-nota="${id}"` },
            { label: "Cancelar", attrs: `data-cancelar-nota="${id}"`, danger: true }
          ];
        } else {
          menuItems = [{ label: "Ver", attrs: `data-view-nota="${id}"` }];
        }
        return `
        <tr>
          <td class="pedido-actions-cell">${rowActions(menuItems, "Acoes da nota")}</td>
          <td>#${id}</td>
          <td>${escapeHtml(n.numero_nf || "–")}${n.serie ? ` / ${escapeHtml(n.serie)}` : ""}</td>
          <td>${escapeHtml(n.fornecedor?.nome || "–")}</td>
          <td>${escapeHtml(n.data_entrada || "–")}</td>
          <td><span class="estoque-status ${statusClass}">${escapeHtml(n.status)}</span></td>
          <td>${moeda.format(n.valor_total || 0)}</td>
          <td>${n.estoque_aplicado ? "Sim" : "Não"}</td>
          <td>${n.financeiro_aplicado ? "Sim" : "Não"}</td>
        </tr>`;
      })
      .join("");
  }

  function renderFornecedoresTable() {
    const e = els();
    if (!e.comprasFornecedoresTable) return;
    const busca = String(state().compras.filters.fornBusca || "").toLowerCase();
    let rows = state().compras.fornecedores || [];
    if (busca) {
      rows = rows.filter((f) =>
        `${f.nome} ${f.documento || ""} ${f.cidade || ""} ${f.email || ""}`.toLowerCase().includes(busca)
      );
    }
    if (!rows.length) {
      e.comprasFornecedoresTable.innerHTML = `<tr><td colspan="7">Nenhum fornecedor cadastrado.</td></tr>`;
      return;
    }
    e.comprasFornecedoresTable.innerHTML = rows
      .map((f) => {
        const id = escapeHtml(f.id);
        return `
      <tr>
        <td class="pedido-actions-cell">${rowActions(
          [
            { label: "Editar", attrs: `data-edit-fornecedor="${id}"` },
            { label: "Excluir", attrs: `data-del-fornecedor="${id}"`, danger: true }
          ],
          "Acoes do fornecedor"
        )}</td>
        <td>${escapeHtml(f.nome)}</td>
        <td>${escapeHtml(f.documento || "–")}</td>
        <td>${escapeHtml(f.telefone || "–")}</td>
        <td>${escapeHtml(f.email || "–")}</td>
        <td>${escapeHtml([f.cidade, f.uf].filter(Boolean).join("/") || "–")}</td>
        <td>${f.ativo === false ? "Não" : "Sim"}</td>
      </tr>`;
      })
      .join("");
  }

  function renderContasPagarTable() {
    const e = els();
    // Atalho em Compras: só NFs
    const rowsCompras = getParcelasPagarRows({
      busca: state().compras.filters.pagarBusca,
      status: state().compras.filters.pagarStatus,
      onlyNota: true
    });
    renderParcelasIntoTable(e.comprasPagarTable, rowsCompras, { showOrigem: true, showEmissao: false });

    // Caixa único: aba Contas a Pagar (filtros de coluna no cabeçalho)
    const cols = state().compras.filters.despesasCols || {};
    let rowsDespesas = getParcelasPagarRows({
      busca: state().compras.filters.despesasBusca,
      // status/origem do cabeçalho têm prioridade; fallback nos selects antigos se existirem
      status: cols.status || state().compras.filters.despesasStatus || "",
      origem: cols.origem || state().compras.filters.despesasOrigem || ""
    });
    rowsDespesas = applyDespesasColumnFilters(rowsDespesas);
    renderParcelasIntoTable(e.despesasPagarTable, rowsDespesas, { showOrigem: true, showEmissao: true });
    renderDespesasKpis();
  }

  function renderComprasSection() {
    ensureStateDefaults();
    setComprasView(state().compras.view);
    renderComprasKpis();
    renderNotasTable();
    renderFornecedoresTable();
    renderContasPagarTable();
  }

  async function ensureDespesasPagarLoaded(options = {}) {
    await ensureComprasLoaded(options);
    renderContasPagarTable();
  }

  function openDespesaModal() {
    ensureStateDefaults();
    const e = els();
    if (!e.despesaModal || !e.despesaForm) return;
    e.despesaForm.reset();
    fillFornecedorSelect(e.despesaFornecedorSelect, "", "Sem fornecedor / avulso");
    fillFormaPagamentoSelect(e.despesaFormaPagamento, "");
    const hoje = formatDateInput(new Date());
    const emissao = e.despesaForm.elements.namedItem("emissao");
    if (emissao && "value" in emissao) emissao.value = hoje;
    const venc = e.despesaForm.elements.namedItem("vencimento");
    if (venc && "value" in venc) venc.value = hoje;
    const parc = e.despesaForm.elements.namedItem("parcelas");
    if (parc && "value" in parc) parc.value = "1";
    const intervalo = e.despesaForm.elements.namedItem("intervalo_dias");
    if (intervalo && "value" in intervalo) intervalo.value = "30";
    e.despesaModal.classList.remove("hidden");
  }

  function closeDespesaModal() {
    const e = els();
    if (e.despesaModal) e.despesaModal.classList.add("hidden");
  }

  async function saveDespesaManual(event) {
    event.preventDefault();
    const e = els();
    const formData = new FormData(e.despesaForm);
    const descricao = String(formData.get("descricao") || "").trim();
    const valor = Number(formData.get("valor") || 0);
    const nParcelas = Math.max(1, Math.trunc(Number(formData.get("parcelas") || 1)));
    const intervalo = Math.max(1, Math.trunc(Number(formData.get("intervalo_dias") || 30)));
    const vencimento = String(formData.get("vencimento") || "").trim();
    const emissao = String(formData.get("emissao") || "").trim() || formatDateInput(new Date());
    const fornecedorId = String(formData.get("fornecedor_id") || "").trim();
    const formaId = String(formData.get("forma_pagamento_id") || "").trim();
    const categoria = String(formData.get("categoria") || "").trim();
    const observacoes = String(formData.get("observacoes") || "").trim();
    const jaPago = Boolean(formData.get("ja_pago"));

    if (!descricao) throw new Error("Informe a descrição.");
    if (!(valor > 0)) throw new Error("Informe um valor válido.");
    if (!vencimento) throw new Error("Informe o vencimento.");

    const baseVenc = new Date(`${vencimento}T12:00:00`);
    const cents = Math.round(valor * 100);
    const base = Math.floor(cents / nParcelas);
    const resto = cents - base * nParcelas;
    const obsParts = [descricao];
    if (categoria) obsParts.push(`Cat.: ${categoria}`);
    if (observacoes) obsParts.push(observacoes);

    const { data: conta, error: contaErr } = await sb()
      .from("contas_pagar")
      .insert({
        empresa_id: state().empresaId,
        nota_entrada_id: null,
        fornecedor_id: fornecedorId ? Number(fornecedorId) : null,
        origem: "despesa_manual",
        numero_titulo: `DESP-${Date.now().toString().slice(-8)}`,
        emissao: new Date(`${emissao}T12:00:00`).toISOString(),
        valor_original: Number(valor.toFixed(2)),
        valor_aberto: jaPago ? 0 : Number(valor.toFixed(2)),
        status: jaPago ? "pago" : "aberto",
        observacoes: obsParts.join(" | ")
      })
      .select("id, numero_titulo")
      .single();
    if (contaErr) throw contaErr;

    const parcelasPayload = [];
    for (let i = 0; i < nParcelas; i += 1) {
      const valorCents = base + (i < resto ? 1 : 0);
      const venc = new Date(baseVenc);
      venc.setDate(venc.getDate() + i * intervalo);
      const valorParcela = Number((valorCents / 100).toFixed(2));
      parcelasPayload.push({
        empresa_id: state().empresaId,
        conta_pagar_id: conta.id,
        numero_parcela: i + 1,
        vencimento: formatDateInput(venc),
        valor_parcela: valorParcela,
        valor_pago: jaPago ? valorParcela : 0,
        status: jaPago ? "pago" : "pendente",
        forma_pagamento_id: formaId ? Number(formaId) : null,
        observacoes: descricao
      });
    }

    const { data: parcelasCriadas, error: pErr } = await sb()
      .from("contas_pagar_parcelas")
      .insert(parcelasPayload)
      .select("id, valor_parcela");
    if (pErr) throw pErr;

    if (jaPago && parcelasCriadas?.length) {
      const pags = parcelasCriadas.map((p) => ({
        empresa_id: state().empresaId,
        parcela_id: p.id,
        data_pagamento: vencimento,
        valor: Number(p.valor_parcela || 0),
        forma_pagamento_id: formaId ? Number(formaId) : null,
        observacoes: "Pago na criação da despesa"
      }));
      const { error: payErr } = await sb().from("pagamentos").insert(pags);
      if (payErr) throw payErr;
    }

    closeDespesaModal();
    state().compras.loaded = false;
    await ensureComprasLoaded({ force: true });
    showToast(`Despesa ${conta.numero_titulo} lançada em Contas a Pagar`);
  }

  /* ---------- Editar / excluir conta a pagar ---------- */

  function ensureContaPagarEditState() {
    if (!state().contaPagarEdit) {
      state().contaPagarEdit = { contaId: null, parcelas: [], removedIds: [] };
    }
    return state().contaPagarEdit;
  }

  function closeContaPagarEditModal() {
    const e = els();
    if (e.contaPagarEditModal) e.contaPagarEditModal.classList.add("hidden");
    state().contaPagarEdit = { contaId: null, parcelas: [], removedIds: [] };
  }

  function renderContaPagarEditTotals() {
    const e = els();
    const edit = ensureContaPagarEditState();
    const total = (edit.parcelas || []).reduce((s, p) => s + Number(p.valor || 0), 0);
    const pago = (edit.parcelas || []).reduce((s, p) => s + Number(p.valorPago || 0), 0);
    if (e.contaPagarEditTotals) {
      e.contaPagarEditTotals.textContent = `${edit.parcelas.length} parcela(s) • total ${moeda.format(total)} • pago ${moeda.format(pago)} • saldo ${moeda.format(Math.max(0, total - pago))}`;
    }
  }

  function renderContaPagarEditParcelas() {
    const e = els();
    if (!e.contaPagarEditParcelasList) return;
    const edit = ensureContaPagarEditState();
    const formasHtml = ['<option value="">Selecione</option>'];
    for (const forma of state().formasPagamento || []) {
      formasHtml.push(`<option value="${forma.id}">${escapeHtml(forma.nome)}</option>`);
    }

    e.contaPagarEditParcelasList.innerHTML = (edit.parcelas || [])
      .map(
        (p, index) => `
      <div class="documento-payment-parcela-row conta-pagar-parcela-row" data-cp-parcela-index="${index}">
        <div class="parcela-numero">#${p.numero || index + 1}</div>
        <label>Vencimento
          <input type="date" data-cp-parcela-field="vencimento" value="${escapeHtml(p.vencimento || "")}" />
        </label>
        <label>Valor
          <input type="number" min="0" step="0.01" data-cp-parcela-field="valor" value="${Number(p.valor || 0).toFixed(2)}" />
        </label>
        <label>Valor pago
          <input type="number" min="0" step="0.01" data-cp-parcela-field="valorPago" value="${Number(p.valorPago || 0).toFixed(2)}" />
        </label>
        <label>Data pagamento
          <input type="date" data-cp-parcela-field="dataPagamento" value="${escapeHtml(p.dataPagamento || "")}" />
        </label>
        <label>Forma
          <select data-cp-parcela-field="formaPagamentoId">${formasHtml.join("")}</select>
        </label>
        <label>Status
          <select data-cp-parcela-field="status">
            <option value="pendente">Pendente</option>
            <option value="parcial">Parcial</option>
            <option value="pago">Pago</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </label>
        <button type="button" class="btn btn-ghost" data-remove-cp-parcela="${index}" ${edit.parcelas.length <= 1 ? "disabled" : ""}>Remover</button>
      </div>`
      )
      .join("");

    e.contaPagarEditParcelasList.querySelectorAll("[data-cp-parcela-index]").forEach((row) => {
      const idx = Number(row.getAttribute("data-cp-parcela-index"));
      const p = edit.parcelas[idx];
      if (!p) return;
      const forma = row.querySelector('[data-cp-parcela-field="formaPagamentoId"]');
      if (forma) forma.value = p.formaPagamentoId || "";
      const status = row.querySelector('[data-cp-parcela-field="status"]');
      if (status) status.value = p.status || "pendente";
    });

    renderContaPagarEditTotals();
  }

  /** Garante registro na tabela pagamentos (data real da baixa). */
  async function syncParcelaPagamentoRecord(parcelaId, { valorPago, dataPagamento, formaPagamentoId, status }) {
    if (!parcelaId) return;
    await sb().from("pagamentos").delete().eq("empresa_id", state().empresaId).eq("parcela_id", parcelaId);

    const valor = Number(valorPago || 0);
    if (status === "cancelado" || valor <= 0.009) return;

    const data =
      String(dataPagamento || "").trim() ||
      formatDateInput(new Date());

    const { error } = await sb().from("pagamentos").insert({
      empresa_id: state().empresaId,
      parcela_id: Number(parcelaId),
      data_pagamento: data,
      valor: Number(valor.toFixed(2)),
      forma_pagamento_id: formaPagamentoId ? Number(formaPagamentoId) : null,
      observacoes: "Baixa via edição de título"
    });
    if (error) throw error;
  }

  function applyPagoDefaultsToParcela(p) {
    if (!p) return;
    if (String(p.status) === "pago") {
      const valor = Number(p.valor || 0);
      if (Number(p.valorPago || 0) + 0.009 < valor) {
        p.valorPago = valor;
      }
      if (!p.dataPagamento) {
        p.dataPagamento = formatDateInput(new Date());
      }
    }
  }

  async function openContaPagarEditModal(contaId) {
    ensureStateDefaults();
    const e = els();
    if (!e.contaPagarEditModal) return;

    await ensureComprasLoaded();

    const { data: conta, error } = await sb()
      .from("contas_pagar")
      .select(
        "id, nota_entrada_id, fornecedor_id, origem, numero_titulo, emissao, valor_original, valor_aberto, status, observacoes, fornecedor:fornecedores(id, nome)"
      )
      .eq("empresa_id", state().empresaId)
      .eq("id", contaId)
      .maybeSingle();
    if (error) throw error;
    if (!conta) throw new Error("Título não encontrado");

    const { data: parcelas, error: pErr } = await sb()
      .from("contas_pagar_parcelas")
      .select("id, numero_parcela, vencimento, valor_parcela, valor_pago, status, forma_pagamento_id, observacoes")
      .eq("empresa_id", state().empresaId)
      .eq("conta_pagar_id", contaId)
      .order("numero_parcela", { ascending: true });
    if (pErr) throw pErr;

    // Datas reais de pagamento (ultima baixa por parcela)
    const parcelaIds = (parcelas || []).map((p) => p.id).filter(Boolean);
    const lastPayDateByParcela = {};
    if (parcelaIds.length) {
      const { data: pays, error: payErr } = await sb()
        .from("pagamentos")
        .select("parcela_id, data_pagamento, valor")
        .eq("empresa_id", state().empresaId)
        .in("parcela_id", parcelaIds)
        .order("data_pagamento", { ascending: false });
      if (!payErr) {
        for (const pay of pays || []) {
          const key = String(pay.parcela_id);
          if (!lastPayDateByParcela[key] && pay.data_pagamento) {
            lastPayDateByParcela[key] = String(pay.data_pagamento).slice(0, 10);
          }
        }
      }
    }

    const edit = ensureContaPagarEditState();
    edit.contaId = conta.id;
    edit.origem = conta.origem;
    edit.notaEntradaId = conta.nota_entrada_id;
    edit.removedIds = [];
    edit.parcelas = (parcelas || []).map((p) => {
      let valorPago = Number(p.valor_pago || 0);
      const valor = Number(p.valor_parcela || 0);
      let status = p.status || "pendente";
      // Corrigir inconsistência legada: status pago com valor pago 0
      if (status === "pago" && valorPago + 0.009 < valor) {
        valorPago = valor;
      }
      const dataPagamento =
        lastPayDateByParcela[String(p.id)] ||
        (status === "pago" || valorPago > 0 ? "" : "");
      return {
        id: p.id,
        numero: p.numero_parcela,
        vencimento: p.vencimento || "",
        valor,
        valorPago,
        dataPagamento,
        status,
        formaPagamentoId: p.forma_pagamento_id ? String(p.forma_pagamento_id) : "",
        observacoes: p.observacoes || ""
      };
    });
    if (!edit.parcelas.length) {
      edit.parcelas = [
        {
          id: null,
          numero: 1,
          vencimento: formatDateInput(new Date()),
          valor: Number(conta.valor_original || 0),
          valorPago: 0,
          dataPagamento: "",
          status: "pendente",
          formaPagamentoId: "",
          observacoes: ""
        }
      ];
    }

    if (e.contaPagarEditId) e.contaPagarEditId.value = String(conta.id);
    if (e.contaPagarEditTitulo) e.contaPagarEditTitulo.value = conta.numero_titulo || `CP-${conta.id}`;
    fillFornecedorSelect(e.contaPagarEditFornecedor, conta.fornecedor_id || "", "Sem fornecedor / avulso");
    if (e.contaPagarEditEmissao) {
      e.contaPagarEditEmissao.value = conta.emissao
        ? formatDateInput(new Date(conta.emissao))
        : formatDateInput(new Date());
    }
    if (e.contaPagarEditOrigem) e.contaPagarEditOrigem.value = origemLabel(conta.origem);
    if (e.contaPagarEditObs) e.contaPagarEditObs.value = conta.observacoes || "";
    if (e.contaPagarEditModalTitle) {
      e.contaPagarEditModalTitle.textContent = `Editar ${conta.numero_titulo || `CP-${conta.id}`}`;
    }
    if (e.contaPagarEditModalSubtitle) {
      e.contaPagarEditModalSubtitle.textContent =
        conta.origem === "nota_entrada"
          ? "Título de NF de compra — emissão e parcelas editáveis."
          : "Despesa / título manual — emissão e parcelas editáveis.";
    }

    renderContaPagarEditParcelas();
    e.contaPagarEditModal.classList.remove("hidden");
  }

  function addContaPagarEditParcela() {
    const edit = ensureContaPagarEditState();
    const last = edit.parcelas[edit.parcelas.length - 1];
    edit.parcelas.push({
      id: null,
      numero: edit.parcelas.length + 1,
      vencimento: addDaysYmd(last?.vencimento || formatDateInput(new Date()), 30),
      valor: 0,
      valorPago: 0,
      dataPagamento: "",
      status: "pendente",
      formaPagamentoId: last?.formaPagamentoId || "",
      observacoes: ""
    });
    renderContaPagarEditParcelas();
  }

  function removeContaPagarEditParcela(index) {
    const edit = ensureContaPagarEditState();
    if (edit.parcelas.length <= 1) return;
    const [removed] = edit.parcelas.splice(index, 1);
    if (removed?.id) edit.removedIds.push(removed.id);
    edit.parcelas.forEach((p, i) => {
      p.numero = i + 1;
    });
    renderContaPagarEditParcelas();
  }

  async function saveContaPagarEdit(event) {
    event.preventDefault();
    const e = els();
    const edit = ensureContaPagarEditState();
    if (!edit.contaId) throw new Error("Título não carregado");

    const titulo = String(e.contaPagarEditTitulo?.value || "").trim();
    const emissao = String(e.contaPagarEditEmissao?.value || "").trim();
    const fornecedorId = String(e.contaPagarEditFornecedor?.value || "").trim();
    const obs = String(e.contaPagarEditObs?.value || "").trim();
    if (!titulo) throw new Error("Informe o título.");
    if (!emissao) throw new Error("Informe a data de emissão.");
    if (!edit.parcelas.length) throw new Error("Informe ao menos uma parcela.");

    for (const p of edit.parcelas) {
      if (!p.vencimento) throw new Error("Todas as parcelas precisam de vencimento.");
      if (!(Number(p.valor) >= 0)) throw new Error("Valor de parcela inválido.");
      // Normaliza pago ANTES dos totais (status pago sem valor pago preenchido)
      if (String(p.status) === "pago") {
        p.valorPago = Number(p.valor || 0);
        if (!p.dataPagamento) p.dataPagamento = formatDateInput(new Date());
      }
      if (Number(p.valorPago || 0) - Number(p.valor || 0) > 0.009) {
        throw new Error("Valor pago não pode ser maior que o valor da parcela.");
      }
      if (
        (String(p.status) === "pago" || Number(p.valorPago || 0) > 0.009) &&
        !String(p.dataPagamento || "").trim()
      ) {
        throw new Error("Informe a data de pagamento das parcelas pagas/parciais.");
      }
    }

    const total = edit.parcelas.reduce((s, p) => s + Number(p.valor || 0), 0);
    const pago = edit.parcelas.reduce((s, p) => s + Number(p.valorPago || 0), 0);
    const aberto = Math.max(0, total - pago);
    let statusConta = "aberto";
    if (aberto <= 0.009) statusConta = "pago";
    else if (pago > 0) statusConta = "parcial";
    if (edit.parcelas.every((p) => p.status === "cancelado")) statusConta = "cancelado";

    const { error: updContaErr } = await sb()
      .from("contas_pagar")
      .update({
        numero_titulo: titulo,
        fornecedor_id: fornecedorId ? Number(fornecedorId) : null,
        emissao: new Date(`${emissao}T12:00:00`).toISOString(),
        valor_original: Number(total.toFixed(2)),
        valor_aberto: Number(aberto.toFixed(2)),
        status: statusConta,
        observacoes: obs || null,
        updated_at: new Date().toISOString()
      })
      .eq("id", edit.contaId)
      .eq("empresa_id", state().empresaId);
    if (updContaErr) throw updContaErr;

    // Remove parcelas marcadas
    for (const id of edit.removedIds || []) {
      await sb().from("pagamentos").delete().eq("empresa_id", state().empresaId).eq("parcela_id", id);
      await sb()
        .from("contas_pagar_parcelas")
        .delete()
        .eq("empresa_id", state().empresaId)
        .eq("id", id);
    }

    for (let i = 0; i < edit.parcelas.length; i += 1) {
      const p = edit.parcelas[i];
      let status = p.status || "pendente";
      let valorPago = Number(Number(p.valorPago || 0).toFixed(2));
      const valorParcela = Number(Number(p.valor || 0).toFixed(2));

      // Status "pago" SEMPRE quita a parcela e exige valor pago completo
      if (status === "pago") {
        valorPago = valorParcela;
        if (!p.dataPagamento) p.dataPagamento = formatDateInput(new Date());
      } else if (valorPago + 0.009 >= valorParcela && valorParcela > 0 && status !== "cancelado") {
        status = "pago";
        valorPago = valorParcela;
        if (!p.dataPagamento) p.dataPagamento = formatDateInput(new Date());
      } else if (valorPago > 0 && status !== "cancelado") {
        status = "parcial";
        if (!p.dataPagamento) p.dataPagamento = formatDateInput(new Date());
      } else if (status !== "cancelado") {
        status = "pendente";
        valorPago = 0;
      }

      const payload = {
        empresa_id: state().empresaId,
        conta_pagar_id: edit.contaId,
        numero_parcela: i + 1,
        vencimento: p.vencimento || null,
        valor_parcela: valorParcela,
        valor_pago: valorPago,
        status,
        forma_pagamento_id: p.formaPagamentoId ? Number(p.formaPagamentoId) : null,
        observacoes: p.observacoes || null
      };

      let parcelaId = p.id ? Number(p.id) : null;
      if (parcelaId) {
        const { error } = await sb()
          .from("contas_pagar_parcelas")
          .update(payload)
          .eq("id", parcelaId)
          .eq("empresa_id", state().empresaId);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await sb()
          .from("contas_pagar_parcelas")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        parcelaId = inserted?.id ? Number(inserted.id) : null;
        p.id = parcelaId;
      }

      // Sincroniza baixa real (data_pagamento) — alimenta o card "Pagas no mês"
      await syncParcelaPagamentoRecord(parcelaId, {
        valorPago,
        dataPagamento: p.dataPagamento || "",
        formaPagamentoId: p.formaPagamentoId || "",
        status
      });
    }

    closeContaPagarEditModal();
    state().compras.loaded = false;
    await ensureComprasLoaded({ force: true });
    showToast("Título atualizado");
  }

  async function deleteContaPagarEdit() {
    const edit = ensureContaPagarEditState();
    if (!edit.contaId) return;

    const msg =
      edit.origem === "nota_entrada"
        ? "Excluir este título gerado por NF?\n\nAs parcelas e pagamentos serão removidos. A NF em si permanece (você pode cancelá-la em Compras se quiser estornar estoque)."
        : "Excluir este título e todas as parcelas/pagamentos?";
    if (!window.confirm(msg)) return;

    const parcelaIds = (edit.parcelas || []).map((p) => p.id).filter(Boolean);
    for (const id of [...parcelaIds, ...(edit.removedIds || [])]) {
      await sb().from("pagamentos").delete().eq("empresa_id", state().empresaId).eq("parcela_id", id);
    }
    await sb()
      .from("contas_pagar_parcelas")
      .delete()
      .eq("empresa_id", state().empresaId)
      .eq("conta_pagar_id", edit.contaId);
    const { error } = await sb()
      .from("contas_pagar")
      .delete()
      .eq("empresa_id", state().empresaId)
      .eq("id", edit.contaId);
    if (error) throw error;

    // Se veio de NF, marca financeiro como não aplicado para permitir reprocessar se necessário
    if (edit.notaEntradaId) {
      await sb()
        .from("notas_entrada")
        .update({ financeiro_aplicado: false, updated_at: new Date().toISOString() })
        .eq("empresa_id", state().empresaId)
        .eq("id", edit.notaEntradaId);
    }

    closeContaPagarEditModal();
    state().compras.loaded = false;
    await ensureComprasLoaded({ force: true });
    showToast("Título excluído");
  }

  /* ---------- Fornecedor combo + modal rápido ---------- */

  const FORNECEDOR_COMBO_KEYS = ["despesa", "contaEdit", "nota"];

  function getFornecedorComboRoot(key) {
    return document.querySelector(`[data-fornecedor-combo="${key}"]`);
  }

  function getFornecedorComboConfig(key) {
    if (key === "despesa") {
      return { emptyLabel: "Sem fornecedor / avulso", allowEmpty: true };
    }
    if (key === "contaEdit") {
      return { emptyLabel: "Sem fornecedor / avulso", allowEmpty: true };
    }
    return { emptyLabel: "Selecione o fornecedor", allowEmpty: true };
  }

  function getFornecedorLabelById(id) {
    if (!id) return null;
    const f = (state().compras.fornecedores || []).find((x) => String(x.id) === String(id));
    return f ? f.nome : null;
  }

  function setFornecedorComboValue(keyOrEl, selected = "", emptyLabel) {
    const root =
      typeof keyOrEl === "string"
        ? getFornecedorComboRoot(keyOrEl)
        : keyOrEl?.closest?.("[data-fornecedor-combo]") || null;
    // Compat: se passou o input hidden diretamente
    const hidden =
      (root && root.querySelector('input[type="hidden"]')) ||
      (keyOrEl instanceof HTMLElement && keyOrEl.tagName === "INPUT" ? keyOrEl : null);
    const comboRoot = root || hidden?.closest?.("[data-fornecedor-combo]");
    if (!comboRoot || !hidden) {
      // fallback antigo se ainda for select
      if (keyOrEl && keyOrEl.tagName === "SELECT") {
        fillFornecedorSelectLegacy(keyOrEl, selected, emptyLabel);
      }
      return;
    }
    const key = comboRoot.getAttribute("data-fornecedor-combo") || "despesa";
    const cfg = getFornecedorComboConfig(key);
    const label = emptyLabel || cfg.emptyLabel;
    hidden.value = selected == null ? "" : String(selected);
    const labelEl = comboRoot.querySelector("[data-fornecedor-combo-label]");
    if (labelEl) {
      labelEl.textContent = selected ? getFornecedorLabelById(selected) || `Fornecedor #${selected}` : label;
    }
  }

  function fillFornecedorSelectLegacy(selectEl, selected = "", emptyLabel = "Selecione o fornecedor") {
    if (!selectEl) return;
    const opts = [`<option value="">${escapeHtml(emptyLabel)}</option>`];
    for (const f of state().compras.fornecedores || []) {
      if (f.ativo === false) continue;
      const sel = String(f.id) === String(selected) ? " selected" : "";
      opts.push(`<option value="${escapeHtml(f.id)}"${sel}>${escapeHtml(f.nome)}</option>`);
    }
    selectEl.innerHTML = opts.join("");
  }

  // Alias usado no resto do módulo
  function fillFornecedorSelect(selectElOrKey, selected = "", emptyLabel = "Selecione o fornecedor") {
    if (typeof selectElOrKey === "string") {
      setFornecedorComboValue(selectElOrKey, selected, emptyLabel);
      return;
    }
    if (selectElOrKey?.closest?.("[data-fornecedor-combo]") || selectElOrKey?.id) {
      // se for o hidden input do combo
      if (selectElOrKey.id === "despesaFornecedorSelect") {
        setFornecedorComboValue("despesa", selected, emptyLabel);
        return;
      }
      if (selectElOrKey.id === "contaPagarEditFornecedor") {
        setFornecedorComboValue("contaEdit", selected, emptyLabel);
        return;
      }
      if (selectElOrKey.id === "notaEntradaFornecedor") {
        setFornecedorComboValue("nota", selected, emptyLabel);
        return;
      }
    }
    setFornecedorComboValue(selectElOrKey, selected, emptyLabel);
  }

  function closeAllFornecedorCombos(exceptRoot = null) {
    document.querySelectorAll("[data-fornecedor-combo-panel]").forEach((panel) => {
      if (exceptRoot && exceptRoot.contains(panel)) return;
      panel.classList.add("hidden");
    });
  }

  function renderFornecedorComboOptions(root, query = "") {
    const optionsEl = root.querySelector("[data-fornecedor-combo-options]");
    if (!optionsEl) return;
    const key = root.getAttribute("data-fornecedor-combo") || "despesa";
    const cfg = getFornecedorComboConfig(key);
    const hidden = root.querySelector('input[type="hidden"]');
    const selected = hidden?.value || "";
    const q = String(query || "").trim().toLowerCase();

    const list = (state().compras.fornecedores || []).filter((f) => {
      if (f.ativo === false) return false;
      if (!q) return true;
      const hay = `${f.nome || ""} ${f.documento || ""} ${f.cidade || ""} ${f.email || ""}`.toLowerCase();
      return hay.includes(q);
    });

    const parts = [];
    parts.push(`
      <button type="button" class="fornecedor-combo-option fornecedor-combo-option--new" data-fornecedor-combo-new>
        + Cadastrar novo fornecedor
      </button>
    `);
    if (cfg.allowEmpty) {
      parts.push(`
        <button type="button" class="fornecedor-combo-option ${selected === "" ? "active" : ""}" data-fornecedor-combo-pick="" data-label="${escapeHtml(cfg.emptyLabel)}">
          ${escapeHtml(cfg.emptyLabel)}
        </button>
      `);
    }
    if (!list.length) {
      parts.push(`<div class="fornecedor-combo-empty">Nenhum fornecedor encontrado${q ? ` para “${escapeHtml(query)}”` : ""}.</div>`);
    } else {
      for (const f of list) {
        const meta = [f.documento, f.cidade && f.uf ? `${f.cidade}/${f.uf}` : f.cidade || f.uf]
          .filter(Boolean)
          .join(" • ");
        parts.push(`
          <button type="button" class="fornecedor-combo-option ${String(selected) === String(f.id) ? "active" : ""}" data-fornecedor-combo-pick="${escapeHtml(f.id)}" data-label="${escapeHtml(f.nome)}">
            <span>${escapeHtml(f.nome)}</span>
            ${meta ? `<small>${escapeHtml(meta)}</small>` : ""}
          </button>
        `);
      }
    }
    optionsEl.innerHTML = parts.join("");
  }

  function openFornecedorCombo(root) {
    if (!root) return;
    closeAllFornecedorCombos(root);
    const panel = root.querySelector("[data-fornecedor-combo-panel]");
    const search = root.querySelector("[data-fornecedor-combo-search]");
    if (!panel) return;
    panel.classList.remove("hidden");
    if (search) {
      search.value = "";
      renderFornecedorComboOptions(root, "");
      setTimeout(() => search.focus(), 0);
    } else {
      renderFornecedorComboOptions(root, "");
    }
  }

  function pickFornecedorCombo(root, id, label) {
    const key = root.getAttribute("data-fornecedor-combo");
    const cfg = getFornecedorComboConfig(key);
    setFornecedorComboValue(key, id || "", label || cfg.emptyLabel);
    closeAllFornecedorCombos();
  }

  function refreshAllFornecedorCombos() {
    for (const key of FORNECEDOR_COMBO_KEYS) {
      const root = getFornecedorComboRoot(key);
      if (!root) continue;
      const hidden = root.querySelector('input[type="hidden"]');
      const cfg = getFornecedorComboConfig(key);
      setFornecedorComboValue(key, hidden?.value || "", cfg.emptyLabel);
      const panel = root.querySelector("[data-fornecedor-combo-panel]");
      if (panel && !panel.classList.contains("hidden")) {
        const search = root.querySelector("[data-fornecedor-combo-search]");
        renderFornecedorComboOptions(root, search?.value || "");
      }
    }
  }

  function attachFornecedorCombos() {
    // Eventos delegados uma vez
    if (attachFornecedorCombos._done) return;
    attachFornecedorCombos._done = true;

    document.addEventListener("click", (ev) => {
      const t = ev.target;
      if (!(t instanceof HTMLElement)) return;

      const trigger = t.closest("[data-fornecedor-combo-trigger]");
      if (trigger) {
        ev.preventDefault();
        const root = trigger.closest("[data-fornecedor-combo]");
        const panel = root?.querySelector("[data-fornecedor-combo-panel]");
        if (panel?.classList.contains("hidden")) openFornecedorCombo(root);
        else closeAllFornecedorCombos();
        return;
      }

      const novo = t.closest("[data-fornecedor-combo-new]");
      if (novo) {
        ev.preventDefault();
        const root = novo.closest("[data-fornecedor-combo]");
        const key = root?.getAttribute("data-fornecedor-combo") || null;
        closeAllFornecedorCombos();
        openFornecedorModal(null, {
          quick: true,
          targetComboKey: key,
          onSaved: (fornecedor) => {
            if (key && fornecedor?.id) {
              setFornecedorComboValue(key, fornecedor.id);
            }
            refreshAllFornecedorCombos();
          }
        });
        return;
      }

      const pick = t.closest("[data-fornecedor-combo-pick]");
      if (pick) {
        ev.preventDefault();
        const root = pick.closest("[data-fornecedor-combo]");
        if (!root) return;
        pickFornecedorCombo(
          root,
          pick.getAttribute("data-fornecedor-combo-pick") || "",
          pick.getAttribute("data-label") || ""
        );
        return;
      }

      if (!t.closest("[data-fornecedor-combo]")) {
        closeAllFornecedorCombos();
      }
    });

    document.addEventListener("input", (ev) => {
      const t = ev.target;
      if (!(t instanceof HTMLElement)) return;
      if (!t.matches("[data-fornecedor-combo-search]")) return;
      const root = t.closest("[data-fornecedor-combo]");
      if (!root) return;
      renderFornecedorComboOptions(root, t.value || "");
    });
  }

  function openFornecedorModal(editId = null, options = {}) {
    ensureStateDefaults();
    const e = els();
    state().fornecedorModal.editId = editId;
    state().fornecedorModal.quick = Boolean(options.quick);
    state().fornecedorModal.targetComboKey = options.targetComboKey || null;
    state().fornecedorModal.onSaved = typeof options.onSaved === "function" ? options.onSaved : null;
    if (!e.fornecedorModal || !e.fornecedorForm) return;
    e.fornecedorForm.reset();
    if (e.fornecedorModalTitle) {
      e.fornecedorModalTitle.textContent = editId ? "Editar fornecedor" : "Novo fornecedor";
    }
    if (e.fornecedorModalSubtitle) {
      e.fornecedorModalSubtitle.textContent = options.quick
        ? "Cadastro rápido — a tela anterior permanece aberta."
        : "Cadastre quem vende para a empresa.";
    }
    if (editId) {
      const f = state().compras.fornecedores.find((x) => Number(x.id) === Number(editId));
      if (f) {
        const set = (name, val) => {
          const field = e.fornecedorForm.elements.namedItem(name);
          if (field && "value" in field) field.value = val == null ? "" : String(val);
        };
        set("nome", f.nome);
        set("documento", f.documento);
        set("telefone", f.telefone);
        set("email", f.email);
        set("cidade", f.cidade);
        set("uf", f.uf);
        set("observacoes", f.observacoes);
        set("ativo", f.ativo === false ? "nao" : "sim");
      }
    }
    e.fornecedorModal.classList.remove("hidden");
    // Foco no nome para cadastro rápido
    const nomeField = e.fornecedorForm.elements.namedItem("nome");
    if (nomeField && "focus" in nomeField) {
      setTimeout(() => nomeField.focus(), 50);
    }
  }

  function closeFornecedorModal() {
    const e = els();
    if (e.fornecedorModal) e.fornecedorModal.classList.add("hidden");
    state().fornecedorModal.editId = null;
    state().fornecedorModal.quick = false;
    state().fornecedorModal.targetComboKey = null;
    state().fornecedorModal.onSaved = null;
  }

  async function saveFornecedor(event) {
    event.preventDefault();
    const e = els();
    const formData = new FormData(e.fornecedorForm);
    const nome = String(formData.get("nome") || "").trim();
    if (!nome) throw new Error("Informe o nome do fornecedor.");
    const payload = {
      empresa_id: state().empresaId,
      nome,
      documento: String(formData.get("documento") || "").trim() || null,
      telefone: String(formData.get("telefone") || "").trim() || null,
      email: String(formData.get("email") || "").trim() || null,
      cidade: String(formData.get("cidade") || "").trim() || null,
      uf: String(formData.get("uf") || "").trim() || null,
      observacoes: String(formData.get("observacoes") || "").trim() || null,
      ativo: String(formData.get("ativo") || "sim") === "sim",
      updated_at: new Date().toISOString()
    };
    const editId = state().fornecedorModal.editId;
    const onSaved = state().fornecedorModal.onSaved;
    let saved = null;

    if (editId) {
      const { data, error } = await sb()
        .from("fornecedores")
        .update(payload)
        .eq("id", editId)
        .eq("empresa_id", state().empresaId)
        .select("id, nome, documento, telefone, email, cidade, uf, ativo, observacoes")
        .single();
      if (error) throw error;
      saved = data;
    } else {
      const { data, error } = await sb()
        .from("fornecedores")
        .insert(payload)
        .select("id, nome, documento, telefone, email, cidade, uf, ativo, observacoes")
        .single();
      if (error) throw error;
      saved = data;
    }

    closeFornecedorModal();
    await loadFornecedores();
    refreshAllFornecedorCombos();
    // Não re-renderiza toda a seção de compras se for quick (evita “piscar” outras telas)
    if (!onSaved) {
      renderComprasSection();
    } else {
      // Atualiza só a tabela de fornecedores se estiver visível
      renderFornecedoresTable();
    }
    if (typeof onSaved === "function" && saved) {
      onSaved(saved);
    }
    showToast(editId ? "Fornecedor atualizado" : "Fornecedor salvo");
  }

  async function deleteFornecedor(id) {
    if (!window.confirm("Excluir este fornecedor?")) return;
    const { error } = await sb()
      .from("fornecedores")
      .delete()
      .eq("id", id)
      .eq("empresa_id", state().empresaId);
    if (error) throw error;
    await loadFornecedores();
    refreshAllFornecedorCombos();
    renderComprasSection();
    showToast("Fornecedor excluído");
  }

  /* ---------- Nota modal ---------- */

  function fillFormaPagamentoSelect(selectEl, selected = "") {
    if (!selectEl) return;
    const formas = state().formasPagamento || [];
    const opts = ['<option value="">Forma de pagamento</option>'];
    for (const f of formas) {
      const sel = String(f.id) === String(selected) ? " selected" : "";
      opts.push(`<option value="${escapeHtml(f.id)}"${sel}>${escapeHtml(f.nome)}</option>`);
    }
    selectEl.innerHTML = opts.join("");
  }

  function fillProdutoOptions(selected = "") {
    const opts = ['<option value="">Produto (opcional)</option>'];
    for (const p of state().produtos || []) {
      if (p.ativo === false) continue;
      const sel = String(p.id) === String(selected) ? " selected" : "";
      opts.push(
        `<option value="${escapeHtml(p.id)}"${sel}>${escapeHtml(p.nome)} — custo ${moeda.format(p.custo || 0)}</option>`
      );
    }
    return opts.join("");
  }

  function renderNotaItensGrid() {
    const e = els();
    const draft = state().notaEntradaModal;
    if (!e.notaEntradaItensGrid) return;
    const readonly = draft.status === "lancada" || draft.status === "cancelada";

    e.notaEntradaItensGrid.innerHTML = (draft.itens || [])
      .map((item, index) => {
        const total = getNotaItemTotal(item);
        return `
        <div class="nota-item-row" data-nota-row="${escapeHtml(item.rowId)}">
          <label>
            Produto
            <select data-nota-field="produtoId" data-row="${escapeHtml(item.rowId)}" ${readonly ? "disabled" : ""}>
              ${fillProdutoOptions(item.produtoId)}
            </select>
          </label>
          <label>
            Descrição
            <input data-nota-field="descricao" data-row="${escapeHtml(item.rowId)}" value="${escapeHtml(item.descricao || "")}" ${readonly ? "readonly" : ""} />
          </label>
          <label>
            Qtd
            <input type="number" min="0" step="0.001" data-nota-field="quantidade" data-row="${escapeHtml(item.rowId)}" value="${escapeHtml(item.quantidade)}" ${readonly ? "readonly" : ""} />
          </label>
          <label>
            Custo unit.
            <input type="number" min="0" step="0.01" data-nota-field="valorUnitario" data-row="${escapeHtml(item.rowId)}" value="${escapeHtml(item.valorUnitario)}" ${readonly ? "readonly" : ""} />
          </label>
          <label>
            Total
            <input type="text" readonly value="${moeda.format(total)}" />
          </label>
          <label class="checkbox-inline">
            <input type="checkbox" data-nota-field="atualizaEstoque" data-row="${escapeHtml(item.rowId)}" ${item.atualizaEstoque ? "checked" : ""} ${readonly ? "disabled" : ""} />
            Estoque
          </label>
          <label class="checkbox-inline">
            <input type="checkbox" data-nota-field="atualizaCusto" data-row="${escapeHtml(item.rowId)}" ${item.atualizaCusto ? "checked" : ""} ${readonly ? "disabled" : ""} />
            Custo
          </label>
          ${!readonly
            ? `<button type="button" class="btn btn-ghost" data-remove-nota-item="${escapeHtml(item.rowId)}" ${draft.itens.length <= 1 && index === 0 ? "disabled" : ""}>Remover</button>`
            : ""}
        </div>`;
      })
      .join("");

    updateNotaResumo();
  }

  function updateNotaResumo() {
    const e = els();
    const draft = state().notaEntradaModal;
    const sub = getNotaSubtotal(draft);
    const total = getNotaTotal(draft);
    if (e.notaEntradaSubtotal) e.notaEntradaSubtotal.textContent = moeda.format(sub);
    if (e.notaEntradaTotal) e.notaEntradaTotal.textContent = moeda.format(total);
    renderNotaParcelasTotals();
  }

  function openNotaModal(options = {}) {
    ensureStateDefaults();
    const e = els();
    if (!options.keepDraft) {
      state().notaEntradaModal = createNotaDraft();
    }
    const draft = state().notaEntradaModal;
    fillFornecedorSelect(e.notaEntradaFornecedor, draft.fornecedorId);
    fillFormaPagamentoSelect(e.notaEntradaFormaPagamento, draft.formaPagamentoId);
    if (e.notaEntradaNumero) e.notaEntradaNumero.value = draft.numeroNf || "";
    if (e.notaEntradaSerie) e.notaEntradaSerie.value = draft.serie || "";
    if (e.notaEntradaChave) e.notaEntradaChave.value = draft.chaveAcesso || "";
    if (e.notaEntradaEmissao) e.notaEntradaEmissao.value = draft.dataEmissao || "";
    if (e.notaEntradaData) e.notaEntradaData.value = draft.dataEntrada || "";
    if (e.notaEntradaDesconto) e.notaEntradaDesconto.value = String(draft.valorDesconto || 0);
    if (e.notaEntradaFrete) e.notaEntradaFrete.value = String(draft.valorFrete || 0);
    if (e.notaEntradaOutras) e.notaEntradaOutras.value = String(draft.valorOutras || 0);
    if (e.notaEntradaObs) e.notaEntradaObs.value = draft.observacoes || "";
    if (e.notaEntradaParcelas) e.notaEntradaParcelas.value = String(draft.parcelas || 1);
    if (e.notaEntradaVenc) e.notaEntradaVenc.value = draft.vencimentoPrimeira || formatDateInput(new Date());
    if (e.notaEntradaIntervalo) e.notaEntradaIntervalo.value = String(draft.intervaloDias || 30);
    if (e.notaEntradaModalTitle) {
      e.notaEntradaModalTitle.textContent = draft.notaId
        ? draft.status === "rascunho"
          ? `Editar nota #${draft.notaId}`
          : `Nota #${draft.notaId}`
        : "Nova nota de entrada";
    }
    const readonly = draft.status === "lancada" || draft.status === "cancelada";
    if (e.notaEntradaSaveBtn) e.notaEntradaSaveBtn.classList.toggle("hidden", readonly);
    if (e.notaEntradaLancarBtn) e.notaEntradaLancarBtn.classList.toggle("hidden", readonly);
    if (e.notaEntradaAddItemBtn) e.notaEntradaAddItemBtn.classList.toggle("hidden", readonly);
    if (!Array.isArray(draft.parcelasEditadas) || !draft.parcelasEditadas.length) {
      ensureNotaParcelasEditadas(true);
    }
    renderNotaItensGrid();
    renderNotaParcelasEditor();
    if (e.notaEntradaModal) e.notaEntradaModal.classList.remove("hidden");
  }

  function closeNotaModal() {
    const e = els();
    if (e.notaEntradaModal) e.notaEntradaModal.classList.add("hidden");
  }

  function syncNotaDraftFromForm() {
    const e = els();
    const draft = state().notaEntradaModal;
    draft.fornecedorId = e.notaEntradaFornecedor?.value || "";
    draft.numeroNf = e.notaEntradaNumero?.value || "";
    draft.serie = e.notaEntradaSerie?.value || "";
    draft.chaveAcesso = e.notaEntradaChave?.value || "";
    draft.dataEmissao = e.notaEntradaEmissao?.value || "";
    draft.dataEntrada = e.notaEntradaData?.value || "";
    draft.valorDesconto = Number(e.notaEntradaDesconto?.value || 0);
    draft.valorFrete = Number(e.notaEntradaFrete?.value || 0);
    draft.valorOutras = Number(e.notaEntradaOutras?.value || 0);
    draft.observacoes = e.notaEntradaObs?.value || "";
    draft.parcelas = Math.max(1, Math.trunc(Number(e.notaEntradaParcelas?.value || 1)));
    draft.vencimentoPrimeira = e.notaEntradaVenc?.value || "";
    draft.intervaloDias = Math.max(1, Math.trunc(Number(e.notaEntradaIntervalo?.value || 30)));
    draft.formaPagamentoId = e.notaEntradaFormaPagamento?.value || "";
    ensureNotaParcelasEditadas();
  }

  function getFilledNotaItens(draft = state().notaEntradaModal) {
    return (draft.itens || []).filter(
      (item) => String(item.descricao || "").trim() || item.produtoId
    );
  }

  async function saveNotaRascunho({ lancar = false } = {}) {
    syncNotaDraftFromForm();
    const draft = state().notaEntradaModal;
    const itens = getFilledNotaItens(draft);
    if (!itens.length) throw new Error("Adicione ao menos um item na nota.");
    if (!draft.fornecedorId) throw new Error("Selecione o fornecedor.");

    const valorProdutos = getNotaSubtotal(draft);
    const valorTotal = getNotaTotal(draft);

    const parcelasEditadas = ensureNotaParcelasEditadas();
    if (lancar) {
      const somaParc = parcelasEditadas.reduce((s, p) => s + Number(p.valor || 0), 0);
      if (Math.abs(somaParc - valorTotal) > 0.05) {
        throw new Error(
          `Total das parcelas (${moeda.format(somaParc)}) difere do total da nota (${moeda.format(valorTotal)}). Ajuste ou use "Ratear total".`
        );
      }
    }

    const payload = {
      empresa_id: state().empresaId,
      fornecedor_id: Number(draft.fornecedorId),
      numero_nf: draft.numeroNf || null,
      serie: draft.serie || null,
      chave_acesso: draft.chaveAcesso || null,
      data_emissao: draft.dataEmissao || null,
      data_entrada: draft.dataEntrada || formatDateInput(new Date()),
      status: "rascunho",
      valor_produtos: Number(valorProdutos.toFixed(2)),
      valor_desconto: Number(Number(draft.valorDesconto || 0).toFixed(2)),
      valor_frete: Number(Number(draft.valorFrete || 0).toFixed(2)),
      valor_outras: Number(Number(draft.valorOutras || 0).toFixed(2)),
      valor_total: Number(valorTotal.toFixed(2)),
      observacoes: draft.observacoes || null,
      parcelas: Math.max(1, parcelasEditadas.length || draft.parcelas || 1),
      vencimento_primeira: parcelasEditadas[0]?.vencimento || draft.vencimentoPrimeira || null,
      intervalo_dias: draft.intervaloDias || 30,
      forma_pagamento_id: draft.formaPagamentoId ? Number(draft.formaPagamentoId) : null,
      raw_payload: {
        parcelas_editadas: parcelasEditadas
      },
      updated_at: new Date().toISOString()
    };

    let notaId = draft.notaId;
    if (notaId) {
      const { error } = await sb()
        .from("notas_entrada")
        .update(payload)
        .eq("id", notaId)
        .eq("empresa_id", state().empresaId)
        .eq("status", "rascunho");
      if (error) throw error;
      await sb()
        .from("notas_entrada_itens")
        .delete()
        .eq("nota_id", notaId)
        .eq("empresa_id", state().empresaId);
    } else {
      const { data, error } = await sb()
        .from("notas_entrada")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      notaId = data.id;
      draft.notaId = notaId;
    }

    const itensPayload = itens.map((item) => ({
      empresa_id: state().empresaId,
      nota_id: notaId,
      produto_id: item.produtoId ? Number(item.produtoId) : null,
      descricao: item.descricao || null,
      quantidade: Number(item.quantidade || 0),
      valor_unitario: Number(item.valorUnitario || 0),
      valor_total: Number(getNotaItemTotal(item).toFixed(2)),
      atualiza_custo: Boolean(item.atualizaCusto),
      atualiza_estoque: Boolean(item.atualizaEstoque)
    }));

    const { error: itensErr } = await sb().from("notas_entrada_itens").insert(itensPayload);
    if (itensErr) throw itensErr;

    if (lancar) {
      await lancarNota(notaId);
      showToast(`Nota #${notaId} lançada: estoque e contas a pagar atualizados`);
    } else {
      showToast(`Nota #${notaId} salva como rascunho`);
    }

    closeNotaModal();
    state().compras.loaded = false;
    await ensureComprasLoaded({ force: true });
  }

  async function loadNotaIntoDraft(notaId, { readonly = false } = {}) {
    const { data: nota, error } = await sb()
      .from("notas_entrada")
      .select("*")
      .eq("empresa_id", state().empresaId)
      .eq("id", notaId)
      .maybeSingle();
    if (error) throw error;
    if (!nota) throw new Error("Nota não encontrada");

    const { data: itens, error: itensErr } = await sb()
      .from("notas_entrada_itens")
      .select("*")
      .eq("empresa_id", state().empresaId)
      .eq("nota_id", notaId)
      .order("id");
    if (itensErr) throw itensErr;

    const raw = nota.raw_payload && typeof nota.raw_payload === "object" ? nota.raw_payload : {};
    const parcelasFromRaw = Array.isArray(raw.parcelas_editadas)
      ? raw.parcelas_editadas.map((p, idx) => ({
          numero: p.numero || idx + 1,
          vencimento: p.vencimento || "",
          valor: Number(p.valor || 0),
          formaPagamentoId: p.formaPagamentoId ? String(p.formaPagamentoId) : "",
          status: p.status === "pago" ? "pago" : "pendente"
        }))
      : null;

    state().notaEntradaModal = {
      notaId: nota.id,
      fornecedorId: nota.fornecedor_id ? String(nota.fornecedor_id) : "",
      numeroNf: nota.numero_nf || "",
      serie: nota.serie || "",
      chaveAcesso: nota.chave_acesso || "",
      dataEmissao: nota.data_emissao || "",
      dataEntrada: nota.data_entrada || "",
      status: nota.status,
      valorDesconto: Number(nota.valor_desconto || 0),
      valorFrete: Number(nota.valor_frete || 0),
      valorOutras: Number(nota.valor_outras || 0),
      observacoes: nota.observacoes || "",
      parcelas: Number(nota.parcelas || 1),
      vencimentoPrimeira: nota.vencimento_primeira || "",
      intervaloDias: Number(nota.intervalo_dias || 30),
      formaPagamentoId: nota.forma_pagamento_id ? String(nota.forma_pagamento_id) : "",
      itens: (itens || []).length
        ? itens.map((item) => ({
            rowId: `${item.id}`,
            produtoId: item.produto_id ? String(item.produto_id) : "",
            descricao: item.descricao || "",
            quantidade: Number(item.quantidade || 0),
            valorUnitario: Number(item.valor_unitario || 0),
            atualizaCusto: item.atualiza_custo !== false,
            atualizaEstoque: item.atualiza_estoque !== false
          }))
        : [createNotaItem()],
      parcelasEditadas: parcelasFromRaw
    };

    if (!parcelasFromRaw?.length) {
      ensureNotaParcelasEditadas(true);
    }
  }

  async function aplicarEstoqueNota(nota, itens) {
    if (nota.estoque_aplicado) return;
    for (const item of itens) {
      if (!item.produto_id || !item.atualiza_estoque) continue;
      const qtd = Number(item.quantidade || 0);
      if (qtd <= 0) continue;
      const prod = (state().produtos || []).find((p) => Number(p.id) === Number(item.produto_id));
      if (prod && prod.controla_estoque === false) continue;

      await registrarEstoqueMovimento({
        produtoId: item.produto_id,
        tipo: "entrada",
        quantidade: qtd,
        motivo: `NF entrada #${nota.id}${nota.numero_nf ? ` (${nota.numero_nf})` : ""}`,
        custoUnitario: Number(item.valor_unitario || 0),
        metadata: { origem: "nota_entrada", nota_id: nota.id, item_id: item.id }
      });

      if (item.atualiza_custo) {
        await sb()
          .from("produto_catalogo")
          .update({
            custo: Number(item.valor_unitario || 0),
            updated_at: new Date().toISOString()
          })
          .eq("id", item.produto_id)
          .eq("empresa_id", state().empresaId);
      }
    }
  }

  async function aplicarFinanceiroNota(nota) {
    if (nota.financeiro_aplicado) return;
    const total = Number(nota.valor_total || 0);
    if (total <= 0) return;

    const raw = nota.raw_payload && typeof nota.raw_payload === "object" ? nota.raw_payload : {};
    let parcelasEditadas = Array.isArray(raw.parcelas_editadas) ? raw.parcelas_editadas : null;

    // Prefer parcelas do draft em memória (mesmo lançamento).
    const draftParc = state().notaEntradaModal?.notaId === nota.id
      ? state().notaEntradaModal.parcelasEditadas
      : null;
    if (Array.isArray(draftParc) && draftParc.length) {
      parcelasEditadas = draftParc;
    }

    if (!parcelasEditadas?.length) {
      // Fallback: gera pelo template antigo da nota
      const nParcelas = Math.max(1, Number(nota.parcelas || 1));
      const intervalo = Math.max(1, Number(nota.intervalo_dias || 30));
      const first = nota.vencimento_primeira || nota.data_entrada || formatDateInput(new Date());
      const parts = splitAmountParts(total, nParcelas);
      parcelasEditadas = parts.map((valor, i) => ({
        numero: i + 1,
        vencimento: addDaysYmd(first, intervalo * i),
        valor,
        formaPagamentoId: nota.forma_pagamento_id ? String(nota.forma_pagamento_id) : "",
        status: "pendente"
      }));
    }

    const totalParcelas = parcelasEditadas.reduce((s, p) => s + Number(p.valor || 0), 0);
    const totalPago = parcelasEditadas
      .filter((p) => p.status === "pago")
      .reduce((s, p) => s + Number(p.valor || 0), 0);
    const valorAberto = Math.max(0, totalParcelas - totalPago);
    let statusConta = "aberto";
    if (valorAberto <= 0.009) statusConta = "pago";
    else if (totalPago > 0) statusConta = "parcial";

    const { data: conta, error: contaErr } = await sb()
      .from("contas_pagar")
      .insert({
        empresa_id: state().empresaId,
        nota_entrada_id: nota.id,
        fornecedor_id: nota.fornecedor_id,
        origem: "nota_entrada",
        numero_titulo: `NF-${nota.id}${nota.numero_nf ? `-${nota.numero_nf}` : ""}`,
        emissao: new Date().toISOString(),
        valor_original: Number(totalParcelas.toFixed(2)),
        valor_aberto: Number(valorAberto.toFixed(2)),
        status: statusConta,
        observacoes: nota.observacoes || null
      })
      .select("id")
      .single();
    if (contaErr) throw contaErr;

    const parcelasPayload = parcelasEditadas.map((parcela, index) => {
      const valor = Number(parcela.valor || 0);
      const pago = parcela.status === "pago";
      return {
        empresa_id: state().empresaId,
        conta_pagar_id: conta.id,
        numero_parcela: parcela.numero || index + 1,
        vencimento: parcela.vencimento || null,
        valor_parcela: Number(valor.toFixed(2)),
        valor_pago: pago ? Number(valor.toFixed(2)) : 0,
        status: pago ? "pago" : "pendente",
        forma_pagamento_id: parcela.formaPagamentoId
          ? Number(parcela.formaPagamentoId)
          : nota.forma_pagamento_id || null
      };
    });

    const { data: parcelasCriadas, error: pErr } = await sb()
      .from("contas_pagar_parcelas")
      .insert(parcelasPayload)
      .select("id, numero_parcela, valor_parcela, status");
    if (pErr) throw pErr;

    const pags = (parcelasCriadas || [])
      .filter((p) => p.status === "pago")
      .map((p) => ({
        empresa_id: state().empresaId,
        parcela_id: p.id,
        data_pagamento: formatDateInput(new Date()),
        valor: Number(p.valor_parcela || 0),
        forma_pagamento_id: nota.forma_pagamento_id || null,
        observacoes: "Marcado como pago na NF de entrada"
      }));
    if (pags.length) {
      const { error: payErr } = await sb().from("pagamentos").insert(pags);
      if (payErr) throw payErr;
    }
  }

  async function lancarNota(notaId) {
    const { data: nota, error } = await sb()
      .from("notas_entrada")
      .select("*")
      .eq("empresa_id", state().empresaId)
      .eq("id", notaId)
      .maybeSingle();
    if (error) throw error;
    if (!nota) throw new Error("Nota não encontrada");
    if (nota.status === "lancada") throw new Error("Nota já lançada");
    if (nota.status === "cancelada") throw new Error("Nota cancelada");

    const { data: itens, error: itensErr } = await sb()
      .from("notas_entrada_itens")
      .select("*")
      .eq("empresa_id", state().empresaId)
      .eq("nota_id", notaId);
    if (itensErr) throw itensErr;
    if (!itens?.length) throw new Error("Nota sem itens");

    await ensureProdutosLoaded({ force: true });
    await aplicarEstoqueNota(nota, itens);
    await aplicarFinanceiroNota(nota);

    const { error: updErr } = await sb()
      .from("notas_entrada")
      .update({
        status: "lancada",
        estoque_aplicado: true,
        financeiro_aplicado: true,
        updated_at: new Date().toISOString()
      })
      .eq("id", notaId)
      .eq("empresa_id", state().empresaId);
    if (updErr) throw updErr;

    state().produtosLoaded = false;
    state().estoqueMovimentosLoaded = false;
    state().estoqueReservasLoaded = false;
  }

  async function cancelarNota(notaId) {
    if (!window.confirm("Cancelar esta nota? O estoque de entrada será estornado (saída) e os títulos em aberto serão cancelados.")) {
      return;
    }

    const { data: nota, error } = await sb()
      .from("notas_entrada")
      .select("*")
      .eq("empresa_id", state().empresaId)
      .eq("id", notaId)
      .maybeSingle();
    if (error) throw error;
    if (!nota || nota.status !== "lancada") throw new Error("Só é possível cancelar nota lançada.");

    const { data: itens, error: itensErr } = await sb()
      .from("notas_entrada_itens")
      .select("*")
      .eq("empresa_id", state().empresaId)
      .eq("nota_id", notaId);
    if (itensErr) throw itensErr;

    if (nota.estoque_aplicado) {
      for (const item of itens || []) {
        if (!item.produto_id || !item.atualiza_estoque) continue;
        const qtd = Number(item.quantidade || 0);
        if (qtd <= 0) continue;
        try {
          await registrarEstoqueMovimento({
            produtoId: item.produto_id,
            tipo: "saida",
            quantidade: qtd,
            motivo: `Cancelamento NF entrada #${nota.id}`,
            permitirNegativo: true,
            metadata: { origem: "cancelamento_nota_entrada", nota_id: nota.id }
          });
        } catch (err) {
          console.warn("Estorno estoque parcial", err);
        }
      }
    }

    if (nota.financeiro_aplicado) {
      const { data: contas } = await sb()
        .from("contas_pagar")
        .select("id")
        .eq("empresa_id", state().empresaId)
        .eq("nota_entrada_id", notaId);
      for (const c of contas || []) {
        await sb()
          .from("contas_pagar_parcelas")
          .update({ status: "cancelado" })
          .eq("empresa_id", state().empresaId)
          .eq("conta_pagar_id", c.id)
          .in("status", ["pendente", "parcial"]);
        await sb()
          .from("contas_pagar")
          .update({ status: "cancelado", valor_aberto: 0, updated_at: new Date().toISOString() })
          .eq("id", c.id)
          .eq("empresa_id", state().empresaId);
      }
    }

    await sb()
      .from("notas_entrada")
      .update({
        status: "cancelada",
        updated_at: new Date().toISOString(),
        raw_payload: { ...(nota.raw_payload || {}), cancelada_em: new Date().toISOString() }
      })
      .eq("id", notaId)
      .eq("empresa_id", state().empresaId);

    state().produtosLoaded = false;
    state().compras.loaded = false;
    await ensureComprasLoaded({ force: true });
    showToast(`Nota #${notaId} cancelada`);
  }

  async function deleteNota(notaId) {
    if (!window.confirm("Excluir este rascunho de nota?")) return;
    const { error } = await sb()
      .from("notas_entrada")
      .delete()
      .eq("id", notaId)
      .eq("empresa_id", state().empresaId)
      .eq("status", "rascunho");
    if (error) throw error;
    state().compras.loaded = false;
    await ensureComprasLoaded({ force: true });
    showToast("Nota excluída");
  }

  async function pagarParcela(parcelaId) {
    const parcela = (state().compras.parcelas || []).find((p) => Number(p.id) === Number(parcelaId));
    if (!parcela) throw new Error("Parcela não encontrada");
    const saldo = Math.max(0, Number(parcela.valor_parcela || 0) - Number(parcela.valor_pago || 0));
    if (saldo <= 0) throw new Error("Parcela já está paga");

    const valorStr = window.prompt(`Valor a pagar (saldo ${moeda.format(saldo)}):`, String(saldo.toFixed(2)));
    if (valorStr == null) return;
    const valor = Number(String(valorStr).replace(",", "."));
    if (!Number.isFinite(valor) || valor <= 0) throw new Error("Valor inválido");
    if (valor > saldo + 0.009) throw new Error("Valor maior que o saldo da parcela");

    const { error: payErr } = await sb().from("pagamentos").insert({
      empresa_id: state().empresaId,
      parcela_id: parcelaId,
      data_pagamento: formatDateInput(new Date()),
      valor: Number(valor.toFixed(2)),
      forma_pagamento_id: parcela.forma_pagamento_id || null,
      observacoes: "Baixa manual"
    });
    if (payErr) throw payErr;

    const novoPago = Number(parcela.valor_pago || 0) + valor;
    const quitada = novoPago + 0.009 >= Number(parcela.valor_parcela || 0);
    await sb()
      .from("contas_pagar_parcelas")
      .update({
        valor_pago: Number(novoPago.toFixed(2)),
        status: quitada ? "pago" : "parcial"
      })
      .eq("id", parcelaId)
      .eq("empresa_id", state().empresaId);

    // Recalcula conta
    const { data: parcelasConta } = await sb()
      .from("contas_pagar_parcelas")
      .select("valor_parcela, valor_pago, status")
      .eq("empresa_id", state().empresaId)
      .eq("conta_pagar_id", parcela.conta_pagar_id);

    const original = (parcelasConta || []).reduce((s, p) => s + Number(p.valor_parcela || 0), 0);
    const pago = (parcelasConta || []).reduce((s, p) => s + Number(p.valor_pago || 0), 0);
    const aberto = Math.max(0, original - pago);
    let statusConta = "aberto";
    if (aberto <= 0.009) statusConta = "pago";
    else if (pago > 0) statusConta = "parcial";

    await sb()
      .from("contas_pagar")
      .update({
        valor_aberto: Number(aberto.toFixed(2)),
        status: statusConta,
        updated_at: new Date().toISOString()
      })
      .eq("id", parcela.conta_pagar_id)
      .eq("empresa_id", state().empresaId);

    await loadContasPagar();
    renderComprasSection();
    showToast("Pagamento registrado");
  }

  function attachComprasEvents() {
    ensureStateDefaults();
    const e = els();
    attachFornecedorCombos();

    for (const btn of e.comprasViewButtons || []) {
      btn.addEventListener("click", () => {
        setComprasView(btn.getAttribute("data-compras-view") || "notas");
        renderComprasSection();
      });
    }

    if (e.openNotaEntradaBtn) {
      e.openNotaEntradaBtn.addEventListener("click", async () => {
        try {
          await ensureComprasLoaded();
          openNotaModal();
        } catch (err) {
          showToast(`Erro: ${err.message}`, "error");
        }
      });
    }
    if (e.openFornecedorBtn) {
      e.openFornecedorBtn.addEventListener("click", async () => {
        try {
          await ensureComprasLoaded();
          openFornecedorModal();
        } catch (err) {
          showToast(`Erro: ${err.message}`, "error");
        }
      });
    }

    if (e.closeFornecedorModalBtn) {
      e.closeFornecedorModalBtn.addEventListener("click", closeFornecedorModal);
    }
    if (e.fornecedorModal) {
      e.fornecedorModal.addEventListener("click", (ev) => {
        if (ev.target === e.fornecedorModal) closeFornecedorModal();
      });
    }
    if (e.fornecedorForm) {
      e.fornecedorForm.addEventListener("submit", async (ev) => {
        try {
          await saveFornecedor(ev);
        } catch (err) {
          showToast(`Erro ao salvar fornecedor: ${err.message}`, "error");
        }
      });
    }

    if (e.closeNotaEntradaModalBtn) {
      e.closeNotaEntradaModalBtn.addEventListener("click", closeNotaModal);
    }
    if (e.notaEntradaModal) {
      e.notaEntradaModal.addEventListener("click", (ev) => {
        if (ev.target === e.notaEntradaModal) closeNotaModal();
      });
    }
    if (e.notaEntradaAddItemBtn) {
      e.notaEntradaAddItemBtn.addEventListener("click", () => {
        state().notaEntradaModal.itens.push(createNotaItem());
        renderNotaItensGrid();
      });
    }
    if (e.notaEntradaSaveBtn) {
      e.notaEntradaSaveBtn.addEventListener("click", async () => {
        try {
          await saveNotaRascunho({ lancar: false });
        } catch (err) {
          showToast(`Erro ao salvar nota: ${err.message}`, "error");
        }
      });
    }
    if (e.notaEntradaLancarBtn) {
      e.notaEntradaLancarBtn.addEventListener("click", async () => {
        try {
          if (!window.confirm("Lançar nota? Isso dará entrada no estoque e gerará contas a pagar.")) return;
          await saveNotaRascunho({ lancar: true });
        } catch (err) {
          showToast(`Erro ao lançar nota: ${err.message}`, "error");
        }
      });
    }

    if (e.notaEntradaGerarParcelasBtn) {
      e.notaEntradaGerarParcelasBtn.addEventListener("click", () => {
        syncNotaDraftFromForm();
        ensureNotaParcelasEditadas(true);
        renderNotaParcelasEditor();
        showToast("Parcelas geradas — ajuste vencimentos e valores se precisar");
      });
    }
    if (e.notaEntradaAddParcelaBtn) {
      e.notaEntradaAddParcelaBtn.addEventListener("click", () => {
        syncNotaDraftFromForm();
        addNotaParcelaEditavel();
      });
    }
    if (e.notaEntradaRatearBtn) {
      e.notaEntradaRatearBtn.addEventListener("click", () => {
        syncNotaDraftFromForm();
        ratearTotalNasParcelasNota();
        showToast("Total rateado nas parcelas");
      });
    }
    if (e.notaEntradaParcelasList) {
      e.notaEntradaParcelasList.addEventListener("input", (ev) => {
        const t = ev.target;
        if (!(t instanceof HTMLElement)) return;
        const row = t.closest("[data-nota-parcela-index]");
        const field = t.getAttribute("data-nota-parcela-field");
        if (!row || !field) return;
        const idx = Number(row.getAttribute("data-nota-parcela-index"));
        const parcela = state().notaEntradaModal.parcelasEditadas?.[idx];
        if (!parcela) return;
        if (field === "valor") parcela.valor = Math.max(0, Number(t.value || 0));
        else if (field === "status") parcela.status = t.value === "pago" ? "pago" : "pendente";
        else parcela[field] = t.value;
        renderNotaParcelasTotals();
      });
      e.notaEntradaParcelasList.addEventListener("change", (ev) => {
        const t = ev.target;
        if (!(t instanceof HTMLElement)) return;
        const row = t.closest("[data-nota-parcela-index]");
        const field = t.getAttribute("data-nota-parcela-field");
        if (!row || !field) return;
        const idx = Number(row.getAttribute("data-nota-parcela-index"));
        const parcela = state().notaEntradaModal.parcelasEditadas?.[idx];
        if (!parcela) return;
        if (field === "status") parcela.status = t.value === "pago" ? "pago" : "pendente";
        else if (field === "formaPagamentoId") parcela.formaPagamentoId = t.value || "";
        else if (field === "vencimento") parcela.vencimento = t.value || "";
        renderNotaParcelasTotals();
      });
      e.notaEntradaParcelasList.addEventListener("click", (ev) => {
        const btn = ev.target?.closest?.("[data-remove-nota-parcela]");
        if (!btn) return;
        const idx = Number(btn.getAttribute("data-remove-nota-parcela"));
        if (!Number.isFinite(idx)) return;
        removeNotaParcelaEditavel(idx);
      });
    }

    // Campos de totais da nota
    for (const id of ["notaEntradaDesconto", "notaEntradaFrete", "notaEntradaOutras"]) {
      const el = e[id];
      if (!el) continue;
      el.addEventListener("input", () => {
        syncNotaDraftFromForm();
        updateNotaResumo();
      });
    }

    if (e.notaEntradaItensGrid) {
      e.notaEntradaItensGrid.addEventListener("input", (ev) => {
        const t = ev.target;
        if (!(t instanceof HTMLElement)) return;
        const rowId = t.getAttribute("data-row");
        const field = t.getAttribute("data-nota-field");
        if (!rowId || !field) return;
        const item = state().notaEntradaModal.itens.find((i) => i.rowId === rowId);
        if (!item) return;
        if (field === "atualizaCusto" || field === "atualizaEstoque") {
          item[field] = t.checked;
        } else if (field === "quantidade" || field === "valorUnitario") {
          item[field] = Number(t.value || 0);
        } else {
          item[field] = t.value;
        }
        if (field === "produtoId" && t.value) {
          const prod = (state().produtos || []).find((p) => String(p.id) === String(t.value));
          if (prod) {
            item.descricao = prod.nome;
            item.valorUnitario = Number(prod.custo || prod.preco || 0);
            renderNotaItensGrid();
            return;
          }
        }
        if (field === "quantidade" || field === "valorUnitario") {
          updateNotaResumo();
          // atualiza só total da linha sem full re-render
          const row = t.closest(".nota-item-row");
          const totalInput = row?.querySelectorAll("input")?.[4];
          if (totalInput) totalInput.value = moeda.format(getNotaItemTotal(item));
        }
      });
      e.notaEntradaItensGrid.addEventListener("change", (ev) => {
        const t = ev.target;
        if (!(t instanceof HTMLElement)) return;
        if (t.getAttribute("data-nota-field") === "produtoId") {
          t.dispatchEvent(new Event("input", { bubbles: true }));
        }
      });
      e.notaEntradaItensGrid.addEventListener("click", (ev) => {
        const btn = ev.target?.closest?.("[data-remove-nota-item]");
        if (!btn) return;
        const rowId = btn.getAttribute("data-remove-nota-item");
        const draft = state().notaEntradaModal;
        draft.itens = draft.itens.filter((i) => i.rowId !== rowId);
        if (!draft.itens.length) draft.itens.push(createNotaItem());
        renderNotaItensGrid();
      });
    }

    // Filtros
    if (e.comprasNotaBusca) {
      e.comprasNotaBusca.addEventListener("input", () => {
        state().compras.filters.notaBusca = e.comprasNotaBusca.value || "";
        renderNotasTable();
      });
    }
    if (e.comprasNotaStatus) {
      e.comprasNotaStatus.addEventListener("change", () => {
        state().compras.filters.notaStatus = e.comprasNotaStatus.value || "";
        renderNotasTable();
      });
    }
    if (e.comprasFornBusca) {
      e.comprasFornBusca.addEventListener("input", () => {
        state().compras.filters.fornBusca = e.comprasFornBusca.value || "";
        renderFornecedoresTable();
      });
    }
    if (e.comprasPagarBusca) {
      e.comprasPagarBusca.addEventListener("input", () => {
        state().compras.filters.pagarBusca = e.comprasPagarBusca.value || "";
        renderContasPagarTable();
      });
    }
    if (e.comprasPagarStatus) {
      e.comprasPagarStatus.addEventListener("change", () => {
        state().compras.filters.pagarStatus = e.comprasPagarStatus.value || "";
        renderContasPagarTable();
      });
    }

    // Contas a Pagar (aba principal)
    if (e.openDespesaModalBtn) {
      e.openDespesaModalBtn.addEventListener("click", async () => {
        try {
          await ensureComprasLoaded();
          openDespesaModal();
        } catch (err) {
          showToast(`Erro: ${err.message}`, "error");
        }
      });
    }
    if (e.closeDespesaModalBtn) {
      e.closeDespesaModalBtn.addEventListener("click", closeDespesaModal);
    }
    if (e.despesaModal) {
      e.despesaModal.addEventListener("click", (ev) => {
        if (ev.target === e.despesaModal) closeDespesaModal();
      });
    }
    if (e.despesaForm) {
      e.despesaForm.addEventListener("submit", async (ev) => {
        try {
          await saveDespesaManual(ev);
        } catch (err) {
          showToast(`Erro ao salvar despesa: ${err.message}`, "error");
        }
      });
    }
    if (e.despesasPagarBusca) {
      e.despesasPagarBusca.addEventListener("input", () => {
        state().compras.filters.despesasBusca = e.despesasPagarBusca.value || "";
        renderContasPagarTable();
      });
    }
    if (e.despesasPagarStatus) {
      e.despesasPagarStatus.addEventListener("change", () => {
        state().compras.filters.despesasStatus = e.despesasPagarStatus.value || "";
        renderContasPagarTable();
      });
    }
    if (e.despesasPagarOrigem) {
      e.despesasPagarOrigem.addEventListener("change", () => {
        state().compras.filters.despesasOrigem = e.despesasPagarOrigem.value || "";
        renderContasPagarTable();
      });
    }

    // Filtros por coluna no cabeçalho da tabela Contas a Pagar
    const applyDespesasColFilterFromEl = (t) => {
      if (!(t instanceof HTMLElement)) return;
      const field = t.getAttribute("data-despesas-col-filter");
      if (!field) return;
      ensureStateDefaults();
      state().compras.filters.despesasCols[field] = "value" in t ? String(t.value || "") : "";
      if (field === "status") state().compras.filters.despesasStatus = state().compras.filters.despesasCols.status || "";
      if (field === "origem") state().compras.filters.despesasOrigem = state().compras.filters.despesasCols.origem || "";
      renderContasPagarTable();
    };
    document.addEventListener("input", (ev) => applyDespesasColFilterFromEl(ev.target));
    document.addEventListener("change", (ev) => applyDespesasColFilterFromEl(ev.target));

    if (e.closeContaPagarEditModalBtn) {
      e.closeContaPagarEditModalBtn.addEventListener("click", closeContaPagarEditModal);
    }
    if (e.contaPagarEditModal) {
      e.contaPagarEditModal.addEventListener("click", (ev) => {
        if (ev.target === e.contaPagarEditModal) closeContaPagarEditModal();
      });
    }
    if (e.contaPagarEditForm) {
      e.contaPagarEditForm.addEventListener("submit", async (ev) => {
        try {
          await saveContaPagarEdit(ev);
        } catch (err) {
          showToast(`Erro ao salvar título: ${err.message}`, "error");
        }
      });
    }
    if (e.contaPagarEditDeleteBtn) {
      e.contaPagarEditDeleteBtn.addEventListener("click", async () => {
        try {
          await deleteContaPagarEdit();
        } catch (err) {
          showToast(`Erro ao excluir: ${err.message}`, "error");
        }
      });
    }
    if (e.contaPagarEditAddParcelaBtn) {
      e.contaPagarEditAddParcelaBtn.addEventListener("click", () => addContaPagarEditParcela());
    }
    if (e.contaPagarEditParcelasList) {
      e.contaPagarEditParcelasList.addEventListener("input", (ev) => {
        const t = ev.target;
        if (!(t instanceof HTMLElement)) return;
        const row = t.closest("[data-cp-parcela-index]");
        const field = t.getAttribute("data-cp-parcela-field");
        if (!row || !field) return;
        const idx = Number(row.getAttribute("data-cp-parcela-index"));
        const edit = ensureContaPagarEditState();
        const p = edit.parcelas[idx];
        if (!p) return;
        if (field === "valor" || field === "valorPago") p[field] = Math.max(0, Number(t.value || 0));
        else p[field] = t.value;
        // Se digitou valor pago e não tem data, assume hoje
        if (field === "valorPago" && Number(p.valorPago || 0) > 0 && !p.dataPagamento) {
          p.dataPagamento = formatDateInput(new Date());
          const dateInput = row.querySelector('[data-cp-parcela-field="dataPagamento"]');
          if (dateInput) dateInput.value = p.dataPagamento;
        }
        renderContaPagarEditTotals();
      });
      e.contaPagarEditParcelasList.addEventListener("change", (ev) => {
        const t = ev.target;
        if (!(t instanceof HTMLElement)) return;
        const row = t.closest("[data-cp-parcela-index]");
        const field = t.getAttribute("data-cp-parcela-field");
        if (!row || !field) return;
        const idx = Number(row.getAttribute("data-cp-parcela-index"));
        const edit = ensureContaPagarEditState();
        const p = edit.parcelas[idx];
        if (!p) return;
        p[field] = t.value;

        // Ao marcar como pago: preenche valor pago e data de pagamento
        if (field === "status" && t.value === "pago") {
          applyPagoDefaultsToParcela(p);
          const valorInput = row.querySelector('[data-cp-parcela-field="valorPago"]');
          const dateInput = row.querySelector('[data-cp-parcela-field="dataPagamento"]');
          if (valorInput) valorInput.value = Number(p.valorPago || 0).toFixed(2);
          if (dateInput) dateInput.value = p.dataPagamento || "";
        }
        if (field === "status" && (t.value === "pendente" || t.value === "cancelado")) {
          if (t.value === "pendente") {
            p.valorPago = 0;
            p.dataPagamento = "";
            const valorInput = row.querySelector('[data-cp-parcela-field="valorPago"]');
            const dateInput = row.querySelector('[data-cp-parcela-field="dataPagamento"]');
            if (valorInput) valorInput.value = "0.00";
            if (dateInput) dateInput.value = "";
          }
        }
        renderContaPagarEditTotals();
      });
      e.contaPagarEditParcelasList.addEventListener("click", (ev) => {
        const btn = ev.target?.closest?.("[data-remove-cp-parcela]");
        if (!btn) return;
        removeContaPagarEditParcela(Number(btn.getAttribute("data-remove-cp-parcela")));
      });
    }

    // Clicks nas tabelas
    document.addEventListener("click", async (ev) => {
      const t = ev.target;
      if (!(t instanceof HTMLElement)) return;

      // Clique na linha de conta a pagar (exceto menu/botoes de acao)
      if (
        !t.closest("[data-stop-row-edit]") &&
        !t.closest("[data-row-actions]") &&
        !t.closest("button") &&
        !t.closest("a") &&
        !t.closest("input") &&
        !t.closest("select")
      ) {
        const row = t.closest("tr[data-edit-conta-pagar]");
        if (row && (e.despesasPagarTable?.contains(row) || e.comprasPagarTable?.contains(row))) {
          const id = row.getAttribute("data-edit-conta-pagar");
          if (id) {
            try {
              await openContaPagarEditModal(Number(id));
            } catch (err) {
              showToast(err.message || String(err), "error");
            }
            return;
          }
        }
      }

      const handlers = [
        ["data-edit-fornecedor", async (id) => openFornecedorModal(Number(id))],
        ["data-del-fornecedor", async (id) => deleteFornecedor(Number(id))],
        [
          "data-edit-nota",
          async (id) => {
            await loadNotaIntoDraft(Number(id));
            openNotaModal({ keepDraft: true });
          }
        ],
        [
          "data-view-nota",
          async (id) => {
            await loadNotaIntoDraft(Number(id), { readonly: true });
            openNotaModal({ keepDraft: true });
          }
        ],
        [
          "data-lancar-nota",
          async (id) => {
            if (!window.confirm("Lançar esta nota? Entrada no estoque + contas a pagar.")) return;
            await lancarNota(Number(id));
            state().compras.loaded = false;
            await ensureComprasLoaded({ force: true });
            showToast(`Nota #${id} lançada`);
          }
        ],
        ["data-cancelar-nota", async (id) => cancelarNota(Number(id))],
        ["data-del-nota", async (id) => deleteNota(Number(id))],
        ["data-pagar-parcela", async (id) => pagarParcela(Number(id))],
        ["data-edit-conta-pagar", async (id) => openContaPagarEditModal(Number(id))]
      ];

      for (const [attr, fn] of handlers) {
        const el = t.closest(`[${attr}]`);
        if (!el) continue;
        // data-edit-conta-pagar no TR já tratado acima; no botão Editar passa aqui
        if (attr === "data-edit-conta-pagar" && el.tagName === "TR") continue;
        const id = el.getAttribute(attr);
        if (!id) continue;
        try {
          await fn(id);
        } catch (err) {
          showToast(err.message || String(err), "error");
        }
        return;
      }
    });
  }

  return {
    ensureComprasLoaded,
    ensureDespesasPagarLoaded,
    renderComprasSection,
    renderContasPagarTable,
    setComprasView,
    attachComprasEvents,
    ensureStateDefaults,
    openDespesaModal
  };
}
