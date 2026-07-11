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
  produtosSource: "produto_catalogo",
  pedidosSource: "documentos_venda",
  pedidosView: "pedidos",
  pedidosListMode: "sintetico",
  pedidosProdutos: [],
  pedidosProdutosRaw: [],
  pedidosProdutosSort: {
    field: "total",
    direction: "desc"
  },
  pedidosProdutosFilters: {
    startDate: "",
    endDate: ""
  },
  orcamentosSource: "documentos_venda",
  itensDocumento: [],
  itensDocumentoModalMode: "itens",
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
  tableViews: {
    clientes: {
      sort: { field: "nome", direction: "asc" },
      filters: { nome: "", telefone: "", email: "" }
    },
    pedidosSintetico: {
      sort: { field: "data", direction: "desc" },
      filters: { pedido: "", data: "", cliente: "", status: "", total: "" }
    },
    pedidosAnalitico: {
      sort: { field: "data", direction: "desc" },
      filters: { pedido: "", data: "", cliente: "", produto: "", quantidade: "", valor: "" }
    },
    pedidosProdutos: {
      sort: { field: "total", direction: "desc" },
      filters: { produto: "", quantidade: "", pedidos: "", total: "", ultimaVenda: "" }
    },
    financeiro: {
      sort: { field: "emissao", direction: "desc" },
      filters: { emissao: "", vencimento: "", cliente: "", titulo: "", status: "", original: "", aberto: "" }
    },
    orcamentos: {
      sort: { field: "data", direction: "desc" },
      filters: { data: "", cliente: "", status: "", total: "" }
    },
    despesas: {
      sort: { field: "data", direction: "desc" },
      filters: { data: "", descricao: "", status: "", valor: "" }
    },
    usuarios: {
      sort: { field: "user_id", direction: "asc" },
      filters: { user_id: "", role: "", ativo: "" }
    },
    adminVinculos: {
      sort: { field: "empresa", direction: "asc" },
      filters: { empresa: "", empresa_id: "", user_id: "", role: "", ativo: "" }
    }
  },
  pedidos: [],
  contasReceber: [],
  recebimentos: [],
  parcelasReceberPrevistas: [],
  dashboardMonthlyCash: [],
  dashboardCashChartMode: "recebimentos",
  recebimentoModal: {
    contaId: null,
    conta: null,
    parcelas: [],
    recebimentos: []
  },
  orcamentos: [],
  despesas: [],
  formasPagamento: [],
  novoDocumentoModal: {
    tipo: "pedido",
    documentoId: null,
    clienteId: "",
    status: "aberto",
    observacoes: "",
    pagamento: {
      modo: "avista",
      formaPagamentoId: "",
      entrada: 0,
      parcelas: 1,
      vencimentoPrimeiraParcela: "",
      intervaloDias: 30
    },
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
  novoDocumentoPagamentoSection: document.getElementById("novoDocumentoPagamentoSection"),
  novoDocumentoPagamentoModo: document.getElementById("novoDocumentoPagamentoModo"),
  novoDocumentoPagamentoForma: document.getElementById("novoDocumentoPagamentoForma"),
  novoDocumentoPagamentoEntrada: document.getElementById("novoDocumentoPagamentoEntrada"),
  novoDocumentoPagamentoParcelas: document.getElementById("novoDocumentoPagamentoParcelas"),
  novoDocumentoPagamentoPrimeiroVencimento: document.getElementById("novoDocumentoPagamentoPrimeiroVencimento"),
  novoDocumentoPagamentoIntervalo: document.getElementById("novoDocumentoPagamentoIntervalo"),
  novoDocumentoPagamentoResumo: document.getElementById("novoDocumentoPagamentoResumo"),
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
    itensDocumentoTableHead: document.getElementById("itensDocumentoTableHead"),
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
  pedidosTableHead: document.getElementById("pedidosTableHead"),
  pedidosSectionSubtitle: document.getElementById("pedidosSectionSubtitle"),
  pedidosListModeToggle: document.getElementById("pedidosListModeToggle"),
  pedidosListModeButtons: Array.from(document.querySelectorAll("[data-pedidos-list-mode]")),
    pedidosProdutosFilters: document.getElementById("pedidosProdutosFilters"),
    pedidosProdutosStartDate: document.getElementById("pedidosProdutosStartDate"),
    pedidosProdutosEndDate: document.getElementById("pedidosProdutosEndDate"),
  pedidosViewButtons: Array.from(document.querySelectorAll("[data-pedidos-view]")),
  contasReceberTable: document.getElementById("contasReceberTable"),
  financeiroStatusFilter: document.getElementById("financeiroStatusFilter"),
  financeiroSearchInput: document.getElementById("financeiroSearchInput"),
  orcamentosTable: document.getElementById("orcamentosTable"),
  despesasTable: document.getElementById("despesasTable"),
  ownerUsersTable: document.getElementById("ownerUsersTable"),
  adminVinculosTable: document.getElementById("adminVinculosTable"),
  clientesCount: document.getElementById("clientesCount"),
  pedidosCount: document.getElementById("pedidosCount"),
  despesasCount: document.getElementById("despesasCount"),
  faturamentoValue: document.getElementById("faturamentoValue"),
  entradasCaixaResumo: document.getElementById("entradasCaixaResumo"),
  entradasCaixaTitulo: document.getElementById("entradasCaixaTitulo"),
  entradasCaixaSubtitulo: document.getElementById("entradasCaixaSubtitulo"),
   entradasCaixaLegenda: document.getElementById("entradasCaixaLegenda"),
  dashboardCashModeButtons: Array.from(document.querySelectorAll("[data-dashboard-cash-mode]")),
  entradasCaixaChart: document.getElementById("entradasCaixaChart"),
  entradasCaixaGrid: document.getElementById("entradasCaixaGrid"),
  estoqueTotalCount: document.getElementById("estoqueTotalCount"),
  estoqueComSaldoCount: document.getElementById("estoqueComSaldoCount"),
  estoquePontoPedidoCount: document.getElementById("estoquePontoPedidoCount"),
  orcamentoAbertoValue: document.getElementById("orcamentoAbertoValue"),
  refreshBtn: document.getElementById("refreshBtn"),
  changePasswordBtn: document.getElementById("changePasswordBtn"),
  changePasswordModal: document.getElementById("changePasswordModal"),
  closeChangePasswordModalBtn: document.getElementById("closeChangePasswordModalBtn"),
  changePasswordForm: document.getElementById("changePasswordForm"),
  recebimentoModal: document.getElementById("recebimentoModal"),
  closeRecebimentoModalBtn: document.getElementById("closeRecebimentoModalBtn"),
  recebimentoForm: document.getElementById("recebimentoForm"),
  recebimentoContaId: document.getElementById("recebimentoContaId"),
  recebimentoModalTitle: document.getElementById("recebimentoModalTitle"),
  recebimentoModalSubtitle: document.getElementById("recebimentoModalSubtitle"),
  recebimentoParcelaSelect: document.getElementById("recebimentoParcelaSelect"),
  recebimentoValorInput: document.getElementById("recebimentoValorInput"),
  recebimentoDataInput: document.getElementById("recebimentoDataInput"),
  recebimentoFormaSelect: document.getElementById("recebimentoFormaSelect"),
  recebimentoJurosInput: document.getElementById("recebimentoJurosInput"),
  recebimentoMultaInput: document.getElementById("recebimentoMultaInput"),
  recebimentoDescontoInput: document.getElementById("recebimentoDescontoInput"),
  recebimentoObservacoesInput: document.getElementById("recebimentoObservacoesInput"),
  recebimentoResumo: document.getElementById("recebimentoResumo"),
  recebimentoHistoricoTable: document.getElementById("recebimentoHistoricoTable"),
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

function openRecebimentoModal() {
  if (!els.recebimentoModal) return;
  els.recebimentoModal.classList.remove("hidden");
}

function closeRecebimentoModal() {
  if (!els.recebimentoModal) return;
  els.recebimentoModal.classList.add("hidden");
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
    pagamento: createPagamentoDraft(),
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

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateInput(dateText) {
  if (!dateText) return null;
  const parsed = new Date(`${dateText}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function splitAmountIntoParts(totalCents, parts) {
  const safeParts = Math.max(1, Number(parts || 1));
  const base = Math.floor(totalCents / safeParts);
  const remainder = totalCents % safeParts;
  return Array.from({ length: safeParts }, (_, index) => base + (index < remainder ? 1 : 0));
}

function createPagamentoDraft() {
  const today = new Date();
  return {
    modo: "avista",
    formaPagamentoId: "",
    entrada: 0,
    parcelas: 1,
    vencimentoPrimeiraParcela: formatDateInput(addDays(today, 30)),
    intervaloDias: 30
  };
}

function getNovoDocumentoPagamentoState() {
  const pagamento = state.novoDocumentoModal.pagamento || createPagamentoDraft();
  return {
    modo: pagamento.modo || "avista",
    formaPagamentoId: pagamento.formaPagamentoId || "",
    entrada: Number(pagamento.entrada || 0),
    parcelas: Math.max(1, Number(pagamento.parcelas || 1)),
    vencimentoPrimeiraParcela: pagamento.vencimentoPrimeiraParcela || formatDateInput(addDays(new Date(), 30)),
    intervaloDias: Math.max(1, Number(pagamento.intervaloDias || 30))
  };
}

function setNovoDocumentoPagamentoField(field, value) {
  state.novoDocumentoModal.pagamento = {
    ...getNovoDocumentoPagamentoState(),
    [field]: value
  };
  renderNovoDocumentoPagamentoSection();
}

function getPaymentLabels(modo) {
  if (modo === "entrada_parcelas") {
    return {
      parcelasLabel: "Parcelas restantes",
      helpText: "A entrada é recebida na hora e o restante vira parcelas."
    };
  }

  if (modo === "parcelado") {
    return {
      parcelasLabel: "Parcelas",
      helpText: "O valor total sera dividido entre as parcelas."
    };
  }

  return {
    parcelasLabel: "Parcelas",
    helpText: "Pagamento imediato, com recebimento na hora."
  };
}

function buildPagamentoPlano(total, pagamentoState) {
  const totalCents = Math.max(0, Math.round(Number(total || 0) * 100));
  const modo = pagamentoState.modo || "avista";
  const formaPagamentoId = pagamentoState.formaPagamentoId ? Number(pagamentoState.formaPagamentoId) : null;
  const intervaloDias = Math.max(1, Number(pagamentoState.intervaloDias || 30));
  const hoje = new Date();
  const vencimentoBase = parseDateInput(pagamentoState.vencimentoPrimeiraParcela) || addDays(hoje, intervaloDias);

  if (modo === "avista") {
    return {
      formaPagamentoId,
      valorOriginal: totalCents,
      valorRecebido: totalCents,
      valorAberto: 0,
      statusConta: totalCents > 0 ? "recebido" : "cancelado",
      parcelas: [
        {
          numero: 1,
          vencimento: hoje,
          valor: totalCents,
          status: totalCents > 0 ? "recebido" : "cancelado",
          valorRecebido: totalCents
        }
      ],
      recebimentos: totalCents > 0
        ? [
            {
              numeroParcela: 1,
              valor: totalCents,
              dataRecebimento: hoje,
              formaPagamentoId
            }
          ]
        : []
    };
  }

  const entradaCents = modo === "entrada_parcelas" ? Math.max(0, Math.min(totalCents, Math.round(Number(pagamentoState.entrada || 0) * 100))) : 0;
  const remainingCents = Math.max(0, totalCents - entradaCents);
  const parcelaCount = Math.max(1, Number(pagamentoState.parcelas || 1));
  const installmentParts = remainingCents > 0 ? splitAmountIntoParts(remainingCents, parcelaCount) : [];

  const parcelas = [];
  const recebimentos = [];

  if (modo === "entrada_parcelas" && entradaCents > 0) {
    parcelas.push({
      numero: 1,
      vencimento: hoje,
      valor: entradaCents,
      status: "recebido",
      valorRecebido: entradaCents
    });
    recebimentos.push({
      numeroParcela: 1,
      valor: entradaCents,
      dataRecebimento: hoje,
      formaPagamentoId
    });
  }

  const startIndex = parcelas.length;
  installmentParts.forEach((partCents, index) => {
    const numeroParcela = startIndex + index + 1;
    const vencimento = addDays(vencimentoBase, intervaloDias * index);
    parcelas.push({
      numero: numeroParcela,
      vencimento,
      valor: partCents,
      status: partCents > 0 ? "pendente" : "cancelado",
      valorRecebido: 0
    });
  });

  return {
    formaPagamentoId,
    valorOriginal: totalCents,
    valorRecebido: entradaCents,
    valorAberto: Math.max(0, totalCents - entradaCents),
    statusConta: entradaCents > 0 ? "parcial" : "aberto",
    parcelas,
    recebimentos
  };
}

function renderNovoDocumentoPagamentoSection() {
  if (!els.novoDocumentoPagamentoSection) return;
  const isPedido = state.novoDocumentoModal.tipo === "pedido";
  els.novoDocumentoPagamentoSection.classList.toggle("hidden", !isPedido);
  if (!isPedido) return;

  const pagamentoState = getNovoDocumentoPagamentoState();
  const labels = getPaymentLabels(pagamentoState.modo);
  const subtotal = getNovoDocumentoSubtotal();
  const plano = buildPagamentoPlano(subtotal, pagamentoState);
  const saldo = Math.max(0, subtotal - Number(pagamentoState.modo === "avista" ? subtotal : pagamentoState.entrada || 0));
  const parcelaBase = plano.parcelas.find((parcela) => parcela.status === "pendente") || plano.parcelas[0];

  if (els.novoDocumentoPagamentoModo) els.novoDocumentoPagamentoModo.value = pagamentoState.modo;
  if (els.novoDocumentoPagamentoForma) els.novoDocumentoPagamentoForma.value = pagamentoState.formaPagamentoId || "";
  if (els.novoDocumentoPagamentoEntrada) els.novoDocumentoPagamentoEntrada.value = String(pagamentoState.entrada || 0);
  if (els.novoDocumentoPagamentoParcelas) els.novoDocumentoPagamentoParcelas.value = String(pagamentoState.parcelas || 1);
  if (els.novoDocumentoPagamentoPrimeiroVencimento) els.novoDocumentoPagamentoPrimeiroVencimento.value = pagamentoState.vencimentoPrimeiraParcela;
  if (els.novoDocumentoPagamentoIntervalo) els.novoDocumentoPagamentoIntervalo.value = String(pagamentoState.intervaloDias || 30);

  const parcelasLabelNode = document.querySelector("[data-pagamento-parcelas-label]");
  const helpTextNode = document.querySelector("[data-pagamento-help]");
  if (parcelasLabelNode) parcelasLabelNode.textContent = labels.parcelasLabel;
  if (helpTextNode) helpTextNode.textContent = labels.helpText;

  if (els.novoDocumentoPagamentoEntrada) {
    els.novoDocumentoPagamentoEntrada.closest("label")?.classList.toggle("hidden", pagamentoState.modo !== "entrada_parcelas");
  }

  if (els.novoDocumentoPagamentoResumo) {
    els.novoDocumentoPagamentoResumo.textContent =
      `Saldo ${moeda.format(saldo)} • ${plano.parcelas.length} registro${plano.parcelas.length === 1 ? "" : "s"}` +
      (parcelaBase ? ` • ${moeda.format(Number(parcelaBase.valor || 0) / 100)}` : "");
  }

  return plano;
}

async function loadFormasPagamento() {
  const { data, error } = await supabaseClient
    .from("formas_pagamento")
    .select("id, nome, tipo, ativo")
    .eq("empresa_id", state.empresaId)
    .eq("ativo", true)
    .order("nome");

  if (error) throw error;
  state.formasPagamento = data || [];
}

function centsToDbValue(cents) {
  return Number((Number(cents || 0) / 100).toFixed(2));
}

function getFormaPagamentoNome(formaPagamentoId) {
  if (!formaPagamentoId) return null;
  const forma = state.formasPagamento.find((item) => String(item.id) === String(formaPagamentoId));
  return forma?.nome || null;
}

function normalizeContaStatus(status, valorAberto, isVencida) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "recebido" || normalized === "quitado") return "recebido";
  if (normalized === "parcial") return "parcial";
  if (normalized === "cancelado") return "cancelado";
  if (Number(valorAberto || 0) <= 0) return "recebido";
  if (isVencida) return "vencido";
  return "aberto";
}

function getContaStatusLabel(status) {
  if (status === "parcial") return "Parcial";
  if (status === "recebido") return "Recebido";
  if (status === "vencido") return "Vencido";
  return "Aberto";
}

function getParcelaSaldo(parcela) {
  return Math.max(0, Number(parcela?.valor_parcela || 0) - Number(parcela?.valor_recebido || 0));
}

async function loadContasReceber() {
  const { data, error } = await supabaseClient
    .from("contas_receber")
    .select("id, documento_id, cliente_id, numero_titulo, emissao, valor_original, valor_aberto, status, cliente:clientes(id,nome)")
    .eq("empresa_id", state.empresaId)
    .order("emissao", { ascending: false })
    .limit(500);

  if (error) {
    if (isMissingRelationError(error)) {
      state.contasReceber = [];
      return;
    }
    throw error;
  }

  const contaIds = (data || []).map((item) => Number(item.id)).filter(Number.isFinite);
  const parcelasByConta = new Map();

  if (contaIds.length) {
    const { data: parcelasData, error: parcelasError } = await supabaseClient
      .from("contas_receber_parcelas")
      .select("conta_receber_id, vencimento, valor_parcela, valor_recebido")
      .eq("empresa_id", state.empresaId)
      .in("conta_receber_id", contaIds)
      .order("vencimento", { ascending: true });

    if (parcelasError) {
      if (!isMissingRelationError(parcelasError)) {
        throw parcelasError;
      }
    } else {
      for (const parcela of parcelasData || []) {
        const contaId = Number(parcela.conta_receber_id || 0);
        if (!contaId) continue;
        if (!parcelasByConta.has(contaId)) {
          parcelasByConta.set(contaId, []);
        }
        parcelasByConta.get(contaId).push(parcela);
      }
    }
  }

  state.contasReceber = (data || []).map((item) => {
    const parcelas = parcelasByConta.get(Number(item.id)) || [];
    const parcelasPendentes = parcelas.filter(
      (parcela) => Number(parcela.valor_parcela || 0) - Number(parcela.valor_recebido || 0) > 0.00001
    );
    const baseVencimento = (parcelasPendentes[0] || parcelas[0])?.vencimento || null;
    const emissaoDate = item.emissao ? new Date(item.emissao) : null;
    const vencimentoDate = baseVencimento ? new Date(baseVencimento) : null;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const vencimentoComparavel = vencimentoDate ? new Date(vencimentoDate.getTime()) : null;
    if (vencimentoComparavel) {
      vencimentoComparavel.setHours(0, 0, 0, 0);
    }
    const statusOriginal = String(item.status || "").toLowerCase();
    const isLiquidada = statusOriginal === "recebido" || statusOriginal === "quitado" || Number(item.valor_aberto || 0) <= 0;
    const isVencida = Boolean(vencimentoComparavel && vencimentoComparavel < hoje && !isLiquidada);
    return {
      ...item,
      emissaoDate,
      vencimentoDate,
      statusNormalizado: normalizeContaStatus(item.status, item.valor_aberto, isVencida)
    };
  });
}

async function loadRecebimentos() {
  const { data, error } = await supabaseClient
    .from("recebimentos")
    .select("id, data_recebimento, valor")
    .eq("empresa_id", state.empresaId)
    .order("data_recebimento", { ascending: false })
    .limit(500);

  if (error) {
    if (isMissingRelationError(error)) {
      state.recebimentos = [];
      return;
    }
    throw error;
  }

  state.recebimentos = data || [];
}

async function loadParcelasReceberPrevistas() {
  // Agregacao usada no dashboard vem via RPC dashboard_monthly_cash.
  // Mantemos apenas parcelas em aberto para calculos auxiliares/telas.
  const { data, error } = await supabaseClient
    .from("contas_receber_parcelas")
    .select("id, vencimento, valor_parcela, valor_recebido, status")
    .eq("empresa_id", state.empresaId)
    .neq("status", "recebido")
    .neq("status", "cancelado")
    .order("vencimento", { ascending: true })
    .limit(500);

  if (error) {
    if (isMissingRelationError(error)) {
      state.parcelasReceberPrevistas = [];
      return;
    }
    throw error;
  }

  state.parcelasReceberPrevistas = data || [];
}

async function loadDashboardMonthlyCash() {
  const { data, error } = await supabaseClient.rpc("dashboard_monthly_cash", {
    target_empresa_id: state.empresaId,
    months_back: 11
  });

  if (error) {
    console.warn("Falha ao carregar RPC dashboard_monthly_cash", error.message);
    state.dashboardMonthlyCash = [];
    return;
  }

  state.dashboardMonthlyCash = (data || []).map((row) => ({
    mes: row.mes,
    realized: Number(row.realized_recebimentos || 0),
    forecast: Number(row.forecast_parcelas || 0),
    faturamento: Number(row.faturamento || 0)
  }));
}

async function cleanupOrphanDocumentoFinanceiro() {
  // Primeiro verifica se ha contas geradas pelo fluxo novo (prefixo DOC-*).
  // Se nao houver, pulamos toda a varredura de documentos.
  const { data: contasDocPreview, error: previewError } = await supabaseClient
    .from("contas_receber")
    .select("id")
    .eq("empresa_id", state.empresaId)
    .like("numero_titulo", "DOC-%")
    .limit(1);

  if (previewError) {
    if (isMissingRelationError(previewError)) return;
    throw previewError;
  }

  if (!contasDocPreview?.length) {
    return;
  }

  const docsResponse = await fetchAllSupabaseRows(() => supabaseClient
    .from("documentos_venda")
    .select("id")
    .eq("empresa_id", state.empresaId));

  if (docsResponse.error) {
    if (isMissingRelationError(docsResponse.error)) return;
    throw docsResponse.error;
  }

  const documentosIds = new Set((docsResponse.data || []).map((item) => Number(item.id)).filter(Number.isFinite));

  const contasResponse = await fetchAllSupabaseRows(() => supabaseClient
    .from("contas_receber")
    .select("id, documento_id, numero_titulo")
    .eq("empresa_id", state.empresaId)
    .like("numero_titulo", "DOC-%"));

  if (contasResponse.error) {
    if (isMissingRelationError(contasResponse.error)) return;
    throw contasResponse.error;
  }

  const orphanDocumentoIds = new Set();
  const orphanContaIds = new Set();
  for (const conta of contasResponse.data || []) {
    const documentoIdField = Number(conta.documento_id || 0);
    const documentoIdTitulo = parseDocumentoIdFromNumeroTitulo(conta.numero_titulo);
    const documentoId = documentoIdField || documentoIdTitulo || 0;

    if (!documentoId || !documentosIds.has(documentoId)) {
      const contaId = Number(conta.id || 0);
      if (contaId) {
        orphanContaIds.add(contaId);
      }
    }

    if (documentoId && !documentosIds.has(documentoId)) {
      orphanDocumentoIds.add(documentoId);
    }
  }

  if (orphanContaIds.size) {
    await deleteContasFinanceirasByContaIds(Array.from(orphanContaIds));
  }

  for (const documentoId of Array.from(orphanDocumentoIds)) {
    await deleteDocumentoFinanceiro(documentoId);
  }
}

async function loadContaFinanceiroDetalhe(contaId) {
  const { data: conta, error: contaError } = await supabaseClient
    .from("contas_receber")
    .select("id, documento_id, cliente_id, numero_titulo, emissao, valor_original, valor_aberto, status, cliente:clientes(id,nome)")
    .eq("empresa_id", state.empresaId)
    .eq("id", contaId)
    .maybeSingle();

  if (contaError) throw contaError;
  if (!conta) throw new Error("Conta a receber nao encontrada.");

  const { data: parcelas, error: parcelasError } = await supabaseClient
    .from("contas_receber_parcelas")
    .select("id, numero_parcela, vencimento, valor_parcela, valor_recebido, status, forma_pagamento_id, observacoes")
    .eq("empresa_id", state.empresaId)
    .eq("conta_receber_id", contaId)
    .order("numero_parcela", { ascending: true });

  if (parcelasError) throw parcelasError;

  const parcelaIds = (parcelas || []).map((item) => item.id);
  let recebimentos = [];
  if (parcelaIds.length) {
    const { data: recebimentosData, error: recebimentosError } = await supabaseClient
      .from("recebimentos")
      .select("id, parcela_id, data_recebimento, valor, forma_pagamento_id, observacoes")
      .eq("empresa_id", state.empresaId)
      .in("parcela_id", parcelaIds)
      .order("data_recebimento", { ascending: false });

    if (recebimentosError) throw recebimentosError;
    recebimentos = recebimentosData || [];
  }

  return {
    conta,
    parcelas: parcelas || [],
    recebimentos
  };
}

function getPendingParcelas(parcelas) {
  return (parcelas || []).filter((item) => getParcelaSaldo(item) > 0.00001);
}

function renderRecebimentoModal() {
  if (!els.recebimentoForm) return;
  const { conta, parcelas, recebimentos } = state.recebimentoModal;
  if (!conta) return;

  const clienteNome = conta.cliente?.nome || "Cliente nao informado";
  if (els.recebimentoModalTitle) {
    els.recebimentoModalTitle.textContent = `Registrar recebimento - ${clienteNome}`;
  }
  if (els.recebimentoModalSubtitle) {
    els.recebimentoModalSubtitle.textContent = `Titulo ${conta.numero_titulo || `DOC-${conta.documento_id || conta.id}`} • Saldo ${moeda.format(conta.valor_aberto || 0)}`;
  }
  if (els.recebimentoContaId) {
    els.recebimentoContaId.value = String(conta.id);
  }

  if (els.recebimentoFormaSelect) {
    const options = ['<option value="">Selecione a forma</option>'];
    for (const forma of state.formasPagamento) {
      options.push(`<option value="${forma.id}">${escapeHtml(forma.nome)}</option>`);
    }
    els.recebimentoFormaSelect.innerHTML = options.join("");
  }

  const pendingParcelas = getPendingParcelas(parcelas);
  if (els.recebimentoParcelaSelect) {
    const options = [
      '<option value="">Abater automaticamente (ordem de vencimento)</option>',
      ...pendingParcelas.map((parcela) => {
        const saldo = getParcelaSaldo(parcela);
        const venc = parcela.vencimento ? new Date(parcela.vencimento).toLocaleDateString("pt-BR") : "-";
        return `<option value="${parcela.id}">Parcela ${parcela.numero_parcela} • Venc ${venc} • Saldo ${moeda.format(saldo)}</option>`;
      })
    ];
    els.recebimentoParcelaSelect.innerHTML = options.join("");
  }

  const defaultParcela = pendingParcelas[0] || null;
  if (els.recebimentoParcelaSelect) {
    els.recebimentoParcelaSelect.value = defaultParcela ? String(defaultParcela.id) : "";
  }
  if (els.recebimentoValorInput) {
    const sugerido = defaultParcela ? getParcelaSaldo(defaultParcela) : Number(conta.valor_aberto || 0);
    els.recebimentoValorInput.value = String(Math.max(0.01, Number(sugerido || 0)).toFixed(2));
  }
  if (els.recebimentoDataInput) {
    els.recebimentoDataInput.value = formatDateInput(new Date());
  }
  if (els.recebimentoJurosInput) els.recebimentoJurosInput.value = "0";
  if (els.recebimentoMultaInput) els.recebimentoMultaInput.value = "0";
  if (els.recebimentoDescontoInput) els.recebimentoDescontoInput.value = "0";
  if (els.recebimentoObservacoesInput) els.recebimentoObservacoesInput.value = "";

  if (els.recebimentoResumo) {
    const recebidos = (parcelas || []).reduce((sum, item) => sum + Number(item.valor_recebido || 0), 0);
    const saldo = Math.max(0, Number(conta.valor_original || 0) - recebidos);
    els.recebimentoResumo.textContent = `Original ${moeda.format(conta.valor_original || 0)} • Recebido ${moeda.format(recebidos)} • Saldo ${moeda.format(saldo)}`;
  }

  if (els.recebimentoHistoricoTable) {
    if (!recebimentos.length) {
      els.recebimentoHistoricoTable.innerHTML = '<tr><td colspan="5">Sem recebimentos registrados.</td></tr>';
    } else {
      const parcelaById = new Map((parcelas || []).map((item) => [String(item.id), item]));
      els.recebimentoHistoricoTable.innerHTML = recebimentos
        .map((item) => {
          const parcela = parcelaById.get(String(item.parcela_id));
          const parcelaLabel = parcela ? `Parcela ${parcela.numero_parcela}` : "-";
          const data = item.data_recebimento ? new Date(item.data_recebimento).toLocaleDateString("pt-BR") : "-";
          const formaNome = getFormaPagamentoNome(item.forma_pagamento_id) || "-";
          return `
            <tr>
              <td>${data}</td>
              <td>${escapeHtml(parcelaLabel)}</td>
              <td>${moeda.format(item.valor || 0)}</td>
              <td>${escapeHtml(formaNome)}</td>
              <td>${escapeHtml(item.observacoes || "-")}</td>
            </tr>
          `;
        })
        .join("");
    }
  }
}

async function openRecebimentoModalByConta(contaId) {
  const detalhe = await loadContaFinanceiroDetalhe(contaId);
  state.recebimentoModal = {
    contaId,
    conta: detalhe.conta,
    parcelas: detalhe.parcelas,
    recebimentos: detalhe.recebimentos
  };
  renderRecebimentoModal();
  openRecebimentoModal();
}

async function openRecebimentoModalByPedido(documentoId) {
  const contasDocumento = state.contasReceber.filter((item) => Number(item.documento_id) === Number(documentoId));
  const conta =
    contasDocumento.find((item) => item.statusNormalizado === "aberto" || item.statusNormalizado === "parcial") ||
    contasDocumento[0];
  if (!conta) {
    throw new Error("Nao existe conta a receber vinculada para este pedido.");
  }
  await openRecebimentoModalByConta(Number(conta.id));
}

function calculateAbatimentoPrincipal(valorRecebido, juros, multa, desconto) {
  const principal = Number(valorRecebido || 0) + Number(desconto || 0) - Number(juros || 0) - Number(multa || 0);
  return Math.max(0, Number(principal.toFixed(2)));
}

function resolveContaStatusByParcelas(parcelas) {
  const totalRecebido = (parcelas || []).reduce((sum, item) => sum + Number(item.valor_recebido || 0), 0);
  const totalPrevisto = (parcelas || []).reduce((sum, item) => sum + Number(item.valor_parcela || 0), 0);
  if (totalPrevisto <= 0) return "aberto";
  if (totalRecebido <= 0) return "aberto";
  if (Math.abs(totalRecebido - totalPrevisto) < 0.01 || totalRecebido > totalPrevisto) return "recebido";
  return "parcial";
}

function getParcelasForAutoAllocation(parcelas) {
  return [...(parcelas || [])]
    .filter((item) => getParcelaSaldo(item) > 0)
    .sort((a, b) => {
      const aDate = a.vencimento ? new Date(a.vencimento).getTime() : 0;
      const bDate = b.vencimento ? new Date(b.vencimento).getTime() : 0;
      if (aDate !== bDate) return aDate - bDate;
      return Number(a.numero_parcela || 0) - Number(b.numero_parcela || 0);
    });
}

async function saveRecebimento(event) {
  event.preventDefault();
  const contaId = Number(els.recebimentoContaId?.value || 0);
  if (!contaId) throw new Error("Conta invalida para registrar recebimento.");

  const valorRecebido = Number(els.recebimentoValorInput?.value || 0);
  const juros = Number(els.recebimentoJurosInput?.value || 0);
  const multa = Number(els.recebimentoMultaInput?.value || 0);
  const desconto = Number(els.recebimentoDescontoInput?.value || 0);
  const dataRecebimento = els.recebimentoDataInput?.value || formatDateInput(new Date());
  const formaPagamentoId = Number(els.recebimentoFormaSelect?.value || 0) || null;
  const parcelaIdTarget = Number(els.recebimentoParcelaSelect?.value || 0) || null;
  const observacoes = String(els.recebimentoObservacoesInput?.value || "").trim();

  if (valorRecebido <= 0) {
    throw new Error("Informe um valor recebido maior que zero.");
  }

  const abatimento = calculateAbatimentoPrincipal(valorRecebido, juros, multa, desconto);
  if (abatimento <= 0) {
    throw new Error("O abatimento da divida ficou zero. Ajuste juros, multa, desconto e valor.");
  }

  const detalheAtual = await loadContaFinanceiroDetalhe(contaId);
  const parcelasMap = new Map((detalheAtual.parcelas || []).map((item) => [Number(item.id), { ...item }]));
  const parcelasParaAlocar = parcelaIdTarget
    ? (() => {
        const parcela = parcelasMap.get(parcelaIdTarget);
        return parcela ? [parcela] : [];
      })()
    : getParcelasForAutoAllocation(detalheAtual.parcelas);

  if (!parcelasParaAlocar.length) {
    throw new Error("Nao ha parcelas pendentes para receber nesta conta.");
  }

  let restante = abatimento;
  const applied = [];

  for (const parcela of parcelasParaAlocar) {
    if (restante <= 0) break;
    const saldo = getParcelaSaldo(parcela);
    if (saldo <= 0) continue;
    const aplicado = Math.min(saldo, restante);
    parcela.valor_recebido = Number((Number(parcela.valor_recebido || 0) + aplicado).toFixed(2));
    const novoSaldo = getParcelaSaldo(parcela);
    parcela.status = novoSaldo <= 0.00001 ? "recebido" : "parcial";
    restante = Number((restante - aplicado).toFixed(2));
    applied.push({
      parcelaId: Number(parcela.id),
      valor: aplicado,
      numeroParcela: Number(parcela.numero_parcela || 0)
    });
  }

  if (!applied.length) {
    throw new Error("Nao foi possivel aplicar o valor nas parcelas pendentes.");
  }

  const atualizacoesParcelas = applied.map((item) => {
    const parcela = parcelasMap.get(item.parcelaId);
    return supabaseClient
      .from("contas_receber_parcelas")
      .update({
        valor_recebido: Number(parcela.valor_recebido || 0),
        status: parcela.status,
        forma_pagamento_id: formaPagamentoId
      })
      .eq("empresa_id", state.empresaId)
      .eq("id", item.parcelaId);
  });

  const resultadosParcelas = await Promise.all(atualizacoesParcelas);
  for (const resultado of resultadosParcelas) {
    if (resultado.error) throw resultado.error;
  }

  const observacaoBase = [
    observacoes || null,
    juros > 0 ? `Juros ${moeda.format(juros)}` : null,
    multa > 0 ? `Multa ${moeda.format(multa)}` : null,
    desconto > 0 ? `Desconto ${moeda.format(desconto)}` : null,
    restante > 0 ? `Valor excedente nao alocado ${moeda.format(restante)}` : null
  ]
    .filter(Boolean)
    .join(" • ");

  const recebimentosPayload = applied.map((item) => ({
    empresa_id: state.empresaId,
    parcela_id: item.parcelaId,
    data_recebimento: new Date(`${dataRecebimento}T12:00:00`).toISOString(),
    valor: Number(item.valor.toFixed(2)),
    forma_pagamento_id: formaPagamentoId,
    observacoes:
      (parcelaIdTarget ? "Recebimento direcionado" : "Recebimento por abatimento automatico") +
      (observacaoBase ? ` • ${observacaoBase}` : "")
  }));

  const { error: recebimentoError } = await supabaseClient.from("recebimentos").insert(recebimentosPayload);
  if (recebimentoError) throw recebimentoError;

  const parcelasAtualizadas = Array.from(parcelasMap.values());
  const totalPrevisto = parcelasAtualizadas.reduce((sum, item) => sum + Number(item.valor_parcela || 0), 0);
  const totalRecebido = parcelasAtualizadas.reduce((sum, item) => sum + Number(item.valor_recebido || 0), 0);
  const novoValorAberto = Math.max(0, Number((totalPrevisto - totalRecebido).toFixed(2)));
  const novoStatusConta = resolveContaStatusByParcelas(parcelasAtualizadas);

  const { error: contaError } = await supabaseClient
    .from("contas_receber")
    .update({
      valor_aberto: novoValorAberto,
      status: novoStatusConta
    })
    .eq("empresa_id", state.empresaId)
    .eq("id", contaId);

  if (contaError) throw contaError;

  await refreshAll();
  await openRecebimentoModalByConta(contaId);
  showToast("Recebimento registrado");
}

async function createDocumentoFinanceiro(documentoId, clienteId, pagamentoState, total) {
  if (Number(total || 0) <= 0) return;

  const existenteResponse = await supabaseClient
    .from("contas_receber")
    .select("id")
    .eq("empresa_id", state.empresaId)
    .eq("documento_id", documentoId)
    .limit(1);

  if (existenteResponse.error) throw existenteResponse.error;
  if (existenteResponse.data?.length) return;

  const formaPagamentoId = pagamentoState.formaPagamentoId ? Number(pagamentoState.formaPagamentoId) : null;

  async function createContaComPlano(planoConta, numeroTituloSuffix = "") {
    const numeroTitulo = numeroTituloSuffix ? `DOC-${documentoId}-${numeroTituloSuffix}` : `DOC-${documentoId}`;

    const { data: contaCriada, error: contaError } = await supabaseClient
      .from("contas_receber")
      .insert({
        empresa_id: state.empresaId,
        documento_id: documentoId,
        cliente_id: clienteId,
        origem: "venda",
        numero_titulo: numeroTitulo,
        emissao: new Date().toISOString(),
        valor_original: centsToDbValue(planoConta.valorOriginal),
        valor_aberto: centsToDbValue(planoConta.valorAberto),
        status: planoConta.statusConta,
        observacoes: getFormaPagamentoNome(formaPagamentoId) || null
      })
      .select("id")
      .single();

    if (contaError) throw contaError;

    const parcelasPayload = planoConta.parcelas.map((parcela) => ({
      empresa_id: state.empresaId,
      conta_receber_id: contaCriada.id,
      numero_parcela: parcela.numero,
      vencimento: parcela.vencimento.toISOString(),
      valor_parcela: centsToDbValue(parcela.valor),
      valor_recebido: centsToDbValue(parcela.valorRecebido || 0),
      status: parcela.status,
      forma_pagamento_id: formaPagamentoId,
      observacoes: parcela.status === "recebido" ? "Recebido na criacao do pedido" : null
    }));

    const { data: parcelasCriadas, error: parcelasError } = await supabaseClient
      .from("contas_receber_parcelas")
      .insert(parcelasPayload)
      .select("id, numero_parcela");

    if (parcelasError) throw parcelasError;

    const recebimentosPayload = (planoConta.recebimentos || [])
      .map((recebimento) => {
        const parcela = parcelasCriadas?.find((item) => Number(item.numero_parcela) === Number(recebimento.numeroParcela));
        if (!parcela) return null;
        return {
          empresa_id: state.empresaId,
          parcela_id: parcela.id,
          data_recebimento: recebimento.dataRecebimento.toISOString(),
          valor: centsToDbValue(recebimento.valor),
          forma_pagamento_id: recebimento.formaPagamentoId,
          observacoes: "Lancado automaticamente pelo pedido"
        };
      })
      .filter(Boolean);

    if (recebimentosPayload.length) {
      const { error: recebimentoError } = await supabaseClient.from("recebimentos").insert(recebimentosPayload);
      if (recebimentoError) throw recebimentoError;
    }
  }

  const totalCents = Math.max(0, Math.round(Number(total || 0) * 100));
  const modo = pagamentoState.modo || "avista";

  if (modo === "entrada_parcelas") {
    const entradaCents = Math.max(0, Math.min(totalCents, Math.round(Number(pagamentoState.entrada || 0) * 100)));
    const restanteCents = Math.max(0, totalCents - entradaCents);
    const parcelaCount = Math.max(1, Number(pagamentoState.parcelas || 1));
    const intervaloDias = Math.max(1, Number(pagamentoState.intervaloDias || 30));
    const vencimentoBase = parseDateInput(pagamentoState.vencimentoPrimeiraParcela) || addDays(new Date(), intervaloDias);

    if (entradaCents > 0 && restanteCents > 0) {
      const hoje = new Date();
      const entradaPlano = {
        valorOriginal: entradaCents,
        valorAberto: 0,
        statusConta: "recebido",
        parcelas: [
          {
            numero: 1,
            vencimento: hoje,
            valor: entradaCents,
            status: "recebido",
            valorRecebido: entradaCents
          }
        ],
        recebimentos: [
          {
            numeroParcela: 1,
            valor: entradaCents,
            dataRecebimento: hoje,
            formaPagamentoId
          }
        ]
      };

      const parts = splitAmountIntoParts(restanteCents, parcelaCount);
      await createContaComPlano(entradaPlano, "E");

      for (let index = 0; index < parts.length; index += 1) {
        const partCents = parts[index];
        const parcelaNumero = index + 1;
        const parcelaPlano = {
          valorOriginal: partCents,
          valorAberto: partCents,
          statusConta: partCents > 0 ? "aberto" : "cancelado",
          parcelas: [
            {
              numero: 1,
              vencimento: addDays(vencimentoBase, intervaloDias * index),
              valor: partCents,
              status: partCents > 0 ? "pendente" : "cancelado",
              valorRecebido: 0
            }
          ],
          recebimentos: []
        };

        await createContaComPlano(parcelaPlano, `P${parcelaNumero}`);
      }
      return;
    }
  }

  const plano = buildPagamentoPlano(total, pagamentoState);
  await createContaComPlano(
    {
      valorOriginal: plano.valorOriginal,
      valorAberto: plano.valorAberto,
      statusConta: plano.statusConta,
      parcelas: plano.parcelas,
      recebimentos: plano.recebimentos
    },
    ""
  );
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

function renderNovoDocumentoFormaPagamentoSelect() {
  if (!els.novoDocumentoPagamentoForma) return;
  const selectedId = String(getNovoDocumentoPagamentoState().formaPagamentoId || "");
  const options = ['<option value="">Selecione a forma</option>'];
  for (const forma of state.formasPagamento) {
    const selected = String(forma.id) === selectedId ? " selected" : "";
    options.push(`<option value="${forma.id}"${selected}>${escapeHtml(forma.nome)}</option>`);
  }
  els.novoDocumentoPagamentoForma.innerHTML = options.join("");
  els.novoDocumentoPagamentoForma.value = selectedId;
}

function renderNovoDocumentoItemRow(item) {
  const produto = state.produtos.find((produtoItem) => String(produtoItem.id) === String(item.produtoId));
  const rowTotal = getNovoDocumentoItemTotal(item);
  return `
    <article class="documento-item-row" data-documento-item-row="${item.rowId}">
      <div class="documento-item-cell documento-item-cell--produto">
        ${renderNovoDocumentoProdutoCombo(item)}
      </div>
      <div class="documento-item-cell">
        <input data-documento-item-field="descricao" value="${escapeHtml(item.descricao || produto?.nome || "")}" placeholder="Descricao do item" />
      </div>
      <div class="documento-item-cell documento-item-cell--qty">
        <input data-documento-item-field="quantidade" type="number" min="0.001" step="0.001" value="${escapeHtml(item.quantidade ?? 1)}" />
      </div>
      <div class="documento-item-cell documento-item-cell--price">
        <input data-documento-item-field="valorUnitario" type="number" min="0" step="0.01" value="${escapeHtml(item.valorUnitario ?? 0)}" />
      </div>
      <div class="documento-item-total">
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

  if (state.novoDocumentoModal.tipo === "pedido") {
    renderNovoDocumentoPagamentoSection();
  }
}

function renderNovoDocumentoItensGrid() {
  if (!els.novoDocumentoItemsGrid) return;
  if (!state.novoDocumentoModal.itens.length) {
    state.novoDocumentoModal.itens = [createDocumentoDraftItem()];
  }

  const header = `
    <div class="documento-items-head-row">
      <span>Produto</span>
      <span>Descricao</span>
      <span>Qtd</span>
      <span>Valor unit.</span>
      <span>Total</span>
      <span></span>
    </div>
  `;

  els.novoDocumentoItemsGrid.innerHTML = header + state.novoDocumentoModal.itens.map((item) => renderNovoDocumentoItemRow(item)).join("");

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
  renderNovoDocumentoFormaPagamentoSelect();
  renderNovoDocumentoItensGrid();
  renderNovoDocumentoPagamentoSection();

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
  const { data: documento, error: documentoError } = await supabaseClient
    .from("documentos_venda")
    .select("id, cliente_id, status, observacoes, total, raw_payload")
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
    pagamento: {
      ...createPagamentoDraft(),
      ...(documento.raw_payload?.pagamento || {})
    },
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
  const pagamentoState = getNovoDocumentoPagamentoState();

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
      itens: itens.length,
      pagamento: pagamentoState
    },
    data_emissao: new Date().toISOString()
  };

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

  if (!isEdit) {
    try {
      await createDocumentoFinanceiro(documentoId, clienteId, pagamentoState, subtotal);
    } catch (financeError) {
      await supabaseClient.from("documento_venda_itens").delete().eq("empresa_id", state.empresaId).eq("documento_id", documentoId);
      await supabaseClient.from("documentos_venda").delete().eq("empresa_id", state.empresaId).eq("id", documentoId);
      throw financeError;
    }
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
    const colspan = state.itensDocumentoModalMode === "pedidos_produto" ? 7 : 4;
    const message = state.itensDocumentoModalMode === "pedidos_produto"
      ? "Nenhum pedido encontrado para este produto."
      : "Sem itens para este documento.";
    els.itensDocumentoTable.innerHTML = `<tr><td colspan="${colspan}">${message}</td></tr>`;
    return;
  }

  if (state.itensDocumentoModalMode === "pedidos_produto") {
    els.itensDocumentoTable.innerHTML = state.itensDocumento
      .map(
        (item) => `
        <tr>
          <td>${item.dataPedido ? new Date(item.dataPedido).toLocaleDateString("pt-BR") : "-"}</td>
          <td>${escapeHtml(item.clienteNome || "-")}</td>
          <td>${escapeHtml(item.status || "-")}</td>
          <td>${escapeHtml(formatPedidoProdutoQuantidade(item.quantidade))}</td>
          <td>${moeda.format(item.valorProduto || 0)}</td>
          <td>${moeda.format(item.pedidoValorTotal || 0)}</td>
          <td><button type="button" class="action-edit" data-open-pedido-produto-itens="${item.pedidoId}">Itens</button></td>
        </tr>
      `
      )
      .join("");
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
  state.itensDocumentoModalMode = "itens";
  renderItensDocumentoTableHead();
  let itens = [];
  let documentoTotal = null;
  let documentoData = null;
  let documentoTemItens = false;

  const { data, error } = await supabaseClient
    .from("documentos_venda")
    .select("id, total, observacoes, raw_payload")
    .eq("empresa_id", state.empresaId)
    .eq("id", documentoId)
    .maybeSingle();

  if (error) throw error;
  documentoData = data || null;
  documentoTotal = documentoData?.total ?? null;

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

  if (!documentoTemItens) {
    const fallbackItem = buildFallbackItemFromDocumento(documentoData);
    if (fallbackItem) {
      itens = [fallbackItem];
    }
  }

  state.itensDocumento = itens;
  if (els.itensDocumentoModalTitle) {
    const titulo = tipoDocumento === "pedido" ? "Itens do Pedido" : "Itens do Orcamento";
    els.itensDocumentoModalTitle.textContent = `${titulo} #${documentoId}`;
  }
  renderItensDocumentoTableHead();
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

function openChangePasswordModal() {
  if (!els.changePasswordModal) return;
  if (els.changePasswordForm) els.changePasswordForm.reset();
  els.changePasswordModal.classList.remove("hidden");
}

function closeChangePasswordModal() {
  if (!els.changePasswordModal) return;
  els.changePasswordModal.classList.add("hidden");
  if (els.changePasswordForm) els.changePasswordForm.reset();
}

async function changePassword(event) {
  event.preventDefault();
  if (!els.changePasswordForm) return;
  const formData = new FormData(els.changePasswordForm);
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("password_confirm") || "");

  if (password.length < 6) {
    throw new Error("A senha precisa ter ao menos 6 caracteres.");
  }
  if (password !== confirm) {
    throw new Error("A confirmacao nao confere com a nova senha.");
  }

  const { error } = await supabaseClient.auth.updateUser({ password });
  if (error) throw error;

  closeChangePasswordModal();
  showToast("Senha atualizada");
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

  if (catalogError) throw catalogError;

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
}

async function loadPedidos() {
  const docsResult = await fetchAllSupabaseRows(() => supabaseClient
    .from("documentos_venda")
    .select(
      "id, data_emissao, status, total, observacoes, raw_payload, cliente_legacy_id, cliente:clientes(id,nome)"
    )
    .eq("empresa_id", state.empresaId)
    .eq("tipo_documento", "pedido")
    .order("data_emissao", { ascending: false }));

  if (docsResult.error) throw docsResult.error;

  state.pedidosSource = "documentos_venda";
  state.pedidos = (docsResult.data || []).map((item) => ({
    id: item.id,
    data_pedido: item.data_emissao,
    status: item.status,
    valor_total: item.total,
    observacoes: item.observacoes || null,
    raw_payload: item.raw_payload || null,
    cliente: item.cliente,
    cliente_legacy_id: item.cliente_legacy_id
  }));
  await loadPedidosProdutos();
}

async function fetchAllSupabaseRows(queryFactory, batchSize = 1000) {
  const allRows = [];
  let start = 0;

  while (true) {
    const end = start + batchSize - 1;
    const { data, error } = await queryFactory().range(start, end);
    if (error) return { data: null, error };

    const rows = data || [];
    allRows.push(...rows);

    if (rows.length < batchSize) {
      return { data: allRows, error: null };
    }

    start += batchSize;
  }
}

async function loadPedidosProdutos() {
  if (!state.pedidos.length) {
    state.pedidosProdutosRaw = [];
    state.pedidosProdutos = [];
    return;
  }

  try {
    const pedidoMetaById = new Map(
      state.pedidos.map((pedido) => [
        Number(pedido.id),
        {
          id: Number(pedido.id),
          dataPedido: pedido.data_pedido || pedido.data_emissao || null,
          clienteNome: pedido.cliente?.nome || (pedido.cliente_legacy_id ? `Legacy #${pedido.cliente_legacy_id}` : "-"),
          status: pedido.status || "-",
          valorTotal: Number(pedido.valor_total || 0)
        }
      ])
    );

    const { data, error } = await fetchAllSupabaseRows(() => supabaseClient
      .from("documento_venda_itens")
      .select("documento_id, produto_id, descricao_item, quantidade, valor_unitario, valor_total")
      .eq("empresa_id", state.empresaId)
      .order("documento_id", { ascending: true }));

    if (error) throw error;

    const normalizedItems = normalizePedidoProdutoRows(data || [], {
      idField: "documento_id",
      totalField: "valor_total",
      metaById: pedidoMetaById
    });

    const pedidosComItens = new Set(normalizedItems.map((item) => Number(item.pedidoId)).filter(Number.isFinite));
    const fallbackRows = state.pedidos
      .filter((pedido) => !pedidosComItens.has(Number(pedido.id)))
      .map(buildFallbackItemFromPedidoMeta)
      .filter(Boolean);

    state.pedidosProdutosRaw = [...normalizedItems, ...fallbackRows];
    state.pedidosProdutos = getFilteredAndSortedPedidosProdutos();
  } catch (error) {
    console.warn("Falha ao carregar itens analiticos de pedidos; usando fallback do cabecalho.", error);
    state.pedidosProdutosRaw = buildFallbackPedidoProdutoRows(state.pedidos);
    state.pedidosProdutos = getFilteredAndSortedPedidosProdutos();
  }
}

function normalizePedidoProdutoRows(items, { idField, totalField, metaById }) {
  return items
    .map((item) => {
      const pedidoId = Number(item[idField]);
      const meta = metaById.get(pedidoId);
      if (!meta) return null;

      return {
        pedidoId,
        produto_id: item.produto_id == null ? null : String(item.produto_id),
        nome: String(item.descricao_item || item.nome_produto || item.produto?.nome || "").trim(),
        quantidade: Number(item.quantidade || 0),
        valorUnitario: Number(item.valor_unitario || 0),
        valorTotal: Number(item[totalField] ?? (Number(item.quantidade || 0) * Number(item.valor_unitario || 0))),
        dataPedido: meta.dataPedido,
        clienteNome: meta.clienteNome,
        status: meta.status,
        pedidoValorTotal: meta.valorTotal
      };
    })
    .filter(Boolean);
}

function buildFallbackItemFromPedidoMeta(pedido) {
  if (!pedido) return null;
  const fallback = buildFallbackItemFromDocumento({
    total: pedido.valor_total,
    observacoes: pedido.observacoes,
    raw_payload: pedido.raw_payload
  });

  if (!fallback) return null;

  return {
    pedidoId: Number(pedido.id),
    produto_id: null,
    nome: String(fallback.descricao_item || "Item consolidado do cabecalho").trim(),
    quantidade: Number(fallback.quantidade || 0),
    valorUnitario: Number(fallback.valor_unitario || 0),
    valorTotal: Number(fallback.valor_total || 0),
    dataPedido: pedido.data_pedido || pedido.data_emissao || null,
    clienteNome: pedido.cliente?.nome || (pedido.cliente_legacy_id ? `Legacy #${pedido.cliente_legacy_id}` : "-"),
    status: pedido.status || "-",
    pedidoValorTotal: Number(pedido.valor_total || 0)
  };
}

function buildFallbackPedidoProdutoRows(pedidos) {
  return (pedidos || []).map(buildFallbackItemFromPedidoMeta).filter(Boolean);
}

async function loadMissingPedidoProdutoRows(missingPedidos, metaById) {
  if (!missingPedidos.length) return [];

  const fallbackRows = [];

  for (const pedido of missingPedidos) {
    const pedidoId = Number(pedido.id);
    if (!Number.isFinite(pedidoId)) continue;

    const { data, error } = await supabaseClient
      .from("documento_venda_itens")
      .select("documento_id, produto_id, descricao_item, quantidade, valor_unitario, valor_total")
      .eq("empresa_id", state.empresaId)
      .eq("documento_id", pedidoId)
      .order("id", { ascending: true });

    if (error) {
      const fallbackItem = buildFallbackItemFromPedidoMeta(pedido);
      if (fallbackItem) fallbackRows.push(fallbackItem);
      continue;
    }

    const normalized = normalizePedidoProdutoRows(data || [], {
      idField: "documento_id",
      totalField: "valor_total",
      metaById
    });

    if (normalized.length) {
      fallbackRows.push(...normalized);
      continue;
    }

    const fallbackItem = buildFallbackItemFromPedidoMeta(pedido);
    if (fallbackItem) {
      fallbackRows.push(fallbackItem);
    }
  }

  return fallbackRows;
}

function aggregatePedidoItemsByProduto(items) {
  const grouped = new Map();

  for (const item of items) {
    const produtoId = item.produto_id == null ? "" : String(item.produto_id);
    const descricaoBase = String(item.nome || "").trim();
    const groupKey = produtoId ? `produto:${produtoId}` : `descricao:${descricaoBase.toLowerCase()}`;
    const quantidade = Number(item.quantidade || 0);
    const valorTotal = Number(item.valorTotal || 0);
    const pedidoId = Number(item.pedidoId);
    const dataPedido = item.dataPedido || null;

    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        groupKey,
        produto_id: produtoId || null,
        nome: descricaoBase,
        quantidade: 0,
        total: 0,
        pedidos: new Set(),
        pedidosDetalhes: new Map(),
        ultimaVenda: null
      });
    }

    const aggregate = grouped.get(groupKey);
    aggregate.quantidade += quantidade;
    aggregate.total += valorTotal;
    if (Number.isFinite(pedidoId)) {
      aggregate.pedidos.add(pedidoId);
      if (!aggregate.pedidosDetalhes.has(pedidoId)) {
        aggregate.pedidosDetalhes.set(pedidoId, {
          pedidoId,
          dataPedido,
          clienteNome: item.clienteNome || "-",
          status: item.status || "-",
          pedidoValorTotal: Number(item.pedidoValorTotal || 0),
          quantidade: 0,
          valorProduto: 0
        });
      }

      const pedidoDetalhe = aggregate.pedidosDetalhes.get(pedidoId);
      pedidoDetalhe.quantidade += quantidade;
      pedidoDetalhe.valorProduto += valorTotal;
    }

    if (dataPedido) {
      const currentDate = aggregate.ultimaVenda ? new Date(aggregate.ultimaVenda) : null;
      const nextDate = new Date(dataPedido);
      if (!currentDate || nextDate > currentDate) {
        aggregate.ultimaVenda = dataPedido;
      }
    }
  }

  return Array.from(grouped.values())
    .map((item) => ({
      ...item,
      pedidos: item.pedidos.size,
      pedidosDetalhes: Array.from(item.pedidosDetalhes.values()).sort(sortPedidosDetalhesByDateDesc)
    }));
}

function resolvePedidoProdutoNome(item) {
  const nome = String(item?.nome || "").trim();
  if (nome) return nome;

  if (item?.produto_id) {
    const produto = state.produtos.find((entry) => String(entry.id) === String(item.produto_id));
    if (produto?.nome) {
      return produto.nome;
    }
  }

  return "Produto sem nome";
}

function getFilteredPedidoProdutoRows() {
  const { startDate, endDate } = state.pedidosProdutosFilters;
  const startTime = startDate ? new Date(`${startDate}T00:00:00`).getTime() : null;
  const endTime = endDate ? new Date(`${endDate}T23:59:59`).getTime() : null;

  return state.pedidosProdutosRaw.filter((item) => {
    if (!startTime && !endTime) return true;
    if (!item.dataPedido) return false;
    const itemTime = new Date(item.dataPedido).getTime();
    if (Number.isNaN(itemTime)) return false;
    if (startTime && itemTime < startTime) return false;
    if (endTime && itemTime > endTime) return false;
    return true;
  });
}

function getFilteredAndSortedPedidosProdutos() {
  const grouped = aggregatePedidoItemsByProduto(getFilteredPedidoProdutoRows());
  return getFilteredAndSortedTableRows(grouped, "pedidosProdutos", {
    produto: (item) => resolvePedidoProdutoNome(item),
    quantidade: {
      filter: (item) => formatPedidoProdutoQuantidade(item.quantidade),
      sort: (item) => Number(item.quantidade || 0)
    },
    pedidos: {
      filter: (item) => String(item.pedidos || 0),
      sort: (item) => Number(item.pedidos || 0)
    },
    total: {
      filter: (item) => moeda.format(item.total || 0),
      sort: (item) => Number(item.total || 0)
    },
    ultimaVenda: {
      filter: (item) => item.ultimaVenda ? new Date(item.ultimaVenda).toLocaleDateString("pt-BR") : "-",
      sort: (item) => item.ultimaVenda ? new Date(item.ultimaVenda).getTime() : 0
    }
  });
}

function setPedidosProdutosSort(field) {
  setTableSort("pedidosProdutos", field === "nome" ? "produto" : field);
}

function renderItensDocumentoTableHead() {
  if (!els.itensDocumentoTableHead) return;

  if (state.itensDocumentoModalMode === "pedidos_produto") {
    els.itensDocumentoTableHead.innerHTML = `
      <tr>
        <th>Data</th>
        <th>Cliente</th>
        <th>Status</th>
        <th>Qtd.</th>
        <th>Total do produto</th>
        <th>Total do pedido</th>
        <th></th>
      </tr>
    `;
    return;
  }

  els.itensDocumentoTableHead.innerHTML = `
    <tr>
      <th>Item</th>
      <th>Qtd</th>
      <th>Vlr Unit.</th>
      <th>Total</th>
    </tr>
  `;
}

function updatePedidosProdutosFiltersVisibility() {
  if (!els.pedidosProdutosFilters) return;
  els.pedidosProdutosFilters.classList.toggle("hidden", state.pedidosView !== "produtos");
}

function updatePedidosProdutosSortHeaders() {
  if (!els.pedidosTableHead || state.pedidosView !== "produtos") return;
  updateTableSortHeaders("pedidosProdutos");
}

function normalizeDateForInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function updatePedidosProdutosFilterInputs() {
  if (els.pedidosProdutosStartDate) {
    const normalized = normalizeDateForInput(state.pedidosProdutosFilters.startDate);
    if (els.pedidosProdutosStartDate.value !== normalized) {
      els.pedidosProdutosStartDate.value = normalized;
    }
  }

  if (els.pedidosProdutosEndDate) {
    const normalized = normalizeDateForInput(state.pedidosProdutosFilters.endDate);
    if (els.pedidosProdutosEndDate.value !== normalized) {
      els.pedidosProdutosEndDate.value = normalized;
    }
  }
}

function maybeSwapPedidosProdutosDateRange() {
  const { startDate, endDate } = state.pedidosProdutosFilters;
  if (!startDate || !endDate) return;
  if (new Date(`${startDate}T00:00:00`).getTime() <= new Date(`${endDate}T00:00:00`).getTime()) return;

  state.pedidosProdutosFilters = {
    startDate: endDate,
    endDate: startDate
  };
}

function updatePedidosProdutosFilter(field, value) {
  state.pedidosProdutosFilters[field] = value || "";
  renderPedidosSection();
}

function sortPedidosDetalhesByDateDesc(a, b) {
  const aTime = a.dataPedido ? new Date(a.dataPedido).getTime() : 0;
  const bTime = b.dataPedido ? new Date(b.dataPedido).getTime() : 0;
  return bTime - aTime;
}

function formatPedidoProdutoQuantidade(value) {
  const quantidade = Number(value || 0);
  return Number.isInteger(quantidade)
    ? String(quantidade)
    : quantidade.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

function getPedidosProdutoFilterSummary() {
  const { startDate, endDate } = state.pedidosProdutosFilters;
  if (startDate && endDate) {
    return `Periodo de ${new Date(`${startDate}T00:00:00`).toLocaleDateString("pt-BR")} ate ${new Date(`${endDate}T00:00:00`).toLocaleDateString("pt-BR")}.`;
  }
  if (startDate) {
    return `Periodo a partir de ${new Date(`${startDate}T00:00:00`).toLocaleDateString("pt-BR")}.`;
  }
  if (endDate) {
    return `Periodo ate ${new Date(`${endDate}T00:00:00`).toLocaleDateString("pt-BR")}.`;
  }
  return "Todos os pedidos carregados entram no consolidado por produto.";
}

function getPedidosProdutoEmptyMessage() {
  return state.pedidosProdutosFilters.startDate || state.pedidosProdutosFilters.endDate
    ? "Nenhum item vendido encontrado no periodo informado."
    : "Nenhum item vendido encontrado nos pedidos.";
}

function getPedidosAnaliticosRows() {
  return getFilteredAndSortedTableRows(state.pedidosProdutosRaw || [], "pedidosAnalitico", {
    pedido: {
      filter: (item) => `#${item.pedidoId || ""}`,
      sort: (item) => Number(item.pedidoId || 0)
    },
    data: {
      filter: (item) => item.dataPedido ? new Date(item.dataPedido).toLocaleDateString("pt-BR") : "-",
      sort: (item) => item.dataPedido ? new Date(item.dataPedido).getTime() : 0
    },
    cliente: (item) => item.clienteNome || "-",
    produto: (item) => resolvePedidoProdutoNome(item),
    quantidade: {
      filter: (item) => formatPedidoProdutoQuantidade(item.quantidade),
      sort: (item) => Number(item.quantidade || 0)
    },
    valor: {
      filter: (item) => moeda.format(item.valorTotal || 0),
      sort: (item) => Number(item.valorTotal || 0)
    }
  });
}

function openPedidosProdutoDetalhes(groupKey) {
  const produto = state.pedidosProdutos.find((item) => item.groupKey === groupKey);
  if (!produto) return;

  state.itensDocumentoModalMode = "pedidos_produto";
  state.itensDocumento = produto.pedidosDetalhes;
  renderItensDocumentoTableHead();
  renderItensDocumentoTable();
  if (els.itensDocumentoModalTitle) {
    els.itensDocumentoModalTitle.textContent = `Pedidos com ${resolvePedidoProdutoNome(produto)}`;
  }
  openItensDocumentoModal();
}

function escapeAttribute(value) {
  return escapeHtml(String(value || ""));
}

function renderPedidosProdutosRows() {
  if (!state.pedidosProdutos.length) {
    els.pedidosTable.innerHTML = `<tr><td colspan="5">${getPedidosProdutoEmptyMessage()}</td></tr>`;
    return;
  }

  els.pedidosTable.innerHTML = state.pedidosProdutos
    .map((item) => {
      const ultimaVenda = item.ultimaVenda ? new Date(item.ultimaVenda).toLocaleDateString("pt-BR") : "-";
      return `
        <tr>
          <td><button type="button" class="action-link" data-open-pedidos-produto="${escapeAttribute(item.groupKey)}">${escapeHtml(resolvePedidoProdutoNome(item))}</button></td>
          <td>${escapeHtml(formatPedidoProdutoQuantidade(item.quantidade))}</td>
          <td>${escapeHtml(item.pedidos)}</td>
          <td>${moeda.format(item.total || 0)}</td>
          <td>${ultimaVenda}</td>
        </tr>
      `;
    })
    .join("");
}

function renderPedidosTableHead() {
  if (!els.pedidosTableHead) return;

  if (state.pedidosView === "produtos") {
    els.pedidosTableHead.innerHTML = `
      <tr>
        <th class="sortable" data-table="pedidosProdutos" data-sort="produto">Produto</th>
        <th class="sortable" data-table="pedidosProdutos" data-sort="quantidade">Qtd. vendida</th>
        <th class="sortable" data-table="pedidosProdutos" data-sort="pedidos">Pedidos</th>
        <th class="sortable" data-table="pedidosProdutos" data-sort="total">Valor vendido</th>
        <th class="sortable" data-table="pedidosProdutos" data-sort="ultimaVenda">Ultima venda</th>
      </tr>
      <tr>
        <th><input data-table-filter="pedidosProdutos" data-field="produto" value="${getTableFilterValue("pedidosProdutos", "produto")}" placeholder="Filtrar" /></th>
        <th><input data-table-filter="pedidosProdutos" data-field="quantidade" value="${getTableFilterValue("pedidosProdutos", "quantidade")}" placeholder="Filtrar" /></th>
        <th><input data-table-filter="pedidosProdutos" data-field="pedidos" value="${getTableFilterValue("pedidosProdutos", "pedidos")}" placeholder="Filtrar" /></th>
        <th><input data-table-filter="pedidosProdutos" data-field="total" value="${getTableFilterValue("pedidosProdutos", "total")}" placeholder="Filtrar" /></th>
        <th><input data-table-filter="pedidosProdutos" data-field="ultimaVenda" value="${getTableFilterValue("pedidosProdutos", "ultimaVenda")}" placeholder="Filtrar" /></th>
      </tr>
    `;
    return;
  }

  if (state.pedidosListMode === "analitico") {
    els.pedidosTableHead.innerHTML = `
      <tr>
        <th class="sortable" data-table="pedidosAnalitico" data-sort="pedido">Pedido</th>
        <th class="sortable" data-table="pedidosAnalitico" data-sort="data">Data</th>
        <th class="sortable" data-table="pedidosAnalitico" data-sort="cliente">Cliente</th>
        <th class="sortable" data-table="pedidosAnalitico" data-sort="produto">Produto</th>
        <th class="sortable" data-table="pedidosAnalitico" data-sort="quantidade">Quantidade</th>
        <th class="sortable" data-table="pedidosAnalitico" data-sort="valor">Valor</th>
      </tr>
      <tr>
        <th><input data-table-filter="pedidosAnalitico" data-field="pedido" value="${getTableFilterValue("pedidosAnalitico", "pedido")}" placeholder="Filtrar" /></th>
        <th><input data-table-filter="pedidosAnalitico" data-field="data" value="${getTableFilterValue("pedidosAnalitico", "data")}" placeholder="Filtrar" /></th>
        <th><input data-table-filter="pedidosAnalitico" data-field="cliente" value="${getTableFilterValue("pedidosAnalitico", "cliente")}" placeholder="Filtrar" /></th>
        <th><input data-table-filter="pedidosAnalitico" data-field="produto" value="${getTableFilterValue("pedidosAnalitico", "produto")}" placeholder="Filtrar" /></th>
        <th><input data-table-filter="pedidosAnalitico" data-field="quantidade" value="${getTableFilterValue("pedidosAnalitico", "quantidade")}" placeholder="Filtrar" /></th>
        <th><input data-table-filter="pedidosAnalitico" data-field="valor" value="${getTableFilterValue("pedidosAnalitico", "valor")}" placeholder="Filtrar" /></th>
      </tr>
    `;
    return;
  }

  els.pedidosTableHead.innerHTML = `
    <tr>
      <th class="sortable" data-table="pedidosSintetico" data-sort="pedido">Pedido</th>
      <th class="sortable" data-table="pedidosSintetico" data-sort="data">Data</th>
      <th class="sortable" data-table="pedidosSintetico" data-sort="cliente">Cliente</th>
      <th class="sortable" data-table="pedidosSintetico" data-sort="status">Status</th>
      <th class="sortable" data-table="pedidosSintetico" data-sort="total">Total</th>
      <th></th>
    </tr>
    <tr>
      <th><input data-table-filter="pedidosSintetico" data-field="pedido" value="${getTableFilterValue("pedidosSintetico", "pedido")}" placeholder="Filtrar" /></th>
      <th><input data-table-filter="pedidosSintetico" data-field="data" value="${getTableFilterValue("pedidosSintetico", "data")}" placeholder="Filtrar" /></th>
      <th><input data-table-filter="pedidosSintetico" data-field="cliente" value="${getTableFilterValue("pedidosSintetico", "cliente")}" placeholder="Filtrar" /></th>
      <th><input data-table-filter="pedidosSintetico" data-field="status" value="${getTableFilterValue("pedidosSintetico", "status")}" placeholder="Filtrar" /></th>
      <th><input data-table-filter="pedidosSintetico" data-field="total" value="${getTableFilterValue("pedidosSintetico", "total")}" placeholder="Filtrar" /></th>
      <th></th>
    </tr>
  `;
}

function renderPedidosSection() {
  maybeSwapPedidosProdutosDateRange();
  if (state.pedidosView === "produtos") {
    state.pedidosProdutos = getFilteredAndSortedPedidosProdutos();
  }
  renderPedidosTableHead();
  renderPedidosTable();
  updateTableSortHeaders(state.pedidosView === "produtos" ? "pedidosProdutos" : (state.pedidosListMode === "analitico" ? "pedidosAnalitico" : "pedidosSintetico"));
  updatePedidosProdutosFiltersVisibility();
  updatePedidosProdutosFilterInputs();

  if (els.pedidosSectionSubtitle) {
    if (state.pedidosView === "produtos") {
      els.pedidosSectionSubtitle.textContent = `Veja o consolidado por produto com quantidade, valor vendido e ultima movimentacao. ${getPedidosProdutoFilterSummary()}`;
    } else if (state.pedidosListMode === "analitico") {
      els.pedidosSectionSubtitle.textContent = "Veja cada item vendido por pedido com cliente, produto, quantidade e valor.";
    } else {
      els.pedidosSectionSubtitle.textContent = "Crie pedidos e orcamentos com itens em grade, subtotal automatico e salvamento mais claro.";
    }
  }

  for (const button of els.pedidosViewButtons || []) {
    button.classList.toggle("active", button.getAttribute("data-pedidos-view") === state.pedidosView);
  }

  for (const button of els.pedidosListModeButtons || []) {
    button.classList.toggle("active", button.getAttribute("data-pedidos-list-mode") === state.pedidosListMode);
  }

  if (els.pedidosListModeToggle) {
    els.pedidosListModeToggle.classList.toggle("hidden", state.pedidosView !== "pedidos");
  }
}

async function loadOrcamentos() {
  const { data: docsData, error: docsError } = await fetchAllSupabaseRows(() => supabaseClient
    .from("documentos_venda")
    .select(
      "id, data_emissao, status, total, cliente_legacy_id, cliente:clientes(id,nome)"
    )
    .eq("empresa_id", state.empresaId)
    .eq("tipo_documento", "orcamento")
    .order("data_emissao", { ascending: false }));

  if (docsError) throw docsError;

  state.orcamentosSource = "documentos_venda";
  state.orcamentos = (docsData || []).map((item) => ({
    id: item.id,
    data_orcamento: item.data_emissao,
    status: item.status,
    valor_total: item.total,
    cliente: item.cliente,
    cliente_legacy_id: item.cliente_legacy_id
  }));
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
  const rows = getFilteredAndSortedTableRows(state.adminVinculos, "adminVinculos", {
    empresa: (item) => item.empresas?.nome || "-",
    empresa_id: (item) => item.empresa_id || "-",
    user_id: (item) => item.user_id || "-",
    role: (item) => item.role || "user",
    ativo: {
      filter: (item) => item.ativo ? "sim" : "nao",
      sort: (item) => item.ativo ? 1 : 0
    }
  });

  if (!rows.length) {
    els.adminVinculosTable.innerHTML = '<tr><td colspan="5">Nenhum vinculo encontrado para os filtros selecionados.</td></tr>';
    updateTableSortHeaders("adminVinculos");
    return;
  }

  els.adminVinculosTable.innerHTML = rows
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
  updateTableSortHeaders("adminVinculos");
}

function renderOwnerUsersTable() {
  if (!els.ownerUsersTable) return;
  const rows = getFilteredAndSortedTableRows(state.ownerUsers, "usuarios", {
    user_id: (item) => item.user_id || "-",
    role: (item) => item.role || "user",
    ativo: {
      filter: (item) => item.ativo ? "sim" : "nao",
      sort: (item) => item.ativo ? 1 : 0
    }
  });

  if (!rows.length) {
    els.ownerUsersTable.innerHTML = '<tr><td colspan="3">Nenhum usuario encontrado para os filtros selecionados.</td></tr>';
    updateTableSortHeaders("usuarios");
    return;
  }

  els.ownerUsersTable.innerHTML = rows
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
  updateTableSortHeaders("usuarios");
}

function renderClientesTable() {
  const rows = getFilteredAndSortedTableRows(state.clientes, "clientes", {
    nome: (item) => item.nome || "-",
    telefone: (item) => item.telefone || "-",
    email: (item) => item.email || "-"
  });

  if (!rows.length) {
    els.clientesTable.innerHTML = '<tr><td colspan="4">Nenhum cliente encontrado para os filtros selecionados.</td></tr>';
    updateTableSortHeaders("clientes");
    return;
  }

  els.clientesTable.innerHTML = rows
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
  updateTableSortHeaders("clientes");
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

function getTableViewConfig(tableKey) {
  return state.tableViews?.[tableKey] || null;
}

function getTableAccessorValue(row, accessors, field, mode = "filter") {
  const accessor = accessors[field];
  if (typeof accessor === "function") {
    return accessor(row);
  }

  if (accessor && typeof accessor === "object") {
    const resolver = accessor[mode] || accessor.filter || accessor.sort;
    if (typeof resolver === "function") {
      return resolver(row);
    }
  }

  const value = row?.[field];
  return value == null ? "" : value;
}

function getFilteredAndSortedTableRows(rows, tableKey, accessors) {
  const view = getTableViewConfig(tableKey);
  if (!view) return [...rows];

  const filtered = rows.filter((row) => {
    return Object.entries(view.filters || {}).every(([field, filterValue]) => {
      const needle = String(filterValue || "").trim().toLowerCase();
      if (!needle) return true;
      const haystack = String(getTableAccessorValue(row, accessors, field, "filter") || "").toLowerCase();
      return haystack.includes(needle);
    });
  });

  const { field, direction } = view.sort || {};
  const factor = direction === "asc" ? 1 : -1;

  filtered.sort((a, b) => {
    const av = getTableAccessorValue(a, accessors, field, "sort");
    const bv = getTableAccessorValue(b, accessors, field, "sort");

    const aNum = Number(av);
    const bNum = Number(bv);
    const bothNumbers = Number.isFinite(aNum) && Number.isFinite(bNum);

    if (bothNumbers) {
      return (aNum - bNum) * factor;
    }

    const aText = String(av == null ? "" : av).toLowerCase();
    const bText = String(bv == null ? "" : bv).toLowerCase();
    return aText.localeCompare(bText, "pt-BR") * factor;
  });

  return filtered;
}

function updateTableSortHeaders(tableKey) {
  const view = getTableViewConfig(tableKey);
  if (!view) return;

  const headers = Array.from(document.querySelectorAll(`th.sortable[data-table="${tableKey}"][data-sort]`));
  for (const th of headers) {
    const field = th.getAttribute("data-sort") || "";
    const baseLabel = th.getAttribute("data-label") || th.textContent || "";

    if (!th.getAttribute("data-label")) {
      th.setAttribute("data-label", baseLabel.trim());
    }

    if (field === view.sort?.field) {
      const marker = view.sort.direction === "asc" ? " ▲" : " ▼";
      th.textContent = `${th.getAttribute("data-label")}${marker}`;
      th.classList.add("sorted");
    } else {
      th.textContent = th.getAttribute("data-label") || "";
      th.classList.remove("sorted");
    }
  }
}

function setTableSort(tableKey, field) {
  const view = getTableViewConfig(tableKey);
  if (!view) return;

  if (view.sort.field === field) {
    view.sort.direction = view.sort.direction === "asc" ? "desc" : "asc";
  } else {
    view.sort.field = field;
    view.sort.direction = field === "nome" || field === "cliente" || field === "produto" || field === "empresa" || field === "user_id"
      ? "asc"
      : "desc";
  }

  rerenderTableView(tableKey);
}

function rerenderTableView(tableKey) {
  if (tableKey === "clientes") {
    renderClientesTable();
    return;
  }
  if (tableKey === "pedidosSintetico" || tableKey === "pedidosAnalitico" || tableKey === "pedidosProdutos") {
    renderPedidosSection();
    return;
  }
  if (tableKey === "financeiro") {
    renderContasReceberTable();
    return;
  }
  if (tableKey === "orcamentos") {
    renderOrcamentosTable();
    return;
  }
  if (tableKey === "despesas") {
    renderDespesasTable();
    return;
  }
  if (tableKey === "usuarios") {
    renderOwnerUsersTable();
    return;
  }
  if (tableKey === "adminVinculos") {
    renderAdminVinculosTable();
  }
}

function getTableFilterValue(tableKey, field) {
  return escapeHtml(getTableViewConfig(tableKey)?.filters?.[field] || "");
}

function renderPedidosTable() {
  if (state.pedidosView === "produtos") {
    renderPedidosProdutosRows();
    return;
  }

  if (state.pedidosListMode === "analitico") {
    const rows = getPedidosAnaliticosRows();
    if (!rows.length) {
      els.pedidosTable.innerHTML = '<tr><td colspan="6">Nenhum item analitico encontrado nos pedidos.</td></tr>';
      return;
    }

    els.pedidosTable.innerHTML = rows
      .map((item) => {
        const data = item.dataPedido ? new Date(item.dataPedido).toLocaleDateString("pt-BR") : "-";
        return `
        <tr>
          <td><button type="button" class="action-link" data-view-pedido-itens="${item.pedidoId}">#${escapeHtml(item.pedidoId)}</button></td>
          <td>${data}</td>
          <td>${escapeHtml(item.clienteNome || "-")}</td>
          <td>${escapeHtml(resolvePedidoProdutoNome(item))}</td>
          <td>${escapeHtml(formatPedidoProdutoQuantidade(item.quantidade))}</td>
          <td>${moeda.format(item.valorTotal || 0)}</td>
        </tr>
      `;
      })
      .join("");
    return;
  }

  const rows = getFilteredAndSortedTableRows(state.pedidos, "pedidosSintetico", {
    pedido: {
      filter: (pedido) => `#${pedido.id || ""}`,
      sort: (pedido) => Number(pedido.id || 0)
    },
    data: {
      filter: (pedido) => pedido.data_pedido ? new Date(pedido.data_pedido).toLocaleDateString("pt-BR") : "-",
      sort: (pedido) => pedido.data_pedido ? new Date(pedido.data_pedido).getTime() : 0
    },
    cliente: (pedido) => pedido.cliente?.nome || (pedido.cliente_legacy_id ? `Legacy #${pedido.cliente_legacy_id}` : "-"),
    status: (pedido) => pedido.status || "-",
    total: {
      filter: (pedido) => moeda.format(pedido.valor_total || 0),
      sort: (pedido) => Number(pedido.valor_total || 0)
    }
  });

  if (!rows.length) {
    els.pedidosTable.innerHTML = '<tr><td colspan="6">Nenhum pedido encontrado para os filtros selecionados.</td></tr>';
    return;
  }

  els.pedidosTable.innerHTML = rows
    .map((pedido) => {
      const data = pedido.data_pedido ? new Date(pedido.data_pedido).toLocaleDateString("pt-BR") : "-";
      const clienteNome = pedido.cliente?.nome || (pedido.cliente_legacy_id ? `Legacy #${escapeHtml(pedido.cliente_legacy_id)}` : "-");
      return `
      <tr>
        <td>#${escapeHtml(pedido.id)}</td>
        <td>${data}</td>
        <td>${clienteNome}</td>
        <td>${escapeHtml(pedido.status || "-")}</td>
        <td>${moeda.format(pedido.valor_total || 0)}</td>
        <td>
          <button class="action-edit" data-edit-pedido="${pedido.id}">Editar</button>
          <button class="action-finance" data-open-recebimento-pedido="${pedido.id}">Receber</button>
          <button class="action-edit" data-view-pedido-itens="${pedido.id}">Itens</button>
          <button class="action-delete" data-del-pedido="${pedido.id}">Excluir</button>
        </td>
      </tr>
    `;
    })
    .join("");
}

function renderContasReceberTable() {
  if (!els.contasReceberTable) return;

  const search = String(els.financeiroSearchInput?.value || "").trim().toLowerCase();
  const statusFilter = String(els.financeiroStatusFilter?.value || "").trim().toLowerCase();

  const statusSearchFiltered = state.contasReceber.filter((conta) => {
    const emissao = conta.emissao ? new Date(conta.emissao).toLocaleDateString("pt-BR") : "";
    const vencimento = conta.vencimentoDate ? conta.vencimentoDate.toLocaleDateString("pt-BR") : "";
    const clienteNome = String(conta.cliente?.nome || "");
    const titulo = String(conta.numero_titulo || "");
    const documento = String(conta.documento_id || "");
    const statusConta = String(conta.statusNormalizado || "aberto");

    const matchStatus = !statusFilter || statusFilter === statusConta;
    const haystack = `${clienteNome} ${titulo} ${documento} ${emissao} ${vencimento}`.toLowerCase();
    const matchSearch = !search || haystack.includes(search);
    return matchStatus && matchSearch;
  });

  const filtered = getFilteredAndSortedTableRows(statusSearchFiltered, "financeiro", {
    emissao: {
      filter: (conta) => conta.emissao ? new Date(conta.emissao).toLocaleDateString("pt-BR") : "-",
      sort: (conta) => conta.emissao ? new Date(conta.emissao).getTime() : 0
    },
    vencimento: {
      filter: (conta) => conta.vencimentoDate ? conta.vencimentoDate.toLocaleDateString("pt-BR") : "-",
      sort: (conta) => conta.vencimentoDate ? conta.vencimentoDate.getTime() : 0
    },
    cliente: (conta) => conta.cliente?.nome || "-",
    titulo: (conta) => conta.numero_titulo || `DOC-${conta.documento_id || conta.id}`,
    status: (conta) => getContaStatusLabel(conta.statusNormalizado || "aberto"),
    original: {
      filter: (conta) => moeda.format(conta.valor_original || 0),
      sort: (conta) => Number(conta.valor_original || 0)
    },
    aberto: {
      filter: (conta) => moeda.format(conta.valor_aberto || 0),
      sort: (conta) => Number(conta.valor_aberto || 0)
    }
  });

  if (!filtered.length) {
    els.contasReceberTable.innerHTML = '<tr><td colspan="8">Nenhuma conta encontrada para os filtros selecionados.</td></tr>';
    updateTableSortHeaders("financeiro");
    return;
  }

  els.contasReceberTable.innerHTML = filtered
    .map((conta) => {
      const emissao = conta.emissao ? new Date(conta.emissao).toLocaleDateString("pt-BR") : "-";
      const vencimento = conta.vencimentoDate ? conta.vencimentoDate.toLocaleDateString("pt-BR") : "-";
      const clienteNome = conta.cliente?.nome || "-";
      const statusConta = conta.statusNormalizado || "aberto";
      const vencimentoClass = statusConta === "vencido" ? "financeiro-vencimento-atrasado" : "";
      return `
        <tr>
          <td>${emissao}</td>
          <td class="${vencimentoClass}">${vencimento}</td>
          <td>${escapeHtml(clienteNome)}</td>
          <td>${escapeHtml(conta.numero_titulo || `DOC-${conta.documento_id || conta.id}`)}</td>
          <td><span class="status-chip ${statusConta}">${getContaStatusLabel(statusConta)}</span></td>
          <td>${moeda.format(conta.valor_original || 0)}</td>
          <td>${moeda.format(conta.valor_aberto || 0)}</td>
          <td>
            <button class="action-finance" data-open-recebimento-conta="${conta.id}">Registrar recebimento</button>
          </td>
        </tr>
      `;
    })
    .join("");
    updateTableSortHeaders("financeiro");
}

function renderOrcamentosTable() {
    const rows = getFilteredAndSortedTableRows(state.orcamentos, "orcamentos", {
      data: {
        filter: (orcamento) => orcamento.data_orcamento ? new Date(orcamento.data_orcamento).toLocaleDateString("pt-BR") : "-",
        sort: (orcamento) => orcamento.data_orcamento ? new Date(orcamento.data_orcamento).getTime() : 0
      },
      cliente: (orcamento) => orcamento.cliente?.nome || (orcamento.cliente_legacy_id ? `Legacy #${orcamento.cliente_legacy_id}` : "-"),
      status: (orcamento) => orcamento.status || "-",
      total: {
        filter: (orcamento) => moeda.format(orcamento.valor_total || 0),
        sort: (orcamento) => Number(orcamento.valor_total || 0)
      }
    });

    if (!rows.length) {
      els.orcamentosTable.innerHTML = '<tr><td colspan="5">Nenhum orcamento encontrado para os filtros selecionados.</td></tr>';
      updateTableSortHeaders("orcamentos");
      return;
    }

    els.orcamentosTable.innerHTML = rows
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
  updateTableSortHeaders("orcamentos");
}

function renderDespesasTable() {
  const rows = getFilteredAndSortedTableRows(state.despesas, "despesas", {
    data: {
      filter: (despesa) => despesa.data_despesa ? new Date(despesa.data_despesa).toLocaleDateString("pt-BR") : "-",
      sort: (despesa) => despesa.data_despesa ? new Date(despesa.data_despesa).getTime() : 0
    },
    descricao: (despesa) => despesa.descricao || "-",
    status: (despesa) => despesa.status || "-",
    valor: {
      filter: (despesa) => moeda.format(despesa.valor || 0),
      sort: (despesa) => Number(despesa.valor || 0)
    }
  });

  if (!rows.length) {
    els.despesasTable.innerHTML = '<tr><td colspan="5">Nenhuma despesa encontrada para os filtros selecionados.</td></tr>';
    updateTableSortHeaders("despesas");
    return;
  }

  els.despesasTable.innerHTML = rows
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
  updateTableSortHeaders("despesas");
}

function renderMetrics() {
  els.clientesCount.textContent = String(state.clientes.length);
  els.pedidosCount.textContent = String(state.pedidos.length);
  els.despesasCount.textContent = String(state.despesas.length);

  if (els.pedidosCount) {
    els.pedidosCount.title = state.pedidos.length >= 1000
      ? "Pedidos carregados por paginação para evitar truncamento em 1000 registros."
      : "";
  }

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

  const monthlyCashEntries = getMonthlyCashEntries(state.dashboardCashChartMode);
  const currentMonthKey = formatMonthKey(new Date());
  const currentMonthEntry = monthlyCashEntries.find((item) => item.monthKey === currentMonthKey)?.total || 0;

  if (els.entradasCaixaTitulo) {
    els.entradasCaixaTitulo.textContent = state.dashboardCashChartMode === "faturamento" ? "Faturamento por Mês" : "Recebimentos por Mês";
  }
  if (els.entradasCaixaSubtitulo) {
    els.entradasCaixaSubtitulo.textContent = state.dashboardCashChartMode === "faturamento"
      ? "Valor total dos pedidos considerando a data de emissão."
      : "Previsto e realizado considerando recebimentos e títulos em aberto.";
  }
 
   if (els.entradasCaixaLegenda) {
     els.entradasCaixaLegenda.innerHTML = state.dashboardCashChartMode === "faturamento"
       ? `
         <span class="cash-chart-legend-item"><i class="cash-dot cash-dot-faturamento"></i> Faturamento</span>
       `
       : `
         <span class="cash-chart-legend-item"><i class="cash-dot cash-dot-realized"></i> Realizado</span>
         <span class="cash-chart-legend-item"><i class="cash-dot cash-dot-forecast"></i> Previsto</span>
       `;
   }

  for (const button of els.dashboardCashModeButtons || []) {
    button.classList.toggle("active", button.getAttribute("data-dashboard-cash-mode") === state.dashboardCashChartMode);
  }

  els.estoqueTotalCount.textContent = `${estoqueTotal} itens`;
  els.estoqueComSaldoCount.textContent = `${estoqueComSaldo} itens`;
  els.estoquePontoPedidoCount.textContent = `${estoquePontoPedido} itens`;
  els.orcamentoAbertoValue.textContent = moeda.format(orcamentoAberto);

  if (els.entradasCaixaResumo) {
    els.entradasCaixaResumo.textContent = moeda.format(currentMonthEntry);
  }

  if (els.entradasCaixaGrid) {
    const entriesHtml = monthlyCashEntries
      .map((item) => {
        const realized = Number(item.realized || 0);
        const forecast = Number(item.forecast || 0);
        return `
          <article class="cash-month-card">
            <span>${escapeHtml(item.label)}</span>
            <strong>${moeda.format(item.total)}</strong>
            ${state.dashboardCashChartMode === "faturamento"
              ? '<span class="cash-month-card-dot" title="Faturamento"><i class="cash-dot cash-dot-faturamento"></i></span>'
              : `
                <div class="cash-month-breakdown">
                  <span><i class="cash-dot cash-dot-realized"></i> ${moeda.format(realized)}</span>
                  <span><i class="cash-dot cash-dot-forecast"></i> ${moeda.format(forecast)}</span>
                </div>
              `}
          </article>
        `;
      })
      .join("");
    els.entradasCaixaGrid.innerHTML = entriesHtml || '<div class="documento-empty-state">Sem recebimentos registrados.</div>';
  }

  if (els.entradasCaixaChart) {
    const maxValue = Math.max(...monthlyCashEntries.map((item) => Number(item.total || 0)), 0);
    const currentMonthKey = formatMonthKey(new Date());
    const chartBars = monthlyCashEntries
      .map((item) => {
        const value = Number(item.total || 0);
        const realized = Number(item.realized || 0);
        const forecast = Number(item.forecast || 0);
        const totalHeight = maxValue > 0 ? Math.max(6, Math.round((value / maxValue) * 100)) : 6;
        const realizedHeight = value > 0 ? Math.max(0, Math.round((realized / value) * totalHeight)) : 0;
        const forecastHeight = Math.max(0, totalHeight - realizedHeight);
        const isCurrentMonth = item.monthKey === currentMonthKey;
        const title = state.dashboardCashChartMode === "faturamento"
          ? `${item.label}: ${moeda.format(value)}`
          : `${item.label}: ${moeda.format(value)} | Realizado ${moeda.format(realized)} | Previsto ${moeda.format(forecast)}`;
        return `
          <div class="cash-bar-wrap${isCurrentMonth ? " cash-bar-wrap-current" : ""}" title="${escapeHtml(title)}">
            <div class="cash-bar-value${state.dashboardCashChartMode === "recebimentos" ? " cash-bar-value-split" : ""}">
              ${state.dashboardCashChartMode === "recebimentos"
                ? `<span class="cash-bar-value-realized">${moeda.format(realized)}</span><span class="cash-bar-value-forecast">${moeda.format(forecast)}</span>`
                : moeda.format(value)}
            </div>
            <div class="cash-bar-track" aria-hidden="true">
              ${state.dashboardCashChartMode === "recebimentos"
                ? `
                  <div class="cash-bar-fill cash-bar-fill-realized" style="height:${realizedHeight}%"></div>
                  <div class="cash-bar-fill cash-bar-fill-forecast" style="height:${forecastHeight}%"></div>
                `
                : `<div class="cash-bar-fill${isCurrentMonth ? " cash-bar-fill-current" : ""}" style="height:${totalHeight}%"></div>`}
            </div>
            <div class="cash-bar-label">${escapeHtml(item.label)}</div>
          </div>
        `;
      })
      .join("");
    els.entradasCaixaChart.innerHTML = chartBars || '<div class="documento-empty-state">Sem recebimentos registrados.</div>';
    window.requestAnimationFrame(() => {
      els.entradasCaixaChart.scrollLeft = els.entradasCaixaChart.scrollWidth;
    });
  }
}

function formatMonthKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getMonthlyCashEntries(mode = "recebimentos") {
  const rows = state.dashboardMonthlyCash || [];
  if (!rows.length) return [];

  return rows.map((row) => {
    const reference = new Date(row.mes);
    const monthKey = formatMonthKey(reference);
    const label = reference.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });

    if (mode === "faturamento") {
      const value = Number(row.faturamento || 0);
      return {
        monthKey,
        label,
        total: value,
        realized: value,
        forecast: 0
      };
    }

    const realized = Number(row.realized || 0);
    const forecast = Number(row.forecast || 0);
    return {
      monthKey,
      label,
      total: realized + forecast,
      realized,
      forecast
    };
  });
}

async function refreshAll() {
  if (refreshAll._running) {
    refreshAll._pending = true;
    return refreshAll._running;
  }

  refreshAll._running = (async () => {
    try {
      if (!state.session || !state.empresaId) return;

      await cleanupOrphanDocumentoFinanceiro();

      const baseLoads = [
        loadClientes(),
        loadProdutos(),
        loadPedidos(),
        loadOrcamentos(),
        loadDespesas(),
        loadFormasPagamento(),
        loadRecebimentos(),
        loadParcelasReceberPrevistas(),
        loadContasReceber(),
        loadDashboardMonthlyCash(),
        loadOwnerUsers()
      ];

      if (state.isPlatformAdmin) {
        baseLoads.push(loadAdminEmpresas(), loadAdminVinculos());
      }

      await Promise.all(baseLoads);

      renderSelects();
      renderClientesTable();
      renderProdutosTable();
      renderPedidosSection();
      renderContasReceberTable();
      renderOrcamentosTable();
      renderDespesasTable();
      renderOwnerUsersTable();
      renderAdminEmpresasSelect();
      renderAdminVinculosTable();
      renderMetrics();
      if (els.novoDocumentoModal && !els.novoDocumentoModal.classList.contains("hidden")) {
        renderNovoDocumentoFormaPagamentoSelect();
        renderNovoDocumentoPagamentoSection();
      }
    } catch (error) {
      console.error(error);
      showToast(`Erro ao carregar dados: ${error.message}`, "error");
    }
  })();

  try {
    await refreshAll._running;
  } finally {
    refreshAll._running = null;
    if (refreshAll._pending) {
      refreshAll._pending = false;
      refreshAll();
    }
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

  els.pedidoForm.reset();
  showToast("Pedido salvo");
  await refreshAll();
}

async function createOrcamento(event) {
  event.preventDefault();
  const formData = new FormData(els.orcamentoForm);
  const clienteIdRaw = Number(formData.get("cliente_id"));
  const clienteId = Number.isFinite(clienteIdRaw) && clienteIdRaw > 0 ? clienteIdRaw : null;

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

function parseDocumentoIdFromNumeroTitulo(numeroTitulo) {
  const match = String(numeroTitulo || "").trim().match(/^DOC-(\d+)/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

async function deleteContasFinanceirasByContaIds(contaIds) {
  const ids = (contaIds || []).map((id) => Number(id)).filter(Number.isFinite);
  if (!ids.length) return;

  const parcelasResponse = await supabaseClient
    .from("contas_receber_parcelas")
    .select("id")
    .eq("empresa_id", state.empresaId)
    .in("conta_receber_id", ids);

  if (parcelasResponse.error && !isMissingRelationError(parcelasResponse.error)) {
    throw parcelasResponse.error;
  }

  const parcelaIds = (parcelasResponse.data || []).map((item) => Number(item.id)).filter(Number.isFinite);

  if (parcelaIds.length) {
    const { error: recebimentosError } = await supabaseClient
      .from("recebimentos")
      .delete()
      .eq("empresa_id", state.empresaId)
      .in("parcela_id", parcelaIds);

    if (recebimentosError && !isMissingRelationError(recebimentosError)) {
      throw recebimentosError;
    }
  }

  const { error: parcelasDeleteError } = await supabaseClient
    .from("contas_receber_parcelas")
    .delete()
    .eq("empresa_id", state.empresaId)
    .in("conta_receber_id", ids);

  if (parcelasDeleteError && !isMissingRelationError(parcelasDeleteError)) {
    throw parcelasDeleteError;
  }

  const { error: contasDeleteError } = await supabaseClient
    .from("contas_receber")
    .delete()
    .eq("empresa_id", state.empresaId)
    .in("id", ids);

  if (contasDeleteError && !isMissingRelationError(contasDeleteError)) {
    throw contasDeleteError;
  }
}

async function deleteDocumentoFinanceiro(documentoId) {
  const contasResponse = await supabaseClient
    .from("contas_receber")
    .select("id")
    .eq("empresa_id", state.empresaId)
    .eq("documento_id", documentoId);

  if (contasResponse.error) {
    if (isMissingRelationError(contasResponse.error)) return;
    throw contasResponse.error;
  }

  const contaIds = (contasResponse.data || []).map((item) => Number(item.id)).filter(Number.isFinite);
  await deleteContasFinanceirasByContaIds(contaIds);
}

async function deleteDocumentoVenda(id, tipoDocumento) {
  await deleteDocumentoFinanceiro(id);

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
  const previousUserId = state.session?.user?.id || null;
  const nextUserId = session?.user?.id || null;

  state.session = session;
  updateShellVisibility();

  if (!session) {
    state.empresaId = null;
    state.empresaNome = "";
    state.currentRole = "user";
    state.isPlatformAdmin = false;
    updateAdminVisibility();
    updateOwnerUsersVisibility();
    setSection("dashboard");
    return;
  }

  // Evita rodar tudo de novo se o mesmo usuario ja esta carregado.
  if (previousUserId && previousUserId === nextUserId && state.empresaId) {
    return;
  }

  setSection("dashboard");

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

  if (els.changePasswordBtn) {
    els.changePasswordBtn.addEventListener("click", openChangePasswordModal);
  }

  if (els.closeChangePasswordModalBtn) {
    els.closeChangePasswordModalBtn.addEventListener("click", closeChangePasswordModal);
  }

  if (els.changePasswordModal) {
    els.changePasswordModal.addEventListener("click", (event) => {
      if (event.target === els.changePasswordModal) {
        closeChangePasswordModal();
      }
    });
  }

  if (els.changePasswordForm) {
    els.changePasswordForm.addEventListener("submit", async (event) => {
      try {
        await changePassword(event);
      } catch (error) {
        showToast(`Erro ao trocar senha: ${error.message}`, "error");
      }
    });
  }

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

  if (els.closeRecebimentoModalBtn) {
    els.closeRecebimentoModalBtn.addEventListener("click", closeRecebimentoModal);
  }

  if (els.recebimentoModal) {
    els.recebimentoModal.addEventListener("click", (event) => {
      if (event.target === els.recebimentoModal) {
        closeRecebimentoModal();
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

  if (els.novoDocumentoPagamentoModo) {
    els.novoDocumentoPagamentoModo.addEventListener("change", () => {
      setNovoDocumentoPagamentoField("modo", els.novoDocumentoPagamentoModo.value || "avista");
    });
  }

  if (els.novoDocumentoPagamentoForma) {
    els.novoDocumentoPagamentoForma.addEventListener("change", () => {
      setNovoDocumentoPagamentoField("formaPagamentoId", els.novoDocumentoPagamentoForma.value || "");
    });
  }

  if (els.novoDocumentoPagamentoEntrada) {
    els.novoDocumentoPagamentoEntrada.addEventListener("input", () => {
      setNovoDocumentoPagamentoField("entrada", Number(els.novoDocumentoPagamentoEntrada.value || 0));
    });
  }

  if (els.novoDocumentoPagamentoParcelas) {
    els.novoDocumentoPagamentoParcelas.addEventListener("input", () => {
      setNovoDocumentoPagamentoField("parcelas", Number(els.novoDocumentoPagamentoParcelas.value || 1));
    });
  }

  if (els.novoDocumentoPagamentoPrimeiroVencimento) {
    els.novoDocumentoPagamentoPrimeiroVencimento.addEventListener("change", () => {
      setNovoDocumentoPagamentoField("vencimentoPrimeiraParcela", els.novoDocumentoPagamentoPrimeiroVencimento.value || "");
    });
  }

  if (els.novoDocumentoPagamentoIntervalo) {
    els.novoDocumentoPagamentoIntervalo.addEventListener("input", () => {
      setNovoDocumentoPagamentoField("intervaloDias", Number(els.novoDocumentoPagamentoIntervalo.value || 30));
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

  if (els.recebimentoForm) {
    els.recebimentoForm.addEventListener("submit", async (event) => {
      try {
        await saveRecebimento(event);
      } catch (error) {
        showToast(`Erro ao salvar recebimento: ${error.message}`, "error");
      }
    });
  }

  if (els.financeiroStatusFilter) {
    els.financeiroStatusFilter.addEventListener("change", () => {
      renderContasReceberTable();
    });
  }

  if (els.financeiroSearchInput) {
    els.financeiroSearchInput.addEventListener("input", () => {
      renderContasReceberTable();
    });
  }

  for (const button of els.dashboardCashModeButtons || []) {
    button.addEventListener("click", () => {
      state.dashboardCashChartMode = button.getAttribute("data-dashboard-cash-mode") === "faturamento" ? "faturamento" : "recebimentos";
      renderMetrics();
    });
  }

  if (els.pedidosProdutosStartDate) {
    els.pedidosProdutosStartDate.addEventListener("change", () => {
      updatePedidosProdutosFilter("startDate", els.pedidosProdutosStartDate.value || "");
    });
  }

  if (els.pedidosProdutosEndDate) {
    els.pedidosProdutosEndDate.addEventListener("change", () => {
      updatePedidosProdutosFilter("endDate", els.pedidosProdutosEndDate.value || "");
    });
  }

  if (els.pedidosTableHead) {
    els.pedidosTableHead.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const header = target.closest("th[data-pedidos-produto-sort]");
      if (!header || state.pedidosView !== "produtos") return;
      const field = header.getAttribute("data-pedidos-produto-sort");
      if (!field) return;
      setPedidosProdutosSort(field);
    });
  }

  for (const button of els.pedidosViewButtons || []) {
    button.addEventListener("click", () => {
      state.pedidosView = button.getAttribute("data-pedidos-view") === "produtos" ? "produtos" : "pedidos";
      renderPedidosSection();
    });
  }

  for (const button of els.pedidosListModeButtons || []) {
    button.addEventListener("click", () => {
      state.pedidosListMode = button.getAttribute("data-pedidos-list-mode") === "analitico" ? "analitico" : "sintetico";
      renderPedidosSection();
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

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const tableKey = target.getAttribute("data-table-filter");
    const field = target.getAttribute("data-field");
    if (!tableKey || !field) return;
    const view = getTableViewConfig(tableKey);
    if (!view) return;

    const selectionStart = typeof target.selectionStart === "number" ? target.selectionStart : null;
    const selectionEnd = typeof target.selectionEnd === "number" ? target.selectionEnd : null;
    view.filters[field] = target.value || "";
    rerenderTableView(tableKey);

    window.requestAnimationFrame(() => {
      const nextInput = document.querySelector(`input[data-table-filter="${tableKey}"][data-field="${field}"]`);
      if (!(nextInput instanceof HTMLInputElement)) return;
      nextInput.focus();

      if (selectionStart == null || selectionEnd == null) return;

      try {
        nextInput.setSelectionRange(selectionStart, selectionEnd);
      } catch (_error) {
        // Alguns tipos de input, como date, nao suportam selecao de cursor.
      }
    });
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const header = target.closest("th.sortable[data-table][data-sort]");
    if (!header) return;
    const tableKey = header.getAttribute("data-table");
    const field = header.getAttribute("data-sort");
    if (!tableKey || !field) return;
    setTableSort(tableKey, field);
  });

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
    const pedidoProdutoGroupKey = target.getAttribute("data-open-pedidos-produto");
    const pedidoProdutoItensId = target.getAttribute("data-open-pedido-produto-itens");
    const orcamentoItensId = target.getAttribute("data-view-orcamento-itens");
    const openRecebimentoPedidoId = target.getAttribute("data-open-recebimento-pedido");
    const openRecebimentoContaId = target.getAttribute("data-open-recebimento-conta");
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
      if (pedidoProdutoGroupKey) {
        openPedidosProdutoDetalhes(pedidoProdutoGroupKey);
        return;
      }
      if (pedidoProdutoItensId) {
        await openDocumentoItens("pedido", Number(pedidoProdutoItensId));
        return;
      }
      if (orcamentoItensId) {
        await openDocumentoItens("orcamento", Number(orcamentoItensId));
        return;
      }
      if (openRecebimentoPedidoId) {
        await openRecebimentoModalByPedido(Number(openRecebimentoPedidoId));
        return;
      }
      if (openRecebimentoContaId) {
        await openRecebimentoModalByConta(Number(openRecebimentoContaId));
        return;
      }
      if (clienteId) {
        await deleteByTable("clientes", Number(clienteId));
      }
      if (produtoId) {
        await deleteByTable("produto_catalogo", Number(produtoId));
      }
      if (pedidoId) {
        if (!window.confirm("Excluir este pedido? Os lancamentos financeiros vinculados tambem serao excluidos.")) {
          return;
        }
        await deleteDocumentoVenda(Number(pedidoId), "pedido");
      }
      if (orcamentoId) {
        if (!window.confirm("Excluir este orcamento? Os lancamentos financeiros vinculados tambem serao excluidos quando existirem.")) {
          return;
        }
        await deleteDocumentoVenda(Number(orcamentoId), "orcamento");
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
