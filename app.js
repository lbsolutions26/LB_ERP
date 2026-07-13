import { installComprasModule } from "./compras.js";
import { installCalendarioModule } from "./calendario.js";

let supabaseClient;
let saasName = "LB ERP SaaS";
let comprasModule = null;
let calendarioModule = null;

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
  supabaseUrl: "",
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
  itensDocumentoPedidoFoto: "",
  itensDocumentoPedidoId: null,
  itensDocumentoTipo: "pedido",
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
    classe_abc: "",
    estoque: "",
    reservado: "",
    disponivel: "",
    ponto_pedido: "",
    status_estoque: "",
    ativo: ""
  },
  tableViews: {
    clientes: {
      sort: { field: "nome", direction: "asc" },
      filters: { nome: "", telefone: "", email: "" }
    },
    pedidosSintetico: {
      sort: { field: "data", direction: "desc" },
      filters: { pedido: "", data: "", cliente: "", pagamento: "", total: "" }
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
  pedidosLoaded: false,
  pedidosLimit: 50,
  pedidosTotalCarregado: 0,
  pedidosCountTotal: 0,
  pedidosFaturamentoTotal: 0,
  pedidosSearchMode: false,
  pedidosSearchLoading: false,
  novoDocumentoSaving: false,
  clientesLoaded: false,
  produtosLoaded: false,
  contasReceberLoaded: false,
  orcamentosLoaded: false,
  despesasLoaded: false,
  ownerUsersLoaded: false,
  adminLoaded: false,
  dashboardCounts: {
    clientes: 0,
    despesas: 0,
    produtosTotal: 0,
    produtosComSaldo: 0,
    produtosPontoPedido: 0,
    orcamentoAberto: 0
  },
  contasReceber: [],
  recebimentos: [],
  parcelasReceberPrevistas: [],
  dashboardMonthlyCash: [],
  dashboardDaily: [],
  dashboardContasPagarMes: {
    total: 0,
    aberto: 0,
    pago: 0,
    count: 0,
    monthKey: ""
  },
  dashboardCashChartMode: "recebimentos",
  dashboardMonthsBack: 11,
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
    itens: [],
    precoVendaCalc: null
  },
  ownerUsers: [],
  adminEmpresas: [],
  adminVinculos: [],
  produtoPrecoVendaCalc: null,
  produtoPrecoFormacaoPending: null,
  estoqueView: "painel",
  estoqueMovimentos: [],
  estoqueMovimentosLoaded: false,
  estoqueReservas: {},
  estoqueReservasLoaded: false,
  estoqueAbcRows: [],
  estoqueAbcDias: 90,
  estoqueInventarioDraft: {},
  estoqueFilters: {
    saldoBusca: "",
    saldoStatus: "",
    saldoAbc: "",
    movBusca: "",
    movTipo: "",
    movStart: "",
    movEnd: "",
    invBusca: ""
  }
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
  produtoModalSubtitle: document.getElementById("produtoModalSubtitle"),
  produtoSubmitBtn: document.getElementById("produtoSubmitBtn"),
  produtoImagePreview: document.getElementById("produtoImagePreview"),
  produtoImageEmpty: document.getElementById("produtoImageEmpty"),
  produtoImageZoomBtn: document.getElementById("produtoImageZoomBtn"),
  produtoImagemPathInput: document.getElementById("produtoImagemPathInput"),
  imageLightbox: document.getElementById("imageLightbox"),
  imageLightboxImg: document.getElementById("imageLightboxImg"),
  imageLightboxCaption: document.getElementById("imageLightboxCaption"),
  closeImageLightboxBtn: document.getElementById("closeImageLightboxBtn"),
  openPedidoModalBtn: document.getElementById("openPedidoModalBtn"),
  novoDocumentoModal: document.getElementById("novoDocumentoModal"),
  closeNovoDocumentoModalBtn: document.getElementById("closeNovoDocumentoModalBtn"),
  novoDocumentoForm: document.getElementById("novoDocumentoForm"),
  novoDocumentoModalTitle: document.getElementById("novoDocumentoModalTitle"),
  novoDocumentoModalSubtitle: document.getElementById("novoDocumentoModalSubtitle"),
  novoDocumentoFotoWrap: document.getElementById("novoDocumentoFotoWrap"),
  novoDocumentoFoto: document.getElementById("novoDocumentoFoto"),
  novoDocumentoClienteSearch: document.getElementById("novoDocumentoClienteSearch"),
  novoDocumentoClienteId: document.getElementById("novoDocumentoClienteId"),
  novoDocumentoClienteTrigger: document.getElementById("novoDocumentoClienteTrigger"),
  novoDocumentoClienteLabel: document.getElementById("novoDocumentoClienteLabel"),
  novoDocumentoClientePanel: document.getElementById("novoDocumentoClientePanel"),
  novoDocumentoClienteOptions: document.getElementById("novoDocumentoClienteOptions"),
  novoDocumentoStatusSelect: document.getElementById("novoDocumentoStatusSelect"),
  novoDocumentoDataEmissao: document.getElementById("novoDocumentoDataEmissao"),
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
  novoDocumentoGerarParcelasBtn: document.getElementById("novoDocumentoGerarParcelasBtn"),
  novoDocumentoLimparParcelasBtn: document.getElementById("novoDocumentoLimparParcelasBtn"),
  novoDocumentoParcelasEditor: document.getElementById("novoDocumentoParcelasEditor"),
  novoDocumentoParcelasList: document.getElementById("novoDocumentoParcelasList"),
  novoDocumentoParcelasTotals: document.getElementById("novoDocumentoParcelasTotals"),
  novoDocumentoAddParcelaBtn: document.getElementById("novoDocumentoAddParcelaBtn"),
  addDocumentoItemBtn: document.getElementById("addDocumentoItemBtn"),
  novoDocumentoSubtotal: document.getElementById("novoDocumentoSubtotal"),
  novoDocumentoResumoTexto: document.getElementById("novoDocumentoResumoTexto"),
  novoDocumentoTotal: document.getElementById("novoDocumentoTotal"),
  novoDocumentoSubmitBtn: document.getElementById("novoDocumentoSubmitBtn"),
  novoDocumentoPdfBtn: document.getElementById("novoDocumentoPdfBtn"),
  openPrecoVendaCalcBtn: document.getElementById("openPrecoVendaCalcBtn"),
  closePrecoVendaCalcBtn: document.getElementById("closePrecoVendaCalcBtn"),
  precoVendaCalcPanel: document.getElementById("precoVendaCalcPanel"),
  precoVendaCalcItens: document.getElementById("precoVendaCalcItens"),
  calcCustoProdutos: document.getElementById("calcCustoProdutos"),
  calcMaoDeObra: document.getElementById("calcMaoDeObra"),
  calcFrete: document.getElementById("calcFrete"),
  calcEmbalagem: document.getElementById("calcEmbalagem"),
  calcOutrasDespesas: document.getElementById("calcOutrasDespesas"),
  calcImpostosPct: document.getElementById("calcImpostosPct"),
  calcTaxaCartaoPct: document.getElementById("calcTaxaCartaoPct"),
  calcComissaoPct: document.getElementById("calcComissaoPct"),
  calcMargemPct: document.getElementById("calcMargemPct"),
  calcCustoBase: document.getElementById("calcCustoBase"),
  calcSomaPct: document.getElementById("calcSomaPct"),
  calcLucro: document.getElementById("calcLucro"),
  calcPrecoSugerido: document.getElementById("calcPrecoSugerido"),
  calcTotalAtual: document.getElementById("calcTotalAtual"),
  calcDiferenca: document.getElementById("calcDiferenca"),
  calcAviso: document.getElementById("calcAviso"),
  calcRecarregarCustosBtn: document.getElementById("calcRecarregarCustosBtn"),
  calcAplicarPrecosBtn: document.getElementById("calcAplicarPrecosBtn"),
  openProdutoPrecoVendaCalcBtn: document.getElementById("openProdutoPrecoVendaCalcBtn"),
  closeProdutoPrecoVendaCalcBtn: document.getElementById("closeProdutoPrecoVendaCalcBtn"),
  produtoPrecoVendaCalcPanel: document.getElementById("produtoPrecoVendaCalcPanel"),
  produtoCalcCusto: document.getElementById("produtoCalcCusto"),
  produtoCalcMaoDeObra: document.getElementById("produtoCalcMaoDeObra"),
  produtoCalcFrete: document.getElementById("produtoCalcFrete"),
  produtoCalcEmbalagem: document.getElementById("produtoCalcEmbalagem"),
  produtoCalcOutrasDespesas: document.getElementById("produtoCalcOutrasDespesas"),
  produtoCalcImpostosPct: document.getElementById("produtoCalcImpostosPct"),
  produtoCalcTaxaCartaoPct: document.getElementById("produtoCalcTaxaCartaoPct"),
  produtoCalcComissaoPct: document.getElementById("produtoCalcComissaoPct"),
  produtoCalcMargemPct: document.getElementById("produtoCalcMargemPct"),
  produtoCalcCustoBase: document.getElementById("produtoCalcCustoBase"),
  produtoCalcSomaPct: document.getElementById("produtoCalcSomaPct"),
  produtoCalcLucro: document.getElementById("produtoCalcLucro"),
  produtoCalcPrecoSugerido: document.getElementById("produtoCalcPrecoSugerido"),
  produtoCalcPrecoAtual: document.getElementById("produtoCalcPrecoAtual"),
  produtoCalcDiferenca: document.getElementById("produtoCalcDiferenca"),
  produtoCalcAviso: document.getElementById("produtoCalcAviso"),
  produtoCalcRecarregarCustoBtn: document.getElementById("produtoCalcRecarregarCustoBtn"),
  produtoCalcAplicarPrecoBtn: document.getElementById("produtoCalcAplicarPrecoBtn"),
  novoClienteRapidoModal: document.getElementById("novoClienteRapidoModal"),
  closeNovoClienteRapidoModalBtn: document.getElementById("closeNovoClienteRapidoModalBtn"),
  novoClienteRapidoForm: document.getElementById("novoClienteRapidoForm"),
  itensDocumentoModal: document.getElementById("itensDocumentoModal"),
  closeItensDocumentoModalBtn: document.getElementById("closeItensDocumentoModalBtn"),
  itensDocumentoModalTitle: document.getElementById("itensDocumentoModalTitle"),
  itensDocumentoModalSubtitle: document.getElementById("itensDocumentoModalSubtitle"),
  novoPedidoClienteBtn: document.getElementById("novoPedidoClienteBtn"),
  itensDocumentoFotoWrap: document.getElementById("itensDocumentoFotoWrap"),
  itensDocumentoFoto: document.getElementById("itensDocumentoFoto"),
    itensDocumentoTableHead: document.getElementById("itensDocumentoTableHead"),
  itensDocumentoTable: document.getElementById("itensDocumentoTable"),
  pedidoForm: document.getElementById("pedidoForm"),
  orcamentoForm: document.getElementById("orcamentoForm"),
  despesaForm: document.getElementById("despesaForm"),
  despesaModal: document.getElementById("despesaModal"),
  closeDespesaModalBtn: document.getElementById("closeDespesaModalBtn"),
  openDespesaModalBtn: document.getElementById("openDespesaModalBtn"),
  despesaFornecedorSelect: document.getElementById("despesaFornecedorSelect"),
  despesaFormaPagamento: document.getElementById("despesaFormaPagamento"),
  despesasPagarTable: document.getElementById("despesasPagarTable"),
  despesasPagarBusca: document.getElementById("despesasPagarBusca"),
  despesasPagarStatus: document.getElementById("despesasPagarStatus"),
  despesasPagarOrigem: document.getElementById("despesasPagarOrigem"),
  despesasKpiAberto: document.getElementById("despesasKpiAberto"),
  despesasKpiVencidas: document.getElementById("despesasKpiVencidas"),
  despesasKpiSemana: document.getElementById("despesasKpiSemana"),
  despesasKpiPagasMes: document.getElementById("despesasKpiPagasMes"),
  despesasSectionSubtitle: document.getElementById("despesasSectionSubtitle"),
  contaPagarEditModal: document.getElementById("contaPagarEditModal"),
  closeContaPagarEditModalBtn: document.getElementById("closeContaPagarEditModalBtn"),
  contaPagarEditForm: document.getElementById("contaPagarEditForm"),
  contaPagarEditModalTitle: document.getElementById("contaPagarEditModalTitle"),
  contaPagarEditModalSubtitle: document.getElementById("contaPagarEditModalSubtitle"),
  contaPagarEditId: document.getElementById("contaPagarEditId"),
  contaPagarEditTitulo: document.getElementById("contaPagarEditTitulo"),
  contaPagarEditFornecedor: document.getElementById("contaPagarEditFornecedor"),
  contaPagarEditEmissao: document.getElementById("contaPagarEditEmissao"),
  contaPagarEditOrigem: document.getElementById("contaPagarEditOrigem"),
  contaPagarEditObs: document.getElementById("contaPagarEditObs"),
  contaPagarEditParcelasList: document.getElementById("contaPagarEditParcelasList"),
  contaPagarEditTotals: document.getElementById("contaPagarEditTotals"),
  contaPagarEditAddParcelaBtn: document.getElementById("contaPagarEditAddParcelaBtn"),
  contaPagarEditDeleteBtn: document.getElementById("contaPagarEditDeleteBtn"),
  // Calendario
  calendarioSectionSubtitle: document.getElementById("calendarioSectionSubtitle"),
  calendarioViewButtons: Array.from(document.querySelectorAll("[data-calendario-view]")),
  calendarioHorariosView: document.getElementById("calendarioHorariosView"),
  calendarioFeriadosView: document.getElementById("calendarioFeriadosView"),
  calendarioAgendaView: document.getElementById("calendarioAgendaView"),
  calendarioHorariosTable: document.getElementById("calendarioHorariosTable"),
  calendarioFeriadosTable: document.getElementById("calendarioFeriadosTable"),
  calendarioSaveHorariosBtn: document.getElementById("calendarioSaveHorariosBtn"),
  calendarioFeriadoBusca: document.getElementById("calendarioFeriadoBusca"),
  calendarioKpiDiasAbertos: document.getElementById("calendarioKpiDiasAbertos"),
  calendarioKpiFeriadosAno: document.getElementById("calendarioKpiFeriadosAno"),
  calendarioKpiProximos: document.getElementById("calendarioKpiProximos"),
  calendarioAgendaGrid: document.getElementById("calendarioAgendaGrid"),
  calendarioAgendaTitulo: document.getElementById("calendarioAgendaTitulo"),
  calendarioAgendaPrevBtn: document.getElementById("calendarioAgendaPrevBtn"),
  calendarioAgendaNextBtn: document.getElementById("calendarioAgendaNextBtn"),
  openFeriadoModalBtn: document.getElementById("openFeriadoModalBtn"),
  feriadoModal: document.getElementById("feriadoModal"),
  closeFeriadoModalBtn: document.getElementById("closeFeriadoModalBtn"),
  feriadoForm: document.getElementById("feriadoForm"),
  feriadoModalTitle: document.getElementById("feriadoModalTitle"),
  feriadoHorarioWrap: document.getElementById("feriadoHorarioWrap"),
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
  filtroProdutoAbc: document.getElementById("filtroProdutoAbc"),
  filtroProdutoEstoque: document.getElementById("filtroProdutoEstoque"),
  filtroProdutoReservado: document.getElementById("filtroProdutoReservado"),
  filtroProdutoDisponivel: document.getElementById("filtroProdutoDisponivel"),
  filtroProdutoPonto: document.getElementById("filtroProdutoPonto"),
  filtroProdutoStatusEstoque: document.getElementById("filtroProdutoStatusEstoque"),
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
  pedidosLoadMoreWrap: document.getElementById("pedidosLoadMoreWrap"),
  pedidosLoadMoreInfo: document.getElementById("pedidosLoadMoreInfo"),
  pedidosLoadMoreBtn: document.getElementById("pedidosLoadMoreBtn"),
  pedidosLoadAllBtn: document.getElementById("pedidosLoadAllBtn"),
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
  dashboardCashRangeButtons: Array.from(document.querySelectorAll("[data-dashboard-cash-range]")),
  entradasCaixaChart: document.getElementById("entradasCaixaChart"),
  entradasCaixaGrid: document.getElementById("entradasCaixaGrid"),
  dailyFaturamentoChart: document.getElementById("dailyFaturamentoChart"),
  dailyFaturamentoResumo: document.getElementById("dailyFaturamentoResumo"),
  dailyFaturamentoHoje: document.getElementById("dailyFaturamentoHoje"),
  dailyPedidosChart: document.getElementById("dailyPedidosChart"),
  dailyPedidosResumo: document.getElementById("dailyPedidosResumo"),
  dailyPedidosHoje: document.getElementById("dailyPedidosHoje"),
  dashboardSection: document.getElementById("section-dashboard"),
  dashboardStatusText: document.getElementById("dashboardStatusText"),
  dashboardForecastCard: document.getElementById("dashboardForecastCard"),
  dashboardForecastValue: document.getElementById("dashboardForecastValue"),
  dashboardForecastSubtitle: document.getElementById("dashboardForecastSubtitle"),
  dashboardForecastFaturado: document.getElementById("dashboardForecastFaturado"),
  dashboardForecastDiasTrab: document.getElementById("dashboardForecastDiasTrab"),
  dashboardForecastMedia: document.getElementById("dashboardForecastMedia"),
  dashboardForecastDiasRest: document.getElementById("dashboardForecastDiasRest"),
  dashboardForecastProjecao: document.getElementById("dashboardForecastProjecao"),
  dashboardForecastDiasMes: document.getElementById("dashboardForecastDiasMes"),
  dashboardForecastHint: document.getElementById("dashboardForecastHint"),
  dashboardContasPagarCard: document.getElementById("dashboardContasPagarCard"),
  dashboardContasPagarValue: document.getElementById("dashboardContasPagarValue"),
  dashboardContasPagarSubtitle: document.getElementById("dashboardContasPagarSubtitle"),
  dashboardContasPagarAberto: document.getElementById("dashboardContasPagarAberto"),
  dashboardContasPagarPago: document.getElementById("dashboardContasPagarPago"),
  dashboardContasPagarCount: document.getElementById("dashboardContasPagarCount"),
  dashboardResultadoCard: document.getElementById("dashboardResultadoCard"),
  dashboardResultadoMain: document.getElementById("dashboardResultadoMain"),
  dashboardResultadoValue: document.getElementById("dashboardResultadoValue"),
  dashboardResultadoSubtitle: document.getElementById("dashboardResultadoSubtitle"),
  dashboardResultadoFaturado: document.getElementById("dashboardResultadoFaturado"),
  dashboardResultadoPagar: document.getElementById("dashboardResultadoPagar"),
  dashboardResultadoSaldo: document.getElementById("dashboardResultadoSaldo"),
  dashboardResultadoHint: document.getElementById("dashboardResultadoHint"),
  estoqueTotalCount: document.getElementById("estoqueTotalCount"),
  estoqueComSaldoCount: document.getElementById("estoqueComSaldoCount"),
  estoquePontoPedidoCount: document.getElementById("estoquePontoPedidoCount"),
  estoqueSectionSubtitle: document.getElementById("estoqueSectionSubtitle"),
  estoqueViewButtons: Array.from(document.querySelectorAll("[data-estoque-view]")),
  estoquePainelView: document.getElementById("estoquePainelView"),
  estoqueSaldosView: document.getElementById("estoqueSaldosView"),
  estoqueMovimentosView: document.getElementById("estoqueMovimentosView"),
  estoqueReposicaoView: document.getElementById("estoqueReposicaoView"),
  estoqueAbcView: document.getElementById("estoqueAbcView"),
  estoqueInventarioView: document.getElementById("estoqueInventarioView"),
  estoqueKpiItens: document.getElementById("estoqueKpiItens"),
  estoqueKpiValor: document.getElementById("estoqueKpiValor"),
  estoqueKpiPonto: document.getElementById("estoqueKpiPonto"),
  estoqueKpiZerados: document.getElementById("estoqueKpiZerados"),
  estoqueKpiReservado: document.getElementById("estoqueKpiReservado"),
  estoqueKpiClasseA: document.getElementById("estoqueKpiClasseA"),
  estoqueSaldosTable: document.getElementById("estoqueSaldosTable"),
  estoqueMovimentosTable: document.getElementById("estoqueMovimentosTable"),
  estoqueReposicaoTable: document.getElementById("estoqueReposicaoTable"),
  estoqueAbcTable: document.getElementById("estoqueAbcTable"),
  estoqueInventarioTable: document.getElementById("estoqueInventarioTable"),
  estoqueSaldoBusca: document.getElementById("estoqueSaldoBusca"),
  estoqueSaldoStatus: document.getElementById("estoqueSaldoStatus"),
  estoqueSaldoAbc: document.getElementById("estoqueSaldoAbc"),
  estoqueMovBusca: document.getElementById("estoqueMovBusca"),
  estoqueMovTipo: document.getElementById("estoqueMovTipo"),
  estoqueMovStart: document.getElementById("estoqueMovStart"),
  estoqueMovEnd: document.getElementById("estoqueMovEnd"),
  estoqueMovRefreshBtn: document.getElementById("estoqueMovRefreshBtn"),
  estoqueAbcDias: document.getElementById("estoqueAbcDias"),
  estoqueAbcRecalcularBtn: document.getElementById("estoqueAbcRecalcularBtn"),
  estoqueAbcCountA: document.getElementById("estoqueAbcCountA"),
  estoqueAbcCountB: document.getElementById("estoqueAbcCountB"),
  estoqueAbcCountC: document.getElementById("estoqueAbcCountC"),
  estoqueAbcCountSem: document.getElementById("estoqueAbcCountSem"),
  estoqueInvBusca: document.getElementById("estoqueInvBusca"),
  estoqueInvAplicarBtn: document.getElementById("estoqueInvAplicarBtn"),
  openEstoqueMovimentoBtn: document.getElementById("openEstoqueMovimentoBtn"),
  estoqueMovimentoModal: document.getElementById("estoqueMovimentoModal"),
  closeEstoqueMovimentoModalBtn: document.getElementById("closeEstoqueMovimentoModalBtn"),
  estoqueMovimentoForm: document.getElementById("estoqueMovimentoForm"),
  estoqueMovimentoProduto: document.getElementById("estoqueMovimentoProduto"),
  estoqueMovimentoTipo: document.getElementById("estoqueMovimentoTipo"),
  estoqueMovimentoQtd: document.getElementById("estoqueMovimentoQtd"),
  estoqueMovimentoQtdLabel: document.getElementById("estoqueMovimentoQtdLabel"),
  estoqueMovimentoMotivo: document.getElementById("estoqueMovimentoMotivo"),
  estoqueMovimentoObs: document.getElementById("estoqueMovimentoObs"),
  estoqueMovimentoNegativo: document.getElementById("estoqueMovimentoNegativo"),
  estoqueMovimentoSaldoInfo: document.getElementById("estoqueMovimentoSaldoInfo"),
  produtoEstoqueInput: document.getElementById("produtoEstoqueInput"),
  produtoEstoqueHint: document.getElementById("produtoEstoqueHint"),
  // Compras
  comprasSectionSubtitle: document.getElementById("comprasSectionSubtitle"),
  comprasViewButtons: Array.from(document.querySelectorAll("[data-compras-view]")),
  comprasNotasView: document.getElementById("comprasNotasView"),
  comprasFornecedoresView: document.getElementById("comprasFornecedoresView"),
  comprasPagarView: document.getElementById("comprasPagarView"),
  comprasKpiNotas: document.getElementById("comprasKpiNotas"),
  comprasKpiRascunho: document.getElementById("comprasKpiRascunho"),
  comprasKpiMes: document.getElementById("comprasKpiMes"),
  comprasKpiAberto: document.getElementById("comprasKpiAberto"),
  comprasKpiVencidas: document.getElementById("comprasKpiVencidas"),
  comprasKpiFornecedores: document.getElementById("comprasKpiFornecedores"),
  comprasNotasTable: document.getElementById("comprasNotasTable"),
  comprasFornecedoresTable: document.getElementById("comprasFornecedoresTable"),
  comprasPagarTable: document.getElementById("comprasPagarTable"),
  comprasNotaBusca: document.getElementById("comprasNotaBusca"),
  comprasNotaStatus: document.getElementById("comprasNotaStatus"),
  comprasFornBusca: document.getElementById("comprasFornBusca"),
  comprasPagarBusca: document.getElementById("comprasPagarBusca"),
  comprasPagarStatus: document.getElementById("comprasPagarStatus"),
  openNotaEntradaBtn: document.getElementById("openNotaEntradaBtn"),
  openFornecedorBtn: document.getElementById("openFornecedorBtn"),
  fornecedorModal: document.getElementById("fornecedorModal"),
  closeFornecedorModalBtn: document.getElementById("closeFornecedorModalBtn"),
  fornecedorForm: document.getElementById("fornecedorForm"),
  fornecedorModalTitle: document.getElementById("fornecedorModalTitle"),
  notaEntradaModal: document.getElementById("notaEntradaModal"),
  closeNotaEntradaModalBtn: document.getElementById("closeNotaEntradaModalBtn"),
  notaEntradaModalTitle: document.getElementById("notaEntradaModalTitle"),
  notaEntradaFornecedor: document.getElementById("notaEntradaFornecedor"),
  notaEntradaNumero: document.getElementById("notaEntradaNumero"),
  notaEntradaSerie: document.getElementById("notaEntradaSerie"),
  notaEntradaChave: document.getElementById("notaEntradaChave"),
  notaEntradaEmissao: document.getElementById("notaEntradaEmissao"),
  notaEntradaData: document.getElementById("notaEntradaData"),
  notaEntradaDesconto: document.getElementById("notaEntradaDesconto"),
  notaEntradaFrete: document.getElementById("notaEntradaFrete"),
  notaEntradaOutras: document.getElementById("notaEntradaOutras"),
  notaEntradaParcelas: document.getElementById("notaEntradaParcelas"),
  notaEntradaVenc: document.getElementById("notaEntradaVenc"),
  notaEntradaIntervalo: document.getElementById("notaEntradaIntervalo"),
  notaEntradaFormaPagamento: document.getElementById("notaEntradaFormaPagamento"),
  notaEntradaObs: document.getElementById("notaEntradaObs"),
  notaEntradaItensGrid: document.getElementById("notaEntradaItensGrid"),
  notaEntradaAddItemBtn: document.getElementById("notaEntradaAddItemBtn"),
  notaEntradaGerarParcelasBtn: document.getElementById("notaEntradaGerarParcelasBtn"),
  notaEntradaAddParcelaBtn: document.getElementById("notaEntradaAddParcelaBtn"),
  notaEntradaRatearBtn: document.getElementById("notaEntradaRatearBtn"),
  notaEntradaParcelasEditor: document.getElementById("notaEntradaParcelasEditor"),
  notaEntradaParcelasList: document.getElementById("notaEntradaParcelasList"),
  notaEntradaParcelasTotals: document.getElementById("notaEntradaParcelasTotals"),
  notaEntradaParcelasParams: document.getElementById("notaEntradaParcelasParams"),
  notaEntradaSubtotal: document.getElementById("notaEntradaSubtotal"),
  notaEntradaTotal: document.getElementById("notaEntradaTotal"),
  notaEntradaSaveBtn: document.getElementById("notaEntradaSaveBtn"),
  notaEntradaLancarBtn: document.getElementById("notaEntradaLancarBtn"),
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

function resolveProdutoImageUrl(imagemPath) {
  const value = String(imagemPath || "").trim();
  if (!value) return "";

  if (/^https?:\/\//i.test(value)) return value;

  const base = String(state.supabaseUrl || "").replace(/\/$/, "");
  if (!base) return "";

  const cleaned = value.replace(/^\/+/, "");

  // Caminhos ja no bucket
  if (cleaned.startsWith("produto-images/") || cleaned.startsWith("pedido-images/")) {
    return `${base}/storage/v1/object/public/${cleaned}`;
  }

  // Paths legados de produtos
  if (!cleaned.startsWith("Produto_Images/") && !cleaned.startsWith("produto_images/")
    && !cleaned.startsWith("Vendas_Images/") && !cleaned.startsWith("Pedido_Images/")) {
    return `${base}/storage/v1/object/public/produto-images/${cleaned}`;
  }

  return "";
}

function getPedidoFotoUrl(pedidoOrPayload) {
  const payload = pedidoOrPayload?.raw_payload || pedidoOrPayload || null;
  if (!payload) return "";
  const foto = payload.foto_url
    || payload.pedido_row?.Foto
    || payload.pedido_row?.foto
    || payload.Foto
    || "";
  return resolveProdutoImageUrl(foto);
}

function renderPedidoThumbHtml(pedido, className = "pedido-thumb") {
  const url = getPedidoFotoUrl(pedido);
  const title = `Pedido #${pedido?.id || ""}`.trim();
  if (!url) {
    return `<span class="${className} ${className}--empty" title="Sem foto" aria-hidden="true"></span>`;
  }
  return `<img
    class="${className} is-clickable"
    src="${escapeHtml(url)}"
    alt="${escapeHtml(title)}"
    title="Clique para ampliar"
    loading="lazy"
    decoding="async"
    referrerpolicy="no-referrer"
    data-image-preview="${escapeHtml(url)}"
    data-image-title="${escapeHtml(title)}"
    onerror="this.classList.add('is-broken'); this.removeAttribute('data-image-preview');"
  />`;
}

function renderProdutoThumbHtml(produto, className = "produto-thumb") {
  const url = resolveProdutoImageUrl(produto?.imagem_path);
  const title = String(produto?.nome || "Produto").trim();
  if (!url) {
    return `<span class="${className} ${className}--empty" title="Sem imagem" aria-hidden="true"></span>`;
  }
  return `<img
    class="${className} is-clickable"
    src="${escapeHtml(url)}"
    alt="${escapeHtml(title)}"
    title="Clique para ampliar"
    loading="lazy"
    decoding="async"
    referrerpolicy="no-referrer"
    data-image-preview="${escapeHtml(url)}"
    data-image-title="${escapeHtml(title)}"
    onerror="this.classList.add('is-broken'); this.removeAttribute('data-image-preview');"
  />`;
}

function openImageLightbox(url, title = "") {
  if (!els.imageLightbox || !els.imageLightboxImg || !url) return;
  els.imageLightboxImg.src = url;
  els.imageLightboxImg.alt = title || "Imagem do produto";
  if (els.imageLightboxCaption) {
    els.imageLightboxCaption.textContent = title || "";
    els.imageLightboxCaption.classList.toggle("hidden", !title);
  }
  els.imageLightbox.classList.remove("hidden");
}

function closeImageLightbox() {
  if (!els.imageLightbox) return;
  els.imageLightbox.classList.add("hidden");
  if (els.imageLightboxImg) {
    els.imageLightboxImg.removeAttribute("src");
    els.imageLightboxImg.alt = "";
  }
  if (els.imageLightboxCaption) {
    els.imageLightboxCaption.textContent = "";
  }
}

function updateProdutoFormImagePreview() {
  const raw = els.produtoImagemPathInput?.value || els.produtoForm?.elements?.namedItem("imagem_path")?.value || "";
  const url = resolveProdutoImageUrl(raw);
  const title = els.produtoForm?.elements?.namedItem("nome")?.value || "Produto";

  if (els.produtoImagePreview) {
    if (url) {
      els.produtoImagePreview.src = url;
      els.produtoImagePreview.alt = title;
      els.produtoImagePreview.classList.remove("hidden");
      els.produtoImagePreview.classList.add("is-clickable");
      els.produtoImagePreview.dataset.imagePreview = url;
      els.produtoImagePreview.dataset.imageTitle = title;
    } else {
      els.produtoImagePreview.removeAttribute("src");
      els.produtoImagePreview.classList.add("hidden");
      els.produtoImagePreview.classList.remove("is-clickable");
      delete els.produtoImagePreview.dataset.imagePreview;
      delete els.produtoImagePreview.dataset.imageTitle;
    }
  }

  if (els.produtoImageEmpty) {
    els.produtoImageEmpty.classList.toggle("hidden", Boolean(url));
  }
  if (els.produtoImageZoomBtn) {
    els.produtoImageZoomBtn.classList.toggle("hidden", !url);
    els.produtoImageZoomBtn.disabled = !url;
  }
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
  updateItensDocumentoModalChrome();
  els.itensDocumentoModal.classList.remove("hidden");
}

function closeItensDocumentoModal() {
  if (!els.itensDocumentoModal) return;
  els.itensDocumentoModal.classList.add("hidden");
  if (els.novoPedidoClienteBtn) els.novoPedidoClienteBtn.classList.add("hidden");
  if (els.itensDocumentoModalSubtitle) {
    els.itensDocumentoModalSubtitle.textContent = "";
    els.itensDocumentoModalSubtitle.classList.add("hidden");
  }
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
  // Limpa o filtro de busca para o label/lista refletirem a escolha.
  if (els.novoDocumentoClienteSearch) {
    els.novoDocumentoClienteSearch.value = "";
  }
  renderNovoDocumentoClienteSelect();
}

function getNovoDocumentoProdutoComboState(item) {
  const produto = state.produtos.find((produtoItem) => String(produtoItem.id) === String(item.produtoId));
  const descricaoFallback = String(item?.descricao || "").trim();
  return {
    produto,
    label: produto?.nome || descricaoFallback || "Selecionar produto",
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
    item.custoUnitario = Number(produto.custo || 0);
  }
  ensureTrailingEmptyDocumentoItem();
  renderNovoDocumentoItensGrid({ focusRowId: rowId, focusField: "quantidade" });
  if (state.novoDocumentoModal.precoVendaCalc?.open) {
    syncPrecoVendaCalcFromItens({ keepOverrides: true });
    renderPrecoVendaCalcPanel();
  }
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
          ${renderProdutoThumbHtml(produto, "produto-combo-thumb")}
          <span class="produto-combo-option-text">
            <span>${escapeHtml(produto.nome)}</span>
            <small>${moeda.format(produto.preco || 0)}</small>
          </span>
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
      : "Monte um pedido com itens em grade. Status Fechado baixa o estoque automaticamente.",
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
    valorUnitario: Number(produto?.preco || 0),
    custoUnitario: Number(produto?.custo || 0)
  };
}

function createPrecoVendaCalcState(overrides = {}) {
  return {
    open: false,
    custoProdutos: 0,
    maoDeObra: 0,
    frete: 0,
    embalagem: 0,
    outrasDespesas: 0,
    impostosPct: 0,
    taxaCartaoPct: 0,
    comissaoPct: 0,
    margemPct: 30,
    ...overrides
  };
}

function isDocumentoItemFilled(item) {
  return Boolean(String(item?.descricao || "").trim() || item?.produtoId);
}

/** Mantém sempre uma linha em branco no final para incluir o próximo item sem botão. */
function ensureTrailingEmptyDocumentoItem() {
  const items = state.novoDocumentoModal.itens;
  if (!Array.isArray(items)) {
    state.novoDocumentoModal.itens = [createDocumentoDraftItem()];
    return true;
  }

  if (!items.length) {
    items.push(createDocumentoDraftItem());
    return true;
  }

  let changed = false;
  while (items.length > 1) {
    const last = items[items.length - 1];
    const prev = items[items.length - 2];
    if (!isDocumentoItemFilled(last) && !isDocumentoItemFilled(prev)) {
      items.pop();
      changed = true;
    } else {
      break;
    }
  }

  const last = items[items.length - 1];
  if (isDocumentoItemFilled(last)) {
    items.push(createDocumentoDraftItem());
    changed = true;
  }

  return changed;
}

function createDocumentoDraft(tipo = "pedido") {
  const config = getDocumentoModalConfig(tipo);
  return {
    tipo: config.tipo,
    documentoId: null,
    clienteId: "",
    status: config.defaultStatus,
    observacoes: "",
    dataEmissao: formatDateInput(new Date()),
    fotoUrl: "",
    pagamento: createPagamentoDraft(),
    parcelasEditadas: null,
    parcelasOriginaisSnapshot: null,
    itens: [createDocumentoDraftItem()],
    precoVendaCalc: createPrecoVendaCalcState(),
    precoFormacaoAplicada: null,
    rawPayloadBase: null
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

function setNovoDocumentoPagamentoField(field, value, options = {}) {
  const current = getNovoDocumentoPagamentoState();
  let nextValue = value;

  if (field === "parcelas") {
    const parsed = Number(value);
    nextValue = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
    // Se o usuario aumenta parcelas no modo a vista, muda para parcelado automaticamente.
    if (nextValue > 1 && current.modo === "avista") {
      state.novoDocumentoModal.pagamento = {
        ...current,
        modo: "parcelado",
        parcelas: nextValue
      };
      if (els.novoDocumentoPagamentoModo) els.novoDocumentoPagamentoModo.value = "parcelado";
      if (!options.skipRender) renderNovoDocumentoPagamentoSection({ preserveFocus: true });
      return;
    }
  }

  state.novoDocumentoModal.pagamento = {
    ...current,
    [field]: nextValue
  };

  if (options.skipRender) {
    updateNovoDocumentoPagamentoResumoOnly();
    return;
  }
  renderNovoDocumentoPagamentoSection({ preserveFocus: true });
}

function updateNovoDocumentoPagamentoResumoOnly() {
  if (!els.novoDocumentoPagamentoSection || state.novoDocumentoModal.tipo !== "pedido") return;
  const pagamentoState = getNovoDocumentoPagamentoState();
  const subtotal = getNovoDocumentoSubtotal();
  const plano = buildPagamentoPlano(subtotal, pagamentoState);
  const saldo = Math.max(
    0,
    subtotal - Number(pagamentoState.modo === "avista" ? subtotal : pagamentoState.entrada || 0)
  );
  const parcelaBase = plano.parcelas.find((parcela) => parcela.status === "pendente") || plano.parcelas[0];
  if (els.novoDocumentoPagamentoResumo) {
    els.novoDocumentoPagamentoResumo.textContent =
      `Saldo ${moeda.format(saldo)} • ${plano.parcelas.length} registro${plano.parcelas.length === 1 ? "" : "s"}` +
      (parcelaBase ? ` • ${moeda.format(Number(parcelaBase.valor || 0) / 100)}` : "");
  }

  // Mantem o campo de parcelas sempre editavel (nao trava em 1).
  if (els.novoDocumentoPagamentoParcelas) {
    els.novoDocumentoPagamentoParcelas.disabled = false;
    els.novoDocumentoPagamentoParcelas.readOnly = false;
    els.novoDocumentoPagamentoParcelas.min = "1";
  }
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

function renderNovoDocumentoPagamentoSection(options = {}) {
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
  const activeEl = document.activeElement;
  const preserveFocus = Boolean(options.preserveFocus);

  const setIfNotFocused = (el, value) => {
    if (!el) return;
    if (preserveFocus && activeEl === el) return;
    el.value = value;
  };

  setIfNotFocused(els.novoDocumentoPagamentoModo, pagamentoState.modo);
  setIfNotFocused(els.novoDocumentoPagamentoForma, pagamentoState.formaPagamentoId || "");
  setIfNotFocused(els.novoDocumentoPagamentoEntrada, String(pagamentoState.entrada || 0));
  setIfNotFocused(els.novoDocumentoPagamentoParcelas, String(pagamentoState.parcelas || 1));
  setIfNotFocused(els.novoDocumentoPagamentoPrimeiroVencimento, pagamentoState.vencimentoPrimeiraParcela);
  setIfNotFocused(els.novoDocumentoPagamentoIntervalo, String(pagamentoState.intervaloDias || 30));

  // Sempre editavel — o travamento em 1 vinha do re-render forçando o valor.
  if (els.novoDocumentoPagamentoParcelas) {
    els.novoDocumentoPagamentoParcelas.disabled = false;
    els.novoDocumentoPagamentoParcelas.readOnly = false;
    els.novoDocumentoPagamentoParcelas.removeAttribute("readonly");
  }

  const parcelasLabelNode = document.querySelector("[data-pagamento-parcelas-label]");
  const helpTextNode = document.querySelector("[data-pagamento-help]");
  if (parcelasLabelNode) parcelasLabelNode.textContent = labels.parcelasLabel;
  if (helpTextNode) helpTextNode.textContent = labels.helpText;

  if (els.novoDocumentoPagamentoEntrada) {
    els.novoDocumentoPagamentoEntrada.closest("label")?.classList.toggle("hidden", pagamentoState.modo !== "entrada_parcelas");
  }

  // A vista e recebimento imediato: nao faz sentido pedir primeiro vencimento.
  if (els.novoDocumentoPagamentoPrimeiroVencimento) {
    els.novoDocumentoPagamentoPrimeiroVencimento
      .closest("label")
      ?.classList.toggle("hidden", pagamentoState.modo === "avista");
  }

  if (els.novoDocumentoPagamentoResumo) {
    els.novoDocumentoPagamentoResumo.textContent =
      `Saldo ${moeda.format(saldo)} • ${plano.parcelas.length} registro${plano.parcelas.length === 1 ? "" : "s"}` +
      (parcelaBase ? ` • ${moeda.format(Number(parcelaBase.valor || 0) / 100)}` : "");
  }

  // Nao reconstroi o editor de parcelas se o usuario esta digitando nos campos de pagamento.
  const editingPaymentField = preserveFocus && activeEl && els.novoDocumentoPagamentoSection.contains(activeEl);
  if (!editingPaymentField) {
    renderNovoDocumentoParcelasEditor();
  }

  return plano;
}

function planoToParcelasEditadas(plano) {
  const formaPagamentoId = plano.formaPagamentoId ? String(plano.formaPagamentoId) : "";
  return (plano.parcelas || []).map((parcela, index) => ({
    numero: parcela.numero || index + 1,
    vencimento: parcela.vencimento instanceof Date ? formatDateInput(parcela.vencimento) : formatDateInput(new Date()),
    valor: Number((Number(parcela.valor || 0) / 100).toFixed(2)),
    formaPagamentoId,
    status: parcela.status === "recebido" ? "recebido" : "pendente"
  }));
}

function gerarParcelasEditaveis() {
  const subtotal = getNovoDocumentoSubtotal();
  const pagamentoState = getNovoDocumentoPagamentoState();
  const plano = buildPagamentoPlano(subtotal, pagamentoState);
  state.novoDocumentoModal.parcelasEditadas = planoToParcelasEditadas(plano);
  renderNovoDocumentoParcelasEditor();
}

function limparParcelasEditaveis() {
  state.novoDocumentoModal.parcelasEditadas = null;
  renderNovoDocumentoParcelasEditor();
}

function addParcelaEditavel() {
  if (!Array.isArray(state.novoDocumentoModal.parcelasEditadas)) {
    state.novoDocumentoModal.parcelasEditadas = [];
  }
  const parcelas = state.novoDocumentoModal.parcelasEditadas;
  const proximo = parcelas.length + 1;
  const ultimoVenc = parcelas.length ? parseDateInput(parcelas[parcelas.length - 1].vencimento) : new Date();
  const proximoVenc = ultimoVenc ? addDays(ultimoVenc, 30) : new Date();
  parcelas.push({
    numero: proximo,
    vencimento: formatDateInput(proximoVenc),
    valor: 0,
    formaPagamentoId: parcelas[0]?.formaPagamentoId || String(getNovoDocumentoPagamentoState().formaPagamentoId || ""),
    status: "pendente"
  });
  renderNovoDocumentoParcelasEditor();
}

function removerParcelaEditavel(index) {
  if (!Array.isArray(state.novoDocumentoModal.parcelasEditadas)) return;
  state.novoDocumentoModal.parcelasEditadas.splice(index, 1);
  state.novoDocumentoModal.parcelasEditadas.forEach((parcela, idx) => {
    parcela.numero = idx + 1;
  });
  renderNovoDocumentoParcelasEditor();
}

function atualizarParcelaEditavel(index, field, value) {
  const parcela = state.novoDocumentoModal.parcelasEditadas?.[index];
  if (!parcela) return;
  if (field === "valor") parcela.valor = Math.max(0, Number(value || 0));
  else if (field === "status") parcela.status = value === "recebido" ? "recebido" : "pendente";
  else parcela[field] = value;
  renderNovoDocumentoParcelasTotals();
}

function renderNovoDocumentoParcelasTotals() {
  if (!els.novoDocumentoParcelasTotals) return;
  const parcelas = state.novoDocumentoModal.parcelasEditadas || [];
  const totalParcelas = parcelas.reduce((sum, item) => sum + Number(item.valor || 0), 0);
  const subtotal = getNovoDocumentoSubtotal();
  const diff = subtotal - totalParcelas;
  const partes = [`${parcelas.length} parcela${parcelas.length === 1 ? "" : "s"}`, `total ${moeda.format(totalParcelas)}`];
  if (Math.abs(diff) > 0.005) {
    partes.push(diff > 0 ? `faltam ${moeda.format(diff)}` : `excedente ${moeda.format(-diff)}`);
  }
  els.novoDocumentoParcelasTotals.textContent = partes.join(" • ");
}

function renderNovoDocumentoParcelasEditor() {
  if (!els.novoDocumentoParcelasEditor) return;
  const parcelas = state.novoDocumentoModal.parcelasEditadas;
  const editing = Array.isArray(parcelas);
  const isEditPedido = Boolean(state.novoDocumentoModal.documentoId);

  els.novoDocumentoParcelasEditor.classList.toggle("hidden", !editing);
  if (els.novoDocumentoGerarParcelasBtn) {
    els.novoDocumentoGerarParcelasBtn.classList.toggle("hidden", editing);
    els.novoDocumentoGerarParcelasBtn.textContent = isEditPedido
      ? "Editar parcelas deste pedido"
      : "Gerar parcelas para editar";
  }
  if (els.novoDocumentoLimparParcelasBtn) {
    els.novoDocumentoLimparParcelasBtn.classList.toggle("hidden", !editing);
  }

  if (!editing) return;
  if (!els.novoDocumentoParcelasList) return;

  const formasHtml = ['<option value="">Selecione</option>'];
  for (const forma of state.formasPagamento) {
    formasHtml.push(`<option value="${forma.id}">${escapeHtml(forma.nome)}</option>`);
  }

  const aviso = isEditPedido
    ? '<div class="documento-payment-parcelas-warning">Se voce alterar as parcelas abaixo, ao salvar as parcelas e recebimentos anteriores deste pedido serao SUBSTITUIDOS pelos novos titulos.</div>'
    : "";

  els.novoDocumentoParcelasList.innerHTML = aviso + parcelas
    .map((parcela, index) => `
      <div class="documento-payment-parcela-row" data-parcela-index="${index}">
        <div class="parcela-numero">#${parcela.numero || index + 1}</div>
        <label>Vencimento
          <input type="date" data-parcela-field="vencimento" value="${escapeHtml(parcela.vencimento || "")}" />
        </label>
        <label>Valor
          <input type="number" min="0" step="0.01" data-parcela-field="valor" value="${Number(parcela.valor || 0).toFixed(2)}" />
        </label>
        <label>Forma de pagamento
          <select data-parcela-field="formaPagamentoId">
            ${formasHtml
              .map((opt) => opt.replace(/^<option value="([^"]*)"/, (m, v) =>
                v === String(parcela.formaPagamentoId || "")
                  ? `<option value="${v}" selected`
                  : `<option value="${v}"`
              ))
              .join("")}
          </select>
        </label>
        <label>Status
          <select data-parcela-field="status">
            <option value="pendente"${parcela.status === "pendente" ? " selected" : ""}>Pendente</option>
            <option value="recebido"${parcela.status === "recebido" ? " selected" : ""}>Recebido</option>
          </select>
        </label>
        <button type="button" class="btn btn-ghost" data-parcela-remove="${index}">Remover</button>
      </div>
    `)
    .join("");

  renderNovoDocumentoParcelasTotals();
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

function getPagamentoModoLabel(modo) {
  const value = String(modo || "").toLowerCase();
  if (value === "parcelado") return "Parcelado";
  if (value === "entrada_parcelas") return "Entrada + parcelas";
  if (value === "avista" || value === "a_vista" || value === "à vista") return "A vista";
  return "";
}

/** Rotulo de tipo de pagamento a partir do snapshot salvo no pedido (raw_payload.pagamento). */
function getPedidoPagamentoLabel(pedidoOrDoc) {
  const raw = pedidoOrDoc?.raw_payload;
  const pag = raw && typeof raw === "object" ? raw.pagamento : null;
  if (!pag || typeof pag !== "object") return "-";

  const modoLabel = getPagamentoModoLabel(pag.modo);
  const formaNome = getFormaPagamentoNome(pag.formaPagamentoId);
  const parcelas = Math.max(0, Number(pag.parcelas || 0));
  const parts = [];

  if (String(pag.modo || "").toLowerCase() === "parcelado" && parcelas > 0) {
    parts.push(`${parcelas}x`);
  } else if (String(pag.modo || "").toLowerCase() === "entrada_parcelas" && parcelas > 0) {
    parts.push(`Entrada + ${parcelas}x`);
  } else if (modoLabel) {
    parts.push(modoLabel);
  }

  if (formaNome) parts.push(formaNome);
  return parts.length ? parts.join(" · ") : "-";
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
      .select("id, conta_receber_id, numero_parcela, vencimento, valor_parcela, valor_recebido, status, forma_pagamento_id")
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

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const rows = [];
  for (const item of data || []) {
    const parcelas = parcelasByConta.get(Number(item.id)) || [];
    const emissaoDate = item.emissao ? new Date(item.emissao) : null;
    const baseTitulo = item.numero_titulo || `DOC-${item.documento_id || item.id}`;

    if (!parcelas.length) {
      // Sem parcelas registradas: mostra a conta como uma unica linha.
      const vencimentoDate = null;
      const statusNormalizado = normalizeContaStatus(item.status, item.valor_aberto, false);
      rows.push({
        id: `conta-${item.id}`,
        contaId: Number(item.id),
        parcelaId: null,
        documento_id: item.documento_id,
        cliente_id: item.cliente_id,
        cliente: item.cliente,
        numero_titulo: baseTitulo,
        emissao: item.emissao,
        emissaoDate,
        vencimento: null,
        vencimentoDate,
        valor_original: Number(item.valor_original || 0),
        valor_aberto: Number(item.valor_aberto || 0),
        statusNormalizado
      });
      continue;
    }

    const totalParcelas = parcelas.length;
    for (const parcela of parcelas) {
      const valorParcela = Number(parcela.valor_parcela || 0);
      const valorRecebido = Number(parcela.valor_recebido || 0);
      const valorAberto = Math.max(0, Number((valorParcela - valorRecebido).toFixed(2)));
      const vencimentoDate = parcela.vencimento ? new Date(parcela.vencimento) : null;
      const vencComp = vencimentoDate ? new Date(vencimentoDate.getTime()) : null;
      if (vencComp) vencComp.setHours(0, 0, 0, 0);

      const statusRaw = String(parcela.status || "").toLowerCase();
      let parcelaStatus;
      if (statusRaw === "recebido" || statusRaw === "quitado" || valorAberto <= 0.005) {
        parcelaStatus = "recebido";
      } else if (statusRaw === "cancelado") {
        parcelaStatus = "cancelado";
      } else if (valorRecebido > 0.005) {
        parcelaStatus = "parcial";
      } else if (vencComp && vencComp < hoje) {
        parcelaStatus = "vencido";
      } else {
        parcelaStatus = "aberto";
      }

      const parcelaLabel = totalParcelas > 1
        ? `${baseTitulo} • ${parcela.numero_parcela || 1}/${totalParcelas}`
        : baseTitulo;

      rows.push({
        id: `parcela-${parcela.id}`,
        contaId: Number(item.id),
        parcelaId: Number(parcela.id),
        documento_id: item.documento_id,
        cliente_id: item.cliente_id,
        cliente: item.cliente,
        numero_titulo: parcelaLabel,
        emissao: item.emissao,
        emissaoDate,
        vencimento: parcela.vencimento,
        vencimentoDate,
        valor_original: valorParcela,
        valor_aberto: valorAberto,
        statusNormalizado: parcelaStatus
      });
    }
  }

  state.contasReceber = rows;
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
  const targetParcelaId = state.recebimentoModal.parcelaIdTarget;
  const targetParcela = targetParcelaId
    ? (parcelas || []).find((item) => Number(item.id) === Number(targetParcelaId))
    : null;
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

  const defaultParcela = (targetParcela && getParcelaSaldo(targetParcela) > 0.005)
    ? targetParcela
    : (pendingParcelas[0] || null);
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

async function openRecebimentoModalByConta(contaId, parcelaIdTarget = null) {
  const detalhe = await loadContaFinanceiroDetalhe(contaId);
  state.recebimentoModal = {
    contaId,
    conta: detalhe.conta,
    parcelas: detalhe.parcelas,
    recebimentos: detalhe.recebimentos,
    parcelaIdTarget: parcelaIdTarget ? Number(parcelaIdTarget) : null
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

async function createContaFromParcelasEditadas(documentoId, clienteId, parcelasEditadas, defaultFormaPagamentoId) {
  const nowIso = new Date().toISOString();
  const totalOriginal = parcelasEditadas.reduce((sum, item) => sum + Number(item.valor || 0), 0);
  const totalRecebido = parcelasEditadas
    .filter((item) => item.status === "recebido")
    .reduce((sum, item) => sum + Number(item.valor || 0), 0);
  const valorAberto = Math.max(0, totalOriginal - totalRecebido);
  const statusConta = valorAberto <= 0.00001 ? "recebido" : (totalRecebido > 0 ? "parcial" : "aberto");

  const { data: contaCriada, error: contaError } = await supabaseClient
    .from("contas_receber")
    .insert({
      empresa_id: state.empresaId,
      documento_id: documentoId,
      cliente_id: clienteId,
      origem: "venda",
      numero_titulo: `DOC-${documentoId}`,
      emissao: nowIso,
      valor_original: Number(totalOriginal.toFixed(2)),
      valor_aberto: Number(valorAberto.toFixed(2)),
      status: statusConta,
      observacoes: getFormaPagamentoNome(defaultFormaPagamentoId) || null
    })
    .select("id")
    .single();

  if (contaError) throw contaError;

  const parcelasPayload = parcelasEditadas.map((parcela, index) => {
    const valor = Number(parcela.valor || 0);
    const isRecebido = parcela.status === "recebido";
    const formaId = parcela.formaPagamentoId ? Number(parcela.formaPagamentoId) : defaultFormaPagamentoId;
    const vencIso = parcela.vencimento
      ? new Date(`${parcela.vencimento}T12:00:00`).toISOString()
      : nowIso;
    return {
      empresa_id: state.empresaId,
      conta_receber_id: contaCriada.id,
      numero_parcela: parcela.numero || index + 1,
      vencimento: vencIso,
      valor_parcela: Number(valor.toFixed(2)),
      valor_recebido: isRecebido ? Number(valor.toFixed(2)) : 0,
      status: isRecebido ? "recebido" : "pendente",
      forma_pagamento_id: formaId || null,
      observacoes: isRecebido ? "Marcado como recebido na criacao" : null
    };
  });

  const { data: parcelasCriadas, error: parcelasError } = await supabaseClient
    .from("contas_receber_parcelas")
    .insert(parcelasPayload)
    .select("id, numero_parcela");

  if (parcelasError) throw parcelasError;

  const recebimentosPayload = parcelasEditadas
    .map((parcela, index) => {
      if (parcela.status !== "recebido") return null;
      const parcelaCriada = parcelasCriadas?.find((item) => Number(item.numero_parcela) === Number(parcela.numero || index + 1));
      if (!parcelaCriada) return null;
      const formaId = parcela.formaPagamentoId ? Number(parcela.formaPagamentoId) : defaultFormaPagamentoId;
      return {
        empresa_id: state.empresaId,
        parcela_id: parcelaCriada.id,
        data_recebimento: parcela.vencimento
          ? new Date(`${parcela.vencimento}T12:00:00`).toISOString()
          : nowIso,
        valor: Number(Number(parcela.valor || 0).toFixed(2)),
        forma_pagamento_id: formaId || null,
        observacoes: "Marcado como recebido na criacao do pedido"
      };
    })
    .filter(Boolean);

  if (recebimentosPayload.length) {
    const { error: recebimentoError } = await supabaseClient.from("recebimentos").insert(recebimentosPayload);
    if (recebimentoError) throw recebimentoError;
  }
}

async function createDocumentoFinanceiro(documentoId, clienteId, pagamentoState, total, parcelasEditadas = null) {
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

  if (Array.isArray(parcelasEditadas) && parcelasEditadas.length) {
    await createContaFromParcelasEditadas(documentoId, clienteId, parcelasEditadas, formaPagamentoId);
    return;
  }

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

function getDocumentoItemProduto(item) {
  if (!item?.produtoId) return null;
  return state.produtos.find((produto) => String(produto.id) === String(item.produtoId)) || null;
}

function renderNovoDocumentoItemRow(item, options = {}) {
  const rowTotal = getNovoDocumentoItemTotal(item);
  const filled = isDocumentoItemFilled(item);
  const isBlank = Boolean(options.isBlank);
  const canRemove = filled || (state.novoDocumentoModal.itens.length > 1 && !isBlank);
  const produto = getDocumentoItemProduto(item);
  const thumbProduto = produto || {
    nome: item.descricao || "Produto",
    imagem_path: item.imagem_path || null
  };
  const rowClass = [
    "documento-item-row",
    isBlank ? "is-blank" : "",
    filled ? "is-filled" : ""
  ].filter(Boolean).join(" ");

  return `
    <article class="${rowClass}" data-documento-item-row="${item.rowId}">
      <div class="documento-item-cell documento-item-cell--produto" data-col-label="Produto">
        <div class="documento-item-produto-wrap">
          ${renderProdutoThumbHtml(thumbProduto, "documento-item-thumb")}
          <div class="documento-item-produto-combo">
            ${renderNovoDocumentoProdutoCombo(item)}
          </div>
        </div>
      </div>
      <div class="documento-item-cell documento-item-cell--qty" data-col-label="Qtd">
        <input data-documento-item-field="quantidade" type="number" min="1" step="1" value="${escapeHtml(item.quantidade ?? 1)}" ${isBlank ? 'placeholder="1"' : ""} />
      </div>
      <div class="documento-item-cell documento-item-cell--price" data-col-label="Valor unit.">
        <input data-documento-item-field="valorUnitario" type="number" min="0" step="0.01" value="${escapeHtml(item.valorUnitario ?? 0)}" ${isBlank ? 'placeholder="0,00"' : ""} />
      </div>
      <div class="documento-item-total" data-col-label="Total">
        <strong data-documento-item-total>${isBlank && !filled ? "—" : moeda.format(rowTotal)}</strong>
      </div>
      <div class="documento-item-actions">
        ${canRemove
          ? `<button type="button" class="documento-item-remove" data-documento-item-remove="${item.rowId}" title="Remover linha" aria-label="Remover linha">×</button>`
          : `<span class="documento-item-remove-placeholder" aria-hidden="true"></span>`}
      </div>
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
    // Atualiza so o resumo para nao sobrescrever o campo de parcelas enquanto digita.
    updateNovoDocumentoPagamentoResumoOnly();
  }

  if (state.novoDocumentoModal.precoVendaCalc?.open) {
    syncPrecoVendaCalcFromItens({ keepOverrides: true });
    renderPrecoVendaCalcPanel();
  }
}

function renderNovoDocumentoItensGrid(options = {}) {
  if (!els.novoDocumentoItemsGrid) return;
  ensureTrailingEmptyDocumentoItem();

  const items = state.novoDocumentoModal.itens;
  const lastIndex = items.length - 1;
  const header = `
    <div class="documento-items-head-row" aria-hidden="true">
      <span>Produto</span>
      <span>Qtd</span>
      <span>Valor unit.</span>
      <span>Total</span>
      <span></span>
    </div>
  `;

  const rowsHtml = items
    .map((item, index) => renderNovoDocumentoItemRow(item, {
      isBlank: index === lastIndex && !isDocumentoItemFilled(item)
    }))
    .join("");

  els.novoDocumentoItemsGrid.innerHTML = `
    <div class="documento-items-sheet-inner">
      ${header}
      ${rowsHtml}
    </div>
    <p class="documento-items-foot-hint">Nova linha pronta no final da grade — basta selecionar o próximo produto.</p>
  `;

  updateNovoDocumentoResumo();

  if (options.focusRowId) {
    window.requestAnimationFrame(() => {
      const row = els.novoDocumentoItemsGrid.querySelector(`[data-documento-item-row="${options.focusRowId}"]`);
      if (!(row instanceof HTMLElement)) return;
      if (options.focusField) {
        const field = row.querySelector(`[data-documento-item-field="${options.focusField}"]`);
        if (field instanceof HTMLInputElement) {
          field.focus();
          field.select();
          return;
        }
      }
      const trigger = row.querySelector("[data-produto-combo-trigger]");
      if (trigger instanceof HTMLElement) trigger.focus();
    });
  }
}

function renderNovoDocumentoPedidoFoto() {
  const wrap = els.novoDocumentoFotoWrap;
  const img = els.novoDocumentoFoto;
  if (!wrap || !img) return;

  const url = resolveProdutoImageUrl(state.novoDocumentoModal.fotoUrl || "");
  if (!url) {
    wrap.classList.add("hidden");
    img.removeAttribute("src");
    delete img.dataset.imagePreview;
    delete img.dataset.imageTitle;
    return;
  }

  const title = state.novoDocumentoModal.documentoId
    ? `Pedido #${state.novoDocumentoModal.documentoId}`
    : "Foto do pedido";
  img.src = url;
  img.alt = title;
  img.dataset.imagePreview = url;
  img.dataset.imageTitle = title;
  img.classList.add("is-clickable");
  wrap.classList.remove("hidden");
}

function renderNovoDocumentoModal() {
  if (!els.novoDocumentoModal) return;
  const config = getDocumentoModalConfig(state.novoDocumentoModal.tipo);
  const isEdit = Boolean(state.novoDocumentoModal.documentoId);

  if (els.novoDocumentoModalTitle) {
    els.novoDocumentoModalTitle.textContent = isEdit ? config.titulo.replace("Novo", "Editar") : config.titulo;
  }
  if (els.novoDocumentoModalSubtitle) {
    els.novoDocumentoModalSubtitle.textContent = isEdit && state.novoDocumentoModal.fotoUrl
      ? "Edite os dados do pedido. A foto do pedido aparece no resumo ao lado."
      : config.subtitulo;
  }
  if (els.novoDocumentoObservacoes) {
    els.novoDocumentoObservacoes.value = state.novoDocumentoModal.observacoes || "";
  }
  if (els.novoDocumentoDataEmissao) {
    els.novoDocumentoDataEmissao.value = state.novoDocumentoModal.dataEmissao || formatDateInput(new Date());
  }

  renderNovoDocumentoClienteSelect();
  renderNovoDocumentoStatusSelect();
  renderNovoDocumentoFormaPagamentoSelect();
  renderNovoDocumentoItensGrid();
  renderNovoDocumentoPagamentoSection();
  renderNovoDocumentoPedidoFoto();

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
  // Garante que clientes e produtos estao carregados para preencher combos corretamente.
  await Promise.all([ensureClientesLoaded(), ensureProdutosLoaded()]);
  await loadDocumentoForEdit(tipo, documentoId);
  renderNovoDocumentoModal();
  if (els.novoDocumentoModal) {
    els.novoDocumentoModal.classList.remove("hidden");
  }
}

function closeNovoDocumentoModal() {
  if (!els.novoDocumentoModal) return;
  closePrecoVendaCalcPanel();
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
  const produtoId = item?.produto_id ? String(item.produto_id) : "";
  const produto = produtoId
    ? state.produtos.find((entry) => String(entry.id) === produtoId)
    : null;
  return {
    rowId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    produtoId,
    descricao: String(item?.descricao_item || item?.descricao || "").trim(),
    produtoSearch: "",
    quantidade: Number(item?.quantidade || 1),
    valorUnitario: Number(item?.valor_unitario || 0),
    custoUnitario: Number(item?.custo_unitario ?? produto?.custo ?? 0)
  };
}

function getFilledDocumentoItens() {
  return (state.novoDocumentoModal.itens || []).filter((item) => isDocumentoItemFilled(item));
}

function getDocumentoItemCustoUnitario(item) {
  if (item?.custoUnitario != null && Number(item.custoUnitario) > 0) {
    return Number(item.custoUnitario);
  }
  const produto = getDocumentoItemProduto(item);
  return Number(produto?.custo || 0);
}

function computeCustoProdutosFromItens() {
  return getFilledDocumentoItens().reduce((sum, item) => {
    const qtd = Number(item.quantidade || 0);
    const custo = getDocumentoItemCustoUnitario(item);
    return sum + qtd * custo;
  }, 0);
}

function ensurePrecoVendaCalcState() {
  if (!state.novoDocumentoModal.precoVendaCalc) {
    state.novoDocumentoModal.precoVendaCalc = createPrecoVendaCalcState();
  }
  return state.novoDocumentoModal.precoVendaCalc;
}

function syncPrecoVendaCalcFromItens(options = {}) {
  const calc = ensurePrecoVendaCalcState();
  const custoItens = Number(computeCustoProdutosFromItens().toFixed(2));
  if (!options.keepOverrides || !calc._custoProdutosTouched) {
    calc.custoProdutos = custoItens;
  }
  return calc;
}

function computePrecoVendaCalc(calc = ensurePrecoVendaCalcState()) {
  const custoBase =
    Number(calc.custoProdutos || 0) +
    Number(calc.maoDeObra || 0) +
    Number(calc.frete || 0) +
    Number(calc.embalagem || 0) +
    Number(calc.outrasDespesas || 0);

  const impostos = Number(calc.impostosPct || 0) / 100;
  const taxa = Number(calc.taxaCartaoPct || 0) / 100;
  const comissao = Number(calc.comissaoPct || 0) / 100;
  const margem = Number(calc.margemPct || 0) / 100;
  const somaPct = impostos + taxa + comissao + margem;

  let precoSugerido = 0;
  let lucro = 0;
  let aviso = "";

  if (somaPct >= 0.999) {
    aviso = "A soma dos percentuais deve ser menor que 100% para calcular o preço.";
    precoSugerido = 0;
    lucro = 0;
  } else if (custoBase <= 0) {
    aviso = "Informe ao menos um custo base (produtos, mão de obra, frete etc.).";
    precoSugerido = 0;
    lucro = 0;
  } else {
    // Preço de venda = custos / (1 - % impostos - % taxa - % comissão - % margem)
    precoSugerido = custoBase / (1 - somaPct);
    lucro = precoSugerido * margem;
  }

  const totalAtual = getNovoDocumentoSubtotal();
  return {
    custoBase,
    somaPct: somaPct * 100,
    precoSugerido,
    lucro,
    totalAtual,
    diferenca: precoSugerido - totalAtual,
    aviso
  };
}

function openPrecoVendaCalcPanel() {
  const calc = ensurePrecoVendaCalcState();
  calc.open = true;
  calc._custoProdutosTouched = false;
  syncPrecoVendaCalcFromItens();
  renderPrecoVendaCalcPanel();
  els.precoVendaCalcPanel?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function closePrecoVendaCalcPanel() {
  const calc = ensurePrecoVendaCalcState();
  calc.open = false;
  if (els.precoVendaCalcPanel) els.precoVendaCalcPanel.classList.add("hidden");
}

function renderPrecoVendaCalcItens() {
  if (!els.precoVendaCalcItens) return;
  const itens = getFilledDocumentoItens();
  if (!itens.length) {
    els.precoVendaCalcItens.innerHTML = '<div class="documento-empty-state">Adicione itens no pedido para montar a base de custos.</div>';
    return;
  }

  els.precoVendaCalcItens.innerHTML = `
    <div class="preco-venda-calc-itens-table">
      <div class="preco-venda-calc-itens-head">
        <span>Item</span>
        <span>Qtd</span>
        <span>Custo unit.</span>
        <span>Custo total</span>
        <span>Venda atual</span>
      </div>
      ${itens
        .map((item) => {
          const qtd = Number(item.quantidade || 0);
          const custoUnit = getDocumentoItemCustoUnitario(item);
          const custoTotal = qtd * custoUnit;
          const vendaTotal = getNovoDocumentoItemTotal(item);
          return `
            <div class="preco-venda-calc-itens-row">
              <span>${escapeHtml(item.descricao || "Item")}</span>
              <span>${escapeHtml(formatQtyForPdf(qtd))}</span>
              <span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  data-calc-item-custo="${item.rowId}"
                  value="${Number(custoUnit || 0).toFixed(2)}"
                />
              </span>
              <span>${moeda.format(custoTotal)}</span>
              <span>${moeda.format(vendaTotal)}</span>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderPrecoVendaCalcPanel() {
  if (!els.precoVendaCalcPanel) return;
  const calc = ensurePrecoVendaCalcState();
  els.precoVendaCalcPanel.classList.toggle("hidden", !calc.open);
  if (!calc.open) return;

  const result = computePrecoVendaCalc(calc);

  if (els.calcCustoProdutos && document.activeElement !== els.calcCustoProdutos) {
    els.calcCustoProdutos.value = String(Number(calc.custoProdutos || 0).toFixed(2));
  }
  if (els.calcMaoDeObra && document.activeElement !== els.calcMaoDeObra) {
    els.calcMaoDeObra.value = String(Number(calc.maoDeObra || 0).toFixed(2));
  }
  if (els.calcFrete && document.activeElement !== els.calcFrete) {
    els.calcFrete.value = String(Number(calc.frete || 0).toFixed(2));
  }
  if (els.calcEmbalagem && document.activeElement !== els.calcEmbalagem) {
    els.calcEmbalagem.value = String(Number(calc.embalagem || 0).toFixed(2));
  }
  if (els.calcOutrasDespesas && document.activeElement !== els.calcOutrasDespesas) {
    els.calcOutrasDespesas.value = String(Number(calc.outrasDespesas || 0).toFixed(2));
  }
  if (els.calcImpostosPct && document.activeElement !== els.calcImpostosPct) {
    els.calcImpostosPct.value = String(Number(calc.impostosPct || 0));
  }
  if (els.calcTaxaCartaoPct && document.activeElement !== els.calcTaxaCartaoPct) {
    els.calcTaxaCartaoPct.value = String(Number(calc.taxaCartaoPct || 0));
  }
  if (els.calcComissaoPct && document.activeElement !== els.calcComissaoPct) {
    els.calcComissaoPct.value = String(Number(calc.comissaoPct || 0));
  }
  if (els.calcMargemPct && document.activeElement !== els.calcMargemPct) {
    els.calcMargemPct.value = String(Number(calc.margemPct || 0));
  }

  if (els.calcCustoBase) els.calcCustoBase.textContent = moeda.format(result.custoBase);
  if (els.calcSomaPct) els.calcSomaPct.textContent = `${result.somaPct.toFixed(2)}%`;
  if (els.calcLucro) els.calcLucro.textContent = moeda.format(result.lucro);
  if (els.calcPrecoSugerido) els.calcPrecoSugerido.textContent = moeda.format(result.precoSugerido);
  if (els.calcTotalAtual) els.calcTotalAtual.textContent = moeda.format(result.totalAtual);
  if (els.calcDiferenca) {
    const diff = result.diferenca;
    els.calcDiferenca.textContent = `${diff >= 0 ? "+" : ""}${moeda.format(diff)}`;
    els.calcDiferenca.classList.toggle("is-positive", diff > 0.009);
    els.calcDiferenca.classList.toggle("is-negative", diff < -0.009);
  }
  if (els.calcAviso) {
    els.calcAviso.textContent = result.aviso || "";
    els.calcAviso.classList.toggle("hidden", !result.aviso);
  }
  if (els.calcAplicarPrecosBtn) {
    els.calcAplicarPrecosBtn.disabled = Boolean(result.aviso) || result.precoSugerido <= 0;
  }

  // Evita recriar inputs de item se o usuario esta editando um deles
  const active = document.activeElement;
  const editingItemCusto = active instanceof HTMLInputElement && active.hasAttribute("data-calc-item-custo");
  if (!editingItemCusto) {
    renderPrecoVendaCalcItens();
  }
}

function readPrecoVendaCalcFromInputs() {
  const calc = ensurePrecoVendaCalcState();
  if (els.calcCustoProdutos) {
    calc.custoProdutos = Math.max(0, Number(els.calcCustoProdutos.value || 0));
    calc._custoProdutosTouched = true;
  }
  if (els.calcMaoDeObra) calc.maoDeObra = Math.max(0, Number(els.calcMaoDeObra.value || 0));
  if (els.calcFrete) calc.frete = Math.max(0, Number(els.calcFrete.value || 0));
  if (els.calcEmbalagem) calc.embalagem = Math.max(0, Number(els.calcEmbalagem.value || 0));
  if (els.calcOutrasDespesas) calc.outrasDespesas = Math.max(0, Number(els.calcOutrasDespesas.value || 0));
  if (els.calcImpostosPct) calc.impostosPct = Math.max(0, Number(els.calcImpostosPct.value || 0));
  if (els.calcTaxaCartaoPct) calc.taxaCartaoPct = Math.max(0, Number(els.calcTaxaCartaoPct.value || 0));
  if (els.calcComissaoPct) calc.comissaoPct = Math.max(0, Number(els.calcComissaoPct.value || 0));
  if (els.calcMargemPct) calc.margemPct = Math.max(0, Number(els.calcMargemPct.value || 0));
  return calc;
}

function applyPrecoVendaCalcToItens() {
  const calc = ensurePrecoVendaCalcState();
  const result = computePrecoVendaCalc(calc);
  if (result.aviso || result.precoSugerido <= 0) {
    showToast(result.aviso || "Nao foi possivel calcular o preco.", "error");
    return;
  }

  const itens = getFilledDocumentoItens();
  if (!itens.length) {
    showToast("Adicione itens antes de aplicar o preco.", "error");
    return;
  }

  // Rateio proporcional ao custo; se custo zerado, rateia pelo valor atual; se ambos zero, igual.
  const pesos = itens.map((item) => {
    const qtd = Math.max(Number(item.quantidade || 0), 0);
    const custoTotal = qtd * getDocumentoItemCustoUnitario(item);
    const vendaTotal = getNovoDocumentoItemTotal(item);
    return custoTotal > 0 ? custoTotal : vendaTotal > 0 ? vendaTotal : 1;
  });
  const pesoTotal = pesos.reduce((s, p) => s + p, 0) || itens.length;

  let alocado = 0;
  itens.forEach((item, index) => {
    const isLast = index === itens.length - 1;
    const fatia = isLast
      ? Math.max(0, result.precoSugerido - alocado)
      : (result.precoSugerido * pesos[index]) / pesoTotal;
    alocado += fatia;
    const qtd = Math.max(Number(item.quantidade || 0), 0.0001);
    item.valorUnitario = Number((fatia / qtd).toFixed(2));
  });

  // Snapshot da formacao de preco no pedido (historico da decisao comercial).
  const snapshot = buildPrecoFormacaoSnapshot(calc, result);
  state.novoDocumentoModal.precoFormacaoAplicada = {
    ...snapshot,
    total_atual_antes: Number(result.totalAtual || 0),
    aplicado_em: new Date().toISOString(),
    itens: getFilledDocumentoItens().map((item) => ({
      rowId: item.rowId,
      produtoId: item.produtoId || null,
      descricao: item.descricao || "",
      quantidade: Number(item.quantidade || 0),
      custo_unitario: getDocumentoItemCustoUnitario(item),
      valor_unitario: Number(item.valorUnitario || 0)
    }))
  };

  renderNovoDocumentoItensGrid();
  updateNovoDocumentoResumo();
  renderPrecoVendaCalcPanel();
  showToast("Preco sugerido aplicado nos itens do pedido");
}

function getProdutoFormNumber(name, fallback = 0) {
  const field = els.produtoForm?.elements?.namedItem(name);
  if (!field || !("value" in field)) return fallback;
  const num = Number(field.value);
  return Number.isFinite(num) ? num : fallback;
}

function setProdutoFormNumber(name, value) {
  const field = els.produtoForm?.elements?.namedItem(name);
  if (!field || !("value" in field)) return;
  field.value = String(Number(value || 0));
}

function ensureProdutoPrecoVendaCalcState() {
  if (!state.produtoPrecoVendaCalc) {
    state.produtoPrecoVendaCalc = createPrecoVendaCalcState({
      custoProdutos: 0,
      margemPct: 30
    });
  }
  return state.produtoPrecoVendaCalc;
}

function syncProdutoPrecoVendaCalcFromForm(options = {}) {
  const calc = ensureProdutoPrecoVendaCalcState();
  const custoCadastro = Math.max(0, getProdutoFormNumber("custo", 0));
  if (!options.keepOverrides || !calc._custoProdutosTouched) {
    calc.custoProdutos = Number(custoCadastro.toFixed(2));
  }
  const margemCadastro = getProdutoFormNumber("margem", NaN);
  if (!options.keepOverrides && Number.isFinite(margemCadastro) && margemCadastro > 0) {
    calc.margemPct = margemCadastro;
  }
  return calc;
}

function openProdutoPrecoVendaCalcPanel() {
  const calc = ensureProdutoPrecoVendaCalcState();
  calc.open = true;
  calc._custoProdutosTouched = false;
  syncProdutoPrecoVendaCalcFromForm();
  renderProdutoPrecoVendaCalcPanel();
  els.produtoPrecoVendaCalcPanel?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function closeProdutoPrecoVendaCalcPanel() {
  const calc = ensureProdutoPrecoVendaCalcState();
  calc.open = false;
  if (els.produtoPrecoVendaCalcPanel) els.produtoPrecoVendaCalcPanel.classList.add("hidden");
}

function readProdutoPrecoVendaCalcFromInputs() {
  const calc = ensureProdutoPrecoVendaCalcState();
  if (els.produtoCalcCusto) {
    calc.custoProdutos = Math.max(0, Number(els.produtoCalcCusto.value || 0));
    calc._custoProdutosTouched = true;
  }
  if (els.produtoCalcMaoDeObra) calc.maoDeObra = Math.max(0, Number(els.produtoCalcMaoDeObra.value || 0));
  if (els.produtoCalcFrete) calc.frete = Math.max(0, Number(els.produtoCalcFrete.value || 0));
  if (els.produtoCalcEmbalagem) calc.embalagem = Math.max(0, Number(els.produtoCalcEmbalagem.value || 0));
  if (els.produtoCalcOutrasDespesas) calc.outrasDespesas = Math.max(0, Number(els.produtoCalcOutrasDespesas.value || 0));
  if (els.produtoCalcImpostosPct) calc.impostosPct = Math.max(0, Number(els.produtoCalcImpostosPct.value || 0));
  if (els.produtoCalcTaxaCartaoPct) calc.taxaCartaoPct = Math.max(0, Number(els.produtoCalcTaxaCartaoPct.value || 0));
  if (els.produtoCalcComissaoPct) calc.comissaoPct = Math.max(0, Number(els.produtoCalcComissaoPct.value || 0));
  if (els.produtoCalcMargemPct) calc.margemPct = Math.max(0, Number(els.produtoCalcMargemPct.value || 0));
  return calc;
}

function renderProdutoPrecoVendaCalcPanel() {
  if (!els.produtoPrecoVendaCalcPanel) return;
  const calc = ensureProdutoPrecoVendaCalcState();
  els.produtoPrecoVendaCalcPanel.classList.toggle("hidden", !calc.open);
  if (!calc.open) return;

  // Reusa a mesma formula do pedido, com custo do produto no campo custoProdutos.
  const resultCore = computePrecoVendaCalc(calc);
  const precoAtual = Math.max(0, getProdutoFormNumber("preco", 0));
  const result = {
    ...resultCore,
    totalAtual: precoAtual,
    diferenca: resultCore.precoSugerido - precoAtual
  };

  const setIfNotFocused = (el, value) => {
    if (!el) return;
    if (document.activeElement === el) return;
    el.value = value;
  };

  setIfNotFocused(els.produtoCalcCusto, String(Number(calc.custoProdutos || 0).toFixed(2)));
  setIfNotFocused(els.produtoCalcMaoDeObra, String(Number(calc.maoDeObra || 0).toFixed(2)));
  setIfNotFocused(els.produtoCalcFrete, String(Number(calc.frete || 0).toFixed(2)));
  setIfNotFocused(els.produtoCalcEmbalagem, String(Number(calc.embalagem || 0).toFixed(2)));
  setIfNotFocused(els.produtoCalcOutrasDespesas, String(Number(calc.outrasDespesas || 0).toFixed(2)));
  setIfNotFocused(els.produtoCalcImpostosPct, String(Number(calc.impostosPct || 0)));
  setIfNotFocused(els.produtoCalcTaxaCartaoPct, String(Number(calc.taxaCartaoPct || 0)));
  setIfNotFocused(els.produtoCalcComissaoPct, String(Number(calc.comissaoPct || 0)));
  setIfNotFocused(els.produtoCalcMargemPct, String(Number(calc.margemPct || 0)));

  if (els.produtoCalcCustoBase) els.produtoCalcCustoBase.textContent = moeda.format(result.custoBase);
  if (els.produtoCalcSomaPct) els.produtoCalcSomaPct.textContent = `${result.somaPct.toFixed(2)}%`;
  if (els.produtoCalcLucro) els.produtoCalcLucro.textContent = moeda.format(result.lucro);
  if (els.produtoCalcPrecoSugerido) els.produtoCalcPrecoSugerido.textContent = moeda.format(result.precoSugerido);
  if (els.produtoCalcPrecoAtual) els.produtoCalcPrecoAtual.textContent = moeda.format(result.totalAtual);
  if (els.produtoCalcDiferenca) {
    const diff = result.diferenca;
    els.produtoCalcDiferenca.textContent = `${diff >= 0 ? "+" : ""}${moeda.format(diff)}`;
    els.produtoCalcDiferenca.classList.toggle("is-positive", diff > 0.009);
    els.produtoCalcDiferenca.classList.toggle("is-negative", diff < -0.009);
  }
  if (els.produtoCalcAviso) {
    els.produtoCalcAviso.textContent = result.aviso || "";
    els.produtoCalcAviso.classList.toggle("hidden", !result.aviso);
  }
  if (els.produtoCalcAplicarPrecoBtn) {
    els.produtoCalcAplicarPrecoBtn.disabled = Boolean(result.aviso) || result.precoSugerido <= 0;
  }
}

function buildPrecoFormacaoSnapshot(calc, result = null) {
  const computed = result || computePrecoVendaCalc(calc);
  return {
    custo_produto: Number(calc.custoProdutos || 0),
    mao_de_obra: Number(calc.maoDeObra || 0),
    frete: Number(calc.frete || 0),
    embalagem: Number(calc.embalagem || 0),
    outras_despesas: Number(calc.outrasDespesas || 0),
    impostos_pct: Number(calc.impostosPct || 0),
    taxa_cartao_pct: Number(calc.taxaCartaoPct || 0),
    comissao_pct: Number(calc.comissaoPct || 0),
    margem_pct: Number(calc.margemPct || 0),
    custo_base: Number(computed.custoBase || 0),
    preco_sugerido: Number(computed.precoSugerido || 0),
    lucro_estimado: Number(computed.lucro || 0),
    soma_pct: Number(computed.somaPct || 0),
    atualizado_em: new Date().toISOString()
  };
}

function hydrateProdutoPrecoVendaCalcFromSnapshot(snapshot, fallback = {}) {
  const src = snapshot && typeof snapshot === "object" ? snapshot : {};
  return createPrecoVendaCalcState({
    open: false,
    custoProdutos: Number(src.custo_produto ?? fallback.custo ?? 0),
    maoDeObra: Number(src.mao_de_obra || 0),
    frete: Number(src.frete || 0),
    embalagem: Number(src.embalagem || 0),
    outrasDespesas: Number(src.outras_despesas || 0),
    impostosPct: Number(src.impostos_pct || 0),
    taxaCartaoPct: Number(src.taxa_cartao_pct || 0),
    comissaoPct: Number(src.comissao_pct || 0),
    margemPct: Number(src.margem_pct ?? fallback.margem ?? 30) || 30,
    _custoProdutosTouched: Boolean(src && Object.keys(src).length)
  });
}

function getCurrentProdutoPrecoFormacaoForSave() {
  // Preferencia: snapshot ja aplicado na calculadora; senao monta a partir do estado atual se aberta.
  if (state.produtoPrecoFormacaoPending) {
    return state.produtoPrecoFormacaoPending;
  }
  if (state.produtoPrecoVendaCalc?.open) {
    const calc = readProdutoPrecoVendaCalcFromInputs();
    const result = computePrecoVendaCalc(calc);
    if (!result.aviso && result.precoSugerido > 0) {
      return buildPrecoFormacaoSnapshot(calc, result);
    }
  }
  return null;
}

function applyProdutoPrecoVendaCalcToForm() {
  const calc = ensureProdutoPrecoVendaCalcState();
  const result = computePrecoVendaCalc(calc);
  if (result.aviso || result.precoSugerido <= 0) {
    showToast(result.aviso || "Nao foi possivel calcular o preco.", "error");
    return;
  }

  setProdutoFormNumber("preco", Number(result.precoSugerido.toFixed(2)));
  setProdutoFormNumber("margem", Number(calc.margemPct || 0));
  // Mantem o custo principal do cadastro alinhado com o custo base do produto na calculadora.
  if (els.produtoCalcCusto) {
    setProdutoFormNumber("custo", Number(calc.custoProdutos || 0));
  }
  state.produtoPrecoFormacaoPending = buildPrecoFormacaoSnapshot(calc, result);
  renderProdutoPrecoVendaCalcPanel();
  showToast("Preco aplicado. Salve o produto para gravar a formacao de preco.");
}

async function loadDocumentoForEdit(tipo, documentoId) {
  const { data: documento, error: documentoError } = await supabaseClient
    .from("documentos_venda")
    .select("id, cliente_id, status, observacoes, total, raw_payload, data_emissao")
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

  // Carrega parcelas ja salvas para esse pedido (se existirem) para pre-preencher o editor.
  let parcelasEditadas = null;
  if (tipo === "pedido") {
    try {
      const { data: contasVinculadas, error: contasErr } = await supabaseClient
        .from("contas_receber")
        .select("id")
        .eq("empresa_id", state.empresaId)
        .eq("documento_id", documentoId);

      if (contasErr && !isMissingRelationError(contasErr)) throw contasErr;

      const contaIds = (contasVinculadas || []).map((item) => Number(item.id)).filter(Number.isFinite);
      if (contaIds.length) {
        const { data: parcelasSalvas, error: parcelasErr } = await supabaseClient
          .from("contas_receber_parcelas")
          .select("numero_parcela, vencimento, valor_parcela, valor_recebido, status, forma_pagamento_id")
          .eq("empresa_id", state.empresaId)
          .in("conta_receber_id", contaIds)
          .order("vencimento", { ascending: true });

        if (parcelasErr && !isMissingRelationError(parcelasErr)) throw parcelasErr;

        const parcelasArr = parcelasSalvas || [];
        if (parcelasArr.length) {
          parcelasEditadas = parcelasArr.map((parcela, idx) => {
            const valor = Number(parcela.valor_parcela || 0);
            const recebido = Number(parcela.valor_recebido || 0);
            const statusRaw = String(parcela.status || "").toLowerCase();
            const isRecebido = statusRaw === "recebido" || statusRaw === "quitado" || (valor > 0 && recebido + 0.005 >= valor);
            return {
              numero: Number(parcela.numero_parcela) || idx + 1,
              vencimento: parcela.vencimento ? formatDateInput(new Date(parcela.vencimento)) : "",
              valor: Number(valor.toFixed(2)),
              formaPagamentoId: parcela.forma_pagamento_id ? String(parcela.forma_pagamento_id) : "",
              status: isRecebido ? "recebido" : "pendente"
            };
          });
        }
      }
    } catch (loadErr) {
      console.warn("Falha ao carregar parcelas salvas do pedido em edicao", loadErr);
    }
  }

  const rawPayload = documento.raw_payload && typeof documento.raw_payload === "object"
    ? documento.raw_payload
    : {};
  const precoFormacaoAplicada = rawPayload.preco_formacao || null;

  state.novoDocumentoModal = {
    tipo,
    documentoId,
    clienteId: documento.cliente_id ? String(documento.cliente_id) : "",
    status: documento.status || "aberto",
    observacoes: documento.observacoes || "",
    dataEmissao: documento.data_emissao
      ? formatDateInput(new Date(documento.data_emissao))
      : formatDateInput(new Date()),
    fotoUrl: getPedidoFotoUrl(documento),
    pagamento: {
      ...createPagamentoDraft(),
      ...(rawPayload.pagamento || {})
    },
    parcelasEditadas,
    parcelasOriginaisSnapshot: parcelasEditadas ? JSON.stringify(parcelasEditadas) : null,
    itens: (itensData || []).length
      ? (itensData || []).map(normalizeDocumentoItem)
      : [createDocumentoDraftItem()],
    precoVendaCalc: hydrateProdutoPrecoVendaCalcFromSnapshot(precoFormacaoAplicada),
    precoFormacaoAplicada,
    // Mantem campos legados (foto, import, etc.) ao regravar o pedido.
    rawPayloadBase: rawPayload
  };
}

function setNovoDocumentoTipo(tipo) {
  state.novoDocumentoModal.tipo = tipo === "orcamento" ? "orcamento" : "pedido";
  const config = getDocumentoModalConfig(state.novoDocumentoModal.tipo);
  state.novoDocumentoModal.status = config.defaultStatus;
  renderNovoDocumentoModal();
}

function addNovoDocumentoItem(produto = null) {
  // Se a última linha está vazia, preenche ela; senão, acrescenta.
  const items = state.novoDocumentoModal.itens;
  const last = items[items.length - 1];
  if (last && !isDocumentoItemFilled(last) && produto) {
    last.produtoId = produto?.id ? String(produto.id) : "";
    last.descricao = produto?.nome || "";
    last.produtoSearch = "";
    last.quantidade = 1;
    last.valorUnitario = Number(produto?.preco || 0);
    last.custoUnitario = Number(produto?.custo || 0);
  } else if (last && !isDocumentoItemFilled(last) && !produto) {
    // Já existe linha em branco — só garante e foca nela.
  } else {
    items.push(createDocumentoDraftItem(produto));
  }
  ensureTrailingEmptyDocumentoItem();
  const focusId = produto
    ? (items.find((item) => String(item.produtoId) === String(produto.id))?.rowId || items[items.length - 2]?.rowId)
    : items[items.length - 1]?.rowId;
  renderNovoDocumentoItensGrid({
    focusRowId: focusId,
    focusField: produto ? "quantidade" : null
  });
}

function removeNovoDocumentoItem(rowId) {
  state.novoDocumentoModal.itens = state.novoDocumentoModal.itens.filter((item) => item.rowId !== rowId);
  ensureTrailingEmptyDocumentoItem();
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
                    ${renderProdutoThumbHtml(produto, "produto-combo-thumb")}
                    <span class="produto-combo-option-text">
                      <span>${escapeHtml(produto.nome)}</span>
                      <small>${moeda.format(produto.preco || 0)}</small>
                    </span>
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
    .map((item) => {
      const produto = getDocumentoItemProduto(item);
      const imagemPath = produto?.imagem_path || item.imagem_path || null;
      return {
        produtoId: item.produtoId ? Number(item.produtoId) : null,
        descricao: String(item.descricao || produto?.nome || "").trim(),
        quantidade: Number(item.quantidade || 0),
        valorUnitario: Number(item.valorUnitario || 0),
        imagemPath,
        imagemUrl: resolveProdutoImageUrl(imagemPath)
      };
    })
    .filter((item) => item.descricao || item.produtoId);
}

function syncNovoDocumentoDraftFromForm() {
  if (els.novoDocumentoObservacoes) {
    state.novoDocumentoModal.observacoes = els.novoDocumentoObservacoes.value || "";
  }
  if (els.novoDocumentoDataEmissao) {
    state.novoDocumentoModal.dataEmissao = els.novoDocumentoDataEmissao.value || state.novoDocumentoModal.dataEmissao;
  }
  if (els.novoDocumentoStatusSelect) {
    state.novoDocumentoModal.status = els.novoDocumentoStatusSelect.value || state.novoDocumentoModal.status;
  }
  if (els.novoDocumentoClienteId) {
    state.novoDocumentoModal.clienteId = els.novoDocumentoClienteId.value || state.novoDocumentoModal.clienteId;
  }
}

function formatQtyForPdf(value) {
  const num = Number(value || 0);
  if (Number.isInteger(num)) return String(num);
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

function getPagamentoResumoTextoParaPdf() {
  if (state.novoDocumentoModal.tipo !== "pedido") return "";
  const pag = getNovoDocumentoPagamentoState();
  const forma = state.formasPagamento.find((item) => String(item.id) === String(pag.formaPagamentoId));
  const formaNome = forma?.nome || "A combinar";
  if (pag.modo === "entrada_parcelas") {
    return `Entrada de ${moeda.format(pag.entrada || 0)} + ${pag.parcelas} parcela(s) · ${formaNome}`;
  }
  if (pag.modo === "parcelado") {
    return `${pag.parcelas} parcela(s) · ${formaNome}`;
  }
  return `À vista · ${formaNome}`;
}

function buildOrcamentoPdfHtml(payload) {
  const {
    empresaNome,
    cliente,
    dataEmissaoLabel,
    numeroRef,
    itens,
    subtotal,
    observacoes,
    pagamentoTexto,
    geradoEm
  } = payload;

  const rows = itens
    .map((item, index) => {
      const total = Number(item.quantidade || 0) * Number(item.valorUnitario || 0);
      const img = item.imagemUrl
        ? `<img class="item-photo" src="${escapeHtml(item.imagemUrl)}" alt="" />`
        : `<span class="item-photo item-photo-empty"></span>`;
      return `
        <tr>
          <td class="col-idx">${index + 1}</td>
          <td class="col-desc">
            <div class="item-desc-wrap">
              ${img}
              <span>${escapeHtml(item.descricao || "Item")}</span>
            </div>
          </td>
          <td class="col-num">${escapeHtml(formatQtyForPdf(item.quantidade))}</td>
          <td class="col-num">${escapeHtml(moeda.format(item.valorUnitario || 0))}</td>
          <td class="col-num">${escapeHtml(moeda.format(total))}</td>
        </tr>
      `;
    })
    .join("");

  const clienteLinhas = [
    cliente?.nome ? `<strong>${escapeHtml(cliente.nome)}</strong>` : "<strong>Cliente não informado</strong>",
    cliente?.telefone ? `Tel.: ${escapeHtml(cliente.telefone)}` : "",
    cliente?.email ? `E-mail: ${escapeHtml(cliente.email)}` : ""
  ].filter(Boolean).join("<br />");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(payload.fileTitle || "Orcamento")}</title>
  <style>
    @page { size: A4; margin: 14mm 12mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", Arial, sans-serif;
      color: #1f1e1a;
      background: #fff;
      font-size: 12px;
      line-height: 1.45;
    }
    .sheet { max-width: 190mm; margin: 0 auto; }
    .header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
      border-bottom: 3px solid #165d59;
      padding-bottom: 14px;
      margin-bottom: 18px;
    }
    .brand h1 {
      margin: 0;
      font-size: 22px;
      letter-spacing: -0.02em;
      color: #0f4744;
    }
    .brand p { margin: 4px 0 0; color: #5f5a50; }
    .doc-meta {
      text-align: right;
      min-width: 180px;
    }
    .badge {
      display: inline-block;
      background: #165d59;
      color: #fff;
      font-weight: 700;
      font-size: 11px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 5px 10px;
      border-radius: 999px;
      margin-bottom: 8px;
    }
    .doc-meta strong { display: block; font-size: 14px; margin-top: 2px; }
    .doc-meta span { color: #5f5a50; }
    .grid-2 {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 14px;
      margin-bottom: 18px;
    }
    .card {
      border: 1px solid #ddd2c0;
      border-radius: 10px;
      padding: 12px 14px;
      background: #fbf8f2;
    }
    .card h2 {
      margin: 0 0 8px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #165d59;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4px;
    }
    thead th {
      background: #165d59;
      color: #fff;
      text-align: left;
      padding: 9px 8px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    tbody td {
      padding: 9px 8px;
      border-bottom: 1px solid #e8dfd0;
      vertical-align: top;
    }
    tbody tr:nth-child(even) td { background: #faf7f1; }
    .col-idx { width: 36px; text-align: center; color: #6d675c; vertical-align: middle; }
    .col-num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; vertical-align: middle; }
    .col-desc { width: 52%; vertical-align: middle; }
    .item-desc-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .item-desc-wrap span {
      line-height: 1.35;
    }
    .item-photo {
      width: 48px;
      height: 48px;
      object-fit: cover;
      border-radius: 8px;
      border: 1px solid #e0d5c0;
      background: #f4efe6;
      flex: 0 0 auto;
    }
    .item-photo-empty {
      display: inline-block;
      background: linear-gradient(135deg, #f4efe6 0%, #e8dfd0 100%);
    }
    .totals {
      margin-top: 14px;
      display: flex;
      justify-content: flex-end;
    }
    .totals-box {
      min-width: 240px;
      border: 1px solid #d7cdb9;
      border-radius: 10px;
      overflow: hidden;
    }
    .totals-box .row {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 10px 14px;
      background: #fff;
    }
    .totals-box .row.total {
      background: #165d59;
      color: #fff;
      font-size: 15px;
      font-weight: 700;
    }
    .notes {
      margin-top: 18px;
      border-top: 1px dashed #d7cdb9;
      padding-top: 12px;
    }
    .notes h3 {
      margin: 0 0 6px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #165d59;
    }
    .notes p { margin: 0; white-space: pre-wrap; color: #3b372f; }
    .approval {
      margin-top: 28px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 28px;
    }
    .sign {
      border-top: 1px solid #9f9687;
      padding-top: 8px;
      text-align: center;
      color: #5f5a50;
      min-height: 48px;
    }
    .footer {
      margin-top: 28px;
      font-size: 10px;
      color: #7a7468;
      text-align: center;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
    .toolbar {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-bottom: 12px;
    }
    .toolbar button {
      border: 0;
      border-radius: 8px;
      padding: 8px 12px;
      font-weight: 700;
      cursor: pointer;
    }
    .toolbar .primary { background: #165d59; color: #fff; }
    .toolbar .ghost { background: #ece7de; color: #1f1e1a; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="toolbar no-print">
      <button class="ghost" type="button" onclick="window.close()">Fechar</button>
      <button class="primary" type="button" onclick="window.print()">Salvar / Imprimir PDF</button>
    </div>

    <header class="header">
      <div class="brand">
        <h1>${escapeHtml(empresaNome || "Empresa")}</h1>
        <p>Orçamento para aprovação do cliente</p>
      </div>
      <div class="doc-meta">
        <div class="badge">Orçamento</div>
        <span>Referência</span>
        <strong>${escapeHtml(numeroRef)}</strong>
        <span style="display:block;margin-top:8px;">Emissão</span>
        <strong>${escapeHtml(dataEmissaoLabel)}</strong>
      </div>
    </header>

    <section class="grid-2">
      <div class="card">
        <h2>Cliente</h2>
        <div>${clienteLinhas}</div>
      </div>
      <div class="card">
        <h2>Condições</h2>
        <div>
          ${pagamentoTexto ? escapeHtml(pagamentoTexto) : "Condições comerciais a combinar."}
          <br /><span style="color:#5f5a50;">Documento gerado para análise e aprovação.</span>
        </div>
      </div>
    </section>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Descrição</th>
          <th class="col-num">Qtd</th>
          <th class="col-num">Valor unit.</th>
          <th class="col-num">Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="5">Nenhum item informado.</td></tr>`}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-box">
        <div class="row total">
          <span>Total</span>
          <span>${escapeHtml(moeda.format(subtotal || 0))}</span>
        </div>
      </div>
    </div>

    ${observacoes
      ? `<section class="notes"><h3>Observações</h3><p>${escapeHtml(observacoes)}</p></section>`
      : ""}

    <section class="approval">
      <div class="sign">Assinatura do cliente<br />Data: ____/____/________</div>
      <div class="sign">Assinatura da empresa<br />${escapeHtml(empresaNome || "")}</div>
    </section>

    <p class="footer">Gerado em ${escapeHtml(geradoEm)} · Documento não fiscal · Válido para aprovação comercial</p>
  </div>
  <script>
    function waitForImages(timeoutMs) {
      var images = Array.prototype.slice.call(document.images || []);
      if (!images.length) return Promise.resolve();
      return Promise.race([
        Promise.all(images.map(function (img) {
          if (img.complete) return Promise.resolve();
          return new Promise(function (resolve) {
            img.onload = resolve;
            img.onerror = resolve;
          });
        })),
        new Promise(function (resolve) { setTimeout(resolve, timeoutMs || 2500); })
      ]);
    }
    window.addEventListener("load", function () {
      waitForImages(3000).then(function () {
        setTimeout(function () {
          try { window.focus(); window.print(); } catch (e) {}
        }, 200);
      });
    });
  </script>
</body>
</html>`;
}

function generateDocumentoOrcamentoPdf() {
  syncNovoDocumentoDraftFromForm();

  const itens = getDocumentoItensPayload();
  if (!itens.length) {
    showToast("Adicione ao menos um item antes de gerar o PDF.", "error");
    return;
  }

  const cliente = state.clientes.find(
    (item) => String(item.id) === String(state.novoDocumentoModal.clienteId)
  );
  if (!cliente) {
    showToast("Selecione o cliente antes de gerar o PDF do orçamento.", "error");
    return;
  }

  const dataEmissao = state.novoDocumentoModal.dataEmissao || formatDateInput(new Date());
  const dataEmissaoDate = parseDateInput(dataEmissao) || new Date();
  const dataEmissaoLabel = dataEmissaoDate.toLocaleDateString("pt-BR");
  const subtotal = itens.reduce(
    (sum, item) => sum + Number(item.quantidade || 0) * Number(item.valorUnitario || 0),
    0
  );
  const docId = state.novoDocumentoModal.documentoId;
  const numeroRef = docId
    ? `ORC-${String(docId).padStart(6, "0")}`
    : `ORC-RASCUNHO-${dataEmissaoDate.toISOString().slice(0, 10).replace(/-/g, "")}`;
  const clienteSlug = String(cliente.nome || "cliente")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "cliente";
  const fileTitle = `Orcamento-${clienteSlug}-${dataEmissaoLabel.replace(/\//g, "-")}`;

  const html = buildOrcamentoPdfHtml({
    empresaNome: state.empresaNome || saasName || "Empresa",
    cliente,
    dataEmissaoLabel,
    numeroRef,
    itens,
    subtotal,
    observacoes: String(state.novoDocumentoModal.observacoes || "").trim(),
    pagamentoTexto: getPagamentoResumoTextoParaPdf(),
    geradoEm: new Date().toLocaleString("pt-BR"),
    fileTitle
  });

  const win = window.open("", "_blank");
  if (!win) {
    showToast("Permita pop-ups no navegador para gerar o PDF.", "error");
    return;
  }

  win.document.open();
  win.document.write(html);
  win.document.close();
  showToast("PDF do orçamento pronto — use Salvar como PDF na impressão.");
}

async function saveNovoDocumento(event) {
  event.preventDefault();
  // Trava sincrona: clique duplo / Enter repetido nao pode abrir 2 inserts em paralelo.
  if (state.novoDocumentoSaving) return;
  state.novoDocumentoSaving = true;

  const submitBtn = els.novoDocumentoSubmitBtn;
  const submitLabelOriginal = submitBtn?.textContent || "Salvar";
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Salvando...";
  }

  try {
    const draft = state.novoDocumentoModal;
    const isEdit = Boolean(draft.documentoId);
    const formData = new FormData(els.novoDocumentoForm);
    const clienteIdRaw = Number(formData.get("cliente_id"));
    const clienteId = Number.isFinite(clienteIdRaw) && clienteIdRaw > 0 ? clienteIdRaw : null;
    const status = String(formData.get("status") || draft.status || "aberto");
    const observacoes = String(formData.get("observacoes") || "").trim();
    const dataEmissaoInput = String(formData.get("data_emissao") || draft.dataEmissao || "").trim();
    const itens = getDocumentoItensPayload();
    const pagamentoState = getNovoDocumentoPagamentoState();

    if (!itens.length) {
      throw new Error("Adicione ao menos um item antes de salvar.");
    }

    const dataEmissaoIso = dataEmissaoInput
      ? new Date(`${dataEmissaoInput}T12:00:00`).toISOString()
      : new Date().toISOString();

    const subtotal = itens.reduce((sum, item) => sum + Number(item.quantidade || 0) * Number(item.valorUnitario || 0), 0);
    const rawPayloadBase = draft.rawPayloadBase && typeof draft.rawPayloadBase === "object"
      ? { ...draft.rawPayloadBase }
      : {};
    const rawPayload = {
      ...rawPayloadBase,
      source: "novo-documento-modal",
      itens: itens.length,
      pagamento: pagamentoState
    };
    // Snapshot da calculadora (historico da decisao comercial no pedido/orcamento).
    if (draft.precoFormacaoAplicada) {
      rawPayload.preco_formacao = draft.precoFormacaoAplicada;
    }
    // Preserva foto legada se so temos a URL resolvida no draft.
    if (!rawPayload.foto_url && draft.fotoUrl) {
      rawPayload.foto_url = draft.fotoUrl;
    }

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
      raw_payload: rawPayload,
      data_emissao: dataEmissaoIso
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
      // Marca cedo no draft para qualquer reentrada nao criar outro documento.
      draft.documentoId = documentoId;
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

    const parcelasEditadas = Array.isArray(draft.parcelasEditadas) && draft.parcelasEditadas.length
      ? draft.parcelasEditadas
      : null;

    if (!isEdit) {
      try {
        await createDocumentoFinanceiro(documentoId, clienteId, pagamentoState, subtotal, parcelasEditadas);
      } catch (financeError) {
        await supabaseClient.from("documento_venda_itens").delete().eq("empresa_id", state.empresaId).eq("documento_id", documentoId);
        await supabaseClient.from("documentos_venda").delete().eq("empresa_id", state.empresaId).eq("id", documentoId);
        draft.documentoId = null;
        throw financeError;
      }
    } else if (parcelasEditadas) {
      const snapshotOriginal = draft.parcelasOriginaisSnapshot || null;
      const snapshotAtual = JSON.stringify(parcelasEditadas);
      if (snapshotOriginal && snapshotOriginal === snapshotAtual) {
        // Parcelas nao foram alteradas nesta edicao, mantem o financeiro atual.
      } else {
        const confirmar = window.confirm(
          "Voce editou as parcelas deste pedido.\n\nAo salvar, as parcelas e recebimentos anteriores deste pedido serao SUBSTITUIDOS pelos novos titulos. Deseja continuar?"
        );
        if (!confirmar) {
          throw new Error("Salvamento cancelado pelo usuario.");
        }
        // Apaga o financeiro anterior e recria com os novos titulos.
        await deleteDocumentoFinanceiro(documentoId);
        await createDocumentoFinanceiro(documentoId, clienteId, pagamentoState, subtotal, parcelasEditadas);
      }
    }

    // Baixa/estorno de estoque para pedidos (status fechado/cancelado/reaberto).
    if (draft.tipo === "pedido") {
      try {
        await syncEstoquePedido(documentoId, status, itens);
      } catch (estoqueError) {
        console.error("Falha ao sincronizar estoque do pedido", estoqueError);
        showToast(`Pedido salvo, mas estoque falhou: ${estoqueError.message}`, "error");
      }
    }

    closeNovoDocumentoModal();
    state.novoDocumentoModal = createDocumentoDraft("pedido");
    if (els.novoDocumentoClienteSearch) {
      els.novoDocumentoClienteSearch.value = "";
    }
    showToast(draft.tipo === "orcamento" ? (isEdit ? "Orcamento atualizado" : "Orcamento salvo") : (isEdit ? "Pedido atualizado" : "Pedido salvo"));
    await refreshAll();
  } finally {
    state.novoDocumentoSaving = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      if (els.novoDocumentoModal && !els.novoDocumentoModal.classList.contains("hidden")) {
        const config = getDocumentoModalConfig(state.novoDocumentoModal.tipo);
        submitBtn.textContent = config?.submitLabel || submitLabelOriginal;
      } else {
        submitBtn.textContent = submitLabelOriginal;
      }
    }
  }
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

function renderItensDocumentoFotoBanner() {
  const wrap = els.itensDocumentoFotoWrap;
  const img = els.itensDocumentoFoto;
  if (!wrap || !img) return;

  const url = state.itensDocumentoModalMode === "itens" ? String(state.itensDocumentoPedidoFoto || "") : "";
  if (!url) {
    wrap.classList.add("hidden");
    img.removeAttribute("src");
    delete img.dataset.imagePreview;
    return;
  }

  const title = `Pedido #${state.itensDocumentoPedidoId || ""}`;
  img.src = url;
  img.alt = title;
  img.dataset.imagePreview = url;
  img.dataset.imageTitle = title;
  img.classList.add("is-clickable");
  wrap.classList.remove("hidden");
}

function renderItensDocumentoTable() {
  if (!els.itensDocumentoTable) return;
  renderItensDocumentoFotoBanner();

  if (!state.itensDocumento.length) {
    const colspan = state.itensDocumentoModalMode === "pedidos_produto"
      ? 7
      : state.itensDocumentoModalMode === "cliente_pedidos"
        ? 6
        : 4;
    const message = state.itensDocumentoModalMode === "pedidos_produto"
      ? "Nenhum pedido encontrado para este produto."
      : state.itensDocumentoModalMode === "cliente_pedidos"
        ? "Nenhum pedido encontrado para este cliente."
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

  if (state.itensDocumentoModalMode === "cliente_pedidos") {
    els.itensDocumentoTable.innerHTML = state.itensDocumento
      .map((pedido) => {
        const data = pedido.data_pedido ? new Date(pedido.data_pedido).toLocaleDateString("pt-BR") : "-";
        return `
          <tr>
            <td class="pedido-cell-id">
              ${renderPedidoThumbHtml(pedido)}
              <span>#${escapeHtml(pedido.id)}</span>
            </td>
            <td>${data}</td>
            <td>${escapeHtml(pedido.status || "-")}</td>
            <td>${moeda.format(pedido.valor_total || 0)}</td>
            <td>
              <button type="button" class="action-edit" data-edit-pedido="${pedido.id}">Editar</button>
              <button type="button" class="action-edit" data-view-pedido-itens="${pedido.id}">Itens</button>
            </td>
          </tr>
        `;
      })
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
    .select("id, descricao_item, quantidade, valor_unitario, valor_total, foto_ref")
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
  state.itensDocumentoPedidoFoto = getPedidoFotoUrl(documentoData);
  state.itensDocumentoPedidoId = documentoId;
  state.itensDocumentoTipo = tipoDocumento;
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
  closeProdutoPrecoVendaCalcPanel();
  state.produtoPrecoFormacaoPending = null;
  state.produtoPrecoVendaCalc = createPrecoVendaCalcState({ margemPct: 30 });

  if (!editing) {
    els.produtoForm.reset();
    delete els.produtoForm.dataset.editId;
    if (els.produtoModalTitle) {
      els.produtoModalTitle.textContent = "Novo Produto";
    }
    if (els.produtoModalSubtitle) {
      els.produtoModalSubtitle.textContent = "Cadastre o item e, se quiser, cole a URL da imagem.";
    }
    if (els.produtoSubmitBtn) {
      els.produtoSubmitBtn.textContent = "Salvar Produto";
    }
    if (els.produtoEstoqueInput) {
      els.produtoEstoqueInput.readOnly = false;
      els.produtoEstoqueInput.title = "";
    }
    if (els.produtoEstoqueHint) {
      els.produtoEstoqueHint.textContent = "No cadastro novo, vira saldo inicial. Na edição, use a aba Estoque.";
    }
    const leadField = els.produtoForm.elements.namedItem("lead_time_dias");
    if (leadField && "value" in leadField) leadField.value = "7";
    updateProdutoFormImagePreview();
    return;
  }

  if (!produto) return;

  els.produtoForm.reset();
  els.produtoForm.dataset.editId = String(produto.id);
  if (els.produtoModalTitle) {
    els.produtoModalTitle.textContent = "Editar Produto";
  }
  if (els.produtoModalSubtitle) {
    els.produtoModalSubtitle.textContent = produto.preco_formacao
      ? "Atualize os dados. A formacao de preco salva sera recarregada na calculadora."
      : "Atualize os dados e confira a imagem do produto.";
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
  setValue("estoque_maximo", produto.estoque_maximo ?? "");
  setValue("lead_time_dias", produto.lead_time_dias ?? 7);
  setValue("descricao", produto.descricao || "");
  setValue("imagem_path", produto.imagem_path || "");
  setValue("ativo", produto.ativo ? "sim" : "nao");
  setValue("controla_estoque", produto.controla_estoque === false ? "nao" : "sim");

  if (els.produtoEstoqueInput) {
    els.produtoEstoqueInput.readOnly = true;
    els.produtoEstoqueInput.title = "Saldo controlado pela aba Estoque";
  }
  if (els.produtoEstoqueHint) {
    els.produtoEstoqueHint.textContent = "Somente leitura. Ajuste pela aba Estoque (movimento/inventário).";
  }

  // Restaura a ultima formacao de preco salva (se existir).
  state.produtoPrecoVendaCalc = hydrateProdutoPrecoVendaCalcFromSnapshot(produto.preco_formacao, {
    custo: produto.custo,
    margem: produto.margem
  });
  state.produtoPrecoFormacaoPending = produto.preco_formacao || null;
  updateProdutoFormImagePreview();
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
      "id, nome, descricao, imagem_path, preco_venda, custo, margem_percentual, preco_formacao, estoque_atual, estoque_minimo, estoque_maximo, lead_time_dias, classe_abc, classe_abc_atualizado_em, ativo, controla_estoque, categoria:produto_categorias(nome)"
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
    preco_formacao: item.preco_formacao || null,
    estoque: Number(item.estoque_atual || 0),
    ponto_pedido: Number(item.estoque_minimo || 0),
    estoque_maximo: item.estoque_maximo == null ? null : Number(item.estoque_maximo),
    lead_time_dias: item.lead_time_dias == null ? 7 : Number(item.lead_time_dias),
    classe_abc: item.classe_abc || null,
    classe_abc_atualizado_em: item.classe_abc_atualizado_em || null,
    ativo: Boolean(item.ativo),
    controla_estoque: Boolean(item.controla_estoque)
  }));
}

async function loadDashboardSnapshot() {
  const { data, error } = await supabaseClient.rpc("dashboard_snapshot", {
    target_empresa_id: state.empresaId,
    months_back: Math.max(1, Number(state.dashboardMonthsBack || 11))
  });

  if (error) {
    console.error("Falha ao carregar dashboard_snapshot", error);
    showToast(`Erro dashboard_snapshot: ${error.message}`, "error");
    return;
  }
  const counts = data?.counts || {};
  state.pedidosCountTotal = Number(counts.pedidos || 0);
  state.pedidosFaturamentoTotal = Number(counts.faturamento_total || 0);
  state.dashboardCounts = {
    clientes: Number(counts.clientes || 0),
    despesas: Number(counts.despesas || 0),
    produtosTotal: Number(counts.produtos_total || 0),
    produtosComSaldo: Number(counts.produtos_com_saldo || 0),
    produtosPontoPedido: Number(counts.produtos_ponto_pedido || 0),
    orcamentoAberto: Number(counts.orcamento_aberto || 0)
  };
  state.dashboardMonthlyCash = (data?.monthly || []).map((row) => ({
    mes: row.mes,
    realized: Number(row.realized || 0),
    forecast: Number(row.forecast || 0),
    faturamento: Number(row.faturamento || 0),
    pedidosCount: Number(row.pedidos_count || 0),
    clientesNovos: Number(row.clientes_novos || 0),
    despesasTotal: Number(row.despesas_total || 0),
    despesasCount: Number(row.despesas_count || 0)
  }));
}

async function loadDashboardDaily() {
  const { data, error } = await supabaseClient.rpc("dashboard_daily_current_month", {
    target_empresa_id: state.empresaId
  });

  if (error) {
    console.warn("Falha ao carregar dashboard_daily_current_month", error.message);
    state.dashboardDaily = [];
    return;
  }

  state.dashboardDaily = (data || []).map((row) => ({
    dia: row.dia,
    faturamento: Number(row.faturamento || 0),
    pedidosCount: Number(row.pedidos_count || 0)
  }));
}

/**
 * Carrega horários e feriados para a previsão do dashboard.
 * Se o calendário ainda não foi configurado, usa seg–sex como padrão.
 */
async function loadCalendarioForDashboard() {
  if (!state.empresaId) {
    state.calendarioForecast = { horarios: [], feriados: [], fromConfig: false };
    return;
  }

  try {
    const [horariosResp, feriadosResp] = await Promise.all([
      supabaseClient
        .from("calendario_horarios")
        .select("dia_semana, aberto, hora_inicio, hora_fim")
        .eq("empresa_id", state.empresaId),
      supabaseClient
        .from("calendario_feriados")
        .select("data, nome, fecha_dia_todo, recorrente")
        .eq("empresa_id", state.empresaId)
    ]);

    if (horariosResp.error && !isMissingRelationError(horariosResp.error)) {
      throw horariosResp.error;
    }
    if (feriadosResp.error && !isMissingRelationError(feriadosResp.error)) {
      throw feriadosResp.error;
    }

    const horarios = horariosResp.data || [];
    state.calendarioForecast = {
      horarios,
      feriados: feriadosResp.data || [],
      fromConfig: horarios.length > 0
    };
  } catch (error) {
    console.warn("Falha ao carregar calendário para previsão", error.message || error);
    state.calendarioForecast = { horarios: [], feriados: [], fromConfig: false };
  }
}

function ymdFromDate(date) {
  return formatDateInput(date);
}

function isDashboardWorkingDay(date, horarios = [], feriados = []) {
  const ymd = ymdFromDate(date);
  const weekday = date.getDay(); // 0=dom ... 6=sáb

  // Feriado de dia inteiro (ou recorrente no mesmo dia/mês) fecha o dia.
  const mmdd = ymd.slice(5);
  const feriado = (feriados || []).find((f) => {
    if (f.data === ymd) return true;
    if (f.recorrente && String(f.data || "").slice(5) === mmdd) return true;
    return false;
  });
  if (feriado && feriado.fecha_dia_todo !== false) {
    return false;
  }

  if (horarios?.length) {
    const h = horarios.find((item) => Number(item.dia_semana) === weekday);
    if (h) return h.aberto !== false;
    // Dia sem cadastro no calendário: considera fechado se há config parcial
    return false;
  }

  // Fallback sem calendário: segunda a sexta.
  return weekday >= 1 && weekday <= 5;
}

/**
 * Previsão de fechamento do mês:
 * média = faturado / dias trabalhados (úteis até hoje)
 * previsão = faturado + média * dias úteis restantes
 */
function computeMonthRevenueForecast() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = new Date(year, month, now.getDate());
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);

  const cal = state.calendarioForecast || { horarios: [], feriados: [], fromConfig: false };
  const horarios = cal.horarios || [];
  const feriados = cal.feriados || [];

  // Faturado do mês = soma do gráfico diário (mesma base do dashboard).
  const faturadoMes = (state.dashboardDaily || []).reduce(
    (sum, row) => sum + Number(row.faturamento || 0),
    0
  );

  let diasTrabalhados = 0;
  let diasRestantes = 0;
  let diasUteisMes = 0;

  for (let day = 1; day <= monthEnd.getDate(); day += 1) {
    const d = new Date(year, month, day);
    if (!isDashboardWorkingDay(d, horarios, feriados)) continue;
    diasUteisMes += 1;
    if (d <= today) diasTrabalhados += 1;
    else diasRestantes += 1;
  }

  const mediaDia = diasTrabalhados > 0 ? faturadoMes / diasTrabalhados : 0;
  const projecaoRestante = mediaDia * diasRestantes;
  const previsao = faturadoMes + projecaoRestante;

  return {
    faturadoMes,
    diasTrabalhados,
    diasRestantes,
    diasUteisMes,
    mediaDia,
    projecaoRestante,
    previsao,
    fromConfig: Boolean(cal.fromConfig),
    monthLabel: monthStart.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
  };
}

function renderDashboardForecastCard() {
  if (!els.dashboardForecastValue && !els.dashboardForecastCard) return;

  const f = computeMonthRevenueForecast();
  const monthName = f.monthLabel.charAt(0).toUpperCase() + f.monthLabel.slice(1);

  if (els.dashboardForecastSubtitle) {
    els.dashboardForecastSubtitle.textContent = `Projeção para ${monthName} com base no faturamento atual e nos dias úteis.`;
  }
  if (els.dashboardForecastValue) els.dashboardForecastValue.textContent = moeda.format(f.previsao);
  if (els.dashboardForecastFaturado) els.dashboardForecastFaturado.textContent = moeda.format(f.faturadoMes);
  if (els.dashboardForecastDiasTrab) els.dashboardForecastDiasTrab.textContent = String(f.diasTrabalhados);
  if (els.dashboardForecastMedia) els.dashboardForecastMedia.textContent = moeda.format(f.mediaDia);
  if (els.dashboardForecastDiasRest) els.dashboardForecastDiasRest.textContent = String(f.diasRestantes);
  if (els.dashboardForecastProjecao) els.dashboardForecastProjecao.textContent = moeda.format(f.projecaoRestante);
  if (els.dashboardForecastDiasMes) els.dashboardForecastDiasMes.textContent = String(f.diasUteisMes);

  if (els.dashboardForecastHint) {
    if (!f.fromConfig) {
      els.dashboardForecastHint.textContent =
        "Calendário ainda não configurado: usando seg–sex como dias úteis. Cadastre em Calendário para mais precisão.";
    } else if (f.diasTrabalhados <= 0) {
      els.dashboardForecastHint.textContent =
        "Ainda não houve dia útil no mês (ou é o primeiro dia). A média será calculada conforme os dias trabalharem.";
    } else {
      els.dashboardForecastHint.textContent =
        `Fórmula: faturado (${moeda.format(f.faturadoMes)}) + média/dia (${moeda.format(f.mediaDia)}) × ${f.diasRestantes} dia(s) restante(s).`;
    }
  }

  state.dashboardForecast = f;
}

/**
 * Contas a pagar do mês corrente (parcelas com vencimento no mês)
 * e resultado = faturamento do mês − total a pagar do mês.
 */
async function loadDashboardContasPagarMes() {
  const empty = {
    total: 0,
    aberto: 0,
    pago: 0,
    count: 0,
    monthKey: formatMonthKey(new Date())
  };

  if (!state.empresaId) {
    state.dashboardContasPagarMes = empty;
    return;
  }

  const now = new Date();
  const start = formatDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
  const end = formatDateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  try {
    const { data, error } = await fetchAllSupabaseRows(() =>
      supabaseClient
        .from("contas_pagar_parcelas")
        .select("id, valor_parcela, valor_pago, status, vencimento")
        .eq("empresa_id", state.empresaId)
        .gte("vencimento", start)
        .lte("vencimento", end)
        .order("vencimento", { ascending: true })
    );

    if (error) {
      if (isMissingRelationError(error)) {
        state.dashboardContasPagarMes = empty;
        return;
      }
      throw error;
    }

    let total = 0;
    let aberto = 0;
    let pago = 0;
    let count = 0;

    for (const row of data || []) {
      const status = String(row.status || "").toLowerCase();
      if (status === "cancelado") continue;
      const valorParcela = Math.max(0, Number(row.valor_parcela || 0));
      const valorPago = Math.max(0, Math.min(valorParcela, Number(row.valor_pago || 0)));
      total += valorParcela;
      pago += valorPago;
      aberto += Math.max(0, valorParcela - valorPago);
      count += 1;
    }

    state.dashboardContasPagarMes = {
      total: Number(total.toFixed(2)),
      aberto: Number(aberto.toFixed(2)),
      pago: Number(pago.toFixed(2)),
      count,
      monthKey: formatMonthKey(now)
    };
  } catch (error) {
    console.warn("Falha ao carregar contas a pagar do mês", error.message || error);
    state.dashboardContasPagarMes = empty;
  }
}

function getDashboardFaturamentoMesAtual() {
  return (state.dashboardDaily || []).reduce(
    (sum, row) => sum + Number(row.faturamento || 0),
    0
  );
}

function renderDashboardResultCards() {
  const pagar = state.dashboardContasPagarMes || {
    total: 0,
    aberto: 0,
    pago: 0,
    count: 0
  };
  const faturadoMes = getDashboardFaturamentoMesAtual();
  const resultado = faturadoMes - Number(pagar.total || 0);
  const now = new Date();
  const monthLabel = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const monthName = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  if (els.dashboardContasPagarSubtitle) {
    els.dashboardContasPagarSubtitle.textContent =
      `Parcelas com vencimento em ${monthName}.`;
  }
  if (els.dashboardContasPagarValue) {
    els.dashboardContasPagarValue.textContent = moeda.format(pagar.total || 0);
  }
  if (els.dashboardContasPagarAberto) {
    els.dashboardContasPagarAberto.textContent = moeda.format(pagar.aberto || 0);
  }
  if (els.dashboardContasPagarPago) {
    els.dashboardContasPagarPago.textContent = moeda.format(pagar.pago || 0);
  }
  if (els.dashboardContasPagarCount) {
    els.dashboardContasPagarCount.textContent = String(pagar.count || 0);
  }

  if (els.dashboardResultadoSubtitle) {
    els.dashboardResultadoSubtitle.textContent =
      `Faturamento de ${monthName} menos as contas a pagar do mês.`;
  }
  if (els.dashboardResultadoFaturado) {
    els.dashboardResultadoFaturado.textContent = moeda.format(faturadoMes);
  }
  if (els.dashboardResultadoPagar) {
    els.dashboardResultadoPagar.textContent = moeda.format(pagar.total || 0);
  }
  if (els.dashboardResultadoSaldo) {
    els.dashboardResultadoSaldo.textContent = moeda.format(resultado);
  }
  if (els.dashboardResultadoValue) {
    els.dashboardResultadoValue.textContent = moeda.format(resultado);
  }
  if (els.dashboardResultadoMain) {
    els.dashboardResultadoMain.classList.toggle("is-negative", resultado < 0);
    els.dashboardResultadoMain.classList.toggle("is-positive", resultado > 0);
    els.dashboardResultadoMain.classList.toggle("is-zero", resultado === 0);
  }
  if (els.dashboardResultadoHint) {
    if (resultado > 0) {
      els.dashboardResultadoHint.textContent =
        "Saldo positivo: o faturamento do mês cobre as contas a pagar com vencimento no período.";
    } else if (resultado < 0) {
      els.dashboardResultadoHint.textContent =
        "Saldo negativo: as contas a pagar do mês superam o faturamento atual.";
    } else {
      els.dashboardResultadoHint.textContent =
        "Faturamento e contas a pagar do mês estão equilibrados.";
    }
  }
}

async function loadPedidosSummary() {
  const [countResp, aggregateResp] = await Promise.all([
    supabaseClient
      .from("documentos_venda")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", state.empresaId)
      .eq("tipo_documento", "pedido"),
    supabaseClient.rpc("dashboard_monthly_cash", {
      target_empresa_id: state.empresaId,
      months_back: 240
    })
  ]);

  if (countResp.error && !isMissingRelationError(countResp.error)) {
    console.warn("Falha ao obter total de pedidos", countResp.error.message);
  } else {
    state.pedidosCountTotal = Number(countResp.count || 0);
  }

  if (aggregateResp.error) {
    console.warn("Falha ao obter faturamento total", aggregateResp.error.message);
    state.pedidosFaturamentoTotal = 0;
  } else {
    const rows = aggregateResp.data || [];
    state.pedidosFaturamentoTotal = rows.reduce((sum, row) => sum + Number(row.faturamento || 0), 0);
  }
}

async function ensurePedidosLoaded(options = {}) {
  // Formas de pagamento alimentam a coluna "Pagamento" da lista.
  if (!state.formasPagamento?.length) {
    try {
      await loadFormasPagamento();
    } catch (error) {
      console.warn("Falha ao carregar formas de pagamento", error.message || error);
    }
  }
  if (state.pedidosLoaded && !options.force) return;
  await loadPedidos();
  state.pedidosLoaded = true;
}

async function ensureClientesLoaded(options = {}) {
  if (state.clientesLoaded && !options.force) return;
  await loadClientes();
  state.clientesLoaded = true;
}

async function ensureProdutosLoaded(options = {}) {
  if (state.produtosLoaded && !options.force) return;
  await loadProdutos();
  state.produtosLoaded = true;
}

/* =========================
   ESTOQUE (modulo completo)
   ========================= */

const ESTOQUE_TIPO_LABEL = {
  entrada: "Entrada",
  saida: "Saída",
  ajuste: "Ajuste",
  venda: "Venda",
  estorno_venda: "Estorno venda",
  inventario: "Inventário"
};

function getProdutosControlamEstoque() {
  return (state.produtos || []).filter((p) => p.controla_estoque !== false);
}

function getEstoqueReservado(produtoId) {
  return Number(state.estoqueReservas?.[String(produtoId)] || 0);
}

function getEstoqueStatus(produto) {
  const saldo = Number(produto.estoque || 0);
  const ponto = Number(produto.ponto_pedido || 0);
  if (saldo < 0) return "negativo";
  if (saldo <= 0) return "zerado";
  if (saldo <= ponto) return "reposicao";
  return "ok";
}

function formatEstoqueStatusBadge(status) {
  const labels = {
    ok: "OK",
    reposicao: "Reposição",
    zerado: "Zerado",
    negativo: "Negativo"
  };
  return `<span class="estoque-status estoque-status--${escapeHtml(status)}">${escapeHtml(labels[status] || status)}</span>`;
}

function formatAbcBadge(classe) {
  const c = String(classe || "").toUpperCase();
  if (c === "A" || c === "B" || c === "C") {
    return `<span class="estoque-abc estoque-abc--${c}" title="Classe ${c}">${c}</span>`;
  }
  return `<span class="estoque-abc estoque-abc--none" title="Sem classe">–</span>`;
}

function getQtdReposicaoSugerida(produto) {
  const saldo = Number(produto.estoque || 0);
  const max = produto.estoque_maximo != null ? Number(produto.estoque_maximo) : null;
  const ponto = Number(produto.ponto_pedido || 0);
  if (max != null && max > saldo) return Math.ceil(max - saldo);
  if (ponto > 0) return Math.max(ponto * 2 - saldo, ponto);
  return Math.max(1, Math.ceil(Math.abs(Math.min(saldo, 0)) || 1));
}

async function registrarEstoqueMovimento({
  produtoId,
  tipo,
  quantidade,
  motivo = null,
  observacoes = null,
  documentoId = null,
  documentoItemId = null,
  custoUnitario = null,
  permitirNegativo = false,
  metadata = {}
}) {
  const { data, error } = await supabaseClient.rpc("registrar_estoque_movimento", {
    p_empresa_id: state.empresaId,
    p_produto_id: Number(produtoId),
    p_tipo: tipo,
    p_quantidade: Number(quantidade),
    p_motivo: motivo,
    p_observacoes: observacoes,
    p_documento_id: documentoId ? Number(documentoId) : null,
    p_documento_item_id: documentoItemId ? Number(documentoItemId) : null,
    p_custo_unitario: custoUnitario,
    p_permitir_negativo: Boolean(permitirNegativo),
    p_metadata: metadata || {}
  });
  if (error) throw error;
  return data;
}

/**
 * Sincroniza baixas de estoque de um pedido.
 * Status fechado => aplica quantidades dos itens (tipo venda).
 * Outros status => zera aplicacao (estorno).
 * Diff com raw_payload.estoque_aplicado evita duplicar.
 */
async function syncEstoquePedido(documentoId, status, itens) {
  if (!documentoId) return;

  const { data: doc, error: docErr } = await supabaseClient
    .from("documentos_venda")
    .select("id, status, raw_payload, tipo_documento")
    .eq("empresa_id", state.empresaId)
    .eq("id", documentoId)
    .maybeSingle();

  if (docErr) throw docErr;
  if (!doc || doc.tipo_documento !== "pedido") return;

  const raw = doc.raw_payload && typeof doc.raw_payload === "object" ? { ...doc.raw_payload } : {};
  const applied = raw.estoque_aplicado && typeof raw.estoque_aplicado === "object" ? { ...raw.estoque_aplicado } : {};
  const statusAtual = String(status || doc.status || "aberto").toLowerCase();
  const shouldApply = statusAtual === "fechado";

  const desired = {};
  if (shouldApply) {
    for (const item of itens || []) {
      const pid = item.produtoId || item.produto_id;
      if (!pid) continue;
      const prod = state.produtos.find((p) => Number(p.id) === Number(pid));
      if (prod && prod.controla_estoque === false) continue;
      const qtd = Number(item.quantidade || 0);
      if (qtd <= 0) continue;
      const key = String(pid);
      desired[key] = Number(((desired[key] || 0) + qtd).toFixed(3));
    }
  }

  const allKeys = new Set([...Object.keys(applied), ...Object.keys(desired)]);
  const errors = [];

  for (const key of allKeys) {
    const before = Number(applied[key] || 0);
    const after = Number(desired[key] || 0);
    const delta = Number((after - before).toFixed(3));
    if (Math.abs(delta) < 0.0005) continue;

    try {
      if (delta > 0) {
        await registrarEstoqueMovimento({
          produtoId: Number(key),
          tipo: "venda",
          quantidade: delta,
          motivo: `Baixa pedido #${documentoId}`,
          documentoId,
          permitirNegativo: false,
          metadata: { origem: "sync_pedido", documento_id: documentoId }
        });
      } else {
        await registrarEstoqueMovimento({
          produtoId: Number(key),
          tipo: "estorno_venda",
          quantidade: Math.abs(delta),
          motivo: `Estorno pedido #${documentoId}`,
          documentoId,
          permitirNegativo: true,
          metadata: { origem: "sync_pedido", documento_id: documentoId }
        });
      }
    } catch (err) {
      errors.push(err.message || String(err));
    }
  }

  raw.estoque_aplicado = desired;
  raw.estoque_sincronizado_em = new Date().toISOString();
  raw.estoque_status_ref = statusAtual;

  const { error: updErr } = await supabaseClient
    .from("documentos_venda")
    .update({ raw_payload: raw })
    .eq("empresa_id", state.empresaId)
    .eq("id", documentoId);

  if (updErr) throw updErr;

  state.produtosLoaded = false;
  state.estoqueMovimentosLoaded = false;
  state.estoqueReservasLoaded = false;

  if (errors.length) {
    throw new Error(errors.join(" | "));
  }
}

async function loadEstoqueReservas(options = {}) {
  if (state.estoqueReservasLoaded && !options.force) return;

  const reservas = {};
  try {
    const { data: docs, error: docsErr } = await supabaseClient
      .from("documentos_venda")
      .select("id")
      .eq("empresa_id", state.empresaId)
      .eq("tipo_documento", "pedido")
      .eq("status", "aberto");

    if (docsErr) throw docsErr;
    const ids = (docs || []).map((d) => d.id);
    if (ids.length) {
      // Carrega em lotes para evitar URL muito longa
      const chunkSize = 80;
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const { data: itens, error: itensErr } = await supabaseClient
          .from("documento_venda_itens")
          .select("produto_id, quantidade")
          .eq("empresa_id", state.empresaId)
          .in("documento_id", chunk);

        if (itensErr) throw itensErr;
        for (const item of itens || []) {
          if (!item.produto_id) continue;
          const key = String(item.produto_id);
          reservas[key] = Number(((reservas[key] || 0) + Number(item.quantidade || 0)).toFixed(3));
        }
      }
    }
  } catch (err) {
    console.warn("Falha ao carregar reservas de estoque", err);
  }

  state.estoqueReservas = reservas;
  state.estoqueReservasLoaded = true;
}

async function loadEstoqueMovimentos(options = {}) {
  if (state.estoqueMovimentosLoaded && !options.force) return;

  let query = supabaseClient
    .from("estoque_movimentos")
    .select(
      "id, produto_id, tipo, quantidade, saldo_anterior, saldo_posterior, motivo, observacoes, documento_id, created_at, produto:produto_catalogo(id, nome)"
    )
    .eq("empresa_id", state.empresaId)
    .order("created_at", { ascending: false })
    .limit(400);

  const start = state.estoqueFilters.movStart;
  const end = state.estoqueFilters.movEnd;
  if (start) query = query.gte("created_at", `${start}T00:00:00`);
  if (end) query = query.lte("created_at", `${end}T23:59:59`);
  if (state.estoqueFilters.movTipo) query = query.eq("tipo", state.estoqueFilters.movTipo);

  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error)) {
      state.estoqueMovimentos = [];
      state.estoqueMovimentosLoaded = true;
      showToast("Tabela de movimentos ainda nao disponivel. Rode a migration de estoque.", "error");
      return;
    }
    throw error;
  }

  state.estoqueMovimentos = data || [];
  state.estoqueMovimentosLoaded = true;
}

function setEstoqueView(view) {
  const allowed = ["painel", "saldos", "movimentos", "reposicao", "abc", "inventario"];
  state.estoqueView = allowed.includes(view) ? view : "painel";

  for (const btn of els.estoqueViewButtons || []) {
    btn.classList.toggle("active", btn.getAttribute("data-estoque-view") === state.estoqueView);
  }

  const map = {
    painel: els.estoquePainelView,
    saldos: els.estoqueSaldosView,
    movimentos: els.estoqueMovimentosView,
    reposicao: els.estoqueReposicaoView,
    abc: els.estoqueAbcView,
    inventario: els.estoqueInventarioView
  };
  for (const [key, el] of Object.entries(map)) {
    if (el) el.classList.toggle("hidden", key !== state.estoqueView);
  }

  if (els.estoqueSectionSubtitle) {
    const labels = {
      painel: "Visão geral de saldos, alertas e valor parado.",
      saldos: "Saldo, reservado, disponível e ponto de pedido por item.",
      movimentos: "Histórico de entradas, saídas, vendas e ajustes.",
      reposicao: "Itens no ponto de pedido com quantidade sugerida.",
      abc: "Curva ABC por valor vendido no período.",
      inventario: "Conte e ajuste o saldo com um clique."
    };
    els.estoqueSectionSubtitle.textContent = labels[state.estoqueView] || labels.painel;
  }
}

function getEstoqueSaldosRows() {
  const busca = String(state.estoqueFilters.saldoBusca || "").trim().toLowerCase();
  const statusFilter = state.estoqueFilters.saldoStatus || "";
  const abcFilter = state.estoqueFilters.saldoAbc || "";

  return getProdutosControlamEstoque()
    .map((produto) => {
      const reservado = getEstoqueReservado(produto.id);
      const saldo = Number(produto.estoque || 0);
      const disponivel = saldo - reservado;
      const status = getEstoqueStatus(produto);
      const valor = saldo * Number(produto.custo || 0);
      return { produto, reservado, saldo, disponivel, status, valor };
    })
    .filter((row) => {
      if (busca) {
        const hay = `${row.produto.nome} ${row.produto.categoria || ""}`.toLowerCase();
        if (!hay.includes(busca)) return false;
      }
      if (statusFilter && row.status !== statusFilter) return false;
      if (abcFilter) {
        const abc = String(row.produto.classe_abc || "-").toUpperCase();
        if (abcFilter === "-" && abc !== "-" && abc !== "") return false;
        if (abcFilter !== "-" && abc !== abcFilter) return false;
      }
      return true;
    })
    .sort((a, b) => String(a.produto.nome).localeCompare(String(b.produto.nome), "pt-BR"));
}

function renderEstoquePainel() {
  const rows = getProdutosControlamEstoque();
  let valor = 0;
  let ponto = 0;
  let zerados = 0;
  let reservadoUn = 0;
  let classeA = 0;

  for (const p of rows) {
    const saldo = Number(p.estoque || 0);
    valor += saldo * Number(p.custo || 0);
    if (getEstoqueStatus(p) === "reposicao") ponto += 1;
    if (saldo <= 0) zerados += 1;
    reservadoUn += getEstoqueReservado(p.id);
    if (String(p.classe_abc || "").toUpperCase() === "A") classeA += 1;
  }

  if (els.estoqueKpiItens) els.estoqueKpiItens.textContent = String(rows.length);
  if (els.estoqueKpiValor) els.estoqueKpiValor.textContent = moeda.format(valor);
  if (els.estoqueKpiPonto) els.estoqueKpiPonto.textContent = String(ponto);
  if (els.estoqueKpiZerados) els.estoqueKpiZerados.textContent = String(zerados);
  if (els.estoqueKpiReservado) els.estoqueKpiReservado.textContent = `${Number(reservadoUn.toFixed(2))} un.`;
  if (els.estoqueKpiClasseA) els.estoqueKpiClasseA.textContent = String(classeA);
}

function renderEstoqueSaldosTable() {
  if (!els.estoqueSaldosTable) return;
  const rows = getEstoqueSaldosRows();
  if (!rows.length) {
    els.estoqueSaldosTable.innerHTML = `<tr><td colspan="11">Nenhum item encontrado.</td></tr>`;
    return;
  }

  els.estoqueSaldosTable.innerHTML = rows
    .map(({ produto, reservado, saldo, disponivel, status, valor }) => `
      <tr>
        <td>${escapeHtml(produto.nome)}</td>
        <td>${escapeHtml(produto.categoria || "-")}</td>
        <td>${formatAbcBadge(produto.classe_abc)}</td>
        <td>${escapeHtml(saldo)}</td>
        <td>${escapeHtml(reservado)}</td>
        <td>${escapeHtml(Number(disponivel.toFixed(2)))}</td>
        <td>${escapeHtml(produto.ponto_pedido ?? 0)}</td>
        <td>${produto.estoque_maximo == null ? "–" : escapeHtml(produto.estoque_maximo)}</td>
        <td>${formatEstoqueStatusBadge(status)}</td>
        <td>${moeda.format(valor)}</td>
        <td class="estoque-actions">
          <button type="button" class="btn btn-ghost" data-estoque-mov="entrada" data-produto-id="${produto.id}">Entrada</button>
          <button type="button" class="btn btn-ghost" data-estoque-mov="saida" data-produto-id="${produto.id}">Saída</button>
          <button type="button" class="btn btn-ghost" data-estoque-mov="ajuste" data-produto-id="${produto.id}">Ajuste</button>
        </td>
      </tr>
    `)
    .join("");
}

function renderEstoqueMovimentosTable() {
  if (!els.estoqueMovimentosTable) return;
  const busca = String(state.estoqueFilters.movBusca || "").trim().toLowerCase();
  let rows = state.estoqueMovimentos || [];
  if (busca) {
    rows = rows.filter((m) => String(m.produto?.nome || "").toLowerCase().includes(busca));
  }

  if (!rows.length) {
    els.estoqueMovimentosTable.innerHTML = `<tr><td colspan="8">Nenhum movimento no filtro atual.</td></tr>`;
    return;
  }

  els.estoqueMovimentosTable.innerHTML = rows
    .map((m) => {
      const qtd = Number(m.quantidade || 0);
      const qtdClass = qtd >= 0 ? "estoque-qtd-pos" : "estoque-qtd-neg";
      const qtdTxt = qtd > 0 ? `+${qtd}` : String(qtd);
      const data = m.created_at ? new Date(m.created_at).toLocaleString("pt-BR") : "–";
      return `
        <tr>
          <td>${escapeHtml(data)}</td>
          <td>${escapeHtml(m.produto?.nome || `#${m.produto_id}`)}</td>
          <td>${escapeHtml(ESTOQUE_TIPO_LABEL[m.tipo] || m.tipo)}</td>
          <td class="${qtdClass}">${escapeHtml(qtdTxt)}</td>
          <td>${escapeHtml(m.saldo_anterior)}</td>
          <td>${escapeHtml(m.saldo_posterior)}</td>
          <td>${escapeHtml(m.motivo || m.observacoes || "–")}</td>
          <td>${m.documento_id ? `#${escapeHtml(m.documento_id)}` : "–"}</td>
        </tr>
      `;
    })
    .join("");
}

function renderEstoqueReposicaoTable() {
  if (!els.estoqueReposicaoTable) return;
  const rows = getProdutosControlamEstoque()
    .filter((p) => {
      const st = getEstoqueStatus(p);
      return st === "reposicao" || st === "zerado" || st === "negativo";
    })
    .map((produto) => {
      const sugerido = getQtdReposicaoSugerida(produto);
      const reservado = getEstoqueReservado(produto.id);
      const disponivel = Number(produto.estoque || 0) - reservado;
      const custoEst = sugerido * Number(produto.custo || 0);
      return { produto, sugerido, reservado, disponivel, custoEst };
    })
    .sort((a, b) => b.sugerido - a.sugerido);

  if (!rows.length) {
    els.estoqueReposicaoTable.innerHTML = `<tr><td colspan="10">Nenhum item no ponto de pedido. Estoque saudável.</td></tr>`;
    return;
  }

  els.estoqueReposicaoTable.innerHTML = rows
    .map(({ produto, sugerido, reservado, disponivel, custoEst }) => `
      <tr>
        <td>${escapeHtml(produto.nome)}</td>
        <td>${formatAbcBadge(produto.classe_abc)}</td>
        <td>${escapeHtml(produto.estoque ?? 0)}</td>
        <td>${escapeHtml(reservado)}</td>
        <td>${escapeHtml(Number(disponivel.toFixed(2)))}</td>
        <td>${escapeHtml(produto.ponto_pedido ?? 0)}</td>
        <td>${produto.estoque_maximo == null ? "–" : escapeHtml(produto.estoque_maximo)}</td>
        <td><strong>${escapeHtml(sugerido)}</strong></td>
        <td>${moeda.format(custoEst)}</td>
        <td>
          <button type="button" class="btn btn-ghost" data-estoque-mov="entrada" data-produto-id="${produto.id}" data-qtd-sugerida="${sugerido}">Entrada</button>
        </td>
      </tr>
    `)
    .join("");
}

function computeAbcFromSales(salesByProduto, dias) {
  const rows = [];
  let totalValor = 0;

  for (const produto of getProdutosControlamEstoque()) {
    const sale = salesByProduto[String(produto.id)] || { qty: 0, valor: 0 };
    rows.push({
      produto,
      qty: sale.qty,
      valor: sale.valor
    });
    totalValor += sale.valor;
  }

  rows.sort((a, b) => b.valor - a.valor || b.qty - a.qty);

  let acum = 0;
  for (const row of rows) {
    if (totalValor <= 0 || row.valor <= 0) {
      row.classe = row.valor > 0 ? "C" : null;
      row.pctAcum = 100;
      continue;
    }
    acum += row.valor;
    const pct = (acum / totalValor) * 100;
    row.pctAcum = pct;
    if (pct <= 80) row.classe = "A";
    else if (pct <= 95) row.classe = "B";
    else row.classe = "C";
  }

  return { rows, totalValor, dias };
}

async function loadAndComputeAbc(options = {}) {
  const dias = Number(options.dias || state.estoqueAbcDias || 90);
  state.estoqueAbcDias = dias;

  const start = new Date();
  start.setDate(start.getDate() - dias);
  const startIso = start.toISOString();

  const { data: docs, error: docsErr } = await supabaseClient
    .from("documentos_venda")
    .select("id")
    .eq("empresa_id", state.empresaId)
    .eq("tipo_documento", "pedido")
    .neq("status", "cancelado")
    .gte("data_emissao", startIso);

  if (docsErr) throw docsErr;

  const salesByProduto = {};
  const ids = (docs || []).map((d) => d.id);
  const chunkSize = 80;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    if (!chunk.length) continue;
    const { data: itens, error: itensErr } = await supabaseClient
      .from("documento_venda_itens")
      .select("produto_id, quantidade, valor_unitario, valor_total")
      .eq("empresa_id", state.empresaId)
      .in("documento_id", chunk);
    if (itensErr) throw itensErr;
    for (const item of itens || []) {
      if (!item.produto_id) continue;
      const key = String(item.produto_id);
      if (!salesByProduto[key]) salesByProduto[key] = { qty: 0, valor: 0 };
      const qtd = Number(item.quantidade || 0);
      const valor = item.valor_total != null
        ? Number(item.valor_total)
        : qtd * Number(item.valor_unitario || 0);
      salesByProduto[key].qty += qtd;
      salesByProduto[key].valor += valor;
    }
  }

  const result = computeAbcFromSales(salesByProduto, dias);
  state.estoqueAbcRows = result.rows;
  return result;
}

async function persistAbcClasses() {
  const now = new Date().toISOString();
  const updates = (state.estoqueAbcRows || []).filter((r) => r.produto?.id);
  // Atualiza em lotes sequenciais (simples e seguro)
  for (const row of updates) {
    const classe = row.classe || null;
    const { error } = await supabaseClient
      .from("produto_catalogo")
      .update({
        classe_abc: classe,
        classe_abc_atualizado_em: now
      })
      .eq("empresa_id", state.empresaId)
      .eq("id", row.produto.id);
    if (error) throw error;
    const local = state.produtos.find((p) => Number(p.id) === Number(row.produto.id));
    if (local) {
      local.classe_abc = classe;
      local.classe_abc_atualizado_em = now;
    }
  }
}

function renderEstoqueAbc() {
  const rows = state.estoqueAbcRows || [];
  let a = 0;
  let b = 0;
  let c = 0;
  let sem = 0;
  for (const row of rows) {
    if (row.classe === "A") a += 1;
    else if (row.classe === "B") b += 1;
    else if (row.classe === "C") c += 1;
    else sem += 1;
  }
  if (els.estoqueAbcCountA) els.estoqueAbcCountA.textContent = String(a);
  if (els.estoqueAbcCountB) els.estoqueAbcCountB.textContent = String(b);
  if (els.estoqueAbcCountC) els.estoqueAbcCountC.textContent = String(c);
  if (els.estoqueAbcCountSem) els.estoqueAbcCountSem.textContent = String(sem);

  if (!els.estoqueAbcTable) return;
  if (!rows.length) {
    els.estoqueAbcTable.innerHTML = `<tr><td colspan="6">Sem dados. Clique em Recalcular ABC.</td></tr>`;
    return;
  }

  els.estoqueAbcTable.innerHTML = rows
    .map((row) => `
      <tr>
        <td>${formatAbcBadge(row.classe)}</td>
        <td>${escapeHtml(row.produto.nome)}</td>
        <td>${escapeHtml(Number(row.qty.toFixed(2)))}</td>
        <td>${moeda.format(row.valor)}</td>
        <td>${row.valor > 0 ? `${escapeHtml(row.pctAcum.toFixed(1))}%` : "–"}</td>
        <td>${escapeHtml(row.produto.estoque ?? 0)}</td>
      </tr>
    `)
    .join("");
}

function renderEstoqueInventarioTable() {
  if (!els.estoqueInventarioTable) return;
  const busca = String(state.estoqueFilters.invBusca || "").trim().toLowerCase();
  const rows = getProdutosControlamEstoque()
    .filter((p) => !busca || String(p.nome).toLowerCase().includes(busca))
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));

  if (!rows.length) {
    els.estoqueInventarioTable.innerHTML = `<tr><td colspan="4">Nenhum produto.</td></tr>`;
    return;
  }

  els.estoqueInventarioTable.innerHTML = rows
    .map((p) => {
      const contagem = state.estoqueInventarioDraft[String(p.id)];
      const contagemVal = contagem === undefined || contagem === "" ? "" : contagem;
      const diff = contagemVal === "" ? "" : Number(contagemVal) - Number(p.estoque || 0);
      const diffTxt = contagemVal === "" ? "–" : (diff > 0 ? `+${diff}` : String(diff));
      return `
        <tr>
          <td>${escapeHtml(p.nome)}</td>
          <td>${escapeHtml(p.estoque ?? 0)}</td>
          <td>
            <input
              type="number"
              min="0"
              step="1"
              data-inv-produto="${p.id}"
              value="${escapeHtml(contagemVal)}"
              placeholder="Contado"
              style="width: 6.5rem"
            />
          </td>
          <td class="${diff > 0 ? "estoque-qtd-pos" : diff < 0 ? "estoque-qtd-neg" : ""}">${escapeHtml(diffTxt)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderEstoqueSection() {
  setEstoqueView(state.estoqueView);
  renderEstoquePainel();
  renderEstoqueSaldosTable();
  renderEstoqueMovimentosTable();
  renderEstoqueReposicaoTable();
  renderEstoqueAbc();
  renderEstoqueInventarioTable();
}

async function ensureEstoqueLoaded(options = {}) {
  await ensureProdutosLoaded(options);
  await Promise.all([
    loadEstoqueReservas(options),
    loadEstoqueMovimentos(options)
  ]);

  // ABC em cache local se vazio
  if (!state.estoqueAbcRows.length || options.forceAbc) {
    try {
      await loadAndComputeAbc({ dias: state.estoqueAbcDias });
    } catch (err) {
      console.warn("ABC nao calculado", err);
    }
  }
  renderEstoqueSection();
}

function fillEstoqueMovimentoProdutoSelect(selectedId = "") {
  if (!els.estoqueMovimentoProduto) return;
  const options = getProdutosControlamEstoque()
    .map((p) => {
      const sel = String(p.id) === String(selectedId) ? " selected" : "";
      return `<option value="${escapeHtml(p.id)}"${sel}>${escapeHtml(p.nome)} (saldo ${escapeHtml(p.estoque ?? 0)})</option>`;
    })
    .join("");
  els.estoqueMovimentoProduto.innerHTML = options || `<option value="">Nenhum produto</option>`;
  updateEstoqueMovimentoSaldoInfo();
}

function updateEstoqueMovimentoSaldoInfo() {
  if (!els.estoqueMovimentoSaldoInfo) return;
  const pid = els.estoqueMovimentoProduto?.value;
  const tipo = els.estoqueMovimentoTipo?.value || "entrada";
  const prod = state.produtos.find((p) => String(p.id) === String(pid));
  if (!prod) {
    els.estoqueMovimentoSaldoInfo.textContent = "";
    return;
  }
  const isAbs = tipo === "ajuste" || tipo === "inventario";
  if (els.estoqueMovimentoQtdLabel) {
    els.estoqueMovimentoQtdLabel.childNodes[0].textContent = isAbs ? "Novo saldo " : "Quantidade ";
  }
  els.estoqueMovimentoSaldoInfo.textContent = isAbs
    ? `Saldo atual: ${prod.estoque ?? 0}. Informe o novo saldo absoluto.`
    : `Saldo atual: ${prod.estoque ?? 0}. Reservado em pedidos abertos: ${getEstoqueReservado(prod.id)}.`;
}

function openEstoqueMovimentoModal({ produtoId = "", tipo = "entrada", quantidade = "" } = {}) {
  if (!els.estoqueMovimentoModal) return;
  fillEstoqueMovimentoProdutoSelect(produtoId);
  if (els.estoqueMovimentoTipo) els.estoqueMovimentoTipo.value = tipo || "entrada";
  if (els.estoqueMovimentoQtd) els.estoqueMovimentoQtd.value = quantidade === "" || quantidade == null ? "" : String(quantidade);
  if (els.estoqueMovimentoMotivo) els.estoqueMovimentoMotivo.value = "";
  if (els.estoqueMovimentoObs) els.estoqueMovimentoObs.value = "";
  if (els.estoqueMovimentoNegativo) els.estoqueMovimentoNegativo.checked = false;
  updateEstoqueMovimentoSaldoInfo();
  els.estoqueMovimentoModal.classList.remove("hidden");
}

function closeEstoqueMovimentoModal() {
  if (els.estoqueMovimentoModal) els.estoqueMovimentoModal.classList.add("hidden");
}

async function submitEstoqueMovimento(event) {
  event.preventDefault();
  const form = els.estoqueMovimentoForm;
  if (!form) return;
  const formData = new FormData(form);
  const produtoId = Number(formData.get("produto_id"));
  const tipo = String(formData.get("tipo") || "entrada");
  const quantidade = Number(formData.get("quantidade"));
  const motivo = String(formData.get("motivo") || "").trim() || null;
  const observacoes = String(formData.get("observacoes") || "").trim() || null;
  const permitirNegativo = Boolean(formData.get("permitir_negativo"));

  if (!produtoId || !Number.isFinite(quantidade)) {
    throw new Error("Informe produto e quantidade.");
  }

  await registrarEstoqueMovimento({
    produtoId,
    tipo,
    quantidade,
    motivo,
    observacoes,
    permitirNegativo
  });

  closeEstoqueMovimentoModal();
  state.produtosLoaded = false;
  state.estoqueMovimentosLoaded = false;
  showToast("Movimento de estoque registrado");
  await ensureEstoqueLoaded({ force: true });
  if (state.produtosLoaded) renderProdutosTable();
  renderMetrics();
}

async function aplicarInventarioContagens() {
  const entries = Object.entries(state.estoqueInventarioDraft || {})
    .map(([id, val]) => ({ id: Number(id), contagem: val === "" || val == null ? null : Number(val) }))
    .filter((e) => e.contagem != null && Number.isFinite(e.contagem));

  if (!entries.length) {
    showToast("Preencha ao menos uma contagem.", "error");
    return;
  }

  let ok = 0;
  let skip = 0;
  const errors = [];

  for (const entry of entries) {
    const prod = state.produtos.find((p) => Number(p.id) === entry.id);
    if (!prod) continue;
    if (Number(prod.estoque || 0) === Number(entry.contagem)) {
      skip += 1;
      continue;
    }
    try {
      await registrarEstoqueMovimento({
        produtoId: entry.id,
        tipo: "inventario",
        quantidade: entry.contagem,
        motivo: "Inventário físico",
        permitirNegativo: entry.contagem < 0
      });
      ok += 1;
    } catch (err) {
      errors.push(`${prod.nome}: ${err.message}`);
    }
  }

  state.estoqueInventarioDraft = {};
  state.produtosLoaded = false;
  state.estoqueMovimentosLoaded = false;
  await ensureEstoqueLoaded({ force: true });
  if (state.produtosLoaded) renderProdutosTable();
  renderMetrics();

  if (errors.length) {
    showToast(`Inventário: ${ok} ok, ${skip} iguais, erros: ${errors[0]}`, "error");
  } else {
    showToast(`Inventário aplicado: ${ok} ajuste(s), ${skip} sem diferença.`);
  }
}

async function ensureOrcamentosLoaded(options = {}) {
  if (state.orcamentosLoaded && !options.force) return;
  await loadOrcamentos();
  state.orcamentosLoaded = true;
}

async function ensureDespesasLoaded(options = {}) {
  if (state.despesasLoaded && !options.force) return;
  await loadDespesas();
  state.despesasLoaded = true;
}

async function ensureContasReceberLoaded(options = {}) {
  if (state.contasReceberLoaded && !options.force) return;
  await Promise.all([loadContasReceber(), loadRecebimentos(), loadParcelasReceberPrevistas()]);
  state.contasReceberLoaded = true;
}

async function ensureOwnerUsersLoaded(options = {}) {
  if (state.ownerUsersLoaded && !options.force) return;
  await loadOwnerUsers();
  state.ownerUsersLoaded = true;
}

async function ensureAdminLoaded(options = {}) {
  if (!state.isPlatformAdmin) return;
  if (state.adminLoaded && !options.force) return;
  await Promise.all([loadAdminEmpresas(), loadAdminVinculos()]);
  state.adminLoaded = true;
}

async function loadPedidos() {
  // Se ha filtro ativo, a busca no banco inteiro prevalece.
  if (hasActivePedidosFilter()) {
    await loadPedidosFilteredFromDatabase();
    return;
  }

  const limit = Math.max(1, Number(state.pedidosLimit || 50));

  const { data: docsData, error: docsError } = await supabaseClient
    .from("documentos_venda")
    .select(
      "id, data_emissao, status, total, observacoes, raw_payload, cliente_legacy_id, cliente:clientes(id,nome)"
    )
    .eq("empresa_id", state.empresaId)
    .eq("tipo_documento", "pedido")
    .order("data_emissao", { ascending: false })
    .limit(limit);

  if (docsError) throw docsError;

  state.pedidosSource = "documentos_venda";
  state.pedidosSearchMode = false;
  state.pedidos = (docsData || []).map(mapDocumentoToPedido);
  state.pedidosTotalCarregado = state.pedidos.length;
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

    const pedidoIds = state.pedidos.map((pedido) => Number(pedido.id)).filter(Number.isFinite);
    const { data, error } = pedidoIds.length
      ? await supabaseClient
          .from("documento_venda_itens")
          .select("documento_id, produto_id, descricao_item, quantidade, valor_unitario, valor_total")
          .eq("empresa_id", state.empresaId)
          .in("documento_id", pedidoIds)
      : { data: [], error: null };

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

  if (state.itensDocumentoModalMode === "cliente_pedidos") {
    els.itensDocumentoTableHead.innerHTML = `
      <tr>
        <th>Pedido</th>
        <th>Data</th>
        <th>Status</th>
        <th>Total</th>
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
      <th class="sortable" data-table="pedidosSintetico" data-sort="pagamento">Pagamento</th>
      <th class="sortable" data-table="pedidosSintetico" data-sort="total">Total</th>
      <th></th>
    </tr>
    <tr>
      <th><input data-table-filter="pedidosSintetico" data-field="pedido" value="${getTableFilterValue("pedidosSintetico", "pedido")}" placeholder="Filtrar" /></th>
      <th><input data-table-filter="pedidosSintetico" data-field="data" value="${getTableFilterValue("pedidosSintetico", "data")}" placeholder="Filtrar" /></th>
      <th><input data-table-filter="pedidosSintetico" data-field="cliente" value="${getTableFilterValue("pedidosSintetico", "cliente")}" placeholder="Filtrar" /></th>
      <th><input data-table-filter="pedidosSintetico" data-field="pagamento" value="${getTableFilterValue("pedidosSintetico", "pagamento")}" placeholder="Filtrar" /></th>
      <th><input data-table-filter="pedidosSintetico" data-field="total" value="${getTableFilterValue("pedidosSintetico", "total")}" placeholder="Filtrar" /></th>
      <th></th>
    </tr>
  `;
}

function getActivePedidosListFilters() {
  const tableKey = state.pedidosListMode === "analitico" ? "pedidosAnalitico" : "pedidosSintetico";
  const view = getTableViewConfig(tableKey);
  const active = {};
  for (const [field, value] of Object.entries(view?.filters || {})) {
    const text = String(value || "").trim();
    if (text) active[field] = text;
  }
  return active;
}

function hasActivePedidosFilter() {
  return Object.keys(getActivePedidosListFilters()).length > 0;
}

function parseLooseDateFilter(value) {
  const text = String(value || "").trim();
  if (!text) return null;

  // yyyy-mm-dd
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const start = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0);
    const end = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 23, 59, 59, 999);
    if (!Number.isNaN(start.getTime())) return { start: start.toISOString(), end: end.toISOString() };
  }

  // dd/mm/yyyy
  match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const start = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), 0, 0, 0, 0);
    const end = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), 23, 59, 59, 999);
    if (!Number.isNaN(start.getTime())) return { start: start.toISOString(), end: end.toISOString() };
  }

  // dd/mm
  match = text.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (match) {
    const year = new Date().getFullYear();
    const start = new Date(year, Number(match[2]) - 1, Number(match[1]), 0, 0, 0, 0);
    const end = new Date(year, Number(match[2]) - 1, Number(match[1]), 23, 59, 59, 999);
    if (!Number.isNaN(start.getTime())) return { start: start.toISOString(), end: end.toISOString() };
  }

  // mm/yyyy or yyyy-mm
  match = text.match(/^(\d{1,2})\/(\d{4})$/);
  if (match) {
    const month = Number(match[1]) - 1;
    const year = Number(match[2]);
    const start = new Date(year, month, 1, 0, 0, 0, 0);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    if (!Number.isNaN(start.getTime())) return { start: start.toISOString(), end: end.toISOString() };
  }

  match = text.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const start = new Date(year, month, 1, 0, 0, 0, 0);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    if (!Number.isNaN(start.getTime())) return { start: start.toISOString(), end: end.toISOString() };
  }

  return null;
}

function parseLooseMoneyFilter(value) {
  const text = String(value || "")
    .trim()
    .replace(/r\$/gi, "")
    .replace(/\s/g, "");
  if (!text) return null;
  // 1.234,56 or 1234.56 or 1234
  let normalized = text;
  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  }
  const num = Number(normalized.replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : null;
}

function mapDocumentoToPedido(item) {
  return {
    id: item.id,
    data_pedido: item.data_emissao,
    status: item.status,
    valor_total: item.total,
    observacoes: item.observacoes || null,
    raw_payload: item.raw_payload || null,
    cliente: item.cliente,
    cliente_legacy_id: item.cliente_legacy_id
  };
}

async function findDocumentoIdsByProdutoFilter(produtoNeedle) {
  const needle = String(produtoNeedle || "").trim();
  if (!needle) return null;

  const { data, error } = await fetchAllSupabaseRows(() =>
    supabaseClient
      .from("documento_venda_itens")
      .select("documento_id")
      .eq("empresa_id", state.empresaId)
      .ilike("descricao_item", `%${needle}%`)
  );

  if (error) throw error;
  const ids = [...new Set((data || []).map((row) => Number(row.documento_id)).filter(Number.isFinite))];
  return ids;
}

async function loadPedidosFilteredFromDatabase() {
  const filters = getActivePedidosListFilters();
  if (!Object.keys(filters).length) {
    if (state.pedidosSearchMode) {
      state.pedidosSearchMode = false;
      state.pedidosLimit = 50;
      await loadPedidos();
    }
    return;
  }

  state.pedidosSearchMode = true;
  state.pedidosSearchLoading = true;

  try {
    const needsClienteInner = Boolean(filters.cliente);
    const select = needsClienteInner
      ? "id, data_emissao, status, total, observacoes, raw_payload, cliente_legacy_id, cliente:clientes!inner(id,nome)"
      : "id, data_emissao, status, total, observacoes, raw_payload, cliente_legacy_id, cliente:clientes(id,nome)";

    let documentIdsFromProduto = null;
    if (filters.produto) {
      documentIdsFromProduto = await findDocumentoIdsByProdutoFilter(filters.produto);
      if (!documentIdsFromProduto.length) {
        state.pedidos = [];
        state.pedidosTotalCarregado = 0;
        state.pedidosProdutosRaw = [];
        state.pedidosProdutos = [];
        return;
      }
    }

    const buildQuery = () => {
      let query = supabaseClient
        .from("documentos_venda")
        .select(select)
        .eq("empresa_id", state.empresaId)
        .eq("tipo_documento", "pedido")
        .order("data_emissao", { ascending: false });

      if (filters.pedido) {
        const cleanId = String(filters.pedido).replace(/[^\d]/g, "");
        query = query.eq("id", cleanId ? Number(cleanId) : -1);
      }

      if (filters.cliente) {
        query = query.ilike("cliente.nome", `%${filters.cliente}%`);
      }

      if (filters.data) {
        const range = parseLooseDateFilter(filters.data);
        if (range) {
          query = query.gte("data_emissao", range.start).lte("data_emissao", range.end);
        }
      }

      if (filters.total) {
        const amount = parseLooseMoneyFilter(filters.total);
        if (amount != null) {
          // tolera digitacao aproximada (ex.: 140, 140.00)
          query = query.gte("total", amount - 0.009).lte("total", amount + 0.009);
        }
      }

      if (documentIdsFromProduto) {
        // PostgREST limita IN muito grande; fatia em blocos no fetch se necessario
        query = query.in("id", documentIdsFromProduto.slice(0, 200));
      }

      return query;
    };

    // Se ha muitos IDs de produto, busca em fatias
    let docsData = [];
    if (documentIdsFromProduto && documentIdsFromProduto.length > 200) {
      const chunks = [];
      for (let i = 0; i < documentIdsFromProduto.length; i += 200) {
        chunks.push(documentIdsFromProduto.slice(i, i + 200));
      }
      for (const chunk of chunks) {
        const { data, error } = await fetchAllSupabaseRows(() => {
          let query = supabaseClient
            .from("documentos_venda")
            .select(select)
            .eq("empresa_id", state.empresaId)
            .eq("tipo_documento", "pedido")
            .in("id", chunk)
            .order("data_emissao", { ascending: false });

          if (filters.pedido) {
            const cleanId = String(filters.pedido).replace(/[^\d]/g, "");
            query = query.eq("id", cleanId ? Number(cleanId) : -1);
          }
          if (filters.cliente) query = query.ilike("cliente.nome", `%${filters.cliente}%`);
          if (filters.data) {
            const range = parseLooseDateFilter(filters.data);
            if (range) query = query.gte("data_emissao", range.start).lte("data_emissao", range.end);
          }
          if (filters.total) {
            const amount = parseLooseMoneyFilter(filters.total);
            if (amount != null) query = query.gte("total", amount - 0.009).lte("total", amount + 0.009);
          }
          return query;
        });
        if (error) throw error;
        docsData.push(...(data || []));
      }
      // dedupe by id
      const byId = new Map(docsData.map((row) => [row.id, row]));
      docsData = [...byId.values()].sort((a, b) => {
        const da = new Date(a.data_emissao || 0).getTime();
        const db = new Date(b.data_emissao || 0).getTime();
        return db - da;
      });
    } else {
      const { data, error } = await fetchAllSupabaseRows(buildQuery);
      if (error) throw error;
      docsData = data || [];
    }

    // Filtros textuais de data (quando nao deu para parsear data exata) e total parcial
    if (filters.data && !parseLooseDateFilter(filters.data)) {
      const needle = filters.data.toLowerCase();
      docsData = docsData.filter((row) => {
        const label = row.data_emissao ? new Date(row.data_emissao).toLocaleDateString("pt-BR") : "";
        return label.toLowerCase().includes(needle);
      });
    }

    // Pagamento fica no raw_payload — filtra no cliente.
    if (filters.pagamento) {
      const needle = String(filters.pagamento).toLowerCase();
      docsData = docsData.filter((row) => getPedidoPagamentoLabel(row).toLowerCase().includes(needle));
    }

    state.pedidosSource = "documentos_venda";
    state.pedidos = docsData.map(mapDocumentoToPedido);
    state.pedidosTotalCarregado = state.pedidos.length;
    await loadPedidosProdutos();
  } finally {
    state.pedidosSearchLoading = false;
  }
}

function schedulePedidosDatabaseSearch() {
  window.clearTimeout(schedulePedidosDatabaseSearch._timer);
  schedulePedidosDatabaseSearch._timer = window.setTimeout(async () => {
    if (schedulePedidosDatabaseSearch._running) {
      schedulePedidosDatabaseSearch._pending = true;
      return;
    }
    schedulePedidosDatabaseSearch._running = true;
    try {
      await loadPedidosFilteredFromDatabase();
      renderPedidosSection();
      renderMetrics();
    } catch (error) {
      console.error(error);
      showToast(`Erro ao buscar pedidos: ${error.message}`, "error");
    } finally {
      schedulePedidosDatabaseSearch._running = false;
      if (schedulePedidosDatabaseSearch._pending) {
        schedulePedidosDatabaseSearch._pending = false;
        schedulePedidosDatabaseSearch();
      }
    }
  }, 350);
}

function updatePedidosLoadMoreUI() {
  const emListaSintetica = state.pedidosView === "pedidos" && state.pedidosListMode === "sintetico";
  const carregado = Number(state.pedidosTotalCarregado || 0);
  const total = Number(state.pedidosCountTotal || 0);
  const restante = Math.max(0, total - carregado);
  const emBusca = Boolean(state.pedidosSearchMode);
  const deveMostrar = emListaSintetica && !emBusca && total > 0 && restante > 0;
  els.pedidosLoadMoreWrap.classList.toggle("hidden", !deveMostrar && !(emListaSintetica && emBusca));

  if (emListaSintetica && emBusca) {
    els.pedidosLoadMoreWrap.classList.remove("hidden");
    if (els.pedidosLoadMoreInfo) {
      els.pedidosLoadMoreInfo.textContent = state.pedidosSearchLoading
        ? "Buscando em todos os pedidos..."
        : `Busca no banco: ${carregado} pedido(s) encontrado(s).`;
    }
    if (els.pedidosLoadMoreBtn) {
      els.pedidosLoadMoreBtn.classList.add("hidden");
    }
    if (els.pedidosLoadAllBtn) {
      els.pedidosLoadAllBtn.classList.add("hidden");
    }
    return;
  }

  if (els.pedidosLoadMoreBtn) els.pedidosLoadMoreBtn.classList.remove("hidden");
  if (els.pedidosLoadAllBtn) els.pedidosLoadAllBtn.classList.remove("hidden");

  if (!deveMostrar) {
    els.pedidosLoadMoreWrap.classList.add("hidden");
    return;
  }

  if (els.pedidosLoadMoreInfo) {
    els.pedidosLoadMoreInfo.textContent = `Exibindo ${carregado} de ${total} pedidos. Restantes: ${restante}.`;
  }
  if (els.pedidosLoadMoreBtn) {
    const step = Math.min(50, restante);
    els.pedidosLoadMoreBtn.textContent = `Mostrar mais ${step}`;
    els.pedidosLoadMoreBtn.disabled = restante <= 0;
  }
  if (els.pedidosLoadAllBtn) {
    els.pedidosLoadAllBtn.textContent = `Mostrar todos (${total})`;
    els.pedidosLoadAllBtn.disabled = restante <= 0;
  }
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
    } else if (state.pedidosSearchMode) {
      els.pedidosSectionSubtitle.textContent = state.pedidosSearchLoading
        ? "Buscando pedidos em todo o banco..."
        : `Filtro ativo no banco inteiro — ${Number(state.pedidosTotalCarregado || 0)} pedido(s) encontrado(s).`;
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
    const showListMode = state.pedidosView === "pedidos";
    // Mantém o slot no desktop (evita botões trocando de lugar); some no mobile via CSS.
    els.pedidosListModeToggle.classList.toggle("hidden", !showListMode);
    els.pedidosListModeToggle.classList.toggle("is-inactive", !showListMode);
    els.pedidosListModeToggle.setAttribute("aria-hidden", showListMode ? "false" : "true");
  }

  updatePedidosLoadMoreUI();
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
      <tr class="cliente-row is-clickable" data-view-cliente-pedidos="${cliente.id}" title="Ver pedidos deste cliente">
        <td>
          <button type="button" class="action-link cliente-nome-link" data-view-cliente-pedidos="${cliente.id}">
            ${escapeHtml(cliente.nome)}
          </button>
        </td>
        <td>${escapeHtml(cliente.telefone || "-")}</td>
        <td>${escapeHtml(cliente.email || "-")}</td>
        <td>
          <button type="button" class="action-edit" data-view-cliente-pedidos="${cliente.id}">Pedidos</button>
          <button type="button" class="action-delete" data-del-cliente="${cliente.id}">Excluir</button>
        </td>
      </tr>
    `
    )
    .join("");
  updateTableSortHeaders("clientes");
}

function updateItensDocumentoModalChrome() {
  const isClientePedidos = state.itensDocumentoModalMode === "cliente_pedidos";
  if (els.novoPedidoClienteBtn) {
    els.novoPedidoClienteBtn.classList.toggle("hidden", !isClientePedidos);
  }
  if (els.itensDocumentoModalSubtitle) {
    if (isClientePedidos) {
      const total = Number(state.itensDocumento?.length || 0);
      els.itensDocumentoModalSubtitle.textContent = total
        ? `${total} pedido(s) encontrado(s). Voce pode criar um novo pedido para este cliente.`
        : "Nenhum pedido ainda. Crie o primeiro pedido para este cliente.";
      els.itensDocumentoModalSubtitle.classList.remove("hidden");
    } else {
      els.itensDocumentoModalSubtitle.textContent = "";
      els.itensDocumentoModalSubtitle.classList.add("hidden");
    }
  }
}

async function openClientePedidosModal(clienteId) {
  const cliente = state.clientes.find((item) => Number(item.id) === Number(clienteId));
  if (!cliente) {
    showToast("Cliente nao encontrado", "error");
    return;
  }

  const { data, error } = await supabaseClient
    .from("documentos_venda")
    .select("id, data_emissao, status, total, raw_payload, cliente_legacy_id, cliente:clientes(id,nome)")
    .eq("empresa_id", state.empresaId)
    .eq("tipo_documento", "pedido")
    .eq("cliente_id", Number(clienteId))
    .order("data_emissao", { ascending: false });

  if (error) throw error;

  state.itensDocumentoModalMode = "cliente_pedidos";
  state.itensDocumentoPedidoFoto = "";
  state.itensDocumentoPedidoId = null;
  state.itensDocumentoClienteId = Number(clienteId);
  state.itensDocumento = (data || []).map((item) => ({
    id: item.id,
    data_pedido: item.data_emissao,
    status: item.status,
    valor_total: item.total,
    raw_payload: item.raw_payload || null,
    cliente: item.cliente || { id: cliente.id, nome: cliente.nome }
  }));

  if (els.itensDocumentoModalTitle) {
    els.itensDocumentoModalTitle.textContent = `Pedidos de ${cliente.nome}`;
  }
  renderItensDocumentoTableHead();
  renderItensDocumentoTable();
  updateItensDocumentoModalChrome();
  openItensDocumentoModal();
}

async function openNovoPedidoForCliente(clienteId) {
  const id = Number(clienteId || state.itensDocumentoClienteId || 0);
  if (!id) {
    showToast("Cliente nao informado", "error");
    return;
  }

  try {
    await Promise.all([ensureClientesLoaded(), ensureProdutosLoaded()]);
  } catch (error) {
    showToast(`Erro ao carregar dados para novo pedido: ${error.message}`, "error");
  }

  closeItensDocumentoModal();
  openNovoDocumentoModal("pedido");
  setNovoDocumentoCliente(id);
  showToast("Cliente selecionado no novo pedido");
}

function getProdutoEstoqueView(produto) {
  const controla = produto.controla_estoque !== false;
  const saldo = Number(produto.estoque || 0);
  const reservado = controla ? getEstoqueReservado(produto.id) : 0;
  const disponivel = controla ? saldo - reservado : null;
  const status = controla ? getEstoqueStatus(produto) : "n/a";
  return { controla, saldo, reservado, disponivel, status };
}

function renderProdutosTable() {
  const produtos = getFilteredAndSortedProdutos();

  els.produtosTable.innerHTML = produtos
    .map((produto) => {
      const est = getProdutoEstoqueView(produto);
      const saldoCell = est.controla
        ? escapeHtml(est.saldo)
        : `<span class="field-hint" title="Produto nao controla estoque">–</span>`;
      const reservCell = est.controla ? escapeHtml(est.reservado) : "–";
      const dispCell = est.controla ? escapeHtml(Number(est.disponivel.toFixed(2))) : "–";
      const pontoCell = est.controla ? escapeHtml(produto.ponto_pedido ?? 0) : "–";
      const statusCell = est.controla
        ? formatEstoqueStatusBadge(est.status)
        : `<span class="estoque-status" title="Sem controle de estoque">N/A</span>`;

      return `
      <tr>
        <td class="produto-cell-nome">
          ${renderProdutoThumbHtml(produto)}
          <span>${escapeHtml(produto.nome)}</span>
        </td>
        <td>${escapeHtml(produto.categoria || "-")}</td>
        <td>${moeda.format(produto.preco || 0)}</td>
        <td>${produto.custo == null ? "-" : moeda.format(produto.custo)}</td>
        <td>${produto.margem == null ? "-" : `${escapeHtml(produto.margem)}%`}</td>
        <td>${est.controla ? formatAbcBadge(produto.classe_abc) : "–"}</td>
        <td><strong>${saldoCell}</strong></td>
        <td>${reservCell}</td>
        <td>${dispCell}</td>
        <td>${pontoCell}</td>
        <td>${statusCell}</td>
        <td>${produto.ativo ? "Sim" : "Nao"}</td>
        <td class="estoque-actions">
          <button class="action-edit" data-edit-produto="${produto.id}">Editar</button>
          ${est.controla
            ? `<button type="button" class="btn btn-ghost" data-produto-estoque-mov="${produto.id}">Estoque</button>`
            : ""}
          <button class="action-delete" data-del-produto="${produto.id}">Excluir</button>
        </td>
      </tr>
    `;
    })
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

  if (field === "classe_abc") {
    return String(produto.classe_abc || "-");
  }

  if (field === "reservado" || field === "disponivel" || field === "status_estoque") {
    const est = getProdutoEstoqueView(produto);
    if (field === "reservado") return String(est.reservado);
    if (field === "disponivel") return est.disponivel == null ? "" : String(est.disponivel);
    return est.status;
  }

  const value = produto[field];
  return value == null ? "" : String(value);
}

function getProdutoSortValue(produto, field) {
  if (field === "reservado" || field === "disponivel") {
    const est = getProdutoEstoqueView(produto);
    return field === "reservado" ? est.reservado : (est.disponivel ?? 0);
  }
  if (field === "status_estoque") {
    const order = { negativo: 0, zerado: 1, reposicao: 2, ok: 3, "n/a": 4 };
    return order[getProdutoEstoqueView(produto).status] ?? 9;
  }
  if (field === "classe_abc") {
    const order = { A: 1, B: 2, C: 3 };
    return order[String(produto.classe_abc || "").toUpperCase()] ?? 9;
  }
  return produto[field];
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
    const av = getProdutoSortValue(a, field);
    const bv = getProdutoSortValue(b, field);

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

/** Chave de dia local (YYYY-MM-DD) a partir de Date ou ISO. */
function toLocalDateKey(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatPedidosDayMilestoneTitle(dateKey) {
  if (!dateKey || dateKey === "sem-data") return "Sem data";
  const parts = dateKey.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return "Sem data";
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  const today = new Date();
  const todayKey = toLocalDateKey(today);
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const yesterdayKey = toLocalDateKey(yesterday);

  const full = date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
  const labeled = full ? full.charAt(0).toUpperCase() + full.slice(1) : dateKey;
  if (dateKey === todayKey) return `Hoje · ${labeled}`;
  if (dateKey === yesterdayKey) return `Ontem · ${labeled}`;
  return labeled;
}

function renderPedidosDayMilestoneRow({ dateKey, count, total, colspan, countLabel }) {
  const title = formatPedidosDayMilestoneTitle(dateKey);
  const countText = `${count} ${countLabel}${count === 1 ? "" : "s"}`;
  const totalText = moeda.format(total || 0);
  const shortDate = dateKey && dateKey !== "sem-data"
    ? dateKey.split("-").reverse().join("/")
    : "";
  return `
    <tr class="pedidos-day-milestone" data-day-key="${escapeHtml(dateKey || "sem-data")}">
      <td colspan="${colspan}">
        <div class="pedidos-day-milestone-inner">
          <span class="pedidos-day-milestone-dot" aria-hidden="true"></span>
          <div class="pedidos-day-milestone-text">
            <strong class="pedidos-day-milestone-title">${escapeHtml(title)}</strong>
            <span class="pedidos-day-milestone-meta">${escapeHtml(countText)} · ${escapeHtml(totalText)}${shortDate ? ` · ${escapeHtml(shortDate)}` : ""}</span>
          </div>
        </div>
      </td>
    </tr>
  `;
}

function buildRowsWithDayMilestones(rows, {
  getDateValue,
  getTotal,
  colspan,
  countLabel,
  renderRow
}) {
  if (!rows.length) return "";

  const dayStats = new Map();
  for (const row of rows) {
    const key = toLocalDateKey(getDateValue(row)) || "sem-data";
    const cur = dayStats.get(key) || { count: 0, total: 0 };
    cur.count += 1;
    cur.total += Number(getTotal(row) || 0);
    dayStats.set(key, cur);
  }

  const parts = [];
  let lastKey = null;
  for (const row of rows) {
    const key = toLocalDateKey(getDateValue(row)) || "sem-data";
    if (key !== lastKey) {
      const stats = dayStats.get(key) || { count: 0, total: 0 };
      parts.push(renderPedidosDayMilestoneRow({
        dateKey: key,
        count: stats.count,
        total: stats.total,
        colspan,
        countLabel
      }));
      lastKey = key;
    }
    parts.push(renderRow(row));
  }
  return parts.join("");
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

    els.pedidosTable.innerHTML = buildRowsWithDayMilestones(rows, {
      getDateValue: (item) => item.dataPedido,
      getTotal: (item) => item.valorTotal,
      colspan: 6,
      countLabel: "item",
      renderRow: (item) => {
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
      }
    });
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
    pagamento: (pedido) => getPedidoPagamentoLabel(pedido),
    total: {
      filter: (pedido) => moeda.format(pedido.valor_total || 0),
      sort: (pedido) => Number(pedido.valor_total || 0)
    }
  });

  if (!rows.length) {
    els.pedidosTable.innerHTML = '<tr><td colspan="6">Nenhum pedido encontrado para os filtros selecionados.</td></tr>';
    return;
  }

  els.pedidosTable.innerHTML = buildRowsWithDayMilestones(rows, {
    getDateValue: (pedido) => pedido.data_pedido,
    getTotal: (pedido) => pedido.valor_total,
    colspan: 6,
    countLabel: "pedido",
    renderRow: (pedido) => {
      const data = pedido.data_pedido ? new Date(pedido.data_pedido).toLocaleDateString("pt-BR") : "-";
      const clienteNome = pedido.cliente?.nome || (pedido.cliente_legacy_id ? `Legacy #${escapeHtml(pedido.cliente_legacy_id)}` : "-");
      const pagamentoLabel = getPedidoPagamentoLabel(pedido);
      return `
      <tr>
        <td class="pedido-cell-id">
          ${renderPedidoThumbHtml(pedido)}
          <span>#${escapeHtml(pedido.id)}</span>
        </td>
        <td>${data}</td>
        <td>${clienteNome}</td>
        <td>${escapeHtml(pagamentoLabel)}</td>
        <td>${moeda.format(pedido.valor_total || 0)}</td>
        <td>
          <button class="action-edit" data-edit-pedido="${pedido.id}">Editar</button>
          <button class="action-finance" data-open-recebimento-pedido="${pedido.id}">Receber</button>
          <button class="action-edit" data-view-pedido-itens="${pedido.id}">Itens</button>
          <button class="action-delete" data-del-pedido="${pedido.id}">Excluir</button>
        </td>
      </tr>
    `;
    }
  });
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
            <button class="action-finance" data-open-recebimento-parcela="${conta.parcelaId || ""}" data-open-recebimento-conta="${conta.contaId || conta.id || ""}">Registrar recebimento</button>
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
  // Aba Contas a Pagar unificada (modulo compras).
  if (comprasModule) {
    comprasModule.renderContasPagarTable();
    return;
  }
  if (!els.despesasPagarTable && !els.despesasTable) return;
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

  if (!els.despesasTable) return;
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

function setDashboardLoading(isLoading, message) {
  if (els.dashboardSection) {
    els.dashboardSection.classList.toggle("is-loading", Boolean(isLoading));
  }
  if (els.dashboardStatusText) {
    els.dashboardStatusText.textContent = message
      || (isLoading ? "Atualizando…" : "Atualizado");
  }
}

function animateDashboardBars(root) {
  if (!root) return;
  const fills = root.querySelectorAll("[data-bar-h]");
  if (!fills.length) return;
  for (const el of fills) {
    el.style.height = "0%";
  }
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      for (const el of fills) {
        el.style.height = el.getAttribute("data-bar-h") || "0%";
      }
    });
  });
}

function renderMetrics(options = {}) {
  const withCharts = options.charts !== false;

  const clientesTotal = state.clientesLoaded ? state.clientes.length : state.dashboardCounts.clientes;
  if (els.clientesCount) els.clientesCount.textContent = String(clientesTotal);
  const pedidosTotal = Number(state.pedidosCountTotal || 0);
  if (els.pedidosCount) els.pedidosCount.textContent = String(pedidosTotal);
  const despesasTotal = state.despesasLoaded ? state.despesas.length : state.dashboardCounts.despesas;
  if (els.despesasCount) els.despesasCount.textContent = String(despesasTotal);

  if (els.pedidosCount) {
    const carregado = Number(state.pedidosTotalCarregado || 0);
    els.pedidosCount.title = state.pedidosLoaded && carregado > 0 && carregado < pedidosTotal
      ? `Total no dashboard: ${pedidosTotal}. Carregados na lista de pedidos: ${carregado}.`
      : "";
  }

  const faturamento = Number(state.pedidosFaturamentoTotal || 0);
  if (els.faturamentoValue) els.faturamentoValue.textContent = moeda.format(faturamento);

  const estoqueTotal = state.produtosLoaded ? state.produtos.length : state.dashboardCounts.produtosTotal;
  const estoqueComSaldo = state.produtosLoaded
    ? state.produtos.filter((produto) => produto.controla_estoque !== false && Number(produto.estoque || 0) > 0).length
    : state.dashboardCounts.produtosComSaldo;
  const estoquePontoPedido = state.produtosLoaded
    ? state.produtos.filter(
        (produto) => produto.controla_estoque !== false && Number(produto.estoque || 0) <= Number(produto.ponto_pedido || 0)
      ).length
    : state.dashboardCounts.produtosPontoPedido;
  const orcamentoAberto = state.orcamentosLoaded
    ? state.orcamentos
        .filter((orcamento) => orcamento.status === "aberto")
        .reduce((sum, orcamento) => sum + Number(orcamento.valor_total || 0), 0)
    : Number(state.dashboardCounts.orcamentoAberto || 0);

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

  if (els.estoqueTotalCount) els.estoqueTotalCount.textContent = `${estoqueTotal} itens`;
  if (els.estoqueComSaldoCount) els.estoqueComSaldoCount.textContent = `${estoqueComSaldo} itens`;
  if (els.estoquePontoPedidoCount) els.estoquePontoPedidoCount.textContent = `${estoquePontoPedido} itens`;
  if (els.orcamentoAbertoValue) els.orcamentoAbertoValue.textContent = moeda.format(orcamentoAberto);

  if (!withCharts) return;

  renderDashboardMetricMonths();
  renderDashboardDailyCharts();
  renderDashboardForecastCard();
  renderDashboardResultCards();

  if (els.entradasCaixaResumo) {
    els.entradasCaixaResumo.textContent = moeda.format(currentMonthEntry);
  }

  if (els.entradasCaixaGrid) {
    if (!monthlyCashEntries.length) {
      els.entradasCaixaGrid.innerHTML = '<div class="documento-empty-state">Sem recebimentos registrados.</div>';
    } else {
      const isFaturamento = state.dashboardCashChartMode === "faturamento";
      // Mais recentes primeiro: mais legível que cards empilhados.
      const rows = [...monthlyCashEntries].reverse();
      const head = isFaturamento
        ? `
          <tr>
            <th scope="col">Mês</th>
            <th scope="col" class="cash-month-num">Faturamento</th>
          </tr>
        `
        : `
          <tr>
            <th scope="col">Mês</th>
            <th scope="col" class="cash-month-num">Total</th>
            <th scope="col" class="cash-month-num">Realizado</th>
            <th scope="col" class="cash-month-num">Previsto</th>
            <th scope="col" class="cash-month-mix-col">Composição</th>
          </tr>
        `;
      const body = rows
        .map((item) => {
          const realized = Number(item.realized || 0);
          const forecast = Number(item.forecast || 0);
          const total = Number(item.total || 0);
          const isCurrent = item.monthKey === currentMonthKey;
          const realizedPct = total > 0 ? Math.round((realized / total) * 100) : 0;
          const forecastPct = Math.max(0, 100 - realizedPct);
          if (isFaturamento) {
            return `
              <tr class="${isCurrent ? "is-current" : ""}">
                <td>
                  <span class="cash-month-label">${escapeHtml(item.label)}</span>
                  ${isCurrent ? '<span class="cash-month-tag">atual</span>' : ""}
                </td>
                <td class="cash-month-num">${moeda.format(total)}</td>
              </tr>
            `;
          }
          return `
            <tr class="${isCurrent ? "is-current" : ""}">
              <td>
                <span class="cash-month-label">${escapeHtml(item.label)}</span>
                ${isCurrent ? '<span class="cash-month-tag">atual</span>' : ""}
              </td>
              <td class="cash-month-num cash-month-total">${moeda.format(total)}</td>
              <td class="cash-month-num cash-month-realized">${moeda.format(realized)}</td>
              <td class="cash-month-num cash-month-forecast">${moeda.format(forecast)}</td>
              <td class="cash-month-mix-col">
                <div class="cash-mix-bar" title="Realizado ${realizedPct}% · Previsto ${forecastPct}%">
                  <span class="cash-mix-realized" style="width:${realizedPct}%"></span>
                  <span class="cash-mix-forecast" style="width:${forecastPct}%"></span>
                </div>
                <span class="cash-mix-pct">${realizedPct}% real.</span>
              </td>
            </tr>
          `;
        })
        .join("");
      els.entradasCaixaGrid.innerHTML = `
        <div class="cash-month-table-wrap">
          <table class="cash-month-table">
            <thead>${head}</thead>
            <tbody>${body}</tbody>
          </table>
        </div>
      `;
    }
  }

  if (els.entradasCaixaChart) {
    const maxValue = Math.max(...monthlyCashEntries.map((item) => Number(item.total || 0)), 0);
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
                  <div class="cash-bar-fill cash-bar-fill-realized" data-bar-h="${realizedHeight}%" style="height:0%"></div>
                  <div class="cash-bar-fill cash-bar-fill-forecast" data-bar-h="${forecastHeight}%" style="height:0%"></div>
                `
                : `<div class="cash-bar-fill${isCurrentMonth ? " cash-bar-fill-current" : ""}" data-bar-h="${totalHeight}%" style="height:0%"></div>`}
            </div>
            <div class="cash-bar-label">${escapeHtml(item.label)}</div>
          </div>
        `;
      })
      .join("");
    els.entradasCaixaChart.innerHTML = chartBars || '<div class="documento-empty-state">Sem recebimentos registrados.</div>';
    animateDashboardBars(els.entradasCaixaChart);
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

function formatCompactNumber(value) {
  const num = Number(value || 0);
  if (Number.isInteger(num)) return String(num);
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatShortMonthLabel(date) {
  const raw = date.toLocaleDateString("pt-BR", { month: "short" });
  return raw.replace(/\.$/, "");
}

function parseMonthDate(value) {
  if (!value) return null;
  const text = String(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getRecentMonthlyMetrics() {
  const rows = state.dashboardMonthlyCash || [];
  const currentKey = formatMonthKey(new Date());
  const byKey = new Map();
  for (const row of rows) {
    const reference = parseMonthDate(row.mes);
    if (!reference) continue;
    byKey.set(formatMonthKey(reference), { reference, row });
  }

  // Se o snapshot ainda nao tem o mes corrente (ou traz zerado), usamos os totais
  // vindos do gráfico diário para o mes atual, para nao mostrar 0 injustamente.
  const dailyRows = state.dashboardDaily || [];
  const dailyTotals = dailyRows.reduce(
    (acc, row) => {
      acc.faturamento += Number(row.faturamento || 0);
      acc.pedidosCount += Number(row.pedidosCount || 0);
      return acc;
    },
    { faturamento: 0, pedidosCount: 0 }
  );

  if (!rows.length && dailyTotals.faturamento === 0 && dailyTotals.pedidosCount === 0) {
    return [];
  }

  const entries = [];
  const cursor = new Date(`${currentKey}-01T12:00:00`);
  for (let i = 0; i < 4; i += 1) {
    const key = formatMonthKey(cursor);
    const match = byKey.get(key);
    const reference = match?.reference || new Date(cursor.getTime());
    const row = match?.row || null;

    const isCurrent = i === 0;
    const faturamento = isCurrent
      ? Math.max(Number(row?.faturamento || 0), dailyTotals.faturamento)
      : Number(row?.faturamento || 0);
    const pedidosCount = isCurrent
      ? Math.max(Number(row?.pedidosCount || 0), dailyTotals.pedidosCount)
      : Number(row?.pedidosCount || 0);

    entries.push({
      key,
      reference,
      label: formatShortMonthLabel(reference),
      isCurrent,
      clientesNovos: Number(row?.clientesNovos || 0),
      pedidosCount,
      despesasCount: Number(row?.despesasCount || 0),
      despesasTotal: Number(row?.despesasTotal || 0),
      faturamento
    });
    cursor.setMonth(cursor.getMonth() - 1);
  }
  return entries;
}

function renderDashboardMetricMonths() {
  const nodes = document.querySelectorAll("[data-metric-months]");
  if (!nodes.length) return;
  const entries = getRecentMonthlyMetrics();
  const noData = !entries.length;

  const formatters = {
    clientes: (entry) => formatCompactNumber(entry.clientesNovos),
    pedidos: (entry) => formatCompactNumber(entry.pedidosCount),
    despesas: (entry) => moeda.format(entry.despesasTotal || 0),
    faturamento: (entry) => moeda.format(entry.faturamento || 0)
  };

  for (const node of nodes) {
    const metric = node.getAttribute("data-metric-months");
    const formatter = formatters[metric];
    if (!formatter) {
      node.innerHTML = "";
      continue;
    }
    if (noData) {
      node.innerHTML = "";
      continue;
    }
    node.innerHTML = entries
      .map((entry) => {
        const value = formatter(entry);
        const cls = entry.isCurrent ? "metric-month metric-month-current" : "metric-month";
        return `
          <div class="${cls}" title="${escapeHtml(entry.reference.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }))}">
            <span class="metric-month-label">${escapeHtml(entry.label)}</span>
            <span class="metric-month-value">${escapeHtml(value)}</span>
          </div>
        `;
      })
      .join("");
  }
}

/**
 * Dias exibidos nos gráficos diários do dashboard:
 * apenas dias úteis do calendário (exclui domingo/fechados e feriados de dia inteiro).
 */
function getDashboardDailyChartRows() {
  const rows = state.dashboardDaily || [];
  const cal = state.calendarioForecast || { horarios: [], feriados: [] };
  const horarios = cal.horarios || [];
  const feriados = cal.feriados || [];

  return rows.filter((row) => {
    if (!row?.dia) return false;
    const date = new Date(`${row.dia}T12:00:00`);
    if (Number.isNaN(date.getTime())) return false;
    return isDashboardWorkingDay(date, horarios, feriados);
  });
}

function renderDashboardDailyCharts() {
  const allRows = state.dashboardDaily || [];
  // Eixo X: só dias úteis (calendário). Totais do mês seguem a base completa.
  const rows = getDashboardDailyChartRows();
  const hoje = new Date();
  const todayKey = formatDateInput(hoje);

  const totalFaturamento = allRows.reduce((sum, row) => sum + Number(row.faturamento || 0), 0);
  const totalPedidos = allRows.reduce((sum, row) => sum + Number(row.pedidosCount || 0), 0);
  const todayRow = allRows.find((row) => row.dia === todayKey) || null;
  const faturamentoHoje = Number(todayRow?.faturamento || 0);
  const pedidosHoje = Number(todayRow?.pedidosCount || 0);

  if (els.dailyFaturamentoResumo) {
    els.dailyFaturamentoResumo.textContent = moeda.format(totalFaturamento);
  }
  if (els.dailyFaturamentoHoje) {
    els.dailyFaturamentoHoje.textContent = moeda.format(faturamentoHoje);
  }
  if (els.dailyPedidosResumo) {
    els.dailyPedidosResumo.textContent = formatCompactNumber(totalPedidos);
  }
  if (els.dailyPedidosHoje) {
    els.dailyPedidosHoje.textContent = formatCompactNumber(pedidosHoje);
  }

  const formatCurrencyNoCents = (value) => {
    const rounded = Math.round(Number(value || 0));
    return `R$ ${rounded.toLocaleString("pt-BR")}`;
  };

  const emptyMessage = allRows.length
    ? "Nenhum dia util no calendario para exibir neste mes."
    : "Sem dados para o mes atual.";

  const renderChart = (node, valueOf, formatValue, formatInside, colorClass) => {
    if (!node) return;
    if (!rows.length) {
      node.innerHTML = `<div class="documento-empty-state">${emptyMessage}</div>`;
      return;
    }
    const maxValue = Math.max(...rows.map((row) => Number(valueOf(row) || 0)), 0);
    node.innerHTML = rows
      .map((row) => {
        const value = Number(valueOf(row) || 0);
        const height = maxValue > 0 ? Math.max(4, Math.round((value / maxValue) * 100)) : 4;
        const isToday = row.dia === todayKey;
        const dayNum = row.dia ? String(Number(row.dia.slice(8, 10))) : "";
        const weekday = row.dia
          ? new Date(`${row.dia}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short" })
          : "";
        const title = row.dia
          ? `${new Date(`${row.dia}T12:00:00`).toLocaleDateString("pt-BR")}${weekday ? ` (${weekday})` : ""}: ${formatValue(value)}`
          : formatValue(value);
        const insideLabel = value > 0
          ? `<span class="daily-bar-inside-label">${escapeHtml(formatInside(value))}</span>`
          : "";
        return `
          <div class="cash-bar-wrap daily-bar-wrap${isToday ? " cash-bar-wrap-current" : ""}" title="${escapeHtml(title)}">
            <div class="cash-bar-track" aria-hidden="true">
              <div class="cash-bar-fill daily-bar-fill ${colorClass}${isToday ? " cash-bar-fill-current" : ""}" data-bar-h="${height}%" style="height:0%">${insideLabel}</div>
            </div>
            <div class="cash-bar-label">${escapeHtml(dayNum)}</div>
          </div>
        `;
      })
      .join("");
    animateDashboardBars(node);
  };

  renderChart(
    els.dailyFaturamentoChart,
    (row) => row.faturamento,
    (value) => moeda.format(value),
    (value) => formatCurrencyNoCents(value),
    "cash-bar-fill-realized"
  );
  renderChart(
    els.dailyPedidosChart,
    (row) => row.pedidosCount,
    (value) => formatCompactNumber(value),
    (value) => formatCompactNumber(value),
    "cash-bar-fill-forecast"
  );
}

function getMonthlyCashEntries(mode = "recebimentos") {
  const rows = state.dashboardMonthlyCash || [];
  if (!rows.length) return [];

  return rows.map((row) => {
    const reference = parseMonthDate(row.mes) || new Date();
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

      setDashboardLoading(true);

      // Dashboard primeiro: pinta a tela cedo e só depois carrega o restante.
      await Promise.all([
        loadDashboardSnapshot(),
        loadDashboardDaily(),
        loadCalendarioForDashboard(),
        loadDashboardContasPagarMes()
      ]);
      renderMetrics({ charts: true });
      setDashboardLoading(false, "Atualizado");

      const secondaryLoads = [loadFormasPagamento()];
      if (state.clientesLoaded) secondaryLoads.push(loadClientes());
      if (state.produtosLoaded) secondaryLoads.push(loadProdutos());
      if (state.pedidosLoaded) secondaryLoads.push(loadPedidos());
      if (state.orcamentosLoaded) secondaryLoads.push(loadOrcamentos());
      if (state.despesasLoaded) secondaryLoads.push(loadDespesas());
      if (state.contasReceberLoaded) secondaryLoads.push(loadContasReceber(), loadRecebimentos(), loadParcelasReceberPrevistas());
      if (state.ownerUsersLoaded) secondaryLoads.push(loadOwnerUsers());
      if (state.adminLoaded && state.isPlatformAdmin) secondaryLoads.push(loadAdminEmpresas(), loadAdminVinculos());
      if (state.estoqueMovimentosLoaded) {
        state.estoqueMovimentosLoaded = false;
        state.estoqueReservasLoaded = false;
        secondaryLoads.push(loadEstoqueMovimentos({ force: true }), loadEstoqueReservas({ force: true }));
      }

      await Promise.all(secondaryLoads);

      renderSelects();
      if (state.clientesLoaded) renderClientesTable();
      if (state.produtosLoaded) renderProdutosTable();
      if (state.pedidosLoaded) renderPedidosSection();
      if (state.contasReceberLoaded) renderContasReceberTable();
      if (state.orcamentosLoaded) renderOrcamentosTable();
      if (state.despesasLoaded) renderDespesasTable();
      if (state.ownerUsersLoaded) renderOwnerUsersTable();
      if (document.getElementById("section-estoque") && !document.getElementById("section-estoque").classList.contains("hidden")) {
        renderEstoqueSection();
      }
      if (state.adminLoaded) {
        renderAdminEmpresasSelect();
        renderAdminVinculosTable();
      }
      // Atualiza totais de outras seções sem remontar os gráficos do dashboard.
      renderMetrics({ charts: false });
      if (els.novoDocumentoModal && !els.novoDocumentoModal.classList.contains("hidden")) {
        renderNovoDocumentoFormaPagamentoSelect();
        renderNovoDocumentoPagamentoSection();
      }
    } catch (error) {
      console.error(error);
      setDashboardLoading(false, "Erro ao atualizar");
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

  const precoFormacao = getCurrentProdutoPrecoFormacaoForSave();
  const estoqueMaxRaw = String(formData.get("estoque_maximo") || "").trim();
  const leadTimeRaw = String(formData.get("lead_time_dias") || "").trim();
  const saldoInicial = Math.max(0, Math.trunc(Number(formData.get("estoque") || 0) || 0));
  const controlaEstoque = String(formData.get("controla_estoque") || "sim") === "sim";

  const payloadCatalogo = {
    empresa_id: state.empresaId,
    categoria_id: categoriaId,
    nome,
    preco_venda: Number(formData.get("preco") || 0),
    custo: String(formData.get("custo") || "").trim() ? Number(formData.get("custo")) : null,
    margem_percentual: String(formData.get("margem") || "").trim() ? Number(formData.get("margem")) : null,
    estoque_minimo: Number(formData.get("ponto_pedido") || 0),
    estoque_maximo: estoqueMaxRaw ? Number(estoqueMaxRaw) : null,
    lead_time_dias: leadTimeRaw ? Number(leadTimeRaw) : 7,
    ativo: String(formData.get("ativo") || "sim") === "sim",
    controla_estoque: controlaEstoque,
    descricao: String(formData.get("descricao") || "").trim() || null,
    imagem_path: String(formData.get("imagem_path") || "").trim() || null
  };

  // Mantem formacao anterior se o usuario nao mexeu na calculadora nesta sessao.
  if (precoFormacao) {
    payloadCatalogo.preco_formacao = precoFormacao;
  } else if (editId) {
    const atual = state.produtos.find((item) => Number(item.id) === Number(editId));
    if (atual?.preco_formacao) {
      payloadCatalogo.preco_formacao = atual.preco_formacao;
    }
  }

  let produtoId = editId;

  if (editId) {
    // Nao sobrescreve estoque_atual na edicao — saldo so muda por movimentos.
    const { error: updateCatalogError } = await supabaseClient
      .from("produto_catalogo")
      .update(payloadCatalogo)
      .eq("id", editId)
      .eq("empresa_id", state.empresaId);

    if (updateCatalogError) throw updateCatalogError;
  } else {
    payloadCatalogo.estoque_atual = 0;
    const { data: inserted, error: insertCatalogError } = await supabaseClient
      .from("produto_catalogo")
      .insert(payloadCatalogo)
      .select("id")
      .single();

    if (insertCatalogError) throw insertCatalogError;
    produtoId = inserted?.id;

    if (controlaEstoque && saldoInicial > 0 && produtoId) {
      try {
        await registrarEstoqueMovimento({
          produtoId,
          tipo: "entrada",
          quantidade: saldoInicial,
          motivo: "Saldo inicial no cadastro",
          permitirNegativo: false
        });
      } catch (movErr) {
        console.warn("Falha ao registrar saldo inicial", movErr);
        // Fallback: seta saldo direto se RPC falhar
        await supabaseClient
          .from("produto_catalogo")
          .update({ estoque_atual: saldoInicial })
          .eq("id", produtoId)
          .eq("empresa_id", state.empresaId);
      }
    }
  }

  state.produtoPrecoFormacaoPending = null;
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
    state.pedidosLoaded = false;
    state.pedidos = [];
    state.pedidosLimit = 50;
    state.pedidosTotalCarregado = 0;
    state.pedidosProdutosRaw = [];
    state.pedidosProdutos = [];
    state.pedidosCountTotal = 0;
    state.pedidosFaturamentoTotal = 0;
    state.clientesLoaded = false;
    state.produtosLoaded = false;
    state.contasReceberLoaded = false;
    state.orcamentosLoaded = false;
    state.despesasLoaded = false;
    state.ownerUsersLoaded = false;
    state.adminLoaded = false;
    state.dashboardCounts = { clientes: 0, despesas: 0, produtosTotal: 0, produtosComSaldo: 0, produtosPontoPedido: 0, orcamentoAberto: 0 };
    updateAdminVisibility();
    updateOwnerUsersVisibility();
    setSection("dashboard");
    handleSession._loadingUserId = null;
    handleSession._loadingPromise = null;
    return;
  }

  // Ja carregamos os dados desse usuario? So retorna.
  if (previousUserId && previousUserId === nextUserId && state.empresaId) {
    return;
  }

  // Uma carga para esse usuario esta em andamento? aguarda.
  if (handleSession._loadingUserId === nextUserId && handleSession._loadingPromise) {
    return handleSession._loadingPromise;
  }

  setSection("dashboard");
  handleSession._loadingUserId = nextUserId;
  handleSession._loadingPromise = (async () => {
    try {
      await loadPlatformAdminStatus();
      await loadEmpresaContext();
      await refreshAll();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      handleSession._loadingUserId = null;
      handleSession._loadingPromise = null;
    }
  })();

  return handleSession._loadingPromise;
}

function initComprasModule() {
  if (comprasModule) return comprasModule;
  comprasModule = installComprasModule({
    getState: () => state,
    getEls: () => els,
    getSupabase: () => supabaseClient,
    helpers: {
      moeda,
      escapeHtml,
      showToast,
      formatDateInput,
      registrarEstoqueMovimento,
      ensureProdutosLoaded,
      loadFormasPagamento
    }
  });
  comprasModule.ensureStateDefaults();
  comprasModule.attachComprasEvents();
  return comprasModule;
}

function initCalendarioModule() {
  if (calendarioModule) return calendarioModule;
  calendarioModule = installCalendarioModule({
    getState: () => state,
    getEls: () => els,
    getSupabase: () => supabaseClient,
    helpers: {
      moeda,
      escapeHtml,
      showToast,
      formatDateInput
    }
  });
  calendarioModule.ensureStateDefaults();
  calendarioModule.attachCalendarioEvents();
  return calendarioModule;
}

function attachEvents() {
  initComprasModule();
  initCalendarioModule();
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
    tab.addEventListener("click", async () => {
      const sectionName = tab.dataset.section || "dashboard";
      setSection(sectionName);
      try {
        if (sectionName === "pedidos") {
          await ensurePedidosLoaded();
          renderPedidosSection();
        } else if (sectionName === "clientes") {
          await ensureClientesLoaded();
          renderSelects();
          renderClientesTable();
        } else if (sectionName === "produtos") {
          await ensureProdutosLoaded();
          // Reserva vem dos pedidos abertos — mesma base da aba Estoque.
          await loadEstoqueReservas({ force: false });
          renderProdutosTable();
        } else if (sectionName === "estoque") {
          await ensureEstoqueLoaded();
        } else if (sectionName === "compras") {
          if (comprasModule) await comprasModule.ensureComprasLoaded();
        } else if (sectionName === "calendario") {
          if (calendarioModule) await calendarioModule.ensureCalendarioLoaded();
        } else if (sectionName === "orcamentos") {
          await ensureOrcamentosLoaded();
          renderOrcamentosTable();
        } else if (sectionName === "despesas") {
          // Caixa único de saídas (NF + despesas manuais) via contas_pagar
          if (comprasModule) await comprasModule.ensureDespesasPagarLoaded();
        } else if (sectionName === "financeiro") {
          await ensureContasReceberLoaded();
          renderContasReceberTable();
        } else if (sectionName === "usuarios") {
          await ensureOwnerUsersLoaded();
          renderOwnerUsersTable();
        } else if (sectionName === "admin") {
          await ensureAdminLoaded();
          renderAdminEmpresasSelect();
          renderAdminVinculosTable();
        }
        renderMetrics();
      } catch (error) {
        showToast(`Erro ao carregar ${sectionName}: ${error.message}`, "error");
      }
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

  if (els.openProdutoPrecoVendaCalcBtn) {
    els.openProdutoPrecoVendaCalcBtn.addEventListener("click", () => openProdutoPrecoVendaCalcPanel());
  }
  if (els.closeProdutoPrecoVendaCalcBtn) {
    els.closeProdutoPrecoVendaCalcBtn.addEventListener("click", () => closeProdutoPrecoVendaCalcPanel());
  }
  if (els.produtoCalcRecarregarCustoBtn) {
    els.produtoCalcRecarregarCustoBtn.addEventListener("click", () => {
      const calc = ensureProdutoPrecoVendaCalcState();
      calc._custoProdutosTouched = false;
      syncProdutoPrecoVendaCalcFromForm();
      renderProdutoPrecoVendaCalcPanel();
      showToast("Custo recarregado do cadastro do produto");
    });
  }
  if (els.produtoCalcAplicarPrecoBtn) {
    els.produtoCalcAplicarPrecoBtn.addEventListener("click", () => applyProdutoPrecoVendaCalcToForm());
  }

  const produtoCalcInputs = [
    els.produtoCalcCusto,
    els.produtoCalcMaoDeObra,
    els.produtoCalcFrete,
    els.produtoCalcEmbalagem,
    els.produtoCalcOutrasDespesas,
    els.produtoCalcImpostosPct,
    els.produtoCalcTaxaCartaoPct,
    els.produtoCalcComissaoPct,
    els.produtoCalcMargemPct
  ].filter(Boolean);

  for (const input of produtoCalcInputs) {
    input.addEventListener("input", () => {
      readProdutoPrecoVendaCalcFromInputs();
      renderProdutoPrecoVendaCalcPanel();
    });
  }

  // Se o usuario editar custo/preco/margem no formulario com a calculadora aberta, atualiza o resultado.
  for (const name of ["custo", "preco", "margem"]) {
    const field = els.produtoForm?.elements?.namedItem(name);
    if (!(field instanceof HTMLElement)) continue;
    field.addEventListener("input", () => {
      if (!state.produtoPrecoVendaCalc?.open) return;
      if (name === "custo" && !state.produtoPrecoVendaCalc._custoProdutosTouched) {
        syncProdutoPrecoVendaCalcFromForm({ keepOverrides: false });
      }
      renderProdutoPrecoVendaCalcPanel();
    });
  }

  if (els.openPedidoModalBtn) {
    els.openPedidoModalBtn.addEventListener("click", async () => {
      try {
        await Promise.all([ensureClientesLoaded(), ensureProdutosLoaded()]);
      } catch (error) {
        showToast(`Erro ao carregar dados para novo pedido: ${error.message}`, "error");
      }
      openNovoDocumentoModal("pedido");
    });
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

  // ---- Estoque: views, filtros, modal e inventario ----
  for (const btn of els.estoqueViewButtons || []) {
    btn.addEventListener("click", async () => {
      const view = btn.getAttribute("data-estoque-view") || "painel";
      setEstoqueView(view);
      try {
        if (view === "movimentos") {
          await loadEstoqueMovimentos({ force: true });
        }
        renderEstoqueSection();
      } catch (error) {
        showToast(`Erro ao carregar estoque: ${error.message}`, "error");
      }
    });
  }

  if (els.openEstoqueMovimentoBtn) {
    els.openEstoqueMovimentoBtn.addEventListener("click", () => openEstoqueMovimentoModal());
  }
  if (els.closeEstoqueMovimentoModalBtn) {
    els.closeEstoqueMovimentoModalBtn.addEventListener("click", closeEstoqueMovimentoModal);
  }
  if (els.estoqueMovimentoModal) {
    els.estoqueMovimentoModal.addEventListener("click", (event) => {
      if (event.target === els.estoqueMovimentoModal) closeEstoqueMovimentoModal();
    });
  }
  if (els.estoqueMovimentoForm) {
    els.estoqueMovimentoForm.addEventListener("submit", async (event) => {
      try {
        await submitEstoqueMovimento(event);
      } catch (error) {
        showToast(`Erro no movimento: ${error.message}`, "error");
      }
    });
  }
  if (els.estoqueMovimentoProduto) {
    els.estoqueMovimentoProduto.addEventListener("change", updateEstoqueMovimentoSaldoInfo);
  }
  if (els.estoqueMovimentoTipo) {
    els.estoqueMovimentoTipo.addEventListener("change", updateEstoqueMovimentoSaldoInfo);
  }

  if (els.estoqueSaldoBusca) {
    els.estoqueSaldoBusca.addEventListener("input", () => {
      state.estoqueFilters.saldoBusca = els.estoqueSaldoBusca.value || "";
      renderEstoqueSaldosTable();
    });
  }
  if (els.estoqueSaldoStatus) {
    els.estoqueSaldoStatus.addEventListener("change", () => {
      state.estoqueFilters.saldoStatus = els.estoqueSaldoStatus.value || "";
      renderEstoqueSaldosTable();
    });
  }
  if (els.estoqueSaldoAbc) {
    els.estoqueSaldoAbc.addEventListener("change", () => {
      state.estoqueFilters.saldoAbc = els.estoqueSaldoAbc.value || "";
      renderEstoqueSaldosTable();
    });
  }
  if (els.estoqueMovBusca) {
    els.estoqueMovBusca.addEventListener("input", () => {
      state.estoqueFilters.movBusca = els.estoqueMovBusca.value || "";
      renderEstoqueMovimentosTable();
    });
  }
  if (els.estoqueMovTipo) {
    els.estoqueMovTipo.addEventListener("change", async () => {
      state.estoqueFilters.movTipo = els.estoqueMovTipo.value || "";
      state.estoqueMovimentosLoaded = false;
      try {
        await loadEstoqueMovimentos({ force: true });
        renderEstoqueMovimentosTable();
      } catch (error) {
        showToast(`Erro ao filtrar movimentos: ${error.message}`, "error");
      }
    });
  }
  if (els.estoqueMovStart) {
    els.estoqueMovStart.addEventListener("change", async () => {
      state.estoqueFilters.movStart = els.estoqueMovStart.value || "";
      state.estoqueMovimentosLoaded = false;
      try {
        await loadEstoqueMovimentos({ force: true });
        renderEstoqueMovimentosTable();
      } catch (error) {
        showToast(`Erro ao filtrar movimentos: ${error.message}`, "error");
      }
    });
  }
  if (els.estoqueMovEnd) {
    els.estoqueMovEnd.addEventListener("change", async () => {
      state.estoqueFilters.movEnd = els.estoqueMovEnd.value || "";
      state.estoqueMovimentosLoaded = false;
      try {
        await loadEstoqueMovimentos({ force: true });
        renderEstoqueMovimentosTable();
      } catch (error) {
        showToast(`Erro ao filtrar movimentos: ${error.message}`, "error");
      }
    });
  }
  if (els.estoqueMovRefreshBtn) {
    els.estoqueMovRefreshBtn.addEventListener("click", async () => {
      try {
        await loadEstoqueMovimentos({ force: true });
        renderEstoqueMovimentosTable();
        showToast("Movimentos atualizados");
      } catch (error) {
        showToast(`Erro ao atualizar: ${error.message}`, "error");
      }
    });
  }
  if (els.estoqueAbcDias) {
    els.estoqueAbcDias.addEventListener("change", () => {
      state.estoqueAbcDias = Number(els.estoqueAbcDias.value || 90);
    });
  }
  if (els.estoqueAbcRecalcularBtn) {
    els.estoqueAbcRecalcularBtn.addEventListener("click", async () => {
      try {
        const dias = Number(els.estoqueAbcDias?.value || state.estoqueAbcDias || 90);
        await loadAndComputeAbc({ dias });
        await persistAbcClasses();
        renderEstoqueSection();
        showToast("Classificação ABC recalculada e salva nos produtos");
      } catch (error) {
        showToast(`Erro ao recalcular ABC: ${error.message}`, "error");
      }
    });
  }
  if (els.estoqueInvBusca) {
    els.estoqueInvBusca.addEventListener("input", () => {
      state.estoqueFilters.invBusca = els.estoqueInvBusca.value || "";
      renderEstoqueInventarioTable();
    });
  }
  if (els.estoqueInvAplicarBtn) {
    els.estoqueInvAplicarBtn.addEventListener("click", async () => {
      try {
        await aplicarInventarioContagens();
      } catch (error) {
        showToast(`Erro no inventário: ${error.message}`, "error");
      }
    });
  }
  if (els.estoqueInventarioTable) {
    els.estoqueInventarioTable.addEventListener("input", (event) => {
      const input = event.target?.closest?.("input[data-inv-produto]");
      if (!input) return;
      const id = input.getAttribute("data-inv-produto");
      state.estoqueInventarioDraft[String(id)] = input.value;
      // Atualiza so a celula de diferenca sem re-render total (mantem foco)
      const tr = input.closest("tr");
      if (!tr) return;
      const saldo = Number(tr.children[1]?.textContent || 0);
      const contagem = input.value === "" ? null : Number(input.value);
      const diffCell = tr.children[3];
      if (!diffCell) return;
      if (contagem == null || !Number.isFinite(contagem)) {
        diffCell.textContent = "–";
        diffCell.className = "";
        return;
      }
      const diff = contagem - saldo;
      diffCell.textContent = diff > 0 ? `+${diff}` : String(diff);
      diffCell.className = diff > 0 ? "estoque-qtd-pos" : diff < 0 ? "estoque-qtd-neg" : "";
    });
  }
  if (els.estoqueSaldosTable) {
    els.estoqueSaldosTable.addEventListener("click", (event) => {
      const btn = event.target?.closest?.("[data-estoque-mov]");
      if (!btn) return;
      openEstoqueMovimentoModal({
        produtoId: btn.getAttribute("data-produto-id") || "",
        tipo: btn.getAttribute("data-estoque-mov") || "entrada"
      });
    });
  }
  if (els.estoqueReposicaoTable) {
    els.estoqueReposicaoTable.addEventListener("click", (event) => {
      const btn = event.target?.closest?.("[data-estoque-mov]");
      if (!btn) return;
      openEstoqueMovimentoModal({
        produtoId: btn.getAttribute("data-produto-id") || "",
        tipo: btn.getAttribute("data-estoque-mov") || "entrada",
        quantidade: btn.getAttribute("data-qtd-sugerida") || ""
      });
    });
  }

  if (els.produtoImagemPathInput) {
    els.produtoImagemPathInput.addEventListener("input", updateProdutoFormImagePreview);
    els.produtoImagemPathInput.addEventListener("change", updateProdutoFormImagePreview);
  }

  const produtoNomeField = els.produtoForm?.elements?.namedItem("nome");
  if (produtoNomeField instanceof HTMLElement) {
    produtoNomeField.addEventListener("input", updateProdutoFormImagePreview);
  }

  if (els.produtoImageZoomBtn) {
    els.produtoImageZoomBtn.addEventListener("click", () => {
      const url = els.produtoImagePreview?.dataset?.imagePreview || els.produtoImagePreview?.src || "";
      const title = els.produtoForm?.elements?.namedItem("nome")?.value || "Produto";
      if (url) openImageLightbox(url, title);
    });
  }

  if (els.produtoImagePreview) {
    els.produtoImagePreview.addEventListener("click", () => {
      const url = els.produtoImagePreview.dataset.imagePreview || els.produtoImagePreview.src || "";
      const title = els.produtoImagePreview.dataset.imageTitle
        || els.produtoForm?.elements?.namedItem("nome")?.value
        || "Produto";
      if (url) openImageLightbox(url, title);
    });
  }

  if (els.closeImageLightboxBtn) {
    els.closeImageLightboxBtn.addEventListener("click", closeImageLightbox);
  }

  if (els.imageLightbox) {
    els.imageLightbox.addEventListener("click", (event) => {
      if (event.target === els.imageLightbox) closeImageLightbox();
    });
  }

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const preview = target.closest("[data-image-preview]");
    if (!preview) return;
    // No combo de produtos, zoom na miniatura sem selecionar o item.
    if (target.closest(".produto-combo-option") && target instanceof HTMLImageElement) {
      event.preventDefault();
      event.stopPropagation();
    }
    // No modal de produto o handler proprio ja cobre a preview principal.
    if (preview.id === "produtoImagePreview") return;
    const url = preview.getAttribute("data-image-preview") || "";
    const title = preview.getAttribute("data-image-title") || preview.getAttribute("alt") || "Produto";
    if (url) openImageLightbox(url, title);
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && els.imageLightbox && !els.imageLightbox.classList.contains("hidden")) {
      closeImageLightbox();
    }
  });

  if (els.closeItensDocumentoModalBtn) {
    els.closeItensDocumentoModalBtn.addEventListener("click", closeItensDocumentoModal);
  }

  if (els.novoPedidoClienteBtn) {
    els.novoPedidoClienteBtn.addEventListener("click", async () => {
      try {
        await openNovoPedidoForCliente(state.itensDocumentoClienteId);
      } catch (error) {
        showToast(`Erro ao abrir novo pedido: ${error.message}`, "error");
      }
    });
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
    els.novoDocumentoClienteTrigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
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
    // mousedown (em vez de click) evita perder a seleção quando o input de busca
    // perde o foco e o browser reordena o evento de clique.
    els.novoDocumentoClientePanel.addEventListener("mousedown", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const quickNew = target.closest("[data-cliente-quick-new]");
      if (quickNew) {
        event.preventDefault();
        event.stopPropagation();
        closeNovoDocumentoClientePanel();
        openNovoClienteRapidoModal();
        return;
      }

      const clienteButton = target.closest("[data-cliente-id]");
      if (!clienteButton) return;
      event.preventDefault();
      event.stopPropagation();
      const clienteId = clienteButton.getAttribute("data-cliente-id") || "";
      setNovoDocumentoCliente(clienteId);
      closeNovoDocumentoClientePanel();
      if (els.novoDocumentoClienteTrigger) {
        els.novoDocumentoClienteTrigger.focus();
      }
    });
  }

  if (els.novoDocumentoPdfBtn) {
    els.novoDocumentoPdfBtn.addEventListener("click", () => {
      try {
        generateDocumentoOrcamentoPdf();
      } catch (error) {
        showToast(`Erro ao gerar PDF: ${error.message}`, "error");
      }
    });
  }

  if (els.openPrecoVendaCalcBtn) {
    els.openPrecoVendaCalcBtn.addEventListener("click", () => openPrecoVendaCalcPanel());
  }
  if (els.closePrecoVendaCalcBtn) {
    els.closePrecoVendaCalcBtn.addEventListener("click", () => closePrecoVendaCalcPanel());
  }
  if (els.calcRecarregarCustosBtn) {
    els.calcRecarregarCustosBtn.addEventListener("click", () => {
      const calc = ensurePrecoVendaCalcState();
      calc._custoProdutosTouched = false;
      syncPrecoVendaCalcFromItens();
      renderPrecoVendaCalcPanel();
      showToast("Custos recarregados a partir dos itens");
    });
  }
  if (els.calcAplicarPrecosBtn) {
    els.calcAplicarPrecosBtn.addEventListener("click", () => applyPrecoVendaCalcToItens());
  }

  const precoCalcInputs = [
    els.calcCustoProdutos,
    els.calcMaoDeObra,
    els.calcFrete,
    els.calcEmbalagem,
    els.calcOutrasDespesas,
    els.calcImpostosPct,
    els.calcTaxaCartaoPct,
    els.calcComissaoPct,
    els.calcMargemPct
  ].filter(Boolean);

  for (const input of precoCalcInputs) {
    input.addEventListener("input", () => {
      readPrecoVendaCalcFromInputs();
      renderPrecoVendaCalcPanel();
    });
  }

  if (els.precoVendaCalcItens) {
    els.precoVendaCalcItens.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      const rowId = target.getAttribute("data-calc-item-custo");
      if (!rowId) return;
      const item = state.novoDocumentoModal.itens.find((entry) => entry.rowId === rowId);
      if (!item) return;
      item.custoUnitario = Math.max(0, Number(target.value || 0));
      const calc = ensurePrecoVendaCalcState();
      if (!calc._custoProdutosTouched) {
        calc.custoProdutos = Number(computeCustoProdutosFromItens().toFixed(2));
      }
      renderPrecoVendaCalcPanel();
    });
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
      const raw = els.novoDocumentoPagamentoParcelas.value;
      const parsed = parseInt(String(raw), 10);
      const value = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
      setNovoDocumentoPagamentoField("parcelas", value, { skipRender: true });
    });
    els.novoDocumentoPagamentoParcelas.addEventListener("change", () => {
      const raw = els.novoDocumentoPagamentoParcelas.value;
      const parsed = parseInt(String(raw), 10);
      const value = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
      setNovoDocumentoPagamentoField("parcelas", value, { skipRender: false });
    });
  }

  if (els.novoDocumentoPagamentoPrimeiroVencimento) {
    els.novoDocumentoPagamentoPrimeiroVencimento.addEventListener("change", () => {
      setNovoDocumentoPagamentoField("vencimentoPrimeiraParcela", els.novoDocumentoPagamentoPrimeiroVencimento.value || "", { skipRender: true });
    });
  }

  if (els.novoDocumentoPagamentoIntervalo) {
    els.novoDocumentoPagamentoIntervalo.addEventListener("input", () => {
      setNovoDocumentoPagamentoField("intervaloDias", Number(els.novoDocumentoPagamentoIntervalo.value || 30), { skipRender: true });
    });
  }

  if (els.novoDocumentoObservacoes) {
    els.novoDocumentoObservacoes.addEventListener("input", () => {
      state.novoDocumentoModal.observacoes = els.novoDocumentoObservacoes.value || "";
    });
  }

  if (els.novoDocumentoGerarParcelasBtn) {
    els.novoDocumentoGerarParcelasBtn.addEventListener("click", () => {
      gerarParcelasEditaveis();
    });
  }

  if (els.novoDocumentoLimparParcelasBtn) {
    els.novoDocumentoLimparParcelasBtn.addEventListener("click", () => {
      limparParcelasEditaveis();
    });
  }

  if (els.novoDocumentoAddParcelaBtn) {
    els.novoDocumentoAddParcelaBtn.addEventListener("click", () => {
      addParcelaEditavel();
    });
  }

  if (els.novoDocumentoParcelasList) {
    const handleParcelaField = (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const row = target.closest("[data-parcela-index]");
      if (!row) return;
      const index = Number(row.getAttribute("data-parcela-index"));
      const field = target.getAttribute("data-parcela-field");
      if (!field) return;
      const value = target.value;
      atualizarParcelaEditavel(index, field, value);
    };
    els.novoDocumentoParcelasList.addEventListener("input", handleParcelaField);
    els.novoDocumentoParcelasList.addEventListener("change", handleParcelaField);
    els.novoDocumentoParcelasList.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const removeIndex = target.getAttribute("data-parcela-remove");
      if (removeIndex == null) return;
      removerParcelaEditavel(Number(removeIndex));
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

      const removeBtn = target.closest("[data-documento-item-remove]");
      if (removeBtn) {
        const rowId = removeBtn.getAttribute("data-documento-item-remove");
        if (rowId) removeNovoDocumentoItem(rowId);
      }
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

  for (const button of els.dashboardCashRangeButtons || []) {
    button.addEventListener("click", async () => {
      const value = Math.max(1, Number(button.getAttribute("data-dashboard-cash-range") || 11));
      if (state.dashboardMonthsBack === value) return;
      state.dashboardMonthsBack = value;
      for (const other of els.dashboardCashRangeButtons || []) {
        other.classList.toggle("active", other === button);
      }
      try {
        setDashboardLoading(true, "Atualizando período…");
        await loadDashboardSnapshot();
        renderMetrics({ charts: true });
        setDashboardLoading(false, "Atualizado");
      } catch (error) {
        setDashboardLoading(false, "Erro ao atualizar");
        showToast(`Erro ao atualizar periodo: ${error.message}`, "error");
      }
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

  if (els.pedidosLoadMoreBtn) {
    els.pedidosLoadMoreBtn.addEventListener("click", async () => {
      const current = Math.max(50, Number(state.pedidosLimit || 50));
      state.pedidosLimit = current + 50;
      try {
        await loadPedidos();
        renderPedidosSection();
        renderMetrics();
      } catch (error) {
        showToast(`Erro ao carregar mais pedidos: ${error.message}`, "error");
      }
    });
  }

  if (els.pedidosLoadAllBtn) {
    els.pedidosLoadAllBtn.addEventListener("click", async () => {
      const total = Number(state.pedidosCountTotal || 0);
      state.pedidosLimit = total > 0 ? total : 100000;
      try {
        await loadPedidos();
        renderPedidosSection();
        renderMetrics();
      } catch (error) {
        showToast(`Erro ao carregar todos os pedidos: ${error.message}`, "error");
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
    ["classe_abc", els.filtroProdutoAbc],
    ["estoque", els.filtroProdutoEstoque],
    ["reservado", els.filtroProdutoReservado],
    ["disponivel", els.filtroProdutoDisponivel],
    ["ponto_pedido", els.filtroProdutoPonto],
    ["status_estoque", els.filtroProdutoStatusEstoque],
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

    if (tableKey === "pedidosSintetico" || tableKey === "pedidosAnalitico") {
      schedulePedidosDatabaseSearch();
    }

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

  // Despesa modal é gerenciado pelo modulo de compras (contas_pagar unificado).

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
    const clientePedidosId = target.closest("[data-view-cliente-pedidos]")?.getAttribute("data-view-cliente-pedidos")
      || target.getAttribute("data-view-cliente-pedidos");
    const produtoEditId = target.getAttribute("data-edit-produto");
    const produtoEstoqueMovId = target.closest("[data-produto-estoque-mov]")?.getAttribute("data-produto-estoque-mov")
      || target.getAttribute("data-produto-estoque-mov");
    const produtoId = target.getAttribute("data-del-produto");
    const pedidoId = target.getAttribute("data-del-pedido");
    const orcamentoId = target.getAttribute("data-del-orcamento");
    const pedidoItensId = target.getAttribute("data-view-pedido-itens");
    const pedidoProdutoGroupKey = target.getAttribute("data-open-pedidos-produto");
    const pedidoProdutoItensId = target.getAttribute("data-open-pedido-produto-itens");
    const orcamentoItensId = target.getAttribute("data-view-orcamento-itens");
    const openRecebimentoPedidoId = target.getAttribute("data-open-recebimento-pedido");
    const openRecebimentoContaId = target.getAttribute("data-open-recebimento-conta");
    const openRecebimentoParcelaId = target.getAttribute("data-open-recebimento-parcela");
    const despesaId = target.getAttribute("data-del-despesa");

    try {
      // Clique no nome/linha do cliente (exceto botao Excluir)
      if (clientePedidosId && !target.closest("[data-del-cliente]")) {
        await openClientePedidosModal(Number(clientePedidosId));
        return;
      }
      if (produtoEditId) {
        openProdutoEditModal(Number(produtoEditId));
        return;
      }
      if (produtoEstoqueMovId) {
        openEstoqueMovimentoModal({
          produtoId: produtoEstoqueMovId,
          tipo: "entrada"
        });
        return;
      }
      const pedidoEditId = target.getAttribute("data-edit-pedido");
      const orcamentoEditId = target.getAttribute("data-edit-orcamento");
      if (pedidoEditId) {
        closeItensDocumentoModal();
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
        const parcelaTarget = openRecebimentoParcelaId ? Number(openRecebimentoParcelaId) : null;
        await openRecebimentoModalByConta(Number(openRecebimentoContaId), parcelaTarget);
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
    state.supabaseUrl = String(SUPABASE_URL || "").replace(/\/$/, "");
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

  let ignoreNextAuthEvent = true;
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (ignoreNextAuthEvent && _event === "INITIAL_SESSION") {
      ignoreNextAuthEvent = false;
      return;
    }
    ignoreNextAuthEvent = false;
    handleSession(session);
  });

  const { data } = await supabaseClient.auth.getSession();
  await handleSession(data.session);
}

initApp();
