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
  els.pedidoClienteSelect.innerHTML = '<option value="">Selecione um cliente</option>';
  els.orcamentoClienteSelect.innerHTML = '<option value="">Selecione um cliente</option>';

  for (const cliente of state.clientes) {
    const optionHtml = `<option value="${cliente.id}">${escapeHtml(cliente.nome)}</option>`;
    els.pedidoClienteSelect.insertAdjacentHTML(
      "beforeend",
      optionHtml
    );
    els.orcamentoClienteSelect.insertAdjacentHTML(
      "beforeend",
      optionHtml
    );
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
        <td><button class="action-delete" data-del-pedido="${pedido.id}">Excluir</button></td>
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
        <td><button class="action-delete" data-del-orcamento="${orcamento.id}">Excluir</button></td>
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

  if (!payload.nome) return;

  const { error } = await supabaseClient.from("clientes").insert(payload);
  if (error) throw error;

  els.clienteForm.reset();
  showToast("Cliente salvo");
  await refreshAll();
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

  els.pedidoForm.addEventListener("submit", async (event) => {
    try {
      await createPedido(event);
    } catch (error) {
      showToast(`Erro ao salvar pedido: ${error.message}`, "error");
    }
  });

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
    const despesaId = target.getAttribute("data-del-despesa");

    try {
      if (produtoEditId) {
        openProdutoEditModal(Number(produtoEditId));
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
