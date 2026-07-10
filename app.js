let supabaseClient;

async function loadRuntimeConfig() {
  const localConfig = window.SUPABASE_CONFIG || {};
  if (localConfig.SUPABASE_URL && localConfig.SUPABASE_ANON_KEY) {
    return localConfig;
  }

  try {
    const response = await fetch("/api/public-config");
    if (!response.ok) {
      throw new Error("Nao foi possivel carregar configuracao do deploy");
    }
    const remoteConfig = await response.json();
    if (!remoteConfig.SUPABASE_URL || !remoteConfig.SUPABASE_ANON_KEY) {
      throw new Error("Configuracao incompleta no deploy");
    }
    return remoteConfig;
  } catch (_error) {
    throw new Error("Configure config.js localmente ou as variaveis SUPABASE_URL e SUPABASE_ANON_KEY na Vercel");
  }
}

const state = {
  session: null,
  empresaId: null,
  empresaNome: "",
  clientes: [],
  produtos: [],
  pedidos: [],
  orcamentos: [],
  despesas: []
};

const els = {
  authScreen: document.getElementById("authScreen"),
  appShell: document.getElementById("appShell"),
  loginForm: document.getElementById("loginForm"),
  logoutBtn: document.getElementById("logoutBtn"),
  empresaInfo: document.getElementById("empresaInfo"),
  tabs: Array.from(document.querySelectorAll(".tab")),
  sections: Array.from(document.querySelectorAll(".app-section")),
  clienteForm: document.getElementById("clienteForm"),
  produtoForm: document.getElementById("produtoForm"),
  pedidoForm: document.getElementById("pedidoForm"),
  orcamentoForm: document.getElementById("orcamentoForm"),
  despesaForm: document.getElementById("despesaForm"),
  pedidoClienteSelect: document.getElementById("pedidoClienteSelect"),
  orcamentoClienteSelect: document.getElementById("orcamentoClienteSelect"),
  clientesTable: document.getElementById("clientesTable"),
  produtosTable: document.getElementById("produtosTable"),
  pedidosTable: document.getElementById("pedidosTable"),
  orcamentosTable: document.getElementById("orcamentosTable"),
  despesasTable: document.getElementById("despesasTable"),
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

function setSection(sectionName) {
  for (const tab of els.tabs) {
    tab.classList.toggle("active", tab.dataset.section === sectionName);
  }
  for (const section of els.sections) {
    const isTarget = section.id === `section-${sectionName}`;
    section.classList.toggle("hidden", !isTarget);
    section.classList.toggle("active-section", isTarget);
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
    .select("empresa_id, empresas(nome)")
    .eq("user_id", userId)
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error("Usuario sem empresa vinculada em usuarios_empresas");
  }

  state.empresaId = data.empresa_id;
  state.empresaNome = data.empresas?.nome || "Empresa";
  els.empresaInfo.textContent = `${state.empresaNome} • ${state.session.user.email}`;
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
  const { data, error } = await supabaseClient
    .from("produtos")
    .select("id, nome, preco, estoque, ponto_pedido")
    .eq("empresa_id", state.empresaId)
    .order("nome");

  if (error) throw error;
  state.produtos = data || [];
}

async function loadPedidos() {
  const { data, error } = await supabaseClient
    .from("pedidos")
    .select(
      "id, data_pedido, status, valor_total, cliente:clientes(id,nome)"
    )
    .eq("empresa_id", state.empresaId)
    .order("data_pedido", { ascending: false });

  if (error) throw error;
  state.pedidos = data || [];
}

async function loadOrcamentos() {
  const { data, error } = await supabaseClient
    .from("orcamentos")
    .select(
      "id, data_orcamento, status, valor_total, cliente:clientes(id,nome)"
    )
    .eq("empresa_id", state.empresaId)
    .order("data_orcamento", { ascending: false });

  if (error) throw error;
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
  els.produtosTable.innerHTML = state.produtos
    .map(
      (produto) => `
      <tr>
        <td>${escapeHtml(produto.nome)}</td>
        <td>${moeda.format(produto.preco || 0)}</td>
        <td>${escapeHtml(produto.estoque ?? 0)}</td>
        <td>${escapeHtml(produto.ponto_pedido ?? 0)}</td>
        <td><button class="action-delete" data-del-produto="${produto.id}">Excluir</button></td>
      </tr>
    `
    )
    .join("");
}

function renderPedidosTable() {
  els.pedidosTable.innerHTML = state.pedidos
    .map((pedido) => {
      const data = pedido.data_pedido ? new Date(pedido.data_pedido).toLocaleDateString("pt-BR") : "-";
      return `
      <tr>
        <td>${data}</td>
        <td>${escapeHtml(pedido.cliente?.nome || "-")}</td>
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
      return `
      <tr>
        <td>${data}</td>
        <td>${escapeHtml(orcamento.cliente?.nome || "-")}</td>
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
  const estoqueComSaldo = state.produtos.filter((produto) => Number(produto.estoque || 0) > 0).length;
  const estoquePontoPedido = state.produtos.filter(
    (produto) => Number(produto.estoque || 0) <= Number(produto.ponto_pedido || 0)
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
    await Promise.all([
      loadClientes(),
      loadProdutos(),
      loadPedidos(),
      loadOrcamentos(),
      loadDespesas()
    ]);
    renderSelects();
    renderClientesTable();
    renderProdutosTable();
    renderPedidosTable();
    renderOrcamentosTable();
    renderDespesasTable();
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
  const payload = {
    empresa_id: state.empresaId,
    nome: String(formData.get("nome") || "").trim(),
    preco: Number(formData.get("preco") || 0),
    estoque: Number(formData.get("estoque") || 0),
    ponto_pedido: Number(formData.get("ponto_pedido") || 0)
  };

  if (!payload.nome) return;

  const { error } = await supabaseClient.from("produtos").insert(payload);
  if (error) throw error;

  els.produtoForm.reset();
  showToast("Produto salvo");
  await refreshAll();
}

async function createPedido(event) {
  event.preventDefault();
  const formData = new FormData(els.pedidoForm);

  const payload = {
    empresa_id: state.empresaId,
    cliente_id: Number(formData.get("cliente_id")),
    descricao: String(formData.get("descricao") || "").trim() || null,
    status: String(formData.get("status") || "aberto"),
    valor_total: Number(formData.get("valor_total") || 0),
    data_pedido: new Date().toISOString()
  };

  const { error } = await supabaseClient.from("pedidos").insert(payload);
  if (error) throw error;

  els.pedidoForm.reset();
  showToast("Pedido salvo");
  await refreshAll();
}

async function createOrcamento(event) {
  event.preventDefault();
  const formData = new FormData(els.orcamentoForm);
  const payload = {
    empresa_id: state.empresaId,
    cliente_id: Number(formData.get("cliente_id")),
    descricao: String(formData.get("descricao") || "").trim() || null,
    status: String(formData.get("status") || "aberto"),
    valor_total: Number(formData.get("valor_total") || 0),
    data_orcamento: new Date().toISOString()
  };

  const { error } = await supabaseClient.from("orcamentos").insert(payload);
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

async function handleSession(session) {
  state.session = session;
  updateShellVisibility();

  if (!session) {
    state.empresaId = null;
    state.empresaNome = "";
    return;
  }

  try {
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

  document.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const clienteId = target.getAttribute("data-del-cliente");
    const produtoId = target.getAttribute("data-del-produto");
    const pedidoId = target.getAttribute("data-del-pedido");
    const orcamentoId = target.getAttribute("data-del-orcamento");
    const despesaId = target.getAttribute("data-del-despesa");

    try {
      if (clienteId) {
        await deleteByTable("clientes", Number(clienteId));
      }
      if (produtoId) {
        await deleteByTable("produtos", Number(produtoId));
      }
      if (pedidoId) {
        await deleteByTable("pedidos", Number(pedidoId));
      }
      if (orcamentoId) {
        await deleteByTable("orcamentos", Number(orcamentoId));
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
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = await loadRuntimeConfig();
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
