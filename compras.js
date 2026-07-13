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
    loadFormasPagamento
  } = helpers;

  function state() {
    return getState();
  }

  function els() {
    return getEls();
  }

  function sb() {
    return getSupabase();
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
        filters: {
          notaBusca: "",
          notaStatus: "",
          fornBusca: "",
          pagarStatus: "",
          pagarBusca: ""
        }
      };
    }
    if (!s.notaEntradaModal) {
      s.notaEntradaModal = createNotaDraft();
    }
    if (!s.fornecedorModal) {
      s.fornecedorModal = { editId: null };
    }
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
      itens: [createNotaItem()]
    };
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
        "id, nota_entrada_id, fornecedor_id, numero_titulo, emissao, valor_original, valor_aberto, status, observacoes, fornecedor:fornecedores(id, nome)"
      )
      .eq("empresa_id", state().empresaId)
      .order("emissao", { ascending: false })
      .limit(300);
    if (error) throw error;
    state().compras.contas = contas || [];

    const contaIds = (contas || []).map((c) => c.id);
    if (!contaIds.length) {
      state().compras.parcelas = [];
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
        return `
        <tr>
          <td>#${escapeHtml(n.id)}</td>
          <td>${escapeHtml(n.numero_nf || "–")}${n.serie ? ` / ${escapeHtml(n.serie)}` : ""}</td>
          <td>${escapeHtml(n.fornecedor?.nome || "–")}</td>
          <td>${escapeHtml(n.data_entrada || "–")}</td>
          <td><span class="estoque-status ${statusClass}">${escapeHtml(n.status)}</span></td>
          <td>${moeda.format(n.valor_total || 0)}</td>
          <td>${n.estoque_aplicado ? "Sim" : "Não"}</td>
          <td>${n.financeiro_aplicado ? "Sim" : "Não"}</td>
          <td class="estoque-actions">
            ${n.status === "rascunho"
              ? `<button type="button" class="btn btn-ghost" data-edit-nota="${n.id}">Editar</button>
                 <button type="button" class="btn" data-lancar-nota="${n.id}">Lançar</button>
                 <button type="button" class="action-delete" data-del-nota="${n.id}">Excluir</button>`
              : n.status === "lancada"
                ? `<button type="button" class="btn btn-ghost" data-view-nota="${n.id}">Ver</button>
                   <button type="button" class="btn btn-ghost" data-cancelar-nota="${n.id}">Cancelar</button>`
                : `<button type="button" class="btn btn-ghost" data-view-nota="${n.id}">Ver</button>`
            }
          </td>
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
      .map(
        (f) => `
      <tr>
        <td>${escapeHtml(f.nome)}</td>
        <td>${escapeHtml(f.documento || "–")}</td>
        <td>${escapeHtml(f.telefone || "–")}</td>
        <td>${escapeHtml(f.email || "–")}</td>
        <td>${escapeHtml([f.cidade, f.uf].filter(Boolean).join("/") || "–")}</td>
        <td>${f.ativo === false ? "Não" : "Sim"}</td>
        <td class="estoque-actions">
          <button type="button" class="action-edit" data-edit-fornecedor="${f.id}">Editar</button>
          <button type="button" class="action-delete" data-del-fornecedor="${f.id}">Excluir</button>
        </td>
      </tr>`
      )
      .join("");
  }

  function renderContasPagarTable() {
    const e = els();
    if (!e.comprasPagarTable) return;
    const busca = String(state().compras.filters.pagarBusca || "").toLowerCase();
    const statusF = state().compras.filters.pagarStatus || "";
    const contasById = Object.fromEntries((state().compras.contas || []).map((c) => [String(c.id), c]));
    let rows = (state().compras.parcelas || []).map((p) => ({
      ...p,
      conta: contasById[String(p.conta_pagar_id)]
    }));
    if (statusF) rows = rows.filter((r) => r.status === statusF);
    if (busca) {
      rows = rows.filter((r) => {
        const hay = `${r.conta?.numero_titulo || ""} ${r.conta?.fornecedor?.nome || ""}`.toLowerCase();
        return hay.includes(busca);
      });
    }
    rows.sort((a, b) => String(a.vencimento || "").localeCompare(String(b.vencimento || "")));

    if (!rows.length) {
      e.comprasPagarTable.innerHTML = `<tr><td colspan="8">Nenhuma parcela a pagar.</td></tr>`;
      return;
    }

    e.comprasPagarTable.innerHTML = rows
      .map((r) => {
        const saldo = Math.max(0, Number(r.valor_parcela || 0) - Number(r.valor_pago || 0));
        const vencida =
          r.status !== "pago" &&
          r.vencimento &&
          new Date(r.vencimento) < new Date(new Date().toDateString());
        return `
        <tr>
          <td>${escapeHtml(r.conta?.numero_titulo || `CP-${r.conta_pagar_id}`)}</td>
          <td>${escapeHtml(r.conta?.fornecedor?.nome || "–")}</td>
          <td>${escapeHtml(r.numero_parcela)}</td>
          <td>${escapeHtml(r.vencimento || "–")}${vencida ? ' <span class="estoque-status estoque-status--zerado">vencida</span>' : ""}</td>
          <td>${moeda.format(r.valor_parcela || 0)}</td>
          <td>${moeda.format(saldo)}</td>
          <td><span class="estoque-status ${r.status === "pago" ? "estoque-status--ok" : "estoque-status--reposicao"}">${escapeHtml(r.status)}</span></td>
          <td class="estoque-actions">
            ${r.status !== "pago" && r.status !== "cancelado"
              ? `<button type="button" class="btn" data-pagar-parcela="${r.id}">Pagar</button>`
              : "–"}
          </td>
        </tr>`;
      })
      .join("");
  }

  function renderComprasSection() {
    ensureStateDefaults();
    setComprasView(state().compras.view);
    renderComprasKpis();
    renderNotasTable();
    renderFornecedoresTable();
    renderContasPagarTable();
  }

  /* ---------- Fornecedor modal ---------- */

  function openFornecedorModal(editId = null) {
    ensureStateDefaults();
    const e = els();
    state().fornecedorModal.editId = editId;
    if (!e.fornecedorModal || !e.fornecedorForm) return;
    e.fornecedorForm.reset();
    if (e.fornecedorModalTitle) {
      e.fornecedorModalTitle.textContent = editId ? "Editar fornecedor" : "Novo fornecedor";
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
  }

  function closeFornecedorModal() {
    const e = els();
    if (e.fornecedorModal) e.fornecedorModal.classList.add("hidden");
    state().fornecedorModal.editId = null;
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
    if (editId) {
      const { error } = await sb()
        .from("fornecedores")
        .update(payload)
        .eq("id", editId)
        .eq("empresa_id", state().empresaId);
      if (error) throw error;
    } else {
      const { error } = await sb().from("fornecedores").insert(payload);
      if (error) throw error;
    }
    closeFornecedorModal();
    await loadFornecedores();
    renderComprasSection();
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
    renderComprasSection();
    showToast("Fornecedor excluído");
  }

  /* ---------- Nota modal ---------- */

  function fillFornecedorSelect(selectEl, selected = "") {
    if (!selectEl) return;
    const opts = ['<option value="">Selecione o fornecedor</option>'];
    for (const f of state().compras.fornecedores || []) {
      if (f.ativo === false) continue;
      const sel = String(f.id) === String(selected) ? " selected" : "";
      opts.push(`<option value="${escapeHtml(f.id)}"${sel}>${escapeHtml(f.nome)}</option>`);
    }
    selectEl.innerHTML = opts.join("");
  }

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
    if (e.notaEntradaVenc) e.notaEntradaVenc.value = draft.vencimentoPrimeira || "";
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
    renderNotaItensGrid();
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
      parcelas: draft.parcelas || 1,
      vencimento_primeira: draft.vencimentoPrimeira || null,
      intervalo_dias: draft.intervaloDias || 30,
      forma_pagamento_id: draft.formaPagamentoId ? Number(draft.formaPagamentoId) : null,
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

    state().notaEntradaModal = {
      notaId: nota.id,
      fornecedorId: nota.fornecedor_id ? String(nota.fornecedor_id) : "",
      numeroNf: nota.numero_nf || "",
      serie: nota.serie || "",
      chaveAcesso: nota.chave_acesso || "",
      dataEmissao: nota.data_emissao || "",
      dataEntrada: nota.data_entrada || "",
      status: readonly ? nota.status : nota.status,
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
        : [createNotaItem()]
    };
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

    const nParcelas = Math.max(1, Number(nota.parcelas || 1));
    const intervalo = Math.max(1, Number(nota.intervalo_dias || 30));
    const baseVenc = nota.vencimento_primeira
      ? new Date(`${nota.vencimento_primeira}T12:00:00`)
      : new Date(`${nota.data_entrada || formatDateInput(new Date())}T12:00:00`);

    const cents = Math.round(total * 100);
    const base = Math.floor(cents / nParcelas);
    const resto = cents - base * nParcelas;

    const { data: conta, error: contaErr } = await sb()
      .from("contas_pagar")
      .insert({
        empresa_id: state().empresaId,
        nota_entrada_id: nota.id,
        fornecedor_id: nota.fornecedor_id,
        origem: "nota_entrada",
        numero_titulo: `NF-${nota.id}${nota.numero_nf ? `-${nota.numero_nf}` : ""}`,
        emissao: new Date().toISOString(),
        valor_original: Number(total.toFixed(2)),
        valor_aberto: Number(total.toFixed(2)),
        status: "aberto",
        observacoes: nota.observacoes || null
      })
      .select("id")
      .single();
    if (contaErr) throw contaErr;

    const parcelasPayload = [];
    for (let i = 0; i < nParcelas; i += 1) {
      const valorCents = base + (i < resto ? 1 : 0);
      const venc = new Date(baseVenc);
      venc.setDate(venc.getDate() + i * intervalo);
      parcelasPayload.push({
        empresa_id: state().empresaId,
        conta_pagar_id: conta.id,
        numero_parcela: i + 1,
        vencimento: formatDateInput(venc),
        valor_parcela: Number((valorCents / 100).toFixed(2)),
        valor_pago: 0,
        status: "pendente",
        forma_pagamento_id: nota.forma_pagamento_id || null
      });
    }

    const { error: pErr } = await sb().from("contas_pagar_parcelas").insert(parcelasPayload);
    if (pErr) throw pErr;
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

    // Clicks nas tabelas
    document.addEventListener("click", async (ev) => {
      const t = ev.target;
      if (!(t instanceof HTMLElement)) return;

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
        ["data-pagar-parcela", async (id) => pagarParcela(Number(id))]
      ];

      for (const [attr, fn] of handlers) {
        const el = t.closest(`[${attr}]`);
        if (!el) continue;
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
    renderComprasSection,
    setComprasView,
    attachComprasEvents,
    ensureStateDefaults
  };
}
