let supabaseClient;
let saasName = "LB ERP SaaS";

function isConfigUsable(config) {
  if (!config || !config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    return false;
  }

  const url = String(config.SUPABASE_URL).trim();
  const key = String(config.SUPABASE_ANON_KEY).trim();

  if (!url.startsWith("https://")) {
    return false;
  }

  if (url.includes("SEU-PROJETO") || key.includes("SUA_ANON_KEY")) {
    return false;
  }

  return true;
}

async function loadRuntimeConfig() {
  const localConfig = window.SUPABASE_CONFIG || {};

  try {
    const response = await fetch("/api/public-config");
    if (response.ok) {
      const remoteConfig = await response.json();
      if (isConfigUsable(remoteConfig)) {
        return remoteConfig;
      }
    }
  } catch (_error) {
    // Em ambiente local sem API da Vercel, seguimos para fallback local.
  }

  if (isConfigUsable(localConfig)) {
    return localConfig;
  }

  throw new Error("Configure config.js localmente ou as variaveis SUPABASE_URL e SUPABASE_ANON_KEY na Vercel");
}

const state = {
  session: null,
  empresaId: null,
  empresaNome: "",
  currentRole: "user",
  isPlatformAdmin: false,
  clientes: [],
  produtos: [],
  produtosSource: "produtos",
  pedidosSource: "pedidos",
  orcamentosSource: "orcamentos",
  itensDocumento: [],
  produtoSort: {
    field: "nome",
    direction: "asc"
  },
  produtoFilters: {
    nome: "",
    categoria: "",
    preco: "",
    custo: "",
    margem: "",
    estoque: "",
    ponto_pedido: "",
    ativo: ""
  },
  pedidos: [],
  orcamentos: [],
  despesas: [],
  novoDocumentoModal: {
    tipo: "pedido",
    documentoId: null,
    clienteId: "",
    status: "aberto",
    observacoes: "",
    itens: []
  },
  ownerUsers: [],
  adminEmpresas: [],
  adminVinculos: []
};

const els = {
  authScreen: document.getElementById("authScreen"),
  appShell: document.getElementById("appShell"),
  loginForm: document.getElementById("loginForm"),
  logoutBtn: document.getElementById("logoutBtn"),
  ownerUsersTab: document.getElementById("ownerUsersTab"),
  adminTab: document.getElementById("adminTab"),
  saasTitleLogin: document.getElementById("saasTitleLogin"),
  saasTitleApp: document.getElementById("saasTitleApp"),
  empresaInfo: document.getElementById("empresaInfo"),
  tabs: Array.from(document.querySelectorAll(".tab")),
  sections: Array.from(document.querySelectorAll(".app-section")),
  clienteForm: document.getElementById("clienteForm"),
  produtoForm: document.getElementById("produtoForm"),
  openProdutoModalBtn: document.getElementById("openProdutoModalBtn"),
  closeProdutoModalBtn: document.getElementById("closeProdutoModalBtn"),
  produtoModal: document.getElementById("produtoModal"),
  produtoModalTitle: document.getElementById("produtoModalTitle"),
  produtoSubmitBtn: document.getElementById("produtoSubmitBtn"),
  openPedidoModalBtn: document.getElementById("openPedidoModalBtn"),
  novoDocumentoModal: document.getElementById("novoDocumentoModal"),
  closeNovoDocumentoModalBtn: document.getElementById("closeNovoDocumentoModalBtn"),
  novoDocumentoForm: document.getElementById("novoDocumentoForm"),
  novoDocumentoModalTitle: document.getElementById("novoDocumentoModalTitle"),
  novoDocumentoModalSubtitle: document.getElementById("novoDocumentoModalSubtitle"),
  novoDocumentoClienteSearch: document.getElementById("novoDocumentoClienteSearch"),
  novoDocumentoClienteId: document.getElementById("novoDocumentoClienteId"),
  novoDocumentoClienteTrigger: document.getElementById("novoDocumentoClienteTrigger"),
  novoDocumentoClienteLabel: document.getElementById("novoDocumentoClienteLabel"),
  novoDocumentoClientePanel: document.getElementById("novoDocumentoClientePanel"),
  novoDocumentoClienteOptions: document.getElementById("novoDocumentoClienteOptions"),
  novoDocumentoStatusSelect: document.getElementById("novoDocumentoStatusSelect"),
  novoDocumentoObservacoes: document.getElementById("novoDocumentoObservacoes"),
  novoDocumentoItemsGrid: document.getElementById("novoDocumentoItemsGrid"),
  addDocumentoItemBtn: document.getElementById("addDocumentoItemBtn"),
  novoDocumentoSubtotal: document.getElementById("novoDocumentoSubtotal"),
  novoDocumentoResumoTexto: document.getElementById("novoDocumentoResumoTexto"),
  novoDocumentoTotal: document.getElementById("novoDocumentoTotal"),
  novoDocumentoSubmitBtn: document.getElementById("novoDocumentoSubmitBtn"),
  novoClienteRapidoModal: document.getElementById("novoClienteRapidoModal"),
  closeNovoClienteRapidoModalBtn: document.getElementById("closeNovoClienteRapidoModalBtn"),
  novoClienteRapidoForm: document.getElementById("novoClienteRapidoForm"),
  itensDocumentoModal: document.getElementById("itensDocumentoModal"),
  closeItensDocumentoModalBtn: document.getElementById("closeItensDocumentoModalBtn"),
  itensDocumentoModalTitle: document.getElementById("itensDocumentoModalTitle"),
  itensDocumentoTable: document.getElementById("itensDocumentoTable"),
  pedidoForm: document.getElementById("pedidoForm"),
  orcamentoForm: document.getElementById("orcamentoForm"),
  despesaForm: document.getElementById("despesaForm"),
  ownerUserForm: document.getElementById("ownerUserForm"),
  adminEmpresaForm: document.getElementById("adminEmpresaForm"),
  adminInviteForm: document.getElementById("adminInviteForm"),
  adminVinculoForm: document.getElementById("adminVinculoForm"),
  pedidoClienteSelect: document.getElementById("pedidoClienteSelect"),
  orcamentoClienteSelect: document.getElementById("orcamentoClienteSelect"),
  adminEmpresaSelect: document.getElementById("adminEmpresaSelect"),
  adminInviteEmpresaSelect: document.getElementById("adminInviteEmpresaSelect"),
  clientesTable: document.getElementById("clientesTable"),
  produtosTable: document.getElementById("produtosTable"),
  filtroProdutoNome: document.getElementById("filtroProdutoNome"),
  filtroProdutoCategoria: document.getElementById("filtroProdutoCategoria"),
  filtroProdutoPreco: document.getElementById("filtroProdutoPreco"),
  filtroProdutoCusto: document.getElementById("filtroProdutoCusto"),
  filtroProdutoMargem: document.getElementById("filtroProdutoMargem"),
  filtroProdutoEstoque: document.getElementById("filtroProdutoEstoque"),
  filtroProdutoPonto: document.getElementById("filtroProdutoPonto"),
  filtroProdutoAtivo: document.getElementById("filtroProdutoAtivo"),
  pedidosTable: document.getElementById("pedidosTable"),
  orcamentosTable: document.getElementById("orcamentosTable"),
  despesasTable: document.getElementById("despesasTable"),
  ownerUsersTable: document.getElementById("ownerUsersTable"),
  adminVinculosTable: document.getElementById("adminVinculosTable"),
  clientesCount: document.getElementById("clientesCount"),
  pedidosCount: document.getElementById("pedidosCount"),
  despesasCount: document.getElementById("despesasCount"),
  faturamentoValue: document.getElementById("faturamentoValue"),
  estoqueTotalCount: document.getElementById("estoqueTotalCount"),
  estoqueComSaldoCount: document.getElementById("estoqueComSaldoCount"),
  estoquePontoPedidoCount: document.getElementById("estoquePontoPedidoCount"),
  orcamentoAbertoValue: document.getElementById("orcamentoAbertoValue"),
  refreshBtn: document.getElementById("refreshBtn"),
  toast: document.getElementById("toast")
};

function applySaasBranding() {
  document.title = saasName;
  if (els.saasTitleLogin) {
    els.saasTitleLogin.textContent = saasName;
  }
  if (els.saasTitleApp) {
    els.saasTitleApp.textContent = saasName;
  }
}

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

function showToast(message, type = "ok") {
  els.toast.textContent = message;
  els.toast.classList.remove("hidden");
  els.toast.style.background = type === "error" ? "#8a2f2f" : "#1f4a47";
  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => {
    els.toast.classList.add("hidden");
  }, 2500);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isMissingRelationError(error) {
  if (!error) return false;
  if (error.code === "42P01") return true;
  return String(error.message || "").toLowerCase().includes("does not exist");
}

function setSection(sectionName) {
  if (sectionName === "admin" && !state.isPlatformAdmin) {
    sectionName = "dashboard";
  }

  for (const tab of els.tabs) {
    tab.classList.toggle("active", tab.dataset.section === sectionName);
  }
  for (const section of els.sections) {
    const isTarget = section.id === `section-${sectionName}`;
    section.classList.toggle("hidden", !isTarget);
    section.classList.toggle("active-section", isTarget);
  }
}

function openProdutoModal() {
  if (!els.produtoModal) return;
  els.produtoModal.classList.remove("hidden");
}

function closeProdutoModal() {
  if (!els.produtoModal) return;
  els.produtoModal.classList.add("hidden");
}

function openItensDocumentoModal() {
  if (!els.itensDocumentoModal) return;
  els.itensDocumentoModal.classList.remove("hidden");
}

function closeItensDocumentoModal() {
  if (!els.itensDocumentoModal) return;
  els.itensDocumentoModal.classList.add("hidden");
}

function openNovoDocumentoClientePanel() {
  if (!els.novoDocumentoClientePanel) return;
  els.novoDocumentoClientePanel.classList.remove("hidden");
  if (els.novoDocumentoClienteTrigger) {
    els.novoDocumentoClienteTrigger.setAttribute("aria-expanded", "true");
  }
  if (els.novoDocumentoClienteSearch) {
    window.requestAnimationFrame(() => els.novoDocumentoClienteSearch.focus());
  }
}

function closeNovoDocumentoClientePanel() {
  if (!els.novoDocumentoClientePanel) return;
  els.novoDocumentoClientePanel.classList.add("hidden");
  if (els.novoDocumentoClienteTrigger) {
    els.novoDocumentoClienteTrigger.setAttribute("aria-expanded", "false");
  }
}

function setNovoDocumentoCliente(clienteId) {
  state.novoDocumentoModal.clienteId = clienteId ? String(clienteId) : "";
  if (els.novoDocumentoClienteId) {
    els.novoDocumentoClienteId.value = state.novoDocumentoModal.clienteId;
  }
  renderNovoDocumentoClienteSelect();
}

function getNovoDocumentoProdutoComboState(item) {
  const produto = state.produtos.find((produtoItem) => String(produtoItem.id) === String(item.produtoId));
  return {
    produto,
    label: produto?.nome || "Selecionar produto",
    search: String(item.produtoSearch || ""),
    query: String(item.produtoSearch || "").trim().toLowerCase()
  };
}

function openNovoDocumentoProdutoPanel(rowId) {
  const panel = document.querySelector(`[data-produto-combo-panel="${rowId}"]`);
  const trigger = document.querySelector(`[data-produto-combo-trigger="${rowId}"]`);
  const search = document.querySelector(`[data-produto-combo-search="${rowId}"]`);
  if (!(panel instanceof HTMLElement)) return;
  panel.classList.remove("hidden");
  if (trigger instanceof HTMLElement) {
    trigger.setAttribute("aria-expanded", "true");
  }
  if (search instanceof HTMLInputElement) {
    window.requestAnimationFrame(() => search.focus());
  }
}

function closeNovoDocumentoProdutoPanel(rowId) {
  const panel = document.querySelector(`[data-produto-combo-panel="${rowId}"]`);
  const trigger = document.querySelector(`[data-produto-combo-trigger="${rowId}"]`);
  if (panel instanceof HTMLElement) {
    panel.classList.add("hidden");
  }
  if (trigger instanceof HTMLElement) {
    trigger.setAttribute("aria-expanded", "false");
  }
}

function setNovoDocumentoProduto(rowId, produtoId) {
  const item = state.novoDocumentoModal.itens.find((draftItem) => draftItem.rowId === rowId);
  if (!item) return;
  const produto = state.produtos.find((produtoItem) => String(produtoItem.id) === String(produtoId));
  item.produtoId = produtoId ? String(produtoId) : "";
  item.produtoSearch = produto?.nome || "";
  if (produto) {
    item.descricao = produto.nome || item.descricao;
    item.valorUnitario = Number(produto.preco || 0);
  }
  renderNovoDocumentoItensGrid();
}

function renderNovoDocumentoProdutoCombo(item) {
  const comboState = getNovoDocumentoProdutoComboState(item);
  const produtosFiltrados = comboState.query
    ? state.produtos.filter((produto) => {
        const nome = String(produto.nome || "").toLowerCase();
        const categoria = String(produto.categoria || "").toLowerCase();
        return nome.includes(comboState.query) || categoria.includes(comboState.query);
      })
    : state.produtos;

  const optionsHtml = [];
  if (!produtosFiltrados.length) {
    optionsHtml.push('<div class="produto-combo-empty">Nenhum produto encontrado</div>');
  } else {
    for (const produto of produtosFiltrados) {
      const isSelected = String(produto.id) === String(item.produtoId);
      optionsHtml.push(`
        <button
          type="button"
          class="produto-combo-option${isSelected ? " active" : ""}"
          data-produto-id="${produto.id}"
          data-produto-row="${item.rowId}"
        >
          <span>${escapeHtml(produto.nome)}</span>
          <small>${moeda.format(produto.preco || 0)}</small>
        </button>
      `);
    }
  }

  return `
    <div class="produto-combo" data-produto-combo="${item.rowId}">
      <button type="button" class="produto-combo-trigger" data-produto-combo-trigger="${item.rowId}" aria-haspopup="listbox" aria-expanded="false">
        <span data-produto-combo-label="${item.rowId}">${escapeHtml(comboState.label)}</span>
        <span class="produto-combo-caret">▾</span>
      </button>
      <div class="produto-combo-panel hidden" data-produto-combo-panel="${item.rowId}" role="listbox" aria-label="Produtos">
        <input
          class="produto-combo-search"
          data-produto-combo-search="${item.rowId}"
          type="search"
          placeholder="Buscar produto..."
          autocomplete="off"
          value="${escapeHtml(comboState.search)}"
        />
        <div class="produto-combo-options" data-produto-combo-options="${item.rowId}">${optionsHtml.join("")}</div>
      </div>
    </div>
  `;
}

function getDocumentoModalConfig(tipo = "pedido") {
  const isOrcamento = tipo === "orcamento";
  return {
    tipo: isOrcamento ? "orcamento" : "pedido",
    titulo: isOrcamento ? "Novo Orçamento" : "Novo Pedido",
    subtitulo: isOrcamento
      ? "Monte um orçamento com itens em grade e total calculado automaticamente."
      : "Monte um pedido com itens em grade e total calculado automaticamente.",
    submitLabel: isOrcamento ? "Salvar Orçamento" : "Salvar Pedido",
    defaultStatus: "aberto",
    statuses: isOrcamento
      ? [
          { value: "aberto", label: "Aberto" },
          { value: "aprovado", label: "Aprovado" },
          { value: "reprovado", label: "Reprovado" }
        ]
      : [
          { value: "aberto", label: "Aberto" },
          { value: "fechado", label: "Fechado" },
          { value: "cancelado", label: "Cancelado" }
        ]
  };
}

function createDocumentoDraftItem(produto = null) {
  return {
    rowId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    produtoId: produto?.id ? String(produto.id) : "",
    descricao: produto?.nome || "",
    produtoSearch: "",
    quantidade: 1,
    valorUnitario: Number(produto?.preco || 0)
  };
}

function createDocumentoDraft(tipo = "pedido") {
  const config = getDocumentoModalConfig(tipo);
  return {
    tipo: config.tipo,
    documentoId: null,
    clienteId: "",
    status: config.defaultStatus,
    observacoes: "",
    itens: [createDocumentoDraftItem()]
  };
}

function getDocumentoProdutoOptions(selectedValue = "") {
  const options = ['<option value="">Selecione um produto</option>'];
  for (const produto of state.produtos) {
    const label = `${produto.nome}${produto.preco ? ` - ${moeda.format(produto.preco)}` : ""}`;
    const selected = String(produto.id) === String(selectedValue) ? " selected" : "";
    options.push(`<option value="${escapeHtml(produto.id)}"${selected}>${escapeHtml(label)}</option>`);
  }
  return options.join("");
}

function getNovoDocumentoItemTotal(item) {
  const quantidade = Number(item?.quantidade || 0);
  const valorUnitario = Number(item?.valorUnitario || 0);
  return quantidade * valorUnitario;
}

function getNovoDocumentoSubtotal() {
  return state.novoDocumentoModal.itens.reduce((sum, item) => sum + getNovoDocumentoItemTotal(item), 0);
}

function renderNovoDocumentoClienteSelect() {
  if (!els.novoDocumentoClienteOptions) return;
  const search = String(els.novoDocumentoClienteSearch?.value || "").trim().toLowerCase();
  const clientesFiltrados = search
    ? state.clientes.filter((cliente) => {
        const nome = String(cliente.nome || "").toLowerCase();
        const telefone = String(cliente.telefone || "").toLowerCase();
        const email = String(cliente.email || "").toLowerCase();
        return nome.includes(search) || telefone.includes(search) || email.includes(search);
      })
    : state.clientes;

  const selectedClient = state.clientes.find((cliente) => String(cliente.id) === String(state.novoDocumentoModal.clienteId));
  if (els.novoDocumentoClienteLabel) {
    els.novoDocumentoClienteLabel.textContent = selectedClient?.nome || "Selecione um cliente";
  }

  const optionsHtml = [];
  optionsHtml.push(`
    <button type="button" class="cliente-combo-option cliente-combo-quick" data-cliente-quick-new>
      + Novo cliente rapido
    </button>
  `);

  if (!clientesFiltrados.length) {
    optionsHtml.push('<div class="cliente-combo-empty">Nenhum cliente encontrado</div>');
  } else {
    for (const cliente of clientesFiltrados) {
      const isSelected = String(cliente.id) === String(state.novoDocumentoModal.clienteId);
      optionsHtml.push(`
        <button
          type="button"
          class="cliente-combo-option${isSelected ? " active" : ""}"
          data-cliente-id="${cliente.id}"
        >
          <span>${escapeHtml(cliente.nome)}</span>
          ${cliente.telefone ? `<small>${escapeHtml(cliente.telefone)}</small>` : ""}
        </button>
      `);
    }
  }

  els.novoDocumentoClienteOptions.innerHTML = optionsHtml.join("");
  if (els.novoDocumentoClienteId) {
    els.novoDocumentoClienteId.value = state.novoDocumentoModal.clienteId || "";
  }
}

function renderNovoDocumentoStatusSelect() {
  if (!els.novoDocumentoStatusSelect) return;
  const config = getDocumentoModalConfig(state.novoDocumentoModal.tipo);
  els.novoDocumentoStatusSelect.innerHTML = config.statuses
    .map((status) => `<option value="${status.value}">${status.label}</option>`)
    .join("");
  if (!config.statuses.some((status) => status.value === state.novoDocumentoModal.status)) {
    state.novoDocumentoModal.status = config.defaultStatus;
  }
  els.novoDocumentoStatusSelect.value = state.novoDocumentoModal.status;
}

function renderNovoDocumentoItemRow(item) {
  const produto = state.produtos.find((produtoItem) => String(produtoItem.id) === String(item.produtoId));
  const rowTotal = getNovoDocumentoItemTotal(item);
  return `
    <article class="documento-item-row" data-documento-item-row="${item.rowId}">
      <label class="documento-item-field">
        <span>Produto</span>
        ${renderNovoDocumentoProdutoCombo(item)}
      </label>
      <label class="documento-item-field">
        <span>Descricao</span>
        <input data-documento-item-field="descricao" value="${escapeHtml(item.descricao || produto?.nome || "")}" placeholder="Descricao do item" />
      </label>
      <label class="documento-item-field">
        <span>Qtd</span>
        <input data-documento-item-field="quantidade" type="number" min="0.001" step="0.001" value="${escapeHtml(item.quantidade ?? 1)}" />
      </label>
      <label class="documento-item-field">
        <span>Valor unit.</span>
        <input data-documento-item-field="valorUnitario" type="number" min="0" step="0.01" value="${escapeHtml(item.valorUnitario ?? 0)}" />
      </label>
      <div class="documento-item-total">
        <span>Total</span>
        <strong data-documento-item-total>${moeda.format(rowTotal)}</strong>
      </div>
      <button type="button" class="btn btn-ghost documento-item-remove" data-documento-item-remove="${item.rowId}">Remover</button>
    </article>
  `;
}

function updateNovoDocumentoResumo() {
  const subtotal = getNovoDocumentoSubtotal();
  const itensCount = state.novoDocumentoModal.itens.filter((item) => {
    const descricao = String(item.descricao || "").trim();
    return descricao || item.produtoId;
  }).length;

  if (els.novoDocumentoSubtotal) {
    els.novoDocumentoSubtotal.textContent = moeda.format(subtotal);
  }
  if (els.novoDocumentoTotal) {
    els.novoDocumentoTotal.textContent = moeda.format(subtotal);
  }
  if (els.novoDocumentoResumoTexto) {
    els.novoDocumentoResumoTexto.textContent = `${itensCount} item${itensCount === 1 ? "" : "s"} adicionad${itensCount === 1 ? "o" : "os"}`;
  }
  if (els.novoDocumentoSubmitBtn) {
    const config = getDocumentoModalConfig(state.novoDocumentoModal.tipo);
    els.novoDocumentoSubmitBtn.textContent = config.submitLabel;
  }
}

function renderNovoDocumentoItensGrid() {
  if (!els.novoDocumentoItemsGrid) return;
  if (!state.novoDocumentoModal.itens.length) {
    state.novoDocumentoModal.itens = [createDocumentoDraftItem()];
  }

  els.novoDocumentoItemsGrid.innerHTML = state.novoDocumentoModal.itens
    .map((item) => renderNovoDocumentoItemRow(item))
    .join("");

  updateNovoDocumentoResumo();
}

function renderNovoDocumentoModal() {
  if (!els.novoDocumentoModal) return;
  const config = getDocumentoModalConfig(state.novoDocumentoModal.tipo);
  const isEdit = Boolean(state.novoDocumentoModal.documentoId);

  if (els.novoDocumentoModalTitle) {
    els.novoDocumentoModalTitle.textContent = isEdit ? config.titulo.replace("Novo", "Editar") : config.titulo;
  }
  if (els.novoDocumentoModalSubtitle) {
    els.novoDocumentoModalSubtitle.textContent = config.subtitulo;
  }
  if (els.novoDocumentoObservacoes) {
    els.novoDocumentoObservacoes.value = state.novoDocumentoModal.observacoes || "";
  }

  renderNovoDocumentoClienteSelect();
  renderNovoDocumentoStatusSelect();
  renderNovoDocumentoItensGrid();

  for (const button of Array.from(document.querySelectorAll("[data-documento-tipo]"))) {
    button.classList.toggle("active", button.getAttribute("data-documento-tipo") === state.novoDocumentoModal.tipo);
  }
}

function openNovoDocumentoModal(tipo = "pedido") {
  if (!els.novoDocumentoModal) return;
  state.novoDocumentoModal = createDocumentoDraft(tipo);
  renderNovoDocumentoModal();
  els.novoDocumentoModal.classList.remove("hidden");
}

async function openNovoDocumentoEditModal(tipo, documentoId) {
  await loadDocumentoForEdit(tipo, documentoId);
  renderNovoDocumentoModal();
  if (els.novoDocumentoModal) {
    els.novoDocumentoModal.classList.remove("hidden");
  }
}

function closeNovoDocumentoModal() {
  if (!els.novoDocumentoModal) return;
  els.novoDocumentoModal.classList.add("hidden");
}

function openNovoClienteRapidoModal() {
  if (!els.novoClienteRapidoModal) return;
  els.novoClienteRapidoModal.classList.remove("hidden");
}

function closeNovoClienteRapidoModal() {
  if (!els.novoClienteRapidoModal) return;
  els.novoClienteRapidoModal.classList.add("hidden");
}

function normalizeDocumentoItem(item) {
  return {
    rowId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    produtoId: item?.produto_id ? String(item.produto_id) : "",
    descricao: String(item?.descricao_item || item?.descricao || "").trim(),
    produtoSearch: "",
    quantidade: Number(item?.quantidade || 1),
    valorUnitario: Number(item?.valor_unitario || 0)
  };
}

async function loadDocumentoForEdit(tipo, documentoId) {
  if (state.pedidosSource !== "documentos_venda" && state.orcamentosSource !== "documentos_venda") {
    throw new Error("Edicao detalhada requer a estrutura documentos_venda no banco.");
  }

  const { data: documento, error: documentoError } = await supabaseClient
    .from("documentos_venda")
    .select("id, cliente_id, status, observacoes, total")
    .eq("empresa_id", state.empresaId)
    .eq("id", documentoId)
    .eq("tipo_documento", tipo)
    .maybeSingle();

  if (documentoError) throw documentoError;
  if (!documento) throw new Error("Documento nao encontrado");

  const { data: itensData, error: itensError } = await supabaseClient
    .from("documento_venda_itens")
    .select("id, produto_id, descricao_item, quantidade, valor_unitario")
    .eq("empresa_id", state.empresaId)
    .eq("documento_id", documentoId)
    .order("id", { ascending: true });

  if (itensError) throw itensError;

  state.novoDocumentoModal = {
    tipo,
    documentoId,
    clienteId: documento.cliente_id ? String(documento.cliente_id) : "",
    status: documento.status || "aberto",
    observacoes: documento.observacoes || "",
    itens: (itensData || []).length
      ? (itensData || []).map(normalizeDocumentoItem)
      : [createDocumentoDraftItem()]
  };
}

function setNovoDocumentoTipo(tipo) {
  state.novoDocumentoModal.tipo = tipo === "orcamento" ? "orcamento" : "pedido";
  const config = getDocumentoModalConfig(state.novoDocumentoModal.tipo);
  state.novoDocumentoModal.status = config.defaultStatus;
  renderNovoDocumentoModal();
}

function addNovoDocumentoItem(produto = null) {
  state.novoDocumentoModal.itens.push(createDocumentoDraftItem(produto));
  renderNovoDocumentoItensGrid();
}

function removeNovoDocumentoItem(rowId) {
  state.novoDocumentoModal.itens = state.novoDocumentoModal.itens.filter((item) => item.rowId !== rowId);
  if (!state.novoDocumentoModal.itens.length) {
    state.novoDocumentoModal.itens = [createDocumentoDraftItem()];
  }
  renderNovoDocumentoItensGrid();
}

function handleNovoDocumentoItemChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const row = target.closest("[data-documento-item-row]");
  if (!row) return;
  const rowId = row.getAttribute("data-documento-item-row");
  if (!rowId) return;

  const item = state.novoDocumentoModal.itens.find((draftItem) => draftItem.rowId === rowId);
  if (!item) return;

  const comboSearch = target.getAttribute("data-produto-combo-search");
  if (comboSearch) {
    item.produtoSearch = target.value || "";
    const panel = document.querySelector(`[data-produto-combo-panel="${rowId}"]`);
    if (panel instanceof HTMLElement) {
      const query = String(item.produtoSearch || "").trim().toLowerCase();
      const produtosFiltrados = query
        ? state.produtos.filter((produto) => {
            const nome = String(produto.nome || "").toLowerCase();
            const categoria = String(produto.categoria || "").toLowerCase();
            return nome.includes(query) || categoria.includes(query);
          })
        : state.produtos;

      const optionsNode = panel.querySelector(`[data-produto-combo-options="${rowId}"]`);
      if (optionsNode instanceof HTMLElement) {
        optionsNode.innerHTML = produtosFiltrados.length
          ? produtosFiltrados
              .map((produto) => {
                const isSelected = String(produto.id) === String(item.produtoId);
                return `
                  <button
                    type="button"
                    class="produto-combo-option${isSelected ? " active" : ""}"
                    data-produto-id="${produto.id}"
                    data-produto-row="${rowId}"
                  >
                    <span>${escapeHtml(produto.nome)}</span>
                    <small>${moeda.format(produto.preco || 0)}</small>
                  </button>
                `;
              })
              .join("")
          : '<div class="produto-combo-empty">Nenhum produto encontrado</div>';
      }
    }
    return;
  }

  const produtoId = target.getAttribute("data-produto-id");
  if (produtoId) {
    setNovoDocumentoProduto(rowId, produtoId);
    closeNovoDocumentoProdutoPanel(rowId);
    return;
  }

  const field = target.getAttribute("data-documento-item-field");
  if (field === "produtoId") {
    const produto = state.produtos.find((produtoItem) => String(produtoItem.id) === String(target.value));
    item.produtoId = target.value || "";
    item.produtoSearch = produto?.nome || "";
    if (produto) {
      item.descricao = produto.nome || item.descricao;
      item.valorUnitario = Number(produto.preco || 0);
      const descricaoInput = row.querySelector('[data-documento-item-field="descricao"]');
      const valorInput = row.querySelector('[data-documento-item-field="valorUnitario"]');
      if (descricaoInput instanceof HTMLInputElement) descricaoInput.value = item.descricao || "";
      if (valorInput instanceof HTMLInputElement) valorInput.value = String(item.valorUnitario || 0);
    }
  } else if (field === "descricao") {
    item.descricao = target.value || "";
  } else if (field === "quantidade") {
    item.quantidade = Math.max(Number(target.value || 0), 0);
  } else if (field === "valorUnitario") {
    item.valorUnitario = Math.max(Number(target.value || 0), 0);
  }

  const totalNode = row.querySelector("[data-documento-item-total]");
  if (totalNode) {
    totalNode.textContent = moeda.format(getNovoDocumentoItemTotal(item));
  }
  updateNovoDocumentoResumo();
}

function getDocumentoItensPayload() {
  return state.novoDocumentoModal.itens
    .map((item) => ({
      produtoId: item.produtoId ? Number(item.produtoId) : null,
      descricao: String(item.descricao || "").trim(),
      quantidade: Number(item.quantidade || 0),
      valorUnitario: Number(item.valorUnitario || 0)
    }))
    .filter((item) => item.descricao || item.produtoId);
}

function buildLegacyDocumentoDescricao(itens) {
  return itens
    .map((item) => `${item.descricao} x${item.quantidade}`)
    .filter(Boolean)
    .join(" | ");
}

async function saveNovoDocumento(event) {
  event.preventDefault();
  const draft = state.novoDocumentoModal;
  const isEdit = Boolean(draft.documentoId);
  const formData = new FormData(els.novoDocumentoForm);
  const clienteIdRaw = Number(formData.get("cliente_id"));
  const clienteId = Number.isFinite(clienteIdRaw) && clienteIdRaw > 0 ? clienteIdRaw : null;
  const status = String(formData.get("status") || draft.status || "aberto");
  const observacoes = String(formData.get("observacoes") || "").trim();
  const itens = getDocumentoItensPayload();

  if (!itens.length) {
    throw new Error("Adicione ao menos um item antes de salvar.");
  }

  const subtotal = itens.reduce((sum, item) => sum + Number(item.quantidade || 0) * Number(item.valorUnitario || 0), 0);
  const documentoPayload = {
    empresa_id: state.empresaId,
    tipo_documento: draft.tipo,
    origem: "manual",
    cliente_id: clienteId,
    status,
    subtotal,
    desconto: 0,
    total: subtotal,
    observacoes: observacoes || null,
    raw_payload: {
      source: "novo-documento-modal",
      itens: itens.length
    },
    data_emissao: new Date().toISOString()
  };

  if (state.pedidosSource === "documentos_venda" || state.orcamentosSource === "documentos_venda") {
    let documentoId = draft.documentoId;

    if (documentoId) {
      const { error: documentoUpdateError } = await supabaseClient
        .from("documentos_venda")
        .update(documentoPayload)
        .eq("empresa_id", state.empresaId)
        .eq("id", documentoId)
        .eq("tipo_documento", draft.tipo);

      if (documentoUpdateError) throw documentoUpdateError;

      const { error: deleteItensError } = await supabaseClient
        .from("documento_venda_itens")
        .delete()
        .eq("empresa_id", state.empresaId)
        .eq("documento_id", documentoId);

      if (deleteItensError) throw deleteItensError;
    } else {
      const { data: documentoCriado, error: documentoError } = await supabaseClient
        .from("documentos_venda")
        .insert(documentoPayload)
        .select("id")
        .single();

      if (documentoError) throw documentoError;
      documentoId = documentoCriado.id;
    }

    const itensPayload = itens.map((item) => ({
      empresa_id: state.empresaId,
      documento_id: documentoId,
      produto_id: item.produtoId,
      descricao_item: item.descricao,
      quantidade: item.quantidade,
      valor_unitario: item.valorUnitario,
      valor_total: item.quantidade * item.valorUnitario,
      raw_payload: {
        source: "novo-documento-modal",
        produto_id: item.produtoId,
        descricao: item.descricao
      }
    }));

    const { error: itensError } = await supabaseClient.from("documento_venda_itens").insert(itensPayload);
    if (itensError) throw itensError;
  } else if (draft.tipo === "pedido") {
    const { error } = await supabaseClient.from("pedidos").insert({
      empresa_id: state.empresaId,
      cliente_id: clienteId,
      descricao: observacoes || buildLegacyDocumentoDescricao(itens),
      status,
      valor_total: subtotal,
      data_pedido: new Date().toISOString()
    });
    if (error) throw error;
  } else {
    const { error } = await supabaseClient.from("orcamentos").insert({
      empresa_id: state.empresaId,
      cliente_id: clienteId,
      descricao: observacoes || buildLegacyDocumentoDescricao(itens),
      status,
      valor_total: subtotal,
      data_orcamento: new Date().toISOString()
    });
    if (error) throw error;
  }

  closeNovoDocumentoModal();
  state.novoDocumentoModal = createDocumentoDraft("pedido");
  if (els.novoDocumentoClienteSearch) {
    els.novoDocumentoClienteSearch.value = "";
  }
  showToast(draft.tipo === "orcamento" ? (isEdit ? "Orcamento atualizado" : "Orcamento salvo") : (isEdit ? "Pedido atualizado" : "Pedido salvo"));
  await refreshAll();
}

async function saveNovoClienteRapido(event) {
  event.preventDefault();
  if (!els.novoClienteRapidoForm) return;

  const formData = new FormData(els.novoClienteRapidoForm);
  const payload = {
    empresa_id: state.empresaId,
    nome: String(formData.get("nome") || "").trim(),
    telefone: String(formData.get("telefone") || "").trim() || null,
    email: String(formData.get("email") || "").trim() || null
  };

  const clienteCriado = await createClienteFromPayload(payload);
  if (!clienteCriado) {
    throw new Error("Informe o nome do cliente.");
  }

  els.novoClienteRapidoForm.reset();
  closeNovoClienteRapidoModal();
  setNovoDocumentoCliente(clienteCriado.id);
  if (els.novoDocumentoClienteSearch) {
    els.novoDocumentoClienteSearch.value = clienteCriado.nome || "";
  }
  await refreshAll();
  renderNovoDocumentoClienteSelect();
  if (els.novoDocumentoClienteTrigger) {
    els.novoDocumentoClienteTrigger.focus();
  }
  showToast("Cliente salvo");
}

function renderItensDocumentoTable() {
  if (!els.itensDocumentoTable) return;

  if (!state.itensDocumento.length) {
    els.itensDocumentoTable.innerHTML = '<tr><td colspan="4">Sem itens para este documento.</td></tr>';
    return;
  }

  els.itensDocumentoTable.innerHTML = state.itensDocumento
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.descricao_item || item.nome_produto || "-")}</td>
        <td>${escapeHtml(item.quantidade ?? 0)}</td>
        <td>${moeda.format(item.valor_unitario || 0)}</td>
        <td>${moeda.format(item.valor_total || 0)}</td>
      </tr>
    `
    )
    .join("");
}

function isSyntheticLegacyTotalItem(item, documentoTotal) {
  if (!item) return false;

  const descricao = String(item.descricao_item || "").trim().toLowerCase();
  if (descricao !== "item legado sem descricao") {
    return false;
  }

  const itemTotal = Number(item.valor_total || 0);
  const totalDocumento = Number(documentoTotal || 0);
  if (!Number.isFinite(itemTotal) || !Number.isFinite(totalDocumento)) {
    return false;
  }

  return Math.abs(itemTotal - totalDocumento) < 0.01;
}

function parseLegacyNumber(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  const normalized = text.replace(/\./g, "").replace(/,/g, ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildFallbackItemFromDocumento(documento) {
  if (!documento) return null;

  const payload = documento.raw_payload || {};
  const quantidade = parseLegacyNumber(payload.quantidade) || 1;
  const valorTotal = Number(documento.total || 0);
  const valorUnitario = quantidade > 0 ? valorTotal / quantidade : valorTotal;

  const descricao =
    (typeof payload.descricao === "string" && payload.descricao.trim()) ||
    (typeof documento.observacoes === "string" && documento.observacoes.trim()) ||
    "Item consolidado do cabecalho legado";

  return {
    descricao_item: descricao,
    quantidade,
    valor_unitario: valorUnitario,
    valor_total: valorTotal
  };
}

async function openDocumentoItens(tipoDocumento, documentoId) {
  let itens = [];
  let documentoTotal = null;
  let documentoData = null;
  let documentoTemItens = false;

  if (tipoDocumento === "pedido" ? state.pedidosSource === "documentos_venda" : state.orcamentosSource === "documentos_venda") {
    const { data, error } = await supabaseClient
      .from("documentos_venda")
      .select("id, total, observacoes, raw_payload")
      .eq("empresa_id", state.empresaId)
      .eq("id", documentoId)
      .maybeSingle();

    if (error) throw error;
    documentoData = data || null;
    documentoTotal = documentoData?.total ?? null;

    if (tipoDocumento === "pedido") {
      if (state.pedidosSource === "documentos_venda") {
        const { data: itensData, error: itensError } = await supabaseClient
          .from("documento_venda_itens")
          .select("id, descricao_item, quantidade, valor_unitario, valor_total")
          .eq("empresa_id", state.empresaId)
          .eq("documento_id", documentoId)
          .order("id", { ascending: true });
        if (itensError) throw itensError;
        const rawItens = itensData || [];
        documentoTemItens = rawItens.length > 0;
        itens = rawItens.filter((item) => !isSyntheticLegacyTotalItem(item, documentoTotal));
      } else {
        const { data: itensData, error: itensError } = await supabaseClient
          .from("pedido_itens")
          .select("id, quantidade, valor_unitario, total, produto:produtos(nome)")
          .eq("empresa_id", state.empresaId)
          .eq("pedido_id", documentoId)
          .order("id", { ascending: true });
        if (itensError) throw itensError;
        const rawItens = itensData || [];
        documentoTemItens = rawItens.length > 0;
        itens = rawItens.map((item) => ({
          id: item.id,
          descricao_item: item.produto?.nome || null,
          nome_produto: item.produto?.nome || null,
          quantidade: item.quantidade,
          valor_unitario: item.valor_unitario,
          valor_total: item.total
        }));
      }
    } else {
      if (state.orcamentosSource === "documentos_venda") {
        const { data: itensData, error: itensError } = await supabaseClient
          .from("documento_venda_itens")
          .select("id, descricao_item, quantidade, valor_unitario, valor_total")
          .eq("empresa_id", state.empresaId)
          .eq("documento_id", documentoId)
          .order("id", { ascending: true });
        if (itensError) throw itensError;
        const rawItens = itensData || [];
        documentoTemItens = rawItens.length > 0;
        itens = rawItens.filter((item) => !isSyntheticLegacyTotalItem(item, documentoTotal));
      } else {
        const { data: itensData, error: itensError } = await supabaseClient
          .from("orcamento_itens")
          .select("id, quantidade, valor_unitario, total, produto:produtos(nome)")
          .eq("empresa_id", state.empresaId)
          .eq("orcamento_id", documentoId)
          .order("id", { ascending: true });
        if (itensError) throw itensError;
        const rawItens = itensData || [];
        documentoTemItens = rawItens.length > 0;
        itens = rawItens.map((item) => ({
          id: item.id,
          descricao_item: item.produto?.nome || null,
          nome_produto: item.produto?.nome || null,
          quantidade: item.quantidade,
          valor_unitario: item.valor_unitario,
          valor_total: item.total
        }));
      }
    }

    if (!documentoTemItens) {
      const fallbackItem = buildFallbackItemFromDocumento(documentoData);
      if (fallbackItem) {
        itens = [fallbackItem];
      }
    }
  } else if (tipoDocumento === "pedido") {
    const { data, error } = await supabaseClient
      .from("pedido_itens")
      .select("id, quantidade, valor_unitario, total, produto:produtos(nome)")
      .eq("empresa_id", state.empresaId)
      .eq("pedido_id", documentoId)
      .order("id", { ascending: true });
    if (error) throw error;
    itens = (data || []).map((item) => ({
      id: item.id,
      descricao_item: item.produto?.nome || null,
      nome_produto: item.produto?.nome || null,
      quantidade: item.quantidade,
      valor_unitario: item.valor_unitario,
      valor_total: item.total
    }));
  } else {
    const { data, error } = await supabaseClient
      .from("orcamento_itens")
      .select("id, quantidade, valor_unitario, total, produto:produtos(nome)")
      .eq("empresa_id", state.empresaId)
      .eq("orcamento_id", documentoId)
      .order("id", { ascending: true });
    if (error) throw error;
    itens = (data || []).map((item) => ({
      id: item.id,
      descricao_item: item.produto?.nome || null,
      nome_produto: item.produto?.nome || null,
      quantidade: item.quantidade,
      valor_unitario: item.valor_unitario,
      valor_total: item.total
    }));
  }

  if (!itens.length && (state.pedidosSource === "documentos_venda" || state.orcamentosSource === "documentos_venda")) {
    // Mantido para compatibilidade quando o documento realmente nao tiver itens.
  }

  state.itensDocumento = itens;
  if (els.itensDocumentoModalTitle) {
    const titulo = tipoDocumento === "pedido" ? "Itens do Pedido" : "Itens do Orcamento";
    els.itensDocumentoModalTitle.textContent = `${titulo} #${documentoId}`;
  }
  renderItensDocumentoTable();
  openItensDocumentoModal();
}

function setProdutoFormMode({ editing = false, produto = null } = {}) {
  if (!els.produtoForm) return;

  if (!editing) {
    els.produtoForm.reset();
    delete els.produtoForm.dataset.editId;
    if (els.produtoModalTitle) {
      els.produtoModalTitle.textContent = "Novo Produto";
    }
    if (els.produtoSubmitBtn) {
      els.produtoSubmitBtn.textContent = "Salvar Produto";
    }
    return;
  }

  if (!produto) return;

  els.produtoForm.reset();
  els.produtoForm.dataset.editId = String(produto.id);
  if (els.produtoModalTitle) {
    els.produtoModalTitle.textContent = "Editar Produto";
  }
  if (els.produtoSubmitBtn) {
    els.produtoSubmitBtn.textContent = "Salvar Alteracoes";
  }

  const setValue = (name, value) => {
    const field = els.produtoForm.elements.namedItem(name);
    if (field && "value" in field) {
      field.value = value == null ? "" : String(value);
    }
  };

  setValue("nome", produto.nome || "");
  setValue("categoria", produto.categoria && produto.categoria !== "-" ? produto.categoria : "");
  setValue("preco", produto.preco ?? 0);
  setValue("custo", produto.custo ?? "");
  setValue("margem", produto.margem ?? "");
  setValue("estoque", produto.estoque ?? 0);
  setValue("ponto_pedido", produto.ponto_pedido ?? 0);
  setValue("descricao", produto.descricao || "");
  setValue("imagem_path", produto.imagem_path || "");
  setValue("ativo", produto.ativo ? "sim" : "nao");
  setValue("controla_estoque", produto.controla_estoque === false ? "nao" : "sim");
}

function openProdutoCreateModal() {
  setProdutoFormMode({ editing: false });
  openProdutoModal();
}

function openProdutoEditModal(produtoId) {
  const produto = state.produtos.find((item) => Number(item.id) === Number(produtoId));
  if (!produto) {
    showToast("Produto nao encontrado", "error");
    return;
  }

  setProdutoFormMode({ editing: true, produto });
  openProdutoModal();
}

function updateAdminVisibility() {
  if (!els.adminTab) return;
  els.adminTab.classList.toggle("hidden", !state.isPlatformAdmin);

  const adminSection = document.getElementById("section-admin");
  if (!state.isPlatformAdmin && adminSection) {
    adminSection.classList.add("hidden");
    adminSection.classList.remove("active-section");
  }
}

function updateOwnerUsersVisibility() {
  if (!els.ownerUsersTab) return;
  const isOwner = state.currentRole === "owner";
  els.ownerUsersTab.classList.toggle("hidden", !isOwner);

  const ownerSection = document.getElementById("section-usuarios");
  if (!isOwner && ownerSection) {
    ownerSection.classList.add("hidden");
    ownerSection.classList.remove("active-section");
  }
}

function updateShellVisibility() {
  const isLogged = Boolean(state.session);
  els.authScreen.classList.toggle("hidden", isLogged);
  els.appShell.classList.toggle("hidden", !isLogged);
}

async function login(event) {
  event.preventDefault();
  const formData = new FormData(els.loginForm);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "").trim();
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  els.loginForm.reset();
}

async function logout() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;
}

async function loadEmpresaContext() {
  const userId = state.session?.user?.id;
  if (!userId) {
    state.empresaId = null;
    state.empresaNome = "";
    return;
  }

  const { data, error } = await supabaseClient
    .from("usuarios_empresas")
    .select("empresa_id, role, empresas(nome)")
    .eq("user_id", userId)
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error("Usuario sem empresa vinculada em usuarios_empresas");
  }

  state.empresaId = data.empresa_id;
  state.currentRole = data.role || "user";
  state.empresaNome = data.empresas?.nome || "Empresa";
  els.empresaInfo.textContent = `${state.empresaNome} • ${state.session.user.email}`;
  updateOwnerUsersVisibility();
}

async function loadOwnerUsers() {
  const isOwner = state.currentRole === "owner";
  if (!isOwner) {
    state.ownerUsers = [];
    return;
  }

  const { data, error } = await supabaseClient
    .from("usuarios_empresas")
    .select("user_id, role, ativo")
    .eq("empresa_id", state.empresaId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  state.ownerUsers = data || [];
}

async function loadPlatformAdminStatus() {
  const userId = state.session?.user?.id;
  if (!userId) {
    state.isPlatformAdmin = false;
    updateAdminVisibility();
    return;
  }

  const { data, error } = await supabaseClient
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    state.isPlatformAdmin = false;
  } else {
    state.isPlatformAdmin = Boolean(data);
  }

  updateAdminVisibility();
}

async function loadAdminEmpresas() {
  if (!state.isPlatformAdmin) {
    state.adminEmpresas = [];
    state.adminVinculos = [];
    return;
  }

  const { data, error } = await supabaseClient
    .from("empresas")
    .select("id, nome, created_at")
    .order("nome");

  if (error) throw error;
  state.adminEmpresas = data || [];
}

async function loadAdminVinculos() {
  if (!state.isPlatformAdmin) {
    state.adminVinculos = [];
    return;
  }

  const { data, error } = await supabaseClient
    .from("usuarios_empresas")
    .select("user_id, empresa_id, role, ativo, empresas(nome)")
    .order("created_at", { ascending: false })
    .limit(150);

  if (error) throw error;
  state.adminVinculos = data || [];
}

async function loadClientes() {
  const { data, error } = await supabaseClient
    .from("clientes")
    .select("id, nome, telefone, email")
    .eq("empresa_id", state.empresaId)
    .order("nome");

  if (error) throw error;
  state.clientes = data || [];
}

async function loadProdutos() {
  const { data: catalogData, error: catalogError } = await supabaseClient
    .from("produto_catalogo")
    .select(
      "id, nome, descricao, imagem_path, preco_venda, custo, margem_percentual, estoque_atual, estoque_minimo, ativo, controla_estoque, categoria:produto_categorias(nome)"
    )
    .eq("empresa_id", state.empresaId)
    .order("nome");

  if (!catalogError) {
    state.produtosSource = "produto_catalogo";
    state.produtos = (catalogData || []).map((item) => ({
      id: item.id,
      nome: item.nome,
      descricao: item.descricao || null,
      imagem_path: item.imagem_path || null,
      categoria: item.categoria?.nome || "-",
      preco: Number(item.preco_venda || 0),
      custo: item.custo == null ? null : Number(item.custo),
      margem: item.margem_percentual == null ? null : Number(item.margem_percentual),
      estoque: Number(item.estoque_atual || 0),
      ponto_pedido: Number(item.estoque_minimo || 0),
      ativo: Boolean(item.ativo),
      controla_estoque: Boolean(item.controla_estoque)
    }));
    return;
  }

  if (!isMissingRelationError(catalogError)) {
    throw catalogError;
  }

  const { data, error } = await supabaseClient
    .from("produtos")
    .select("id, nome, preco, estoque, ponto_pedido")
    .eq("empresa_id", state.empresaId)
    .order("nome");

  if (error) throw error;
  state.produtosSource = "produtos";
  state.produtos = (data || []).map((item) => ({
    ...item,
    descricao: null,
    imagem_path: null,
    categoria: "-",
    custo: null,
    margem: null,
    ativo: true,
    controla_estoque: true
  }));
}

async function loadPedidos() {
  const { data: docsData, error: docsError } = await supabaseClient
    .from("documentos_venda")
    .select(
      "id, data_emissao, status, total, cliente_legacy_id, cliente:clientes(id,nome)"
    )
    .eq("empresa_id", state.empresaId)
    .eq("tipo_documento", "pedido")
    .order("data_emissao", { ascending: false });

  if (!docsError) {
    state.pedidosSource = "documentos_venda";
    state.pedidos = (docsData || []).map((item) => ({
      id: item.id,
      data_pedido: item.data_emissao,
      status: item.status,
      valor_total: item.total,
      cliente: item.cliente,
      cliente_legacy_id: item.cliente_legacy_id
    }));
    return;
  }

  if (!isMissingRelationError(docsError)) {
    throw docsError;
  }

  const { data, error } = await supabaseClient
    .from("pedidos")
    .select(
      "id, data_pedido, status, valor_total, cliente:clientes(id,nome)"
    )
    .eq("empresa_id", state.empresaId)
    .order("data_pedido", { ascending: false });

  if (error) throw error;
  state.pedidosSource = "pedidos";
  state.pedidos = data || [];
}

async function loadOrcamentos() {
  const { data: docsData, error: docsError } = await supabaseClient
    .from("documentos_venda")
    .select(
      "id, data_emissao, status, total, cliente_legacy_id, cliente:clientes(id,nome)"
    )
    .eq("empresa_id", state.empresaId)
    .eq("tipo_documento", "orcamento")
    .order("data_emissao", { ascending: false });

  if (!docsError) {
    state.orcamentosSource = "documentos_venda";
    state.orcamentos = (docsData || []).map((item) => ({
      id: item.id,
      data_orcamento: item.data_emissao,
      status: item.status,
      valor_total: item.total,
      cliente: item.cliente,
      cliente_legacy_id: item.cliente_legacy_id
    }));
    return;
  }

  if (!isMissingRelationError(docsError)) {
    throw docsError;
  }

  const { data, error } = await supabaseClient
    .from("orcamentos")
    .select(
      "id, data_orcamento, status, valor_total, cliente:clientes(id,nome)"
    )
    .eq("empresa_id", state.empresaId)
    .order("data_orcamento", { ascending: false });

  if (error) throw error;
  state.orcamentosSource = "orcamentos";
  state.orcamentos = data || [];
}

async function loadDespesas() {
  const { data, error } = await supabaseClient
    .from("despesas")
    .select("id, data_despesa, descricao, status, valor")
    .eq("empresa_id", state.empresaId)
    .order("data_despesa", { ascending: false });

  if (error) throw error;
  state.despesas = data || [];
}

function renderSelects() {
  if (els.pedidoClienteSelect) {
    els.pedidoClienteSelect.innerHTML = '<option value="">Selecione um cliente</option>';
  }
  if (els.orcamentoClienteSelect) {
    els.orcamentoClienteSelect.innerHTML = '<option value="">Selecione um cliente</option>';
  }

  for (const cliente of state.clientes) {
    const optionHtml = `<option value="${cliente.id}">${escapeHtml(cliente.nome)}</option>`;
    if (els.pedidoClienteSelect) {
      els.pedidoClienteSelect.insertAdjacentHTML("beforeend", optionHtml);
    }
    if (els.orcamentoClienteSelect) {
      els.orcamentoClienteSelect.insertAdjacentHTML("beforeend", optionHtml);
    }
  }
}

function renderAdminEmpresasSelect() {
  if (!els.adminEmpresaSelect) return;
  els.adminEmpresaSelect.innerHTML = '<option value="">Selecione a empresa</option>';
  if (els.adminInviteEmpresaSelect) {
    els.adminInviteEmpresaSelect.innerHTML = '<option value="">Selecione a empresa</option>';
  }

  for (const empresa of state.adminEmpresas) {
    const option = `<option value="${empresa.id}">${escapeHtml(empresa.nome)}</option>`;
    els.adminEmpresaSelect.insertAdjacentHTML(
      "beforeend",
      option
    );
    if (els.adminInviteEmpresaSelect) {
      els.adminInviteEmpresaSelect.insertAdjacentHTML("beforeend", option);
    }
  }
}

function renderAdminVinculosTable() {
  if (!els.adminVinculosTable) return;
  els.adminVinculosTable.innerHTML = state.adminVinculos
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.empresas?.nome || "-")}</td>
        <td>${escapeHtml(item.empresa_id)}</td>
        <td>${escapeHtml(item.user_id)}</td>
        <td>${escapeHtml(item.role || "user")}</td>
        <td>${item.ativo ? "Sim" : "Nao"}</td>
      </tr>
    `
    )
    .join("");
}

function renderOwnerUsersTable() {
  if (!els.ownerUsersTable) return;
  els.ownerUsersTable.innerHTML = state.ownerUsers
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.user_id)}</td>
        <td>${escapeHtml(item.role || "user")}</td>
        <td>${item.ativo ? "Sim" : "Nao"}</td>
      </tr>
    `
    )
    .join("");
}

function renderClientesTable() {
  els.clientesTable.innerHTML = state.clientes
    .map(
      (cliente) => `
      <tr>
        <td>${escapeHtml(cliente.nome)}</td>
        <td>${escapeHtml(cliente.telefone || "-")}</td>
        <td>${escapeHtml(cliente.email || "-")}</td>
        <td><button class="action-delete" data-del-cliente="${cliente.id}">Excluir</button></td>
      </tr>
    `
    )
    .join("");
}

function renderProdutosTable() {
  const produtos = getFilteredAndSortedProdutos();

  els.produtosTable.innerHTML = produtos
    .map(
      (produto) => `
      <tr>
        <td>${escapeHtml(produto.nome)}</td>
        <td>${escapeHtml(produto.categoria || "-")}</td>
        <td>${moeda.format(produto.preco || 0)}</td>
        <td>${produto.custo == null ? "-" : moeda.format(produto.custo)}</td>
        <td>${produto.margem == null ? "-" : `${escapeHtml(produto.margem)}%`}</td>
        <td>${escapeHtml(produto.estoque ?? 0)}</td>
        <td>${escapeHtml(produto.ponto_pedido ?? 0)}</td>
        <td>${produto.ativo ? "Sim" : "Nao"}</td>
        <td>
          <button class="action-edit" data-edit-produto="${produto.id}">Editar</button>
          <button class="action-delete" data-del-produto="${produto.id}">Excluir</button>
        </td>
      </tr>
    `
    )
    .join("");

  updateProdutoSortHeaders();
}

function updateProdutoSortHeaders() {
  const headers = Array.from(document.querySelectorAll("#section-produtos th.sortable[data-sort]"));
  for (const th of headers) {
    const field = th.getAttribute("data-sort") || "";
    const baseLabel = th.getAttribute("data-label") || th.textContent || "";

    if (!th.getAttribute("data-label")) {
      th.setAttribute("data-label", baseLabel.trim());
    }

    if (field === state.produtoSort.field) {
      const marker = state.produtoSort.direction === "asc" ? " ▲" : " ▼";
      th.textContent = `${th.getAttribute("data-label")}${marker}`;
      th.classList.add("sorted");
    } else {
      th.textContent = th.getAttribute("data-label") || "";
      th.classList.remove("sorted");
    }
  }
}

function getProdutoFieldValue(produto, field) {
  if (field === "ativo") {
    return produto.ativo ? "sim" : "nao";
  }

  const value = produto[field];
  return value == null ? "" : String(value);
}

function getFilteredAndSortedProdutos() {
  const filtered = state.produtos.filter((produto) => {
    return Object.entries(state.produtoFilters).every(([field, filterValue]) => {
      const needle = String(filterValue || "").trim().toLowerCase();
      if (!needle) return true;
      const haystack = getProdutoFieldValue(produto, field).toLowerCase();
      return haystack.includes(needle);
    });
  });

  const { field, direction } = state.produtoSort;
  const factor = direction === "desc" ? -1 : 1;

  filtered.sort((a, b) => {
    const av = a[field];
    const bv = b[field];

    const aNum = Number(av);
    const bNum = Number(bv);
    const bothNumbers = Number.isFinite(aNum) && Number.isFinite(bNum);

    if (bothNumbers) {
      return (aNum - bNum) * factor;
    }

    const aText = getProdutoFieldValue(a, field).toLowerCase();
    const bText = getProdutoFieldValue(b, field).toLowerCase();
    return aText.localeCompare(bText, "pt-BR") * factor;
  });

  return filtered;
}

function setProdutoSort(field) {
  if (state.produtoSort.field === field) {
    state.produtoSort.direction = state.produtoSort.direction === "asc" ? "desc" : "asc";
  } else {
    state.produtoSort.field = field;
    state.produtoSort.direction = "asc";
  }

  renderProdutosTable();
}

function renderPedidosTable() {
  els.pedidosTable.innerHTML = state.pedidos
    .map((pedido) => {
      const data = pedido.data_pedido ? new Date(pedido.data_pedido).toLocaleDateString("pt-BR") : "-";
      const clienteNome = pedido.cliente?.nome || (pedido.cliente_legacy_id ? `Legacy #${escapeHtml(pedido.cliente_legacy_id)}` : "-");
      return `
      <tr>
        <td>${data}</td>
        <td>${clienteNome}</td>
        <td>${escapeHtml(pedido.status || "-")}</td>
        <td>${moeda.format(pedido.valor_total || 0)}</td>
        <td>
            <button class="action-edit" data-edit-pedido="${pedido.id}">Editar</button>
          <button class="action-edit" data-view-pedido-itens="${pedido.id}">Itens</button>
          <button class="action-delete" data-del-pedido="${pedido.id}">Excluir</button>
        </td>
      </tr>
    `;
    })
    .join("");
}

function renderOrcamentosTable() {
  els.orcamentosTable.innerHTML = state.orcamentos
    .map((orcamento) => {
      const data = orcamento.data_orcamento ? new Date(orcamento.data_orcamento).toLocaleDateString("pt-BR") : "-";
      const clienteNome = orcamento.cliente?.nome || (orcamento.cliente_legacy_id ? `Legacy #${escapeHtml(orcamento.cliente_legacy_id)}` : "-");
      return `
      <tr>
        <td>${data}</td>
        <td>${clienteNome}</td>
        <td>${escapeHtml(orcamento.status || "-")}</td>
        <td>${moeda.format(orcamento.valor_total || 0)}</td>
        <td>
            <button class="action-edit" data-edit-orcamento="${orcamento.id}">Editar</button>
          <button class="action-edit" data-view-orcamento-itens="${orcamento.id}">Itens</button>
          <button class="action-delete" data-del-orcamento="${orcamento.id}">Excluir</button>
        </td>
      </tr>
    `;
    })
    .join("");
}

function renderDespesasTable() {
  els.despesasTable.innerHTML = state.despesas
    .map((despesa) => {
      const data = despesa.data_despesa ? new Date(despesa.data_despesa).toLocaleDateString("pt-BR") : "-";
      return `
      <tr>
        <td>${data}</td>
        <td>${escapeHtml(despesa.descricao || "-")}</td>
        <td>${escapeHtml(despesa.status || "-")}</td>
        <td>${moeda.format(despesa.valor || 0)}</td>
        <td><button class="action-delete" data-del-despesa="${despesa.id}">Excluir</button></td>
      </tr>
    `;
    })
    .join("");
}

function renderMetrics() {
  els.clientesCount.textContent = String(state.clientes.length);
  els.pedidosCount.textContent = String(state.pedidos.length);
  els.despesasCount.textContent = String(state.despesas.length);

  const faturamento = state.pedidos
    .filter((pedido) => pedido.status === "fechado")
    .reduce((sum, pedido) => sum + Number(pedido.valor_total || 0), 0);
  els.faturamentoValue.textContent = moeda.format(faturamento);

  const estoqueTotal = state.produtos.length;
  const produtosComEstoque = state.produtos.filter((produto) => produto.controla_estoque !== false);
  const estoqueComSaldo = produtosComEstoque.filter((produto) => Number(produto.estoque || 0) > 0).length;
  const estoquePontoPedido = state.produtos.filter(
    (produto) => produto.controla_estoque !== false && Number(produto.estoque || 0) <= Number(produto.ponto_pedido || 0)
  ).length;
  const orcamentoAberto = state.orcamentos
    .filter((orcamento) => orcamento.status === "aberto")
    .reduce((sum, orcamento) => sum + Number(orcamento.valor_total || 0), 0);

  els.estoqueTotalCount.textContent = `${estoqueTotal} itens`;
  els.estoqueComSaldoCount.textContent = `${estoqueComSaldo} itens`;
  els.estoquePontoPedidoCount.textContent = `${estoquePontoPedido} itens`;
  els.orcamentoAbertoValue.textContent = moeda.format(orcamentoAberto);
}

async function refreshAll() {
  try {
    if (!state.session || !state.empresaId) return;
    const baseLoads = [
      loadClientes(),
      loadProdutos(),
      loadPedidos(),
      loadOrcamentos(),
      loadDespesas(),
      loadOwnerUsers()
    ];

    if (state.isPlatformAdmin) {
      baseLoads.push(loadAdminEmpresas(), loadAdminVinculos());
    }

    await Promise.all(baseLoads);

    renderSelects();
    renderClientesTable();
    renderProdutosTable();
    renderPedidosTable();
    renderOrcamentosTable();
    renderDespesasTable();
    renderOwnerUsersTable();
    renderAdminEmpresasSelect();
    renderAdminVinculosTable();
    renderMetrics();
  } catch (error) {
    console.error(error);
    showToast(`Erro ao carregar dados: ${error.message}`, "error");
  }
}

async function createCliente(event) {
  event.preventDefault();
  const formData = new FormData(els.clienteForm);
  const payload = {
    empresa_id: state.empresaId,
    nome: String(formData.get("nome") || "").trim(),
    telefone: String(formData.get("telefone") || "").trim() || null,
    email: String(formData.get("email") || "").trim() || null
  };

  await createClienteFromPayload(payload);

  els.clienteForm.reset();
  showToast("Cliente salvo");
  await refreshAll();
}

async function createClienteFromPayload(payload) {
  if (!payload?.nome) return null;

  const { data, error } = await supabaseClient
    .from("clientes")
    .insert(payload)
    .select("id, nome, telefone, email")
    .single();

  if (error) throw error;
  return data || null;
}

async function createProduto(event) {
  event.preventDefault();
  const formData = new FormData(els.produtoForm);
  const nome = String(formData.get("nome") || "").trim();
  const editId = Number(els.produtoForm?.dataset.editId || 0) || null;
  if (!nome) return;

  if (state.produtosSource === "produto_catalogo") {
    const categoriaNome = String(formData.get("categoria") || "").trim();
    let categoriaId = null;

    if (categoriaNome) {
      const { data: categoriaData, error: categoriaError } = await supabaseClient
        .from("produto_categorias")
        .upsert(
          {
            empresa_id: state.empresaId,
            nome: categoriaNome
          },
          { onConflict: "empresa_id,nome" }
        )
        .select("id")
        .single();

      if (categoriaError) throw categoriaError;
      categoriaId = categoriaData?.id ?? null;
    }

    const payloadCatalogo = {
      empresa_id: state.empresaId,
      categoria_id: categoriaId,
      nome,
      preco_venda: Number(formData.get("preco") || 0),
      custo: String(formData.get("custo") || "").trim() ? Number(formData.get("custo")) : null,
      margem_percentual: String(formData.get("margem") || "").trim() ? Number(formData.get("margem")) : null,
      estoque_atual: Number(formData.get("estoque") || 0),
      estoque_minimo: Number(formData.get("ponto_pedido") || 0),
      ativo: String(formData.get("ativo") || "sim") === "sim",
      controla_estoque: String(formData.get("controla_estoque") || "sim") === "sim",
      descricao: String(formData.get("descricao") || "").trim() || null,
      imagem_path: String(formData.get("imagem_path") || "").trim() || null
    };

    if (editId) {
      const { error: updateCatalogError } = await supabaseClient
        .from("produto_catalogo")
        .update(payloadCatalogo)
        .eq("id", editId)
        .eq("empresa_id", state.empresaId);

      if (updateCatalogError) throw updateCatalogError;
    } else {
      const { error: insertCatalogError } = await supabaseClient
        .from("produto_catalogo")
        .insert(payloadCatalogo);

      if (insertCatalogError) throw insertCatalogError;
    }
  } else {
    const payload = {
      empresa_id: state.empresaId,
      nome,
      preco: Number(formData.get("preco") || 0),
      estoque: Number(formData.get("estoque") || 0),
      ponto_pedido: Number(formData.get("ponto_pedido") || 0)
    };

    if (editId) {
      const { error } = await supabaseClient
        .from("produtos")
        .update(payload)
        .eq("id", editId)
        .eq("empresa_id", state.empresaId);
      if (error) throw error;
    } else {
      const { error } = await supabaseClient.from("produtos").insert(payload);
      if (error) throw error;
    }
  }

  setProdutoFormMode({ editing: false });
  closeProdutoModal();
  showToast(editId ? "Produto atualizado" : "Produto salvo");
  await refreshAll();
}

async function createPedido(event) {
  event.preventDefault();
  const formData = new FormData(els.pedidoForm);
  const clienteIdRaw = Number(formData.get("cliente_id"));
  const clienteId = Number.isFinite(clienteIdRaw) && clienteIdRaw > 0 ? clienteIdRaw : null;

  if (state.pedidosSource === "documentos_venda") {
    const payload = {
      empresa_id: state.empresaId,
      tipo_documento: "pedido",
      cliente_id: clienteId,
      observacoes: String(formData.get("descricao") || "").trim() || null,
      status: String(formData.get("status") || "aberto"),
      total: Number(formData.get("valor_total") || 0),
      subtotal: Number(formData.get("valor_total") || 0),
      data_emissao: new Date().toISOString()
    };

    const { error } = await supabaseClient.from("documentos_venda").insert(payload);
    if (error) throw error;
  } else {
    const payload = {
      empresa_id: state.empresaId,
      cliente_id: clienteId,
      descricao: String(formData.get("descricao") || "").trim() || null,
      status: String(formData.get("status") || "aberto"),
      valor_total: Number(formData.get("valor_total") || 0),
      data_pedido: new Date().toISOString()
    };

    const { error } = await supabaseClient.from("pedidos").insert(payload);
    if (error) throw error;
  }

  els.pedidoForm.reset();
  showToast("Pedido salvo");
  await refreshAll();
}

async function createOrcamento(event) {
  event.preventDefault();
  const formData = new FormData(els.orcamentoForm);
  const clienteIdRaw = Number(formData.get("cliente_id"));
  const clienteId = Number.isFinite(clienteIdRaw) && clienteIdRaw > 0 ? clienteIdRaw : null;

  if (state.orcamentosSource === "documentos_venda") {
    const payload = {
      empresa_id: state.empresaId,
      tipo_documento: "orcamento",
      cliente_id: clienteId,
      observacoes: String(formData.get("descricao") || "").trim() || null,
      status: String(formData.get("status") || "aberto"),
      total: Number(formData.get("valor_total") || 0),
      subtotal: Number(formData.get("valor_total") || 0),
      data_emissao: new Date().toISOString()
    };

    const { error } = await supabaseClient.from("documentos_venda").insert(payload);
    if (error) throw error;
  } else {
    const payload = {
      empresa_id: state.empresaId,
      cliente_id: clienteId,
      descricao: String(formData.get("descricao") || "").trim() || null,
      status: String(formData.get("status") || "aberto"),
      valor_total: Number(formData.get("valor_total") || 0),
      data_orcamento: new Date().toISOString()
    };

    const { error } = await supabaseClient.from("orcamentos").insert(payload);
    if (error) throw error;
  }

  els.orcamentoForm.reset();
  showToast("Orcamento salvo");
  await refreshAll();
}

async function createDespesa(event) {
  event.preventDefault();
  const formData = new FormData(els.despesaForm);
  const payload = {
    empresa_id: state.empresaId,
    descricao: String(formData.get("descricao") || "").trim(),
    categoria: String(formData.get("categoria") || "").trim() || null,
    status: String(formData.get("status") || "aberto"),
    valor: Number(formData.get("valor") || 0),
    data_despesa: new Date().toISOString()
  };

  const { error } = await supabaseClient.from("despesas").insert(payload);
  if (error) throw error;

  els.despesaForm.reset();
  showToast("Despesa salva");
  await refreshAll();
}

async function createAdminEmpresa(event) {
  event.preventDefault();
  if (!state.isPlatformAdmin) throw new Error("Acesso restrito ao admin SaaS");

  const formData = new FormData(els.adminEmpresaForm);
  const nome = String(formData.get("nome") || "").trim();
  if (!nome) return;

  const { error } = await supabaseClient.from("empresas").insert({ nome });
  if (error) throw error;

  els.adminEmpresaForm.reset();
  showToast("Empresa criada");
  await refreshAll();
}

async function findUserByEmail(email) {
  const { data, error } = await supabaseClient.rpc("admin_find_user_by_email", {
    target_email: email
  });

  if (error) throw error;
  if (!data || !data.length) {
    throw new Error("Usuario nao encontrado no Auth");
  }

  return data[0].user_id;
}

async function createAdminVinculo(event) {
  event.preventDefault();
  if (!state.isPlatformAdmin) throw new Error("Acesso restrito ao admin SaaS");

  const formData = new FormData(els.adminVinculoForm);
  const email = String(formData.get("email") || "").trim();
  const empresaId = String(formData.get("empresa_id") || "").trim();
  const role = String(formData.get("role") || "user").trim();

  if (!email || !empresaId) {
    return;
  }

  const userId = await findUserByEmail(email);

  const { error } = await supabaseClient
    .from("usuarios_empresas")
    .upsert(
      {
        user_id: userId,
        empresa_id: empresaId,
        role,
        ativo: true
      },
      { onConflict: "user_id,empresa_id" }
    );

  if (error) throw error;

  els.adminVinculoForm.reset();
  showToast("Usuario vinculado");
  await refreshAll();
}

async function createAdminUserAndVinculo(event) {
  event.preventDefault();
  if (!state.isPlatformAdmin) throw new Error("Acesso restrito ao admin SaaS");

  const formData = new FormData(els.adminInviteForm);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "").trim();
  const empresaId = String(formData.get("empresa_id") || "").trim();
  const role = String(formData.get("role") || "user").trim();

  if (!email || !password || !empresaId) return;

  const accessToken = state.session?.access_token;
  if (!accessToken) {
    throw new Error("Sessao invalida. Faca login novamente.");
  }

  const response = await fetch("/api/admin-create-user", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      email,
      password,
      empresa_id: empresaId,
      role
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "Falha ao criar usuario");
  }

  els.adminInviteForm.reset();
  showToast("Usuario criado e vinculado");
  await refreshAll();
}

async function createOwnerUser(event) {
  event.preventDefault();
  if (state.currentRole !== "owner") throw new Error("Acesso restrito ao owner da empresa");

  const formData = new FormData(els.ownerUserForm);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "").trim();
  const role = String(formData.get("role") || "user").trim();

  if (!email || !password) return;

  const accessToken = state.session?.access_token;
  if (!accessToken) throw new Error("Sessao invalida. Faca login novamente.");

  const response = await fetch("/api/owner-create-user", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      email,
      password,
      role,
      empresa_id: state.empresaId
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Falha ao criar usuario");
  }

  els.ownerUserForm.reset();
  showToast("Usuario criado para a empresa");
  await refreshAll();
}

async function deleteByTable(table, id) {
  const { error } = await supabaseClient
    .from(table)
    .delete()
    .eq("id", id)
    .eq("empresa_id", state.empresaId);
  if (error) throw error;
  showToast("Registro excluido");
  await refreshAll();
}

async function deleteDocumentoVenda(id, tipoDocumento) {
  const { error } = await supabaseClient
    .from("documentos_venda")
    .delete()
    .eq("id", id)
    .eq("empresa_id", state.empresaId)
    .eq("tipo_documento", tipoDocumento);

  if (error) throw error;
  showToast("Registro excluido");
  await refreshAll();
}

async function handleSession(session) {
  state.session = session;
  updateShellVisibility();
  setSection("dashboard");

  if (!session) {
    state.empresaId = null;
    state.empresaNome = "";
    state.currentRole = "user";
    state.isPlatformAdmin = false;
    updateAdminVisibility();
    updateOwnerUsersVisibility();
    return;
  }

  try {
    await loadPlatformAdminStatus();
    await loadEmpresaContext();
    await refreshAll();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function attachEvents() {
  els.refreshBtn.addEventListener("click", refreshAll);
  els.loginForm.addEventListener("submit", async (event) => {
    try {
      await login(event);
      showToast("Login realizado");
    } catch (error) {
      showToast(`Erro no login: ${error.message}`, "error");
    }
  });

  els.logoutBtn.addEventListener("click", async () => {
    try {
      await logout();
      showToast("Sessao encerrada");
    } catch (error) {
      showToast(`Erro ao sair: ${error.message}`, "error");
    }
  });

  for (const tab of els.tabs) {
    tab.addEventListener("click", () => {
      setSection(tab.dataset.section || "dashboard");
    });
  }

  els.clienteForm.addEventListener("submit", async (event) => {
    try {
      await createCliente(event);
    } catch (error) {
      showToast(`Erro ao salvar cliente: ${error.message}`, "error");
    }
  });

  els.produtoForm.addEventListener("submit", async (event) => {
    try {
      await createProduto(event);
    } catch (error) {
      showToast(`Erro ao salvar produto: ${error.message}`, "error");
    }
  });

  if (els.openProdutoModalBtn) {
    els.openProdutoModalBtn.addEventListener("click", openProdutoCreateModal);
  }

  if (els.openPedidoModalBtn) {
    els.openPedidoModalBtn.addEventListener("click", () => openNovoDocumentoModal("pedido"));
  }

  if (els.closeProdutoModalBtn) {
    els.closeProdutoModalBtn.addEventListener("click", () => {
      setProdutoFormMode({ editing: false });
      closeProdutoModal();
    });
  }

  if (els.produtoModal) {
    els.produtoModal.addEventListener("click", (event) => {
      if (event.target === els.produtoModal) {
        setProdutoFormMode({ editing: false });
        closeProdutoModal();
      }
    });
  }

  if (els.closeItensDocumentoModalBtn) {
    els.closeItensDocumentoModalBtn.addEventListener("click", closeItensDocumentoModal);
  }

  if (els.itensDocumentoModal) {
    els.itensDocumentoModal.addEventListener("click", (event) => {
      if (event.target === els.itensDocumentoModal) {
        closeItensDocumentoModal();
      }
    });
  }

  if (els.closeNovoDocumentoModalBtn) {
    els.closeNovoDocumentoModalBtn.addEventListener("click", closeNovoDocumentoModal);
  }

  if (els.novoDocumentoClienteTrigger) {
    els.novoDocumentoClienteTrigger.addEventListener("click", () => {
      if (els.novoDocumentoClientePanel?.classList.contains("hidden")) {
        openNovoDocumentoClientePanel();
      } else {
        closeNovoDocumentoClientePanel();
      }
    });
  }

  if (els.closeNovoClienteRapidoModalBtn) {
    els.closeNovoClienteRapidoModalBtn.addEventListener("click", closeNovoClienteRapidoModal);
  }

  if (els.novoDocumentoModal) {
    els.novoDocumentoModal.addEventListener("click", (event) => {
      if (event.target === els.novoDocumentoModal) {
        closeNovoDocumentoModal();
      }
    });
  }

  if (els.novoClienteRapidoModal) {
    els.novoClienteRapidoModal.addEventListener("click", (event) => {
      if (event.target === els.novoClienteRapidoModal) {
        closeNovoClienteRapidoModal();
      }
    });
  }

  if (els.novoDocumentoClientePanel) {
    els.novoDocumentoClientePanel.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const quickNew = target.closest("[data-cliente-quick-new]");
      if (quickNew) {
        closeNovoDocumentoClientePanel();
        openNovoClienteRapidoModal();
        return;
      }

      const clienteButton = target.closest("[data-cliente-id]");
      if (!clienteButton) return;
      const clienteId = clienteButton.getAttribute("data-cliente-id") || "";
      setNovoDocumentoCliente(clienteId);
      closeNovoDocumentoClientePanel();
    });
  }

  if (els.addDocumentoItemBtn) {
    els.addDocumentoItemBtn.addEventListener("click", () => addNovoDocumentoItem());
  }

  if (els.novoDocumentoForm) {
    els.novoDocumentoForm.addEventListener("submit", async (event) => {
      try {
        await saveNovoDocumento(event);
      } catch (error) {
        showToast(`Erro ao salvar documento: ${error.message}`, "error");
      }
    });
  }

  if (els.novoDocumentoClienteSearch) {
    els.novoDocumentoClienteSearch.addEventListener("input", () => {
      renderNovoDocumentoClienteSelect();
      openNovoDocumentoClientePanel();
    });

    els.novoDocumentoClienteSearch.addEventListener("focus", () => {
      openNovoDocumentoClientePanel();
    });
  }

  if (els.novoDocumentoStatusSelect) {
    els.novoDocumentoStatusSelect.addEventListener("change", () => {
      state.novoDocumentoModal.status = els.novoDocumentoStatusSelect.value || "aberto";
    });
  }

  if (els.novoDocumentoObservacoes) {
    els.novoDocumentoObservacoes.addEventListener("input", () => {
      state.novoDocumentoModal.observacoes = els.novoDocumentoObservacoes.value || "";
    });
  }

  if (els.novoDocumentoItemsGrid) {
    els.novoDocumentoItemsGrid.addEventListener("change", handleNovoDocumentoItemChange);
    els.novoDocumentoItemsGrid.addEventListener("input", handleNovoDocumentoItemChange);
    els.novoDocumentoItemsGrid.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const comboTrigger = target.closest("[data-produto-combo-trigger]");
      if (comboTrigger) {
        const rowId = comboTrigger.getAttribute("data-produto-combo-trigger") || "";
        const panel = document.querySelector(`[data-produto-combo-panel="${rowId}"]`);
        if (panel instanceof HTMLElement && panel.classList.contains("hidden")) {
          openNovoDocumentoProdutoPanel(rowId);
        } else {
          closeNovoDocumentoProdutoPanel(rowId);
        }
        return;
      }

      const comboSearch = target.closest("[data-produto-combo-search]");
      if (comboSearch) {
        return;
      }

      const comboOption = target.closest("[data-produto-id][data-produto-row]");
      if (comboOption) {
        const rowId = comboOption.getAttribute("data-produto-row") || "";
        const produtoId = comboOption.getAttribute("data-produto-id") || "";
        setNovoDocumentoProduto(rowId, produtoId);
        closeNovoDocumentoProdutoPanel(rowId);
        return;
      }

      const rowId = target.getAttribute("data-documento-item-remove");
      if (!rowId) return;
      removeNovoDocumentoItem(rowId);
    });
  }

  if (els.novoClienteRapidoForm) {
    els.novoClienteRapidoForm.addEventListener("submit", async (event) => {
      try {
        await saveNovoClienteRapido(event);
      } catch (error) {
        showToast(`Erro ao salvar cliente: ${error.message}`, "error");
      }
    });
  }

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const combo = target.closest("[data-cliente-combo]");
    if (!combo) {
      closeNovoDocumentoClientePanel();
    }

    const produtoCombo = target.closest("[data-produto-combo]");
    if (!produtoCombo) {
      for (const item of state.novoDocumentoModal.itens) {
        closeNovoDocumentoProdutoPanel(item.rowId);
      }
    }
  });

  for (const button of Array.from(document.querySelectorAll("[data-documento-tipo]"))) {
    button.addEventListener("click", () => {
      const tipo = button.getAttribute("data-documento-tipo") || "pedido";
      setNovoDocumentoTipo(tipo);
    });
  }

  const filterBindings = [
    ["nome", els.filtroProdutoNome],
    ["categoria", els.filtroProdutoCategoria],
    ["preco", els.filtroProdutoPreco],
    ["custo", els.filtroProdutoCusto],
    ["margem", els.filtroProdutoMargem],
    ["estoque", els.filtroProdutoEstoque],
    ["ponto_pedido", els.filtroProdutoPonto],
    ["ativo", els.filtroProdutoAtivo]
  ];

  for (const [field, input] of filterBindings) {
    if (!input) continue;
    input.addEventListener("input", () => {
      state.produtoFilters[field] = input.value || "";
      renderProdutosTable();
    });
  }

  const sortHeaders = Array.from(document.querySelectorAll("#section-produtos th.sortable[data-sort]"));
  for (const th of sortHeaders) {
    th.addEventListener("click", () => {
      const field = th.getAttribute("data-sort");
      if (!field) return;
      setProdutoSort(field);
    });
  }

  if (els.pedidoForm) {
    els.pedidoForm.addEventListener("submit", async (event) => {
      try {
        await createPedido(event);
      } catch (error) {
        showToast(`Erro ao salvar pedido: ${error.message}`, "error");
      }
    });
  }

  els.orcamentoForm.addEventListener("submit", async (event) => {
    try {
      await createOrcamento(event);
    } catch (error) {
      showToast(`Erro ao salvar orcamento: ${error.message}`, "error");
    }
  });

  els.despesaForm.addEventListener("submit", async (event) => {
    try {
      await createDespesa(event);
    } catch (error) {
      showToast(`Erro ao salvar despesa: ${error.message}`, "error");
    }
  });

  els.ownerUserForm.addEventListener("submit", async (event) => {
    try {
      await createOwnerUser(event);
    } catch (error) {
      showToast(`Erro ao criar usuario da empresa: ${error.message}`, "error");
    }
  });

  els.adminEmpresaForm.addEventListener("submit", async (event) => {
    try {
      await createAdminEmpresa(event);
    } catch (error) {
      showToast(`Erro ao criar empresa: ${error.message}`, "error");
    }
  });

  els.adminInviteForm.addEventListener("submit", async (event) => {
    try {
      await createAdminUserAndVinculo(event);
    } catch (error) {
      showToast(`Erro ao criar usuario: ${error.message}`, "error");
    }
  });

  els.adminVinculoForm.addEventListener("submit", async (event) => {
    try {
      await createAdminVinculo(event);
    } catch (error) {
      showToast(`Erro ao vincular usuario: ${error.message}`, "error");
    }
  });

  document.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const clienteId = target.getAttribute("data-del-cliente");
    const produtoEditId = target.getAttribute("data-edit-produto");
    const produtoId = target.getAttribute("data-del-produto");
    const pedidoId = target.getAttribute("data-del-pedido");
    const orcamentoId = target.getAttribute("data-del-orcamento");
    const pedidoItensId = target.getAttribute("data-view-pedido-itens");
    const orcamentoItensId = target.getAttribute("data-view-orcamento-itens");
    const despesaId = target.getAttribute("data-del-despesa");

    try {
      if (produtoEditId) {
        openProdutoEditModal(Number(produtoEditId));
        return;
      }
      const pedidoEditId = target.getAttribute("data-edit-pedido");
      const orcamentoEditId = target.getAttribute("data-edit-orcamento");
      if (pedidoEditId) {
        await openNovoDocumentoEditModal("pedido", Number(pedidoEditId));
        return;
      }
      if (orcamentoEditId) {
        await openNovoDocumentoEditModal("orcamento", Number(orcamentoEditId));
        return;
      }
      if (pedidoItensId) {
        await openDocumentoItens("pedido", Number(pedidoItensId));
        return;
      }
      if (orcamentoItensId) {
        await openDocumentoItens("orcamento", Number(orcamentoItensId));
        return;
      }
      if (clienteId) {
        await deleteByTable("clientes", Number(clienteId));
      }
      if (produtoId) {
        await deleteByTable(state.produtosSource, Number(produtoId));
      }
      if (pedidoId) {
        if (state.pedidosSource === "documentos_venda") {
          await deleteDocumentoVenda(Number(pedidoId), "pedido");
        } else {
          await deleteByTable("pedidos", Number(pedidoId));
        }
      }
      if (orcamentoId) {
        if (state.orcamentosSource === "documentos_venda") {
          await deleteDocumentoVenda(Number(orcamentoId), "orcamento");
        } else {
          await deleteByTable("orcamentos", Number(orcamentoId));
        }
      }
      if (despesaId) {
        await deleteByTable("despesas", Number(despesaId));
      }
    } catch (error) {
      showToast(`Erro ao excluir: ${error.message}`, "error");
    }
  });
}

async function initApp() {
  try {
    const { SUPABASE_URL, SUPABASE_ANON_KEY, SAAS_NAME } = await loadRuntimeConfig();
    if (SAAS_NAME) {
      saasName = SAAS_NAME;
    }
    applySaasBranding();
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (error) {
    alert(error.message);
    throw error;
  }

  attachEvents();

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    handleSession(session);
  });

  const { data } = await supabaseClient.auth.getSession();
  await handleSession(data.session);
}

initApp();
