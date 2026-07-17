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
  empresaConfig: null,
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
  pedidoOperacoesId: null,
  /** Quando abre itens a partir de outra visão do mesmo modal, fecha volta para ela. */
  itensDocumentoReturnTo: null,
  itensDocumentoProdutoGroupKey: null,
  itensDocumentoClienteId: null,
  itensDocumentoClienteSummary: null,
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
  orcamentosMostrarAprovados: false,
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
  empresaNomeApp: document.getElementById("empresaNomeApp"),
  empresaLogoApp: document.getElementById("empresaLogoApp"),
  empresaInfo: document.getElementById("empresaInfo"),
  empresaConfigForm: document.getElementById("empresaConfigForm"),
  empresaLogoPreview: document.getElementById("empresaLogoPreview"),
  empresaLogoEmpty: document.getElementById("empresaLogoEmpty"),
  empresaLogoPathInput: document.getElementById("empresaLogoPathInput"),
  empresaLogoCameraBtn: document.getElementById("empresaLogoCameraBtn"),
  empresaLogoGaleriaBtn: document.getElementById("empresaLogoGaleriaBtn"),
  empresaLogoRemoverBtn: document.getElementById("empresaLogoRemoverBtn"),
  empresaLogoCameraInput: document.getElementById("empresaLogoCameraInput"),
  empresaLogoGaleriaInput: document.getElementById("empresaLogoGaleriaInput"),
  empresaCorPrimariaInput: document.getElementById("empresaCorPrimariaInput"),
  empresaConfigAplicarPadraoBtn: document.getElementById("empresaConfigAplicarPadraoBtn"),
  empresaConfigSubmitBtn: document.getElementById("empresaConfigSubmitBtn"),
  tabs: Array.from(document.querySelectorAll(".tab")),
  sections: Array.from(document.querySelectorAll(".app-section")),
  clienteForm: document.getElementById("clienteForm"),
  clienteModal: document.getElementById("clienteModal"),
  clienteModalTitle: document.getElementById("clienteModalTitle"),
  clienteModalSubtitle: document.getElementById("clienteModalSubtitle"),
  openClienteModalBtn: document.getElementById("openClienteModalBtn"),
  closeClienteModalBtn: document.getElementById("closeClienteModalBtn"),
  clienteSubmitBtn: document.getElementById("clienteSubmitBtn"),
  clienteFormId: document.getElementById("clienteFormId"),
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
  produtoFotoHint: document.getElementById("produtoFotoHint"),
  produtoFotoCameraBtn: document.getElementById("produtoFotoCameraBtn"),
  produtoFotoGaleriaBtn: document.getElementById("produtoFotoGaleriaBtn"),
  produtoFotoRemoverBtn: document.getElementById("produtoFotoRemoverBtn"),
  produtoFotoCameraInput: document.getElementById("produtoFotoCameraInput"),
  produtoFotoGaleriaInput: document.getElementById("produtoFotoGaleriaInput"),
  imageLightbox: document.getElementById("imageLightbox"),
  imageLightboxImg: document.getElementById("imageLightboxImg"),
  imageLightboxCaption: document.getElementById("imageLightboxCaption"),
  closeImageLightboxBtn: document.getElementById("closeImageLightboxBtn"),
  openPedidoModalBtn: document.getElementById("openPedidoModalBtn"),
  fabNovoPedidoBtn: document.getElementById("fabNovoPedidoBtn"),
  novoDocumentoModal: document.getElementById("novoDocumentoModal"),
  closeNovoDocumentoModalBtn: document.getElementById("closeNovoDocumentoModalBtn"),
  novoDocumentoForm: document.getElementById("novoDocumentoForm"),
  novoDocumentoModalTitle: document.getElementById("novoDocumentoModalTitle"),
  novoDocumentoModalSubtitle: document.getElementById("novoDocumentoModalSubtitle"),
  novoDocumentoConverterBtn: document.getElementById("novoDocumentoConverterBtn"),
  novoDocumentoFotoWrap: document.getElementById("novoDocumentoFotoWrap"),
  novoDocumentoFoto: document.getElementById("novoDocumentoFoto"),
  novoDocumentoFotoHint: document.getElementById("novoDocumentoFotoHint"),
  novoDocumentoFotoCameraBtn: document.getElementById("novoDocumentoFotoCameraBtn"),
  novoDocumentoFotoGaleriaBtn: document.getElementById("novoDocumentoFotoGaleriaBtn"),
  novoDocumentoFotoRemoverBtn: document.getElementById("novoDocumentoFotoRemoverBtn"),
  novoDocumentoFotoCameraInput: document.getElementById("novoDocumentoFotoCameraInput"),
  novoDocumentoFotoGaleriaInput: document.getElementById("novoDocumentoFotoGaleriaInput"),
  novoDocumentoClienteSearch: document.getElementById("novoDocumentoClienteSearch"),
  novoDocumentoClienteId: document.getElementById("novoDocumentoClienteId"),
  novoDocumentoClienteTrigger: document.getElementById("novoDocumentoClienteTrigger"),
  novoDocumentoClienteLabel: document.getElementById("novoDocumentoClienteLabel"),
  novoDocumentoClientePanel: document.getElementById("novoDocumentoClientePanel"),
  novoDocumentoClienteOptions: document.getElementById("novoDocumentoClienteOptions"),
  novoDocumentoStatusSelect: document.getElementById("novoDocumentoStatusSelect"),
  novoDocumentoDataEmissao: document.getElementById("novoDocumentoDataEmissao"),
  novoDocumentoObservacoes: document.getElementById("novoDocumentoObservacoes"),
  novoDocumentoExtraSection: document.getElementById("novoDocumentoExtraSection"),
  novoDocumentoExtraTitle: document.getElementById("novoDocumentoExtraTitle"),
  novoDocumentoExtraHint: document.getElementById("novoDocumentoExtraHint"),
  novoDocumentoExtraFields: document.getElementById("novoDocumentoExtraFields"),
  docExtraCamposEditor: document.getElementById("docExtraCamposEditor"),
  docExtraAddCampoBtn: document.getElementById("docExtraAddCampoBtn"),
  docExtraBikePresetBtn: document.getElementById("docExtraBikePresetBtn"),
  docExtraClearBtn: document.getElementById("docExtraClearBtn"),
  empresaDocExtraFormPedido: document.getElementById("empresaDocExtraFormPedido"),
  empresaDocExtraFormOrcamento: document.getElementById("empresaDocExtraFormOrcamento"),
  empresaDocExtraPdf: document.getElementById("empresaDocExtraPdf"),
  empresaDocExtraResumo: document.getElementById("empresaDocExtraResumo"),
  empresaDocExtraTitulo: document.getElementById("empresaDocExtraTitulo"),
  empresaDocExtraHint: document.getElementById("empresaDocExtraHint"),
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
  pedidoOperacoesModal: document.getElementById("pedidoOperacoesModal"),
  closePedidoOperacoesModalBtn: document.getElementById("closePedidoOperacoesModalBtn"),
  pedidoOperacoesTitle: document.getElementById("pedidoOperacoesTitle"),
  pedidoOperacoesSubtitle: document.getElementById("pedidoOperacoesSubtitle"),
  pedidoOperacoesBody: document.getElementById("pedidoOperacoesBody"),
  pedidoOperacoesItensBtn: document.getElementById("pedidoOperacoesItensBtn"),
  pedidoOperacoesReceberBtn: document.getElementById("pedidoOperacoesReceberBtn"),
  pedidoOperacoesPdfBtn: document.getElementById("pedidoOperacoesPdfBtn"),
  pedidoOperacoesEditarBtn: document.getElementById("pedidoOperacoesEditarBtn"),
  novoPedidoClienteBtn: document.getElementById("novoPedidoClienteBtn"),
  itensDocumentoFotoWrap: document.getElementById("itensDocumentoFotoWrap"),
  itensDocumentoFoto: document.getElementById("itensDocumentoFoto"),
    itensDocumentoTableHead: document.getElementById("itensDocumentoTableHead"),
  itensDocumentoTable: document.getElementById("itensDocumentoTable"),
  itensDocumentoClienteSummary: document.getElementById("itensDocumentoClienteSummary"),
  clientePedidosCount: document.getElementById("clientePedidosCount"),
  clientePedidosTotal: document.getElementById("clientePedidosTotal"),
  clientePedidosAberto: document.getElementById("clientePedidosAberto"),
  clientePedidosAbertoMeta: document.getElementById("clientePedidosAbertoMeta"),
  pedidoForm: document.getElementById("pedidoForm"),
  openOrcamentoModalBtn: document.getElementById("openOrcamentoModalBtn"),
  despesaForm: document.getElementById("despesaForm"),
  despesaModal: document.getElementById("despesaModal"),
  closeDespesaModalBtn: document.getElementById("closeDespesaModalBtn"),
  openDespesaModalBtn: document.getElementById("openDespesaModalBtn"),
  exportContasPagarExcelBtn: document.getElementById("exportContasPagarExcelBtn"),
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
  despesaClassificacao: document.getElementById("despesaClassificacao"),
  despesaResponsavel: document.getElementById("despesaResponsavel"),
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
  contaPagarEditClassificacao: document.getElementById("contaPagarEditClassificacao"),
  contaPagarEditResponsavel: document.getElementById("contaPagarEditResponsavel"),
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
  orcamentosMostrarAprovados: document.getElementById("orcamentosMostrarAprovados"),
  orcamentosSectionSubtitle: document.getElementById("orcamentosSectionSubtitle"),
  despesasTable: document.getElementById("despesasTable"),
  ownerUsersTable: document.getElementById("ownerUsersTable"),
  adminVinculosTable: document.getElementById("adminVinculosTable"),
  clientesCount: document.getElementById("clientesCount"),
  pedidosCount: document.getElementById("pedidosCount"),
  despesasCount: document.getElementById("despesasCount"),
  faturamentoValue: document.getElementById("faturamentoValue"),
  faturamentoBadge: document.getElementById("faturamentoBadge"),
  faturamentoHint: document.getElementById("faturamentoHint"),
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
  if (els.saasTitleLogin) {
    els.saasTitleLogin.textContent = saasName;
  }
  if (els.saasTitleApp) {
    els.saasTitleApp.textContent = saasName;
  }
  updateAppBrandChrome();
}

/**
 * Cabeçalho do app: logo + nome da empresa em destaque + LB ERP SaaS pequeno.
 */
function updateAppBrandChrome() {
  const cfg = state.empresaConfig ? normalizeEmpresaConfig(state.empresaConfig, state.empresaNome) : null;
  const empresaNome = String(cfg?.nome || state.empresaNome || "Empresa").trim() || "Empresa";
  const cor = String(cfg?.cor_primaria || "").trim();
  const logoPath = String(cfg?.logo_path || "").trim();
  const logoUrl = logoPath ? resolveProdutoImageUrl(logoPath) : "";

  if (els.empresaNomeApp) {
    els.empresaNomeApp.textContent = empresaNome;
  }
  if (els.saasTitleApp) {
    els.saasTitleApp.textContent = saasName || "LB ERP SaaS";
  }

  if (els.empresaLogoApp) {
    if (logoUrl) {
      els.empresaLogoApp.src = logoUrl;
      els.empresaLogoApp.alt = `Logo ${empresaNome}`;
      els.empresaLogoApp.classList.remove("hidden");
    } else {
      els.empresaLogoApp.removeAttribute("src");
      els.empresaLogoApp.alt = "";
      els.empresaLogoApp.classList.add("hidden");
    }
  }

  // Cor primaria da empresa no tema do app (quando cadastrada)
  if (/^#[0-9a-fA-F]{6}$/.test(cor)) {
    document.documentElement.style.setProperty("--brand", cor);
    document.documentElement.style.setProperty("--brand-strong", darkenHexColor(cor, 0.28));
  } else {
    document.documentElement.style.setProperty("--brand", "#165d59");
    document.documentElement.style.setProperty("--brand-strong", "#0f4744");
  }

  if (state.session?.user?.email) {
    document.title = `${empresaNome} · ${saasName}`;
    if (els.empresaInfo) {
      els.empresaInfo.textContent = state.session.user.email;
    }
  } else {
    document.title = saasName;
    if (els.empresaInfo) {
      els.empresaInfo.textContent = "—";
    }
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

function setProdutoImagemPathValue(value) {
  if (els.produtoImagemPathInput) {
    els.produtoImagemPathInput.value = value == null ? "" : String(value);
  }
  const field = els.produtoForm?.elements?.namedItem("imagem_path");
  if (field && "value" in field && field !== els.produtoImagemPathInput) {
    field.value = value == null ? "" : String(value);
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
  if (els.produtoFotoHint) {
    els.produtoFotoHint.textContent = url
      ? "Toque na foto para ampliar"
      : "Tire uma foto ou escolha da galeria";
  }
  if (els.produtoFotoRemoverBtn) {
    els.produtoFotoRemoverBtn.classList.toggle("hidden", !url);
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

function isItensDocumentoModalOpen() {
  return Boolean(els.itensDocumentoModal && !els.itensDocumentoModal.classList.contains("hidden"));
}

/**
 * Fecha o modal de itens/pedidos do cliente.
 * Se o usuário abriu "Itens" a partir da lista de pedidos do cliente (ou do detalhe por produto),
 * volta para essa visão em vez de fechar tudo.
 */
async function closeItensDocumentoModal({ force = false } = {}) {
  if (!force && state.itensDocumentoReturnTo) {
    const back = state.itensDocumentoReturnTo;
    state.itensDocumentoReturnTo = null;
    try {
      if (back.mode === "cliente_pedidos" && back.clienteId) {
        await openClientePedidosModal(back.clienteId);
        return;
      }
      if (back.mode === "pedidos_produto" && back.groupKey) {
        openPedidosProdutoDetalhes(back.groupKey);
        return;
      }
    } catch (error) {
      console.error(error);
      showToast(`Erro ao voltar: ${error.message}`, "error");
    }
  }

  state.itensDocumentoReturnTo = null;
  if (!els.itensDocumentoModal) return;
  els.itensDocumentoModal.classList.add("hidden");
  if (els.novoPedidoClienteBtn) els.novoPedidoClienteBtn.classList.add("hidden");
  if (els.itensDocumentoModalSubtitle) {
    els.itensDocumentoModalSubtitle.textContent = "";
    els.itensDocumentoModalSubtitle.classList.add("hidden");
  }
  if (els.closeItensDocumentoModalBtn) {
    els.closeItensDocumentoModalBtn.textContent = "Fechar";
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

function closeAllNovoDocumentoProdutoPanels(exceptRowId = null) {
  document.querySelectorAll("[data-produto-combo-panel]").forEach((panel) => {
    if (!(panel instanceof HTMLElement)) return;
    const rowId = panel.getAttribute("data-produto-combo-panel");
    if (exceptRowId != null && String(rowId) === String(exceptRowId)) return;
    closeNovoDocumentoProdutoPanel(rowId);
  });
}

function openNovoDocumentoProdutoPanel(rowId) {
  const panel = document.querySelector(`[data-produto-combo-panel="${rowId}"]`);
  const trigger = document.querySelector(`[data-produto-combo-trigger="${rowId}"]`);
  const search = document.querySelector(`[data-produto-combo-search="${rowId}"]`);
  if (!(panel instanceof HTMLElement)) return;

  // Fecha outros pickers abertos
  closeAllNovoDocumentoProdutoPanels(rowId);

  // Tela cheia: saca o painel do overflow do modal e ancora no body
  const host = document.querySelector(`[data-produto-combo="${rowId}"]`);
  if (host instanceof HTMLElement && panel.parentElement !== document.body) {
    panel.dataset.produtoComboHost = String(rowId);
    document.body.appendChild(panel);
  }

  panel.classList.add("produto-combo-panel--sheet");
  panel.classList.remove("hidden");
  document.body.classList.add("produto-picker-open");

  if (trigger instanceof HTMLElement) {
    trigger.setAttribute("aria-expanded", "true");
  }
  if (search instanceof HTMLInputElement) {
    window.requestAnimationFrame(() => {
      try {
        search.focus();
        search.select?.();
      } catch (_) {
        /* ignore */
      }
    });
  }
}

function closeNovoDocumentoProdutoPanel(rowId) {
  if (rowId == null || rowId === "") return;
  const panel = document.querySelector(`[data-produto-combo-panel="${rowId}"]`);
  const trigger = document.querySelector(`[data-produto-combo-trigger="${rowId}"]`);

  if (panel instanceof HTMLElement) {
    panel.classList.add("hidden");
    panel.classList.remove("produto-combo-panel--sheet");

    // Devolve o painel ao combo da linha (se a linha ainda existir)
    const host =
      document.querySelector(`[data-produto-combo="${rowId}"]`) ||
      (panel.dataset.produtoComboHost
        ? document.querySelector(`[data-produto-combo="${panel.dataset.produtoComboHost}"]`)
        : null);
    if (host instanceof HTMLElement && panel.parentElement !== host) {
      host.appendChild(panel);
    } else if (panel.parentElement === document.body) {
      // Linha re-renderizada: remove painel órfão no body
      panel.remove();
    }
    delete panel.dataset.produtoComboHost;
  }

  if (trigger instanceof HTMLElement) {
    trigger.setAttribute("aria-expanded", "false");
  }

  if (!document.querySelector(".produto-combo-panel--sheet:not(.hidden)")) {
    document.body.classList.remove("produto-picker-open");
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
  // Fecha o picker fullscreen antes de re-render (evita painel órfão no body)
  closeNovoDocumentoProdutoPanel(rowId);
  ensureTrailingEmptyDocumentoItem();
  renderNovoDocumentoItensGrid({ focusRowId: rowId, focusField: "quantidade" });
  if (state.novoDocumentoModal.precoVendaCalc?.open) {
    syncPrecoVendaCalcFromItens({ keepOverrides: true });
    renderPrecoVendaCalcPanel();
  }
}

/** Atualiza a lista de opções do picker de produto (também quando o painel está no body). */
function refreshNovoDocumentoProdutoOptions(rowId, searchText) {
  const item = state.novoDocumentoModal.itens.find((draftItem) => draftItem.rowId === rowId);
  if (!item) return;
  item.produtoSearch = searchText || "";
  const panel = document.querySelector(`[data-produto-combo-panel="${rowId}"]`);
  if (!(panel instanceof HTMLElement)) return;

  const query = String(item.produtoSearch || "").trim().toLowerCase();
  const produtosFiltrados = query
    ? state.produtos.filter((produto) => {
        const nome = String(produto.nome || "").toLowerCase();
        const categoria = String(produto.categoria || "").toLowerCase();
        return nome.includes(query) || categoria.includes(query);
      })
    : state.produtos;

  const optionsNode = panel.querySelector(`[data-produto-combo-options="${rowId}"]`);
  if (!(optionsNode instanceof HTMLElement)) return;

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
      <button type="button" class="produto-combo-trigger" data-produto-combo-trigger="${item.rowId}" aria-haspopup="dialog" aria-expanded="false">
        <span data-produto-combo-label="${item.rowId}">${escapeHtml(comboState.label)}</span>
        <span class="produto-combo-caret">▾</span>
      </button>
      <div class="produto-combo-panel hidden" data-produto-combo-panel="${item.rowId}" role="dialog" aria-label="Selecionar produto" aria-modal="true">
        <div class="produto-combo-sheet-head">
          <div>
            <strong class="produto-combo-sheet-title">Selecionar produto</strong>
            <p class="produto-combo-sheet-sub">Busque e toque no item para adicionar ao pedido</p>
          </div>
          <button type="button" class="btn btn-ghost produto-combo-sheet-close" data-produto-combo-close="${item.rowId}">
            Fechar
          </button>
        </div>
        <input
          class="produto-combo-search"
          data-produto-combo-search="${item.rowId}"
          type="search"
          placeholder="Buscar produto por nome ou categoria..."
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

/** Flags de onde o campo/seção aparece. */
function normalizeDocExtraWhereFlags(src = null, fallback = true) {
  const s = src && typeof src === "object" ? src : {};
  const def = fallback !== false;
  // Compat: se só existia "ativo", repassa para todos os lugares.
  const legacyAtivo = s.ativo;
  const pick = (key) => {
    if (s[key] != null) return Boolean(s[key]);
    if (legacyAtivo != null) return Boolean(legacyAtivo);
    return def;
  };
  return {
    form_pedido: pick("form_pedido"),
    form_orcamento: pick("form_orcamento"),
    pdf: pick("pdf"),
    resumo: pick("resumo")
  };
}

function createDocExtraCampo(src = null) {
  const s = src && typeof src === "object" ? src : {};
  const where = normalizeDocExtraWhereFlags(s, s.ativo !== false);
  return {
    id: String(s.id || "").trim(),
    label: String(s.label || "").trim(),
    tipo: s.tipo === "textarea" ? "textarea" : "text",
    ativo: s.ativo !== false,
    placeholder: String(s.placeholder || "").trim(),
    form_pedido: where.form_pedido,
    form_orcamento: where.form_orcamento,
    pdf: where.pdf,
    resumo: where.resumo
  };
}

/** Preset clássico de oficina de bikes (compatível com dados legados em raw_payload.bicicleta). */
const DOC_EXTRA_BIKE_PRESET = {
  titulo: "Bicicleta",
  hint: "Dados da bike do cliente neste documento.",
  form_pedido: true,
  form_orcamento: true,
  pdf: true,
  resumo: true,
  campos: [
    createDocExtraCampo({ id: "marca", label: "Marca", tipo: "text", placeholder: "Ex.: Specialized" }),
    createDocExtraCampo({ id: "modelo", label: "Modelo", tipo: "text", placeholder: "Ex.: Rockhopper" }),
    createDocExtraCampo({ id: "tamanhoAro", label: "Tamanho de aro", tipo: "text", placeholder: 'Ex.: 29"' }),
    createDocExtraCampo({ id: "cor", label: "Cor", tipo: "text", placeholder: "Ex.: Preta/vermelha" }),
    createDocExtraCampo({
      id: "acessorios",
      label: "Acessórios",
      tipo: "textarea",
      placeholder: "Ex.: pedais, suporte, bagageiro..."
    })
  ]
};

function cloneDocExtraConfig(src) {
  const where = normalizeDocExtraWhereFlags(src, src?.ativo !== false);
  return {
    // "ativo" legado = qualquer lugar habilitado
    ativo: Boolean(
      src?.ativo !== false &&
        (where.form_pedido || where.form_orcamento || where.pdf || where.resumo)
    ),
    titulo: String(src?.titulo || "").trim(),
    hint: String(src?.hint || "").trim(),
    form_pedido: where.form_pedido,
    form_orcamento: where.form_orcamento,
    pdf: where.pdf,
    resumo: where.resumo,
    campos: Array.isArray(src?.campos) ? src.campos.map((c) => createDocExtraCampo(c)) : []
  };
}

function normalizeDocExtraConfig(raw) {
  // Sem config salva: mantém comportamento atual da GuPedal (bicicleta).
  if (raw == null || raw === "") {
    return cloneDocExtraConfig(DOC_EXTRA_BIKE_PRESET);
  }
  let parsed = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch (_) {
      return cloneDocExtraConfig(DOC_EXTRA_BIKE_PRESET);
    }
  }
  if (!parsed || typeof parsed !== "object") {
    return cloneDocExtraConfig(DOC_EXTRA_BIKE_PRESET);
  }
  const base = cloneDocExtraConfig({
    ...parsed,
    titulo: parsed.titulo || "Dados adicionais",
    hint: parsed.hint || "Campos extras deste documento.",
    campos: Array.isArray(parsed.campos) ? parsed.campos : []
  });
  // Garante ids únicos e válidos
  const used = new Set();
  base.campos = base.campos
    .filter((c) => c.label || c.id)
    .map((c, idx) => {
      let id = c.id || slugifyDocExtraFieldId(c.label) || `campo_${idx + 1}`;
      id = id.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 40) || `campo_${idx + 1}`;
      let unique = id;
      let n = 2;
      while (used.has(unique)) {
        unique = `${id}_${n}`;
        n += 1;
      }
      used.add(unique);
      return createDocExtraCampo({ ...c, id: unique, label: c.label || unique });
    });
  base.ativo = Boolean(
    base.form_pedido || base.form_orcamento || base.pdf || base.resumo
  );
  return base;
}

function slugifyDocExtraFieldId(label) {
  return String(label || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 32);
}

function getDocExtraConfig() {
  return normalizeDocExtraConfig(getEmpresaConfig()?.doc_extra_config);
}

/**
 * Campos ativos para um destino: "form_pedido" | "form_orcamento" | "pdf" | "resumo" | "any"
 */
function getActiveDocExtraCampos(config = null, where = "any") {
  const cfg = config || getDocExtraConfig();
  const sectionOn =
    where === "any"
      ? cfg.form_pedido || cfg.form_orcamento || cfg.pdf || cfg.resumo
      : Boolean(cfg[where]);
  if (!sectionOn) return [];
  return (cfg.campos || []).filter((c) => {
    if (!c?.ativo || !c.id || !c.label) return false;
    if (where === "any") {
      return c.form_pedido || c.form_orcamento || c.pdf || c.resumo;
    }
    return Boolean(c[where]);
  });
}

/** Valores dos campos extras (legado: bicicleta). */
function createDocExtraDraft(src = null, campos = null) {
  const s = src && typeof src === "object" ? src : {};
  // Compat legado: aro / tamanho_aro
  const legacy = {
    ...s,
    tamanhoAro: s.tamanhoAro || s.tamanho_aro || s.aro || ""
  };
  const list = Array.isArray(campos) ? campos : getDocExtraConfig().campos || [];
  const out = {};
  if (list.length) {
    for (const campo of list) {
      if (!campo?.id) continue;
      out[campo.id] = String(legacy[campo.id] ?? "").trim();
    }
  }
  // Preserva valores extras já salvos mesmo se o campo foi desativado
  for (const [key, value] of Object.entries(legacy)) {
    if (key === "tamanho_aro" || key === "aro") continue;
    if (out[key] == null || out[key] === "") {
      const text = String(value ?? "").trim();
      if (text) out[key] = text;
    }
  }
  // Garante chaves legadas mínimas se ainda forem do modelo bike
  if (!list.length) {
    return {
      marca: String(legacy.marca || "").trim(),
      modelo: String(legacy.modelo || "").trim(),
      tamanhoAro: String(legacy.tamanhoAro || "").trim(),
      cor: String(legacy.cor || "").trim(),
      acessorios: String(legacy.acessorios || "").trim()
    };
  }
  return out;
}

// Alias de compatibilidade
function createBicicletaDraft(src = null) {
  return createDocExtraDraft(src);
}

function isDocExtraFilled(values) {
  if (!values || typeof values !== "object") return false;
  return Object.values(values).some((v) => String(v || "").trim());
}

function isBicicletaFilled(bike) {
  return isDocExtraFilled(bike);
}

function extractDocExtraFromPayload(rawPayload) {
  const raw = rawPayload && typeof rawPayload === "object" ? rawPayload : {};
  if (raw.doc_extra && typeof raw.doc_extra === "object") {
    const valores = raw.doc_extra.valores && typeof raw.doc_extra.valores === "object"
      ? raw.doc_extra.valores
      : raw.doc_extra;
    return createDocExtraDraft(valores);
  }
  return createDocExtraDraft(raw.bicicleta || raw.bike || null);
}

function readDocExtraFromForm() {
  const campos = getDocExtraConfig().campos || [];
  const values = {};
  for (const campo of campos) {
    if (!campo?.id) continue;
    const el = document.getElementById(`docExtraField_${campo.id}`);
    values[campo.id] = String(el?.value || "").trim();
  }
  // Mantém valores de campos desativados que já estavam no draft
  const prev = state.novoDocumentoModal?.bicicleta || {};
  for (const [key, value] of Object.entries(prev)) {
    if (values[key] == null || values[key] === "") {
      const text = String(value || "").trim();
      if (text) values[key] = text;
    }
  }
  return createDocExtraDraft(values, campos);
}

function readBicicletaFromForm() {
  return readDocExtraFromForm();
}

function getDocExtraFormWhereForTipo(tipo = null) {
  const t = tipo || state.novoDocumentoModal?.tipo || "pedido";
  return t === "orcamento" ? "form_orcamento" : "form_pedido";
}

function renderDocumentoExtraFields(values = null) {
  const section = els.novoDocumentoExtraSection;
  const wrap = els.novoDocumentoExtraFields;
  if (!section || !wrap) return;

  const cfg = getDocExtraConfig();
  const formWhere = getDocExtraFormWhereForTipo();
  const active = getActiveDocExtraCampos(cfg, formWhere);
  if (!active.length) {
    section.classList.add("hidden");
    wrap.innerHTML = "";
    return;
  }

  section.classList.remove("hidden");
  if (els.novoDocumentoExtraTitle) {
    els.novoDocumentoExtraTitle.textContent = cfg.titulo || "Dados adicionais";
  }
  if (els.novoDocumentoExtraHint) {
    const tipo = formWhere === "form_orcamento" ? "orçamento" : "pedido";
    els.novoDocumentoExtraHint.textContent =
      cfg.hint || `Dados extras do cliente neste ${tipo}.`;
  }

  const vals = createDocExtraDraft(values || state.novoDocumentoModal?.bicicleta || {}, cfg.campos);
  wrap.innerHTML = active
    .map((campo) => {
      const id = `docExtraField_${campo.id}`;
      const val = escapeHtml(vals[campo.id] || "");
      const ph = escapeHtml(campo.placeholder || "");
      const full = campo.tipo === "textarea" ? " documento-bike-acessorios" : "";
      if (campo.tipo === "textarea") {
        return `<label class="${full.trim()}">
          ${escapeHtml(campo.label)}
          <textarea id="${id}" name="doc_extra_${escapeHtml(campo.id)}" rows="2" placeholder="${ph}" autocomplete="off">${val}</textarea>
        </label>`;
      }
      return `<label>
        ${escapeHtml(campo.label)}
        <input id="${id}" name="doc_extra_${escapeHtml(campo.id)}" type="text" value="${val}" placeholder="${ph}" autocomplete="off" />
      </label>`;
    })
    .join("");
}

function fillDocExtraForm(values) {
  renderDocumentoExtraFields(values);
}

function fillBicicletaForm(bike) {
  fillDocExtraForm(bike);
}

function buildDocExtraPdfLines(values, meta = null, where = "pdf") {
  const cfg = getDocExtraConfig();
  const hasMetaCampos = Array.isArray(meta?.campos) && meta.campos.length > 0;
  const titulo = String(meta?.titulo || cfg.titulo || "Dados adicionais").trim();
  // Sem snapshot e destino desligado na empresa: não exibe.
  if (!hasMetaCampos && !cfg[where] && where !== "any") {
    return { titulo, lines: [] };
  }
  const camposMeta = hasMetaCampos
    ? meta.campos
    : getActiveDocExtraCampos(cfg, where);
  const vals = values && typeof values === "object" ? values : {};
  const lines = [];
  for (const campo of camposMeta) {
    const id = campo.id || campo;
    const label = campo.label || id;
    const value = String(vals[id] || "").trim();
    if (!value) continue;
    if (campo.ativo === false) continue;
    // Snapshot antigo pode não ter a flag; config atual com meta vazio filtra por where
    if (!hasMetaCampos && where !== "any" && campo[where] === false) continue;
    if (hasMetaCampos && where !== "any" && campo[where] === false) continue;
    lines.push({ label, value });
  }
  // Fallback: seção ligada e valores legados sem definição
  if (!lines.length && (cfg[where] || where === "any") && isDocExtraFilled(vals) && !hasMetaCampos) {
    for (const [key, value] of Object.entries(vals)) {
      const text = String(value || "").trim();
      if (!text) continue;
      const known = (cfg.campos || []).find((c) => c.id === key);
      if (known && where !== "any" && known[where] === false) continue;
      lines.push({ label: known?.label || key, value: text });
    }
  }
  return { titulo, lines };
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
    bicicleta: createBicicletaDraft(),
    pagamento: createPagamentoDraft(),
    parcelasEditadas: null,
    parcelasOriginaisSnapshot: null,
    itens: [createDocumentoDraftItem()],
    precoVendaCalc: createPrecoVendaCalcState(),
    precoFormacaoAplicada: null,
    rawPayloadBase: null,
    // Quando o pedido nasce de um orçamento (conversão).
    convertidoDeOrcamentoId: null
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

function getDocumentoStatusLabel(status) {
  const s = String(status || "").toLowerCase();
  if (s === "fechado") return "Fechado";
  if (s === "cancelado") return "Cancelado";
  if (s === "aprovado") return "Aprovado";
  if (s === "reprovado") return "Reprovado";
  return "Aberto";
}

function getDocumentoStatusChipClass(status) {
  const s = String(status || "").toLowerCase();
  if (s === "fechado" || s === "aprovado") return "fechado";
  if (s === "cancelado" || s === "reprovado") return "cancelado";
  return "aberto";
}

function closePedidoOperacoesModal() {
  if (!els.pedidoOperacoesModal) return;
  els.pedidoOperacoesModal.classList.add("hidden");
  state.pedidoOperacoesId = null;
}

function renderPedidoOperacoesBody(snapshot) {
  if (!els.pedidoOperacoesBody) return;
  const {
    documentoId,
    clienteNome,
    dataEmissao,
    total,
    statusDocumento,
    pagamentoLabel,
    statusFinanceiro,
    financeiroDetalhe,
    statusEstoque,
    estoqueDetalhe,
    parcelas,
    orcamentoOrigemId
  } = snapshot;

  const parcelasHtml = (parcelas || []).length
    ? `<ul class="pedido-operacoes-list">${parcelas
        .map((p) => {
          const venc = p.vencimento
            ? new Date(p.vencimento).toLocaleDateString("pt-BR")
            : "–";
          const chip = getContaStatusLabel(p.statusNormalizado || p.status);
          const chipClass = p.statusNormalizado || "aberto";
          return `<li>
            <span><strong>Parc. ${escapeHtml(p.numero || "–")}</strong> · venc. ${escapeHtml(venc)}</span>
            <span>
              <span class="status-chip ${escapeHtml(chipClass)}">${escapeHtml(chip)}</span>
              ${moeda.format(p.valor || 0)}
              ${Number(p.saldo || 0) > 0.009 ? ` · saldo ${moeda.format(p.saldo)}` : ""}
            </span>
          </li>`;
        })
        .join("")}</ul>`
    : `<p class="section-subtitle">Nenhum título financeiro vinculado a este pedido.</p>`;

  els.pedidoOperacoesBody.innerHTML = `
    <div class="pedido-operacoes-meta">
      <strong>Pedido #${escapeHtml(documentoId)}</strong>
      <span>${escapeHtml(clienteNome || "Cliente não informado")}${dataEmissao ? ` · ${escapeHtml(dataEmissao)}` : ""}</span>
      <span>Total ${moeda.format(total || 0)}${orcamentoOrigemId ? ` · oriundo do orçamento #${escapeHtml(orcamentoOrigemId)}` : ""}</span>
    </div>

    <div class="pedido-operacoes-grid">
      <article class="pedido-operacao-card">
        <span>Documento</span>
        <strong><span class="status-chip ${getDocumentoStatusChipClass(statusDocumento)}">${escapeHtml(getDocumentoStatusLabel(statusDocumento))}</span></strong>
        <small>Status comercial do pedido</small>
      </article>
      <article class="pedido-operacao-card">
        <span>Financeiro</span>
        <strong><span class="status-chip ${escapeHtml(statusFinanceiro.chip)}">${escapeHtml(statusFinanceiro.label)}</span></strong>
        <small>${escapeHtml(financeiroDetalhe || pagamentoLabel || "–")}</small>
      </article>
      <article class="pedido-operacao-card">
        <span>Estoque</span>
        <strong><span class="status-chip ${escapeHtml(statusEstoque.chip)}">${escapeHtml(statusEstoque.label)}</span></strong>
        <small>${escapeHtml(estoqueDetalhe || "–")}</small>
      </article>
      <article class="pedido-operacao-card">
        <span>Pagamento</span>
        <strong>${escapeHtml(pagamentoLabel || "–")}</strong>
        <small>Condição registrada no pedido</small>
      </article>
    </div>

    <section class="pedido-operacoes-section">
      <h4>Parcelas / títulos</h4>
      ${parcelasHtml}
    </section>
  `;
}

/**
 * Abre o painel de status das operações do pedido (documento, financeiro, estoque).
 * Usado ao clicar na coluna Pedido (#) da lista.
 */
async function openPedidoOperacoesModal(pedidoId) {
  const id = Number(pedidoId);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("Pedido inválido.");
  }
  if (!els.pedidoOperacoesModal) return;

  state.pedidoOperacoesId = id;
  if (els.pedidoOperacoesTitle) {
    els.pedidoOperacoesTitle.textContent = `Status do pedido #${id}`;
  }
  if (els.pedidoOperacoesSubtitle) {
    els.pedidoOperacoesSubtitle.textContent = "Carregando operações...";
  }
  if (els.pedidoOperacoesBody) {
    els.pedidoOperacoesBody.innerHTML = `<p class="section-subtitle">Carregando status do pedido #${id}...</p>`;
  }
  els.pedidoOperacoesModal.classList.remove("hidden");

  const { data: documento, error: docError } = await supabaseClient
    .from("documentos_venda")
    .select("id, cliente_id, status, total, observacoes, raw_payload, data_emissao, cliente:clientes(id,nome)")
    .eq("empresa_id", state.empresaId)
    .eq("id", id)
    .eq("tipo_documento", "pedido")
    .maybeSingle();

  if (docError) throw docError;
  if (!documento) throw new Error("Pedido não encontrado.");

  const raw =
    documento.raw_payload && typeof documento.raw_payload === "object"
      ? documento.raw_payload
      : {};
  const pagamentoLabel = getPedidoPagamentoLabel(documento);
  const dataEmissao = documento.data_emissao
    ? new Date(documento.data_emissao).toLocaleDateString("pt-BR")
    : "";
  const clienteNome = documento.cliente?.nome || "";

  // Financeiro
  let parcelas = [];
  let valorOriginal = 0;
  let valorAberto = 0;
  let valorRecebido = 0;
  try {
    const { data: contas, error: contasError } = await supabaseClient
      .from("contas_receber")
      .select("id, valor_original, valor_aberto, status")
      .eq("empresa_id", state.empresaId)
      .eq("documento_id", id);

    if (contasError && !isMissingRelationError(contasError)) throw contasError;

    const contaIds = (contas || []).map((c) => Number(c.id)).filter(Number.isFinite);
    for (const c of contas || []) {
      valorOriginal += Number(c.valor_original || 0);
      valorAberto += Number(c.valor_aberto || 0);
    }
    valorRecebido = Math.max(0, valorOriginal - valorAberto);

    if (contaIds.length) {
      const { data: parcelasData, error: parcelasError } = await supabaseClient
        .from("contas_receber_parcelas")
        .select("id, conta_receber_id, numero_parcela, vencimento, valor_parcela, valor_recebido, status")
        .eq("empresa_id", state.empresaId)
        .in("conta_receber_id", contaIds)
        .order("vencimento", { ascending: true });

      if (parcelasError && !isMissingRelationError(parcelasError)) throw parcelasError;

      const today = new Date(new Date().toDateString());
      parcelas = (parcelasData || []).map((p, idx) => {
        const valor = Number(p.valor_parcela || 0);
        const recebido = Number(p.valor_recebido || 0);
        const saldo = Math.max(0, valor - recebido);
        const venc = p.vencimento ? new Date(`${String(p.vencimento).slice(0, 10)}T12:00:00`) : null;
        const isVencida = Boolean(venc && !Number.isNaN(venc.getTime()) && venc < today && saldo > 0.009);
        const statusNormalizado = normalizeContaStatus(p.status, saldo, isVencida);
        return {
          numero: p.numero_parcela || idx + 1,
          vencimento: p.vencimento,
          valor,
          saldo,
          status: p.status,
          statusNormalizado
        };
      });
    }
  } catch (finError) {
    console.warn("Falha ao carregar financeiro do pedido", finError);
  }

  let statusFinanceiro = { label: "Sem títulos", chip: "nao_aplicavel" };
  let financeiroDetalhe = "Nenhum título a receber gerado.";
  if (parcelas.length || valorOriginal > 0) {
    if (valorAberto <= 0.009) {
      statusFinanceiro = { label: "Recebido", chip: "recebido" };
      financeiroDetalhe = `Total ${moeda.format(valorOriginal)} quitado.`;
    } else if (valorRecebido > 0.009) {
      statusFinanceiro = { label: "Parcial", chip: "parcial" };
      financeiroDetalhe = `Recebido ${moeda.format(valorRecebido)} · em aberto ${moeda.format(valorAberto)}.`;
    } else if (parcelas.some((p) => p.statusNormalizado === "vencido")) {
      statusFinanceiro = { label: "Vencido", chip: "vencido" };
      financeiroDetalhe = `Em aberto ${moeda.format(valorAberto)} com parcela(s) vencida(s).`;
    } else {
      statusFinanceiro = { label: "Em aberto", chip: "aberto" };
      financeiroDetalhe = `Saldo em aberto ${moeda.format(valorAberto)}.`;
    }
  }

  // Estoque
  const applied =
    raw.estoque_aplicado && typeof raw.estoque_aplicado === "object" ? raw.estoque_aplicado : {};
  const qtdBaixada = Object.values(applied).reduce((sum, v) => sum + Number(v || 0), 0);
  const statusDoc = String(documento.status || "aberto").toLowerCase();
  let statusEstoque = { label: "Não baixado", chip: "pendente" };
  let estoqueDetalhe = "Estoque só baixa com status Fechado.";
  if (statusDoc === "cancelado") {
    statusEstoque = { label: "Não aplicável", chip: "nao_aplicavel" };
    estoqueDetalhe = "Pedido cancelado — sem baixa de estoque.";
  } else if (qtdBaixada > 0.0005) {
    statusEstoque = { label: "Baixado", chip: "ok" };
    estoqueDetalhe = `${qtdBaixada.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} un. baixada(s) do estoque.`;
  } else if (statusDoc === "fechado") {
    statusEstoque = { label: "Sem itens controlados", chip: "nao_aplicavel" };
    estoqueDetalhe = "Pedido fechado, mas sem produtos com controle de estoque.";
  }

  if (els.pedidoOperacoesSubtitle) {
    els.pedidoOperacoesSubtitle.textContent = "Situação das operações desta ordem";
  }

  renderPedidoOperacoesBody({
    documentoId: id,
    clienteNome,
    dataEmissao,
    total: documento.total,
    statusDocumento: documento.status || "aberto",
    pagamentoLabel,
    statusFinanceiro,
    financeiroDetalhe,
    statusEstoque,
    estoqueDetalhe,
    parcelas,
    orcamentoOrigemId: raw.orcamento_origem_id || null
  });

  if (els.pedidoOperacoesReceberBtn) {
    const podeReceber = valorAberto > 0.009;
    els.pedidoOperacoesReceberBtn.disabled = !podeReceber;
    els.pedidoOperacoesReceberBtn.title = podeReceber
      ? "Registrar recebimento"
      : "Nada em aberto para receber";
  }
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

  // Foto disponível em pedido e orçamento (mesmo modal).
  wrap.classList.remove("hidden");
  const isOrcamento = state.novoDocumentoModal.tipo === "orcamento";
  const tipoLabel = isOrcamento ? "Orçamento" : "Pedido";
  const url = resolveProdutoImageUrl(state.novoDocumentoModal.fotoUrl || "");
  const title = state.novoDocumentoModal.documentoId
    ? `${tipoLabel} #${state.novoDocumentoModal.documentoId}`
    : `Foto do ${tipoLabel.toLowerCase()}`;

  const fotoTitleEl = wrap.querySelector(".documento-pedido-foto-meta strong");
  if (fotoTitleEl) {
    fotoTitleEl.textContent = `Foto do ${tipoLabel.toLowerCase()}`;
  }

  if (url) {
    img.src = url;
    img.alt = title;
    img.dataset.imagePreview = url;
    img.dataset.imageTitle = title;
    img.classList.add("is-clickable");
    img.classList.remove("hidden");
    if (els.novoDocumentoFotoHint) {
      els.novoDocumentoFotoHint.textContent = "Toque na foto para ampliar";
    }
    els.novoDocumentoFotoRemoverBtn?.classList.remove("hidden");
  } else {
    img.removeAttribute("src");
    delete img.dataset.imagePreview;
    delete img.dataset.imageTitle;
    img.classList.add("hidden");
    if (els.novoDocumentoFotoHint) {
      els.novoDocumentoFotoHint.textContent = "Tire uma foto ou escolha da galeria";
    }
    els.novoDocumentoFotoRemoverBtn?.classList.add("hidden");
  }
}

/**
 * Reduz e converte a imagem para JPEG (acelera upload no celular).
 */
function compressImageFile(file, { maxSide = 1600, quality = 0.82 } = {}) {
  return new Promise((resolve, reject) => {
    if (!(file instanceof Blob)) {
      reject(new Error("Arquivo de imagem inválido"));
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) {
          URL.revokeObjectURL(objectUrl);
          resolve(file);
          return;
        }
        const scale = Math.min(1, maxSide / Math.max(w, h));
        const tw = Math.max(1, Math.round(w * scale));
        const th = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement("canvas");
        canvas.width = tw;
        canvas.height = th;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, tw, th);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);
            if (!(blob instanceof Blob)) {
              resolve(file);
              return;
            }
            resolve(
              new File([blob], "pedido-foto.jpg", {
                type: "image/jpeg",
                lastModified: Date.now()
              })
            );
          },
          "image/jpeg",
          quality
        );
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };
    img.src = objectUrl;
  });
}

async function uploadPedidoFotoFile(file) {
  if (!supabaseClient) throw new Error("Supabase não configurado");
  if (!state.empresaId) throw new Error("Empresa não selecionada");
  if (!(file instanceof File) && !(file instanceof Blob)) {
    throw new Error("Selecione uma imagem válida");
  }

  const compressed = await compressImageFile(file);
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 8);
  const objectPath = `${state.empresaId}/${stamp}-${rand}.jpg`;

  const { error } = await supabaseClient.storage
    .from("pedido-images")
    .upload(objectPath, compressed, {
      contentType: "image/jpeg",
      upsert: true,
      cacheControl: "3600"
    });

  if (error) {
    throw new Error(error.message || "Falha ao enviar a foto");
  }

  // Guarda caminho estável no payload; a URL pública é resolvida na exibição
  return `pedido-images/${objectPath}`;
}

async function uploadProdutoImagemFile(file) {
  if (!supabaseClient) throw new Error("Supabase não configurado");
  if (!state.empresaId) throw new Error("Empresa não selecionada");
  if (!(file instanceof File) && !(file instanceof Blob)) {
    throw new Error("Selecione uma imagem válida");
  }

  const compressed = await compressImageFile(file);
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 8);
  const produtoId = els.produtoForm?.dataset?.editId
    ? String(els.produtoForm.dataset.editId)
    : "novo";
  const objectPath = `${state.empresaId}/${produtoId}/${stamp}-${rand}.jpg`;

  const { error } = await supabaseClient.storage
    .from("produto-images")
    .upload(objectPath, compressed, {
      contentType: "image/jpeg",
      upsert: true,
      cacheControl: "3600"
    });

  if (error) {
    throw new Error(error.message || "Falha ao enviar a imagem");
  }

  // Caminho estável; a URL pública é resolvida na exibição
  return `produto-images/${objectPath}`;
}

async function handleProdutoFotoSelected(fileList) {
  const file = fileList?.[0];
  if (!file) return;
  if (!String(file.type || "").startsWith("image/")) {
    showToast("Selecione um arquivo de imagem.", "error");
    return;
  }

  const cameraBtn = els.produtoFotoCameraBtn;
  const galeriaBtn = els.produtoFotoGaleriaBtn;
  const labels = {
    camera: cameraBtn?.textContent || "Câmera",
    galeria: galeriaBtn?.textContent || "Galeria"
  };
  if (cameraBtn) {
    cameraBtn.disabled = true;
    cameraBtn.textContent = "Enviando...";
  }
  if (galeriaBtn) {
    galeriaBtn.disabled = true;
    galeriaBtn.textContent = "Enviando...";
  }

  try {
    const pathOrUrl = await uploadProdutoImagemFile(file);
    setProdutoImagemPathValue(pathOrUrl);
    updateProdutoFormImagePreview();
    showToast("Foto do produto pronta. Salve para confirmar.");
  } catch (error) {
    console.warn("Falha ao enviar foto do produto", error);
    showToast(`Erro ao enviar foto: ${error.message || "falha desconhecida"}`, "error");
  } finally {
    if (cameraBtn) {
      cameraBtn.disabled = false;
      cameraBtn.textContent = labels.camera;
    }
    if (galeriaBtn) {
      galeriaBtn.disabled = false;
      galeriaBtn.textContent = labels.galeria;
    }
    if (els.produtoFotoCameraInput) els.produtoFotoCameraInput.value = "";
    if (els.produtoFotoGaleriaInput) els.produtoFotoGaleriaInput.value = "";
  }
}

function removeProdutoFoto() {
  const current = String(els.produtoImagemPathInput?.value || "").trim();
  if (!current) return;
  if (!window.confirm("Remover a foto deste produto?")) return;
  setProdutoImagemPathValue("");
  updateProdutoFormImagePreview();
  showToast("Foto removida. Salve para confirmar.");
}

async function handleNovoDocumentoFotoSelected(fileList) {
  const file = fileList?.[0];
  if (!file) return;
  if (!String(file.type || "").startsWith("image/")) {
    showToast("Selecione um arquivo de imagem.", "error");
    return;
  }

  const cameraBtn = els.novoDocumentoFotoCameraBtn;
  const galeriaBtn = els.novoDocumentoFotoGaleriaBtn;
  const labels = {
    camera: cameraBtn?.textContent || "Câmera",
    galeria: galeriaBtn?.textContent || "Galeria"
  };
  if (cameraBtn) {
    cameraBtn.disabled = true;
    cameraBtn.textContent = "Enviando...";
  }
  if (galeriaBtn) {
    galeriaBtn.disabled = true;
    galeriaBtn.textContent = "Enviando...";
  }

  try {
    const pathOrUrl = await uploadPedidoFotoFile(file);
    state.novoDocumentoModal.fotoUrl = pathOrUrl;
    // Se o pedido já está salvo, grava a foto no raw_payload na hora
    if (state.novoDocumentoModal.documentoId) {
      const rawBase =
        state.novoDocumentoModal.rawPayloadBase && typeof state.novoDocumentoModal.rawPayloadBase === "object"
          ? { ...state.novoDocumentoModal.rawPayloadBase }
          : {};
      rawBase.foto_url = pathOrUrl;
      state.novoDocumentoModal.rawPayloadBase = rawBase;
      const { error } = await supabaseClient
        .from("documentos_venda")
        .update({ raw_payload: rawBase })
        .eq("id", state.novoDocumentoModal.documentoId)
        .eq("empresa_id", state.empresaId);
      if (error) throw error;
    }
    renderNovoDocumentoPedidoFoto();
    showToast("Foto salva");
  } catch (error) {
    console.warn("Falha ao enviar foto do documento", error);
    showToast(`Erro ao enviar foto: ${error.message || "falha desconhecida"}`, "error");
  } finally {
    if (cameraBtn) {
      cameraBtn.disabled = false;
      cameraBtn.textContent = labels.camera;
    }
    if (galeriaBtn) {
      galeriaBtn.disabled = false;
      galeriaBtn.textContent = labels.galeria;
    }
    if (els.novoDocumentoFotoCameraInput) els.novoDocumentoFotoCameraInput.value = "";
    if (els.novoDocumentoFotoGaleriaInput) els.novoDocumentoFotoGaleriaInput.value = "";
  }
}

async function removeNovoDocumentoFoto() {
  if (!state.novoDocumentoModal.fotoUrl) return;
  if (!window.confirm("Remover a foto deste documento?")) return;

  state.novoDocumentoModal.fotoUrl = "";
  if (state.novoDocumentoModal.rawPayloadBase && typeof state.novoDocumentoModal.rawPayloadBase === "object") {
    delete state.novoDocumentoModal.rawPayloadBase.foto_url;
  }

  if (state.novoDocumentoModal.documentoId && supabaseClient) {
    try {
      const rawBase =
        state.novoDocumentoModal.rawPayloadBase && typeof state.novoDocumentoModal.rawPayloadBase === "object"
          ? { ...state.novoDocumentoModal.rawPayloadBase }
          : {};
      delete rawBase.foto_url;
      state.novoDocumentoModal.rawPayloadBase = rawBase;
      const { error } = await supabaseClient
        .from("documentos_venda")
        .update({ raw_payload: rawBase })
        .eq("id", state.novoDocumentoModal.documentoId)
        .eq("empresa_id", state.empresaId);
      if (error) throw error;
    } catch (error) {
      showToast(`Erro ao remover foto: ${error.message}`, "error");
      return;
    }
  }

  renderNovoDocumentoPedidoFoto();
  showToast("Foto removida");
}

function renderNovoDocumentoModal() {
  if (!els.novoDocumentoModal) return;
  const config = getDocumentoModalConfig(state.novoDocumentoModal.tipo);
  const isEdit = Boolean(state.novoDocumentoModal.documentoId);
  const isConversao = Boolean(state.novoDocumentoModal.convertidoDeOrcamentoId) && !isEdit;

  if (els.novoDocumentoModalTitle) {
    if (isConversao) {
      els.novoDocumentoModalTitle.textContent = `Pedido a partir do orçamento #${state.novoDocumentoModal.convertidoDeOrcamentoId}`;
    } else {
      els.novoDocumentoModalTitle.textContent = isEdit ? config.titulo.replace("Novo", "Editar") : config.titulo;
    }
  }
  if (els.novoDocumentoModalSubtitle) {
    if (isConversao) {
      els.novoDocumentoModalSubtitle.textContent =
        "Dados copiados do orçamento. Ajuste o pagamento se precisar e salve para gerar o pedido.";
    } else {
      const tipoLabel = state.novoDocumentoModal.tipo === "orcamento" ? "orçamento" : "pedido";
      els.novoDocumentoModalSubtitle.textContent = isEdit && state.novoDocumentoModal.fotoUrl
        ? `Edite os dados do ${tipoLabel}. A foto aparece no resumo ao lado.`
        : config.subtitulo;
    }
  }
  if (els.novoDocumentoConverterBtn) {
    // Botão só ao editar um orçamento já salvo (ainda não convertido nesta tela).
    const showConverter =
      state.novoDocumentoModal.tipo === "orcamento" && Boolean(state.novoDocumentoModal.documentoId);
    els.novoDocumentoConverterBtn.classList.toggle("hidden", !showConverter);
  }
  if (els.novoDocumentoObservacoes) {
    els.novoDocumentoObservacoes.value = state.novoDocumentoModal.observacoes || "";
  }
  if (els.novoDocumentoDataEmissao) {
    els.novoDocumentoDataEmissao.value = state.novoDocumentoModal.dataEmissao || formatDateInput(new Date());
  }

  fillDocExtraForm(state.novoDocumentoModal.bicicleta);

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
  // Pré-carrega gerador de PDF enquanto o usuário preenche o formulário
  preloadHtml2Pdf();
}

async function openNovoDocumentoEditModal(tipo, documentoId) {
  // Garante que clientes e produtos estao carregados para preencher combos corretamente.
  await Promise.all([ensureClientesLoaded(), ensureProdutosLoaded()]);
  await loadDocumentoForEdit(tipo, documentoId);
  renderNovoDocumentoModal();
  if (els.novoDocumentoModal) {
    els.novoDocumentoModal.classList.remove("hidden");
  }
  preloadHtml2Pdf();
}

function closeNovoDocumentoModal() {
  if (!els.novoDocumentoModal) return;
  closeAllNovoDocumentoProdutoPanels();
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
    bicicleta: extractDocExtraFromPayload(rawPayload),
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
    rawPayloadBase: rawPayload,
    convertidoDeOrcamentoId: null
  };
}

/**
 * Marca o orçamento de origem como aprovado e grava o id do pedido gerado.
 */
async function markOrcamentoAsConverted(orcamentoId, pedidoId) {
  if (!orcamentoId || !pedidoId || !supabaseClient) return;

  const { data: orcamento, error: loadError } = await supabaseClient
    .from("documentos_venda")
    .select("id, status, raw_payload")
    .eq("empresa_id", state.empresaId)
    .eq("id", orcamentoId)
    .eq("tipo_documento", "orcamento")
    .maybeSingle();

  if (loadError) throw loadError;
  if (!orcamento) return;

  const raw =
    orcamento.raw_payload && typeof orcamento.raw_payload === "object"
      ? { ...orcamento.raw_payload }
      : {};
  raw.pedido_convertido_id = Number(pedidoId);
  raw.convertido_em = new Date().toISOString();

  const { error: updateError } = await supabaseClient
    .from("documentos_venda")
    .update({
      status: "aprovado",
      raw_payload: raw
    })
    .eq("empresa_id", state.empresaId)
    .eq("id", orcamentoId)
    .eq("tipo_documento", "orcamento");

  if (updateError) throw updateError;
}

/**
 * Abre um novo pedido pré-preenchido a partir de um orçamento (sem gravar ainda).
 * Ao salvar o pedido, o orçamento é marcado como aprovado e vinculado.
 */
async function convertOrcamentoToPedido(orcamentoId) {
  const id = Number(orcamentoId);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("Orçamento inválido.");
  }

  await Promise.all([ensureClientesLoaded(), ensureProdutosLoaded()]);

  // Se o orçamento já está aberto no modal, usa os dados da tela (inclui edições recentes).
  const modalOpen =
    els.novoDocumentoModal && !els.novoDocumentoModal.classList.contains("hidden");
  const openDraft = state.novoDocumentoModal;
  const usingOpenDraft =
    modalOpen &&
    openDraft?.tipo === "orcamento" &&
    Number(openDraft.documentoId) === id;

  let documento = null;
  let rawPayload = {};
  let itens = [];
  let statusAtual = "aberto";

  if (usingOpenDraft) {
    syncNovoDocumentoDraftFromForm();
    rawPayload =
      openDraft.rawPayloadBase && typeof openDraft.rawPayloadBase === "object"
        ? { ...openDraft.rawPayloadBase }
        : {};
    statusAtual = String(openDraft.status || "aberto").toLowerCase();
    itens = (openDraft.itens || []).map((item) => ({ ...item, rowId: `${Date.now()}-${Math.random().toString(16).slice(2)}` }));
    documento = {
      id,
      cliente_id: openDraft.clienteId || null,
      status: openDraft.status,
      observacoes: openDraft.observacoes || "",
      raw_payload: rawPayload,
      fotoUrl: openDraft.fotoUrl || "",
      bicicleta: openDraft.bicicleta,
      pagamento: openDraft.pagamento,
      precoFormacaoAplicada: openDraft.precoFormacaoAplicada
    };
  } else {
    const { data, error: documentoError } = await supabaseClient
      .from("documentos_venda")
      .select("id, cliente_id, status, observacoes, total, raw_payload, data_emissao")
      .eq("empresa_id", state.empresaId)
      .eq("id", id)
      .eq("tipo_documento", "orcamento")
      .maybeSingle();

    if (documentoError) throw documentoError;
    if (!data) throw new Error("Orçamento não encontrado.");
    documento = data;
    rawPayload =
      documento.raw_payload && typeof documento.raw_payload === "object"
        ? { ...documento.raw_payload }
        : {};
    statusAtual = String(documento.status || "").toLowerCase();

    const { data: itensData, error: itensError } = await supabaseClient
      .from("documento_venda_itens")
      .select("id, produto_id, descricao_item, quantidade, valor_unitario")
      .eq("empresa_id", state.empresaId)
      .eq("documento_id", id)
      .order("id", { ascending: true });

    if (itensError) throw itensError;
    itens = (itensData || []).map(normalizeDocumentoItem);
  }

  const pedidoJaCriado = Number(rawPayload.pedido_convertido_id || 0);
  if (pedidoJaCriado > 0) {
    const abrir = window.confirm(
      `Este orçamento já foi convertido no pedido #${pedidoJaCriado}.\n\nDeseja abrir o pedido existente?`
    );
    if (abrir) {
      await openNovoDocumentoEditModal("pedido", pedidoJaCriado);
    }
    return;
  }

  if (statusAtual === "reprovado") {
    const seguir = window.confirm(
      "Este orçamento está reprovado.\n\nMesmo assim deseja criar um pedido a partir dele?"
    );
    if (!seguir) return;
  } else {
    const confirmar = window.confirm(
      "Converter este orçamento em pedido?\n\n" +
        "• Será aberto um novo pedido com os mesmos dados (cliente, itens, foto, bike…)\n" +
        "• Confira o pagamento e salve o pedido\n" +
        "• Ao salvar, o orçamento será marcado como Aprovado e vinculado ao pedido"
    );
    if (!confirmar) return;
  }

  if (!itens.filter((item) => isDocumentoItemFilled(item)).length) {
    throw new Error("O orçamento não tem itens para converter.");
  }

  const precoFormacaoAplicada =
    documento.precoFormacaoAplicada || rawPayload.preco_formacao || null;
  const basePayload = { ...rawPayload };
  delete basePayload.pedido_convertido_id;
  delete basePayload.convertido_em;

  const fotoUrl = usingOpenDraft
    ? String(documento.fotoUrl || "")
    : getPedidoFotoUrl(documento);
  const bicicleta = usingOpenDraft
    ? createDocExtraDraft(documento.bicicleta)
    : extractDocExtraFromPayload(rawPayload);
  const pagamento = usingOpenDraft
    ? { ...createPagamentoDraft(), ...(documento.pagamento || {}) }
    : { ...createPagamentoDraft(), ...(rawPayload.pagamento || {}) };

  state.novoDocumentoModal = {
    ...createDocumentoDraft("pedido"),
    tipo: "pedido",
    documentoId: null,
    clienteId: documento.cliente_id ? String(documento.cliente_id) : "",
    status: "aberto",
    observacoes: documento.observacoes || "",
    dataEmissao: formatDateInput(new Date()),
    fotoUrl,
    bicicleta,
    pagamento,
    parcelasEditadas: null,
    parcelasOriginaisSnapshot: null,
    itens: itens.length ? itens : [createDocumentoDraftItem()],
    precoVendaCalc: hydrateProdutoPrecoVendaCalcFromSnapshot(precoFormacaoAplicada),
    precoFormacaoAplicada,
    rawPayloadBase: {
      ...basePayload,
      orcamento_origem_id: id,
      source: "conversao-orcamento"
    },
    convertidoDeOrcamentoId: id
  };

  ensureTrailingEmptyDocumentoItem();
  renderNovoDocumentoModal();
  if (els.novoDocumentoModal) {
    els.novoDocumentoModal.classList.remove("hidden");
  }
  preloadHtml2Pdf();
  showToast("Pedido montado a partir do orçamento. Confira o pagamento e salve.");
}

function setNovoDocumentoTipo(tipo) {
  const nextTipo = tipo === "orcamento" ? "orcamento" : "pedido";
  const draft = state.novoDocumentoModal;
  const prevTipo = draft.tipo;
  // Editando orçamento e mudou para pedido → trata como conversão (novo pedido).
  if (
    prevTipo === "orcamento" &&
    nextTipo === "pedido" &&
    draft.documentoId &&
    !draft.convertidoDeOrcamentoId
  ) {
    const orcamentoId = draft.documentoId;
    convertOrcamentoToPedido(orcamentoId).catch((error) => {
      showToast(`Erro ao converter orçamento: ${error.message}`, "error");
    });
    return;
  }
  draft.tipo = nextTipo;
  const config = getDocumentoModalConfig(draft.tipo);
  // Só reseta status se o valor atual não existir no novo tipo.
  const statusOk = (config.statuses || []).some((s) => s.value === draft.status);
  if (!statusOk) {
    draft.status = config.defaultStatus;
  }
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

  // Busca do picker pode estar no body (tela cheia) — resolve pelo atributo, sem precisar da linha
  const comboSearchAttr = target.getAttribute("data-produto-combo-search");
  if (comboSearchAttr) {
    refreshNovoDocumentoProdutoOptions(comboSearchAttr, target.value || "");
    return;
  }

  const row = target.closest("[data-documento-item-row]");
  if (!row) return;
  const rowId = row.getAttribute("data-documento-item-row");
  if (!rowId) return;

  const item = state.novoDocumentoModal.itens.find((draftItem) => draftItem.rowId === rowId);
  if (!item) return;

  const produtoId = target.getAttribute("data-produto-id");
  if (produtoId) {
    setNovoDocumentoProduto(rowId, produtoId);
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
  state.novoDocumentoModal.bicicleta = readDocExtraFromForm();
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

/** Resolve o cliente do PDF de forma robusta (lista local, label da UI ou fetch pontual). */
async function resolveClienteForPdf() {
  const clienteId = String(state.novoDocumentoModal.clienteId || els.novoDocumentoClienteId?.value || "").trim();
  if (!clienteId) return null;

  try {
    await ensureClientesLoaded();
  } catch (err) {
    console.warn("Falha ao garantir clientes para PDF", err);
  }

  let cliente = state.clientes.find((item) => String(item.id) === clienteId) || null;
  if (cliente?.nome) return cliente;

  // Fallback: nome já exibido no seletor do modal
  const label = String(els.novoDocumentoClienteLabel?.textContent || "").trim();
  if (label && label !== "Selecione um cliente") {
    cliente = {
      id: clienteId,
      nome: label,
      telefone: cliente?.telefone || "",
      email: cliente?.email || ""
    };
  }

  // Último recurso: busca só este cliente no Supabase
  if ((!cliente?.nome || !cliente?.telefone) && supabaseClient && state.empresaId) {
    try {
      const { data, error } = await supabaseClient
        .from("clientes")
        .select("id, nome, telefone, email")
        .eq("empresa_id", state.empresaId)
        .eq("id", clienteId)
        .maybeSingle();
      if (!error && data?.nome) {
        cliente = data;
        const idx = state.clientes.findIndex((item) => String(item.id) === String(data.id));
        if (idx >= 0) state.clientes[idx] = data;
        else state.clientes.push(data);
      }
    } catch (err) {
      console.warn("Falha ao buscar cliente para PDF", err);
    }
  }

  return cliente?.nome ? cliente : cliente;
}

/** Converte URL de imagem em data URL (evita CORS/blank no html2canvas). */
async function imageUrlToDataUrl(url, timeoutMs = 3500) {
  const src = String(url || "").trim();
  if (!src) return "";
  if (/^data:/i.test(src)) return src;

  try {
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timer = controller
      ? setTimeout(() => {
          try {
            controller.abort();
          } catch (_) {
            /* ignore */
          }
        }, timeoutMs)
      : null;

    const res = await fetch(src, {
      mode: "cors",
      credentials: "omit",
      signal: controller?.signal
    });
    if (timer) clearTimeout(timer);
    if (!res.ok) return "";
    const blob = await res.blob();
    if (!blob || !String(blob.type || "").startsWith("image/")) return "";

    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => resolve("");
      reader.readAsDataURL(blob);
    });
  } catch (_) {
    return "";
  }
}

/** Prepara itens do PDF com miniaturas embutidas (data URL) para renderização rápida e estável. */
async function prepareItensForPdf(itens) {
  const list = Array.isArray(itens) ? itens : [];
  const withImages = await Promise.all(
    list.map(async (item) => {
      const remoteUrl = String(item.imagemUrl || "").trim();
      if (!remoteUrl) return { ...item, imagemUrl: "" };
      const dataUrl = await imageUrlToDataUrl(remoteUrl);
      return { ...item, imagemUrl: dataUrl || "" };
    })
  );
  return withImages;
}

function waitForElementImages(root, timeoutMs = 2500) {
  const images = Array.from(root?.querySelectorAll?.("img") || []);
  if (!images.length) return Promise.resolve();
  return Promise.race([
    Promise.all(
      images.map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete) {
              resolve();
              return;
            }
            img.onload = () => resolve();
            img.onerror = () => resolve();
          })
      )
    ),
    new Promise((resolve) => setTimeout(resolve, timeoutMs))
  ]);
}

function darkenHexColor(hex, amount = 0.22) {
  const raw = String(hex || "").replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return "#0f4744";
  const n = Math.min(1, Math.max(0, Number(amount) || 0));
  const parts = [0, 2, 4].map((i) => {
    const v = parseInt(raw.slice(i, i + 2), 16);
    return Math.max(0, Math.round(v * (1 - n)));
  });
  return `#${parts.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function buildOrcamentoPdfHtml(payload) {
  const {
    empresaNome,
    empresaConfig,
    empresaLogoDataUrl,
    cliente,
    dataEmissaoLabel,
    numeroRef,
    itens,
    subtotal,
    observacoes,
    pagamentoTexto,
    bicicleta,
    docLabel,
    geradoEm,
    autoPrint = false
  } = payload;
  const tipoLabel = docLabel || "Orçamento";
  const clienteNome = String(cliente?.nome || "").trim();
  const clienteTel = String(cliente?.telefone || "").trim();
  const clienteEmail = String(cliente?.email || "").trim();
  const cfg = normalizeEmpresaConfig(empresaConfig || {}, empresaNome);
  const brand = cfg.cor_primaria || "#165d59";
  const brandDark = darkenHexColor(brand, 0.28);
  const nomeEmpresa = cfg.nome || empresaNome || "Empresa";
  const empresaContatoHtml = [
    cfg.telefone ? `Tel.: ${escapeHtml(cfg.telefone)}` : "",
    cfg.email ? `E-mail: ${escapeHtml(cfg.email)}` : "",
    ...formatEmpresaEnderecoLinhas(cfg).map((line) => escapeHtml(line))
  ].filter(Boolean).join("<br />");
  const logoHtml = empresaLogoDataUrl
    ? `<img class="brand-logo" src="${escapeHtml(empresaLogoDataUrl)}" alt="Logo" />`
    : "";
  const termosHtml = cfg.pdf_termos
    ? cfg.pdf_termos
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => `<div class="termo-line">${escapeHtml(line)}</div>`)
      .join("")
    : "";
  const avisoHtml = cfg.pdf_aviso
    ? `<div class="aviso-box"><strong>Atenção</strong><p>${escapeHtml(cfg.pdf_aviso)}</p></div>`
    : "";

  const rows = (itens || [])
    .map((item, index) => {
      const total = Number(item.quantidade || 0) * Number(item.valorUnitario || 0);
      const img = item.imagemUrl
        ? `<img class="item-photo" src="${escapeHtml(item.imagemUrl)}" alt="" crossorigin="anonymous" />`
        : `<span class="item-photo item-photo-empty"></span>`;
      return `
        <tr>
          <td class="col-idx">${index + 1}</td>
          <td class="col-desc">
            <table class="item-desc-table"><tr>
              <td class="item-photo-cell">${img}</td>
              <td class="item-text-cell">${escapeHtml(item.descricao || "Item")}</td>
            </tr></table>
          </td>
          <td class="col-num">${escapeHtml(formatQtyForPdf(item.quantidade))}</td>
          <td class="col-num">${escapeHtml(moeda.format(item.valorUnitario || 0))}</td>
          <td class="col-num">${escapeHtml(moeda.format(total))}</td>
        </tr>
      `;
    })
    .join("");

  const clienteLinhas = [
    clienteNome ? `<strong>${escapeHtml(clienteNome)}</strong>` : "<strong>Cliente não informado</strong>",
    clienteTel ? `Tel.: ${escapeHtml(clienteTel)}` : "",
    clienteEmail ? `E-mail: ${escapeHtml(clienteEmail)}` : ""
  ].filter(Boolean).join("<br />");

  // Layout com table (não flex/grid): html2canvas renderiza de forma confiável.
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
      padding: 0;
      font-family: Arial, Helvetica, sans-serif;
      color: #1f1e1a;
      background: #fff;
      font-size: 12px;
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet {
      width: 700px;
      max-width: 100%;
      margin: 0 auto;
      padding: 8px 4px 16px;
      font-family: Arial, Helvetica, sans-serif;
      color: #1f1e1a;
      background: #fff;
      font-size: 12px;
      line-height: 1.45;
    }
    .header {
      width: 100%;
      border-collapse: collapse;
      border-bottom: 3px solid ${brand};
      margin-bottom: 16px;
      padding-bottom: 0;
    }
    .header td {
      vertical-align: top;
      padding: 0 0 12px 0;
    }
    .brand-logo {
      max-width: 120px;
      max-height: 56px;
      object-fit: contain;
      display: block;
      margin-bottom: 8px;
    }
    .brand h1 {
      margin: 0;
      font-size: 22px;
      letter-spacing: -0.02em;
      color: ${brandDark};
    }
    .brand p { margin: 4px 0 0; color: #5f5a50; }
    .brand .empresa-contato {
      margin-top: 8px;
      font-size: 11px;
      color: #5f5a50;
      line-height: 1.4;
    }
    .doc-meta {
      text-align: right;
      width: 200px;
    }
    .badge {
      display: inline-block;
      background: ${brand};
      color: #fff;
      font-weight: 700;
      font-size: 11px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 5px 10px;
      border-radius: 999px;
      margin-bottom: 8px;
    }
    .doc-meta strong { display: block; font-size: 14px; margin-top: 2px; color: #1f1e1a; }
    .doc-meta span { color: #5f5a50; }
    .grid-2 {
      width: 100%;
      border-collapse: separate;
      border-spacing: 12px 0;
      margin: 0 -12px 16px;
    }
    .grid-2 td {
      width: 50%;
      vertical-align: top;
    }
    .card {
      border: 1px solid #ddd2c0;
      border-radius: 10px;
      padding: 12px 14px;
      background: #fbf8f2;
      color: #1f1e1a;
    }
    .card h2 {
      margin: 0 0 8px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: ${brand};
    }
    .card .card-body { color: #1f1e1a; }
    table.items {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4px;
    }
    table.items thead th {
      background: ${brand};
      color: #fff;
      text-align: left;
      padding: 9px 8px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    table.items tbody td {
      padding: 9px 8px;
      border-bottom: 1px solid #e8dfd0;
      vertical-align: middle;
      color: #1f1e1a;
      background: #fff;
    }
    table.items tbody tr:nth-child(even) td { background: #faf7f1; }
    .col-idx { width: 36px; text-align: center; color: #6d675c; }
    .col-num { text-align: right; white-space: nowrap; }
    .col-desc { width: 52%; }
    .item-desc-table { width: 100%; border-collapse: collapse; }
    .item-desc-table td { border: 0 !important; padding: 0 !important; background: transparent !important; vertical-align: middle; }
    .item-photo-cell { width: 56px; }
    .item-text-cell { padding-left: 10px !important; line-height: 1.35; color: #1f1e1a; }
    .item-photo {
      width: 48px;
      height: 48px;
      object-fit: cover;
      border-radius: 8px;
      border: 1px solid #e0d5c0;
      background: #f4efe6;
      display: block;
    }
    .item-photo-empty {
      display: block;
      width: 48px;
      height: 48px;
      border-radius: 8px;
      border: 1px solid #e0d5c0;
      background: #f4efe6;
    }
    .totals {
      margin-top: 14px;
      text-align: right;
    }
    .totals-box {
      display: inline-block;
      min-width: 240px;
      border: 1px solid #d7cdb9;
      border-radius: 10px;
      overflow: hidden;
      text-align: left;
    }
    .totals-box .row {
      width: 100%;
      border-collapse: collapse;
    }
    .totals-box .row td {
      padding: 10px 14px;
      background: #fff;
      color: #1f1e1a;
    }
    .totals-box .row.total td {
      background: ${brand};
      color: #fff;
      font-size: 15px;
      font-weight: 700;
    }
    .totals-box .row .lbl { text-align: left; }
    .totals-box .row .val { text-align: right; white-space: nowrap; }
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
      color: ${brand};
    }
    .notes p { margin: 0; white-space: pre-wrap; color: #3b372f; }
    .termos {
      margin-top: 16px;
      border-top: 1px dashed #d7cdb9;
      padding-top: 12px;
    }
    .termos h3 {
      margin: 0 0 8px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: ${brand};
    }
    .termo-line {
      margin: 0 0 4px;
      color: #3b372f;
      font-size: 11px;
    }
    .aviso-box {
      margin-top: 14px;
      border: 1px solid #e2b4b4;
      background: #fff5f5;
      border-radius: 10px;
      padding: 12px 14px;
    }
    .aviso-box strong {
      display: block;
      color: #8a2f2f;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 6px;
    }
    .aviso-box p {
      margin: 0;
      white-space: pre-wrap;
      color: #5a3030;
      font-size: 11px;
      line-height: 1.45;
    }
    .approval {
      width: 100%;
      border-collapse: separate;
      border-spacing: 28px 0;
      margin: 28px -28px 0;
    }
    .approval td { width: 50%; vertical-align: top; }
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
      text-align: right;
      margin-bottom: 12px;
    }
    .toolbar button {
      border: 0;
      border-radius: 8px;
      padding: 8px 12px;
      font-weight: 700;
      cursor: pointer;
      margin-left: 8px;
    }
    .toolbar .primary { background: ${brand}; color: #fff; }
    .toolbar .ghost { background: #ece7de; color: #1f1e1a; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="toolbar no-print">
      <button class="ghost" type="button" onclick="window.close()">Fechar</button>
      <button class="primary" type="button" onclick="window.print()">Imprimir / Salvar PDF</button>
    </div>

    <table class="header">
      <tr>
        <td class="brand">
          ${logoHtml}
          <h1>${escapeHtml(nomeEmpresa)}</h1>
          <p>${escapeHtml(tipoLabel)} para o cliente</p>
          ${empresaContatoHtml ? `<div class="empresa-contato">${empresaContatoHtml}</div>` : ""}
        </td>
        <td class="doc-meta">
          <div class="badge">${escapeHtml(tipoLabel)}</div>
          <span>Referência</span>
          <strong>${escapeHtml(numeroRef)}</strong>
          <span style="display:block;margin-top:8px;">Emissão</span>
          <strong>${escapeHtml(dataEmissaoLabel)}</strong>
        </td>
      </tr>
    </table>

    <table class="grid-2">
      <tr>
        <td>
          <div class="card">
            <h2>Cliente</h2>
            <div class="card-body">${clienteLinhas}</div>
          </div>
        </td>
        <td>
          <div class="card">
            <h2>Condições</h2>
            <div class="card-body">
              ${pagamentoTexto ? escapeHtml(pagamentoTexto) : "Condições comerciais a combinar."}
              <br /><span style="color:#5f5a50;">Documento gerado para análise e aprovação.</span>
            </div>
          </div>
        </td>
      </tr>
    </table>

    ${(() => {
      const extra = buildDocExtraPdfLines(bicicleta, payload.docExtraMeta || null);
      if (!extra.lines.length) return "";
      return `<div class="card" style="margin-bottom:14px;">
          <h2>${escapeHtml(extra.titulo || "Dados adicionais")}</h2>
          <div class="card-body">
            ${extra.lines
              .map((line) => `<strong>${escapeHtml(line.label)}:</strong> ${escapeHtml(line.value)}`)
              .join("<br />")}
          </div>
        </div>`;
    })()}

    <table class="items">
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
        <table class="row total">
          <tr>
            <td class="lbl">Total</td>
            <td class="val">${escapeHtml(moeda.format(subtotal || 0))}</td>
          </tr>
        </table>
      </div>
    </div>

    ${observacoes
      ? `<section class="notes"><h3>Observações</h3><p>${escapeHtml(observacoes)}</p></section>`
      : ""}

    ${termosHtml
      ? `<section class="termos"><h3>Termos e condições</h3>${termosHtml}</section>`
      : ""}

    ${avisoHtml}

    <table class="approval">
      <tr>
        <td><div class="sign">Assinatura do cliente<br />Data: ____/____/________</div></td>
        <td><div class="sign">Assinatura da empresa<br />${escapeHtml(nomeEmpresa)}</div></td>
      </tr>
    </table>

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
        ${autoPrint
          ? `setTimeout(function () {
          try { window.focus(); window.print(); } catch (e) {}
        }, 200);`
          : ""}
      });
    });
  </script>
</body>
</html>`;
}

function openOrcamentoHtmlPreview(html) {
  const win = window.open("", "_blank");
  if (!win) {
    showToast("Permita pop-ups no navegador para abrir o documento.", "error");
    return false;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}

/** Fecha o visualizador/exportador de documento. */
function closePdfViewerModal() {
  const overlay = document.getElementById("pdfViewerOverlay");
  if (!overlay) return;
  const url = overlay.dataset.blobUrl || "";
  overlay.remove();
  if (url) {
    try {
      URL.revokeObjectURL(url);
    } catch (_) {
      /* ignore */
    }
  }
}

function openPdfInNewTab(url) {
  const opened = window.open(url, "_blank", "noopener");
  if (opened) return true;
  try {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch (_) {
    return false;
  }
}

function downloadPdfBlob(pdfBlob, fileName) {
  const safeName = String(fileName || "documento.pdf").replace(/[^\w.\-() ]+/g, "_");
  const name = safeName.toLowerCase().endsWith(".pdf") ? safeName : `${safeName}.pdf`;
  const url = URL.createObjectURL(pdfBlob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch (_) {
    return openPdfInNewTab(url);
  } finally {
    // Mantém a URL um pouco para o download iniciar no mobile
    window.setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch (_) {
        /* ignore */
      }
    }, 60_000);
  }
}

function canSharePdfFile(file) {
  if (typeof navigator.share !== "function") return false;
  try {
    if (typeof navigator.canShare !== "function") return true;
    return navigator.canShare({ files: [file] });
  } catch (_) {
    return false;
  }
}

/**
 * Tela de exportação: prévia bonita do documento + Baixar PDF / Enviar (WhatsApp).
 * Não depende de “Imprimir → Salvar PDF” do navegador.
 */
function openPdfViewerModal({ blob, fileName, title, shareText, previewHtml }) {
  closePdfViewerModal();

  const pdfBlob =
    blob instanceof Blob && blob.type === "application/pdf"
      ? blob
      : new Blob([blob], { type: "application/pdf" });
  const url = URL.createObjectURL(pdfBlob);
  const safeName = String(fileName || "documento.pdf").replace(/[^\w.\-() ]+/g, "_");
  const finalName = safeName.toLowerCase().endsWith(".pdf") ? safeName : `${safeName}.pdf`;
  const file = new File([pdfBlob], finalName, { type: "application/pdf" });
  const shareFilesOk = canSharePdfFile(file);
  const hasShareApi = typeof navigator.share === "function";
  const mobile = isMobileDevice();

  const overlay = document.createElement("div");
  overlay.id = "pdfViewerOverlay";
  overlay.className = "modal-overlay pdf-viewer-overlay modal-overlay--stack";
  overlay.dataset.blobUrl = url;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", title || "Exportar PDF");

  const previewBlock = previewHtml
    ? `<iframe class="pdf-viewer-frame pdf-viewer-frame--html" title="Prévia do documento"></iframe>`
    : `<iframe class="pdf-viewer-frame" title="PDF" src="${url}"></iframe>`;

  overlay.innerHTML = `
    <div class="modal-card pdf-viewer-card">
      <div class="modal-head pdf-viewer-head">
        <div>
          <h2 class="pdf-viewer-title">${escapeHtml(title || "Documento")}</h2>
          <p class="modal-subtitle pdf-viewer-subtitle">
            ${
              mobile
                ? "Toque em <strong>Enviar PDF</strong> para mandar no WhatsApp, ou <strong>Baixar PDF</strong>."
                : "Baixe o PDF ou envie pelo WhatsApp — sem precisar usar Imprimir do navegador."
            }
          </p>
        </div>
        <button type="button" class="btn btn-ghost pdf-viewer-close-top" data-pdf-action="close" aria-label="Fechar">Fechar</button>
      </div>

      <div class="pdf-viewer-frame-wrap">
        ${previewBlock}
      </div>

      <div class="pdf-viewer-toolbar">
        ${
          shareFilesOk
            ? `<button type="button" class="btn btn-primary pdf-viewer-main-btn" data-pdf-action="share">Enviar PDF</button>`
            : hasShareApi
              ? `<button type="button" class="btn btn-primary pdf-viewer-main-btn" data-pdf-action="share-fallback">Enviar</button>`
              : ""
        }
        <button type="button" class="btn ${shareFilesOk ? "btn-ghost" : "btn-primary"} pdf-viewer-main-btn" data-pdf-action="download">Baixar PDF</button>
        <button type="button" class="btn btn-ghost" data-pdf-action="open-tab">Abrir PDF</button>
      </div>
    </div>
  `;

  const close = () => closePdfViewerModal();

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });

  overlay.querySelectorAll('[data-pdf-action="close"]').forEach((el) => {
    el.addEventListener("click", close);
  });

  // Prévia HTML bonita (srcdoc) — o PDF real fica nos botões
  if (previewHtml) {
    const frame = overlay.querySelector(".pdf-viewer-frame--html");
    if (frame) {
      // Remove toolbar interna da prévia (os botões reais ficam no rodapé)
      const cleaned = String(previewHtml).replace(
        /<div class="toolbar no-print">[\s\S]*?<\/div>/i,
        ""
      );
      frame.srcdoc = cleaned;
    }
  }

  overlay.querySelector('[data-pdf-action="download"]')?.addEventListener("click", () => {
    const ok = downloadPdfBlob(pdfBlob, finalName);
    if (ok) showToast("Download do PDF iniciado");
    else showToast("Não foi possível baixar o PDF neste aparelho.", "error");
  });

  overlay.querySelector('[data-pdf-action="open-tab"]')?.addEventListener("click", () => {
    if (!openPdfInNewTab(url)) {
      showToast("Permita pop-ups para abrir o PDF.", "error");
    }
  });

  overlay.querySelector('[data-pdf-action="share"]')?.addEventListener("click", async () => {
    try {
      await navigator.share({
        files: [file],
        title: finalName,
        text: shareText || title || ""
      });
      showToast("Escolha o WhatsApp na lista para enviar o PDF");
    } catch (err) {
      if (err?.name === "AbortError") return;
      // Fallback: baixa o arquivo para o usuário anexar
      downloadPdfBlob(pdfBlob, finalName);
      showToast("Não deu para abrir o compartilhar. PDF baixado — anexe no WhatsApp.", "error");
    }
  });

  overlay.querySelector('[data-pdf-action="share-fallback"]')?.addEventListener("click", async () => {
    // Alguns aparelhos compartilham só texto — ainda assim baixamos o PDF
    try {
      downloadPdfBlob(pdfBlob, finalName);
      if (hasShareApi) {
        await navigator.share({
          title: finalName,
          text: `${shareText || title || "Documento"}\n\n(O PDF foi baixado neste aparelho — anexe no WhatsApp.)`
        });
      }
      showToast("PDF baixado. No WhatsApp, anexe o arquivo baixado.");
    } catch (err) {
      if (err?.name === "AbortError") return;
      showToast("PDF baixado. Abra o WhatsApp e anexe o arquivo.", "error");
    }
  });

  document.body.appendChild(overlay);
  showToast(mobile ? "PDF pronto — use Enviar ou Baixar" : "PDF pronto para baixar ou enviar");
  return true;
}

let pdfMakeLoadPromise = null;

function loadScriptOnce(src, dataKey) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-pdf-lib="${dataKey}"]`);
    if (existing) {
      if (existing.dataset.loaded === "1") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Falha ao carregar ${dataKey}`)), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.pdfLib = dataKey;
    script.onload = () => {
      script.dataset.loaded = "1";
      resolve();
    };
    script.onerror = () => reject(new Error(`Falha ao carregar ${dataKey}`));
    document.head.appendChild(script);
  });
}

/**
 * pdfmake gera PDF por especificação (sem html2canvas).
 * Funciona bem no mobile e suporta acentos (Roboto).
 */
async function ensurePdfMakeLoaded() {
  if (window.pdfMake?.createPdf) return window.pdfMake;
  if (pdfMakeLoadPromise) {
    await pdfMakeLoadPromise;
    if (window.pdfMake?.createPdf) return window.pdfMake;
  }

  pdfMakeLoadPromise = (async () => {
    await loadScriptOnce(
      "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.12/pdfmake.min.js",
      "pdfmake"
    );
    await loadScriptOnce(
      "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.12/vfs_fonts.min.js",
      "pdfmake-vfs"
    );
    // vfs_fonts costuma expor pdfMake.vfs ou window.pdfMake.vfs
    if (window.pdfMake && !window.pdfMake.vfs && window.pdfMake.virtualfs) {
      window.pdfMake.vfs = window.pdfMake.virtualfs;
    }
  })();

  try {
    await pdfMakeLoadPromise;
  } catch (err) {
    pdfMakeLoadPromise = null;
    throw err;
  }

  if (!window.pdfMake?.createPdf) {
    pdfMakeLoadPromise = null;
    throw new Error("Gerador de PDF indisponível");
  }
  return window.pdfMake;
}

/** Pré-carrega o gerador de PDF em background (ex.: ao abrir o modal). */
function preloadHtml2Pdf() {
  ensurePdfMakeLoaded().catch(() => {
    /* silencioso: gera sob demanda se falhar */
  });
}

function isMobileDevice() {
  return (
    window.matchMedia?.("(max-width: 900px)")?.matches ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "") ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function buildDocumentoPdfDefinition(payload) {
  const {
    empresaNome,
    empresaConfig,
    empresaLogoDataUrl,
    cliente,
    dataEmissaoLabel,
    numeroRef,
    itens,
    subtotal,
    observacoes,
    pagamentoTexto,
    bicicleta,
    docLabel,
    geradoEm
  } = payload;

  const tipoLabel = docLabel || "Orçamento";
  const clienteNome = String(cliente?.nome || "Cliente não informado").trim();
  const clienteTel = String(cliente?.telefone || "").trim();
  const clienteEmail = String(cliente?.email || "").trim();
  const cfg = normalizeEmpresaConfig(empresaConfig || {}, empresaNome);
  const brand = cfg.cor_primaria || "#165d59";
  const brandDark = darkenHexColor(brand, 0.28);
  const nomeEmpresa = cfg.nome || empresaNome || "Empresa";
  const muted = "#5f5a50";
  const line = "#ddd2c0";
  const softBg = "#fbf8f2";

  const empresaHeaderStack = [];
  if (empresaLogoDataUrl) {
    empresaHeaderStack.push({
      image: empresaLogoDataUrl,
      width: 88,
      margin: [0, 0, 0, 6]
    });
  }
  empresaHeaderStack.push({ text: String(nomeEmpresa), fontSize: 18, bold: true, color: brandDark });
  empresaHeaderStack.push({ text: `${tipoLabel} para o cliente`, fontSize: 10, color: muted, margin: [0, 4, 0, 0] });
  if (cfg.telefone) {
    empresaHeaderStack.push({ text: `Tel.: ${cfg.telefone}`, fontSize: 9, color: muted, margin: [0, 6, 0, 0] });
  }
  if (cfg.email) {
    empresaHeaderStack.push({ text: `E-mail: ${cfg.email}`, fontSize: 9, color: muted, margin: [0, 2, 0, 0] });
  }
  formatEmpresaEnderecoLinhas(cfg).forEach((linha, idx) => {
    empresaHeaderStack.push({
      text: linha,
      fontSize: 9,
      color: muted,
      margin: [0, idx === 0 && !cfg.telefone && !cfg.email ? 6 : 2, 0, 0]
    });
  });

  const clienteLines = [
    { text: clienteNome, bold: true, fontSize: 11, color: "#1f1e1a" }
  ];
  if (clienteTel) clienteLines.push({ text: `Tel.: ${clienteTel}`, fontSize: 9, color: muted, margin: [0, 2, 0, 0] });
  if (clienteEmail) clienteLines.push({ text: `E-mail: ${clienteEmail}`, fontSize: 9, color: muted, margin: [0, 2, 0, 0] });

  const condicoesLines = [
    {
      text: pagamentoTexto || "Condições comerciais a combinar.",
      fontSize: 10,
      color: "#1f1e1a"
    },
    {
      text: "Documento gerado para análise e aprovação.",
      fontSize: 9,
      color: muted,
      margin: [0, 4, 0, 0]
    }
  ];

  const tableBody = [
    [
      { text: "#", style: "th", alignment: "center" },
      { text: "Descrição", style: "th" },
      { text: "Qtd", style: "th", alignment: "right" },
      { text: "Valor unit.", style: "th", alignment: "right" },
      { text: "Total", style: "th", alignment: "right" }
    ]
  ];

  (itens || []).forEach((item, index) => {
    const qtd = Number(item.quantidade || 0);
    const unit = Number(item.valorUnitario || 0);
    const total = qtd * unit;
    const zebra = index % 2 === 1;
    const cellBg = zebra ? "#faf7f1" : "#ffffff";
    tableBody.push([
      { text: String(index + 1), alignment: "center", fontSize: 9, color: muted, fillColor: cellBg },
      { text: String(item.descricao || "Item"), fontSize: 9, color: "#1f1e1a", fillColor: cellBg },
      { text: formatQtyForPdf(qtd), alignment: "right", fontSize: 9, color: "#1f1e1a", fillColor: cellBg },
      { text: moeda.format(unit), alignment: "right", fontSize: 9, color: "#1f1e1a", fillColor: cellBg },
      { text: moeda.format(total), alignment: "right", fontSize: 9, color: "#1f1e1a", fillColor: cellBg }
    ]);
  });

  if ((itens || []).length === 0) {
    tableBody.push([
      { text: "Nenhum item informado.", colSpan: 5, alignment: "center", fontSize: 9, color: muted, margin: [0, 6, 0, 6] },
      {},
      {},
      {},
      {}
    ]);
  }

  const content = [
    {
      columns: [
        {
          width: "*",
          stack: empresaHeaderStack
        },
        {
          width: 150,
          alignment: "right",
          stack: [
            {
              table: {
                widths: ["*"],
                body: [[{
                  text: tipoLabel.toUpperCase(),
                  fontSize: 9,
                  bold: true,
                  color: "#ffffff",
                  fillColor: brand,
                  alignment: "center",
                  margin: [4, 3, 4, 3]
                }]]
              },
              layout: "noBorders",
              margin: [0, 0, 0, 6]
            },
            { text: "Referência", fontSize: 8, color: muted },
            { text: String(numeroRef || "-"), fontSize: 11, bold: true, color: "#1f1e1a", margin: [0, 1, 0, 6] },
            { text: "Emissão", fontSize: 8, color: muted },
            { text: String(dataEmissaoLabel || "-"), fontSize: 11, bold: true, color: "#1f1e1a", margin: [0, 1, 0, 0] }
          ]
        }
      ],
      margin: [0, 0, 0, 8]
    },
    {
      canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: brand }],
      margin: [0, 0, 0, 14]
    },
    {
      columns: [
        {
          width: "*",
          table: {
            widths: ["*"],
            body: [[{
              stack: [
                { text: "CLIENTE", fontSize: 9, bold: true, color: brand, margin: [0, 0, 0, 6] },
                ...clienteLines
              ],
              fillColor: softBg
            }]]
          },
          layout: {
            hLineWidth: () => 1,
            vLineWidth: () => 1,
            hLineColor: () => line,
            vLineColor: () => line,
            paddingLeft: () => 8,
            paddingRight: () => 8,
            paddingTop: () => 8,
            paddingBottom: () => 8
          }
        },
        {
          width: "*",
          table: {
            widths: ["*"],
            body: [[{
              stack: [
                { text: "CONDIÇÕES", fontSize: 9, bold: true, color: brand, margin: [0, 0, 0, 6] },
                ...condicoesLines
              ],
              fillColor: softBg
            }]]
          },
          layout: {
            hLineWidth: () => 1,
            vLineWidth: () => 1,
            hLineColor: () => line,
            vLineColor: () => line,
            paddingLeft: () => 8,
            paddingRight: () => 8,
            paddingTop: () => 8,
            paddingBottom: () => 8
          }
        }
      ],
      columnGap: 10,
      margin: [0, 0, 0, 12]
    }
  ];

  {
    const extra = buildDocExtraPdfLines(bicicleta, payload.docExtraMeta || null);
    if (extra.lines.length) {
      content.push({
        table: {
          widths: ["*"],
          body: [[{
            stack: [
              {
                text: String(extra.titulo || "Dados adicionais").toUpperCase(),
                fontSize: 9,
                bold: true,
                color: brand,
                margin: [0, 0, 0, 6]
              },
              {
                text: extra.lines.map((line) => `${line.label}: ${line.value}`).join("\n"),
                fontSize: 10,
                color: "#1f1e1a"
              }
            ],
            fillColor: softBg
          }]]
        },
        layout: {
          hLineWidth: () => 1,
          vLineWidth: () => 1,
          hLineColor: () => line,
          vLineColor: () => line,
          paddingLeft: () => 10,
          paddingRight: () => 10,
          paddingTop: () => 8,
          paddingBottom: () => 8
        },
        margin: [0, 0, 0, 12]
      });
    }
  }

  content.push({
    table: {
      headerRows: 1,
      widths: [22, "*", 40, 70, 70],
      body: tableBody
    },
    layout: {
      hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length ? 0.8 : 0.4),
      vLineWidth: () => 0,
      hLineColor: (i) => (i <= 1 ? brand : "#e8dfd0"),
      paddingLeft: () => 6,
      paddingRight: () => 6,
      paddingTop: () => 6,
      paddingBottom: () => 6,
      fillColor: (rowIndex) => (rowIndex === 0 ? brand : null)
    },
    margin: [0, 0, 0, 12]
  });

  content.push({
    columns: [
      { width: "*", text: "" },
      {
        width: 200,
        table: {
          widths: ["*", "auto"],
          body: [[
            { text: "Total", bold: true, color: "#ffffff", fontSize: 12 },
            { text: moeda.format(subtotal || 0), bold: true, color: "#ffffff", fontSize: 12, alignment: "right" }
          ]]
        },
        layout: {
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingLeft: () => 12,
          paddingRight: () => 12,
          paddingTop: () => 10,
          paddingBottom: () => 10,
          fillColor: () => brand
        }
      }
    ],
    margin: [0, 0, 0, 16]
  });

  if (observacoes) {
    content.push({
      stack: [
        { text: "OBSERVAÇÕES", fontSize: 9, bold: true, color: brand, margin: [0, 0, 0, 4] },
        { text: String(observacoes), fontSize: 10, color: "#3b372f" }
      ],
      margin: [0, 0, 0, 12]
    });
  }

  if (cfg.pdf_termos) {
    const termosLines = String(cfg.pdf_termos)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, idx) => ({
        text: line,
        fontSize: 9,
        color: "#3b372f",
        margin: [0, idx === 0 ? 0 : 2, 0, 0]
      }));
    if (termosLines.length) {
      content.push({
        stack: [
          { text: "TERMOS E CONDIÇÕES", fontSize: 9, bold: true, color: brand, margin: [0, 0, 0, 6] },
          ...termosLines
        ],
        margin: [0, 0, 0, 12]
      });
    }
  }

  if (cfg.pdf_aviso) {
    content.push({
      table: {
        widths: ["*"],
        body: [[{
          stack: [
            { text: "ATENÇÃO", fontSize: 9, bold: true, color: "#8a2f2f", margin: [0, 0, 0, 4] },
            { text: String(cfg.pdf_aviso), fontSize: 9, color: "#5a3030" }
          ],
          fillColor: "#fff5f5"
        }]]
      },
      layout: {
        hLineWidth: () => 1,
        vLineWidth: () => 1,
        hLineColor: () => "#e2b4b4",
        vLineColor: () => "#e2b4b4",
        paddingLeft: () => 10,
        paddingRight: () => 10,
        paddingTop: () => 8,
        paddingBottom: () => 8
      },
      margin: [0, 0, 0, 14]
    });
  }

  content.push({
    columns: [
      {
        width: "*",
        stack: [
          { canvas: [{ type: "line", x1: 0, y1: 0, x2: 220, y2: 0, lineWidth: 0.8, lineColor: "#9f9687" }], margin: [0, 24, 0, 6] },
          { text: "Assinatura do cliente", alignment: "center", fontSize: 9, color: muted },
          { text: "Data: ____/____/________", alignment: "center", fontSize: 9, color: muted, margin: [0, 4, 0, 0] }
        ]
      },
      {
        width: "*",
        stack: [
          { canvas: [{ type: "line", x1: 0, y1: 0, x2: 220, y2: 0, lineWidth: 0.8, lineColor: "#9f9687" }], margin: [0, 24, 0, 6] },
          { text: "Assinatura da empresa", alignment: "center", fontSize: 9, color: muted },
          { text: String(nomeEmpresa || ""), alignment: "center", fontSize: 9, color: muted, margin: [0, 4, 0, 0] }
        ]
      }
    ],
    columnGap: 24,
    margin: [0, 8, 0, 20]
  });

  content.push({
    text: `Gerado em ${geradoEm || ""} · Documento não fiscal · Válido para aprovação comercial`,
    alignment: "center",
    fontSize: 8,
    color: "#7a7468"
  });

  return {
    pageSize: "A4",
    pageMargins: [36, 36, 36, 40],
    defaultStyle: {
      font: "Roboto",
      fontSize: 10,
      color: "#1f1e1a"
    },
    styles: {
      th: {
        bold: true,
        fontSize: 9,
        color: "#ffffff"
      }
    },
    content
  };
}

function createPdfBlobFromDefinition(docDefinition) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (err, blob) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) reject(err);
      else resolve(blob);
    };

    const timer = setTimeout(() => {
      finish(new Error("Tempo esgotado ao montar o PDF no aparelho"));
    }, 20000);

    try {
      const pdfMakeApi = window.pdfMake || window.pdfmake;
      if (!pdfMakeApi?.createPdf) {
        finish(new Error("Gerador de PDF não carregou"));
        return;
      }
      const pdf = pdfMakeApi.createPdf(docDefinition);
      pdf.getBlob((blob) => {
        if (!(blob instanceof Blob) || blob.size < 200) {
          finish(new Error("PDF gerado está vazio ou inválido"));
          return;
        }
        // Garante MIME correto no mobile (alguns browsers devolvem application/octet-stream)
        if (blob.type && blob.type !== "application/pdf") {
          finish(null, new Blob([blob], { type: "application/pdf" }));
          return;
        }
        finish(null, blob);
      });
    } catch (err) {
      finish(err instanceof Error ? err : new Error(String(err || "Erro ao gerar PDF")));
    }
  });
}

/**
 * Gera PDF a partir de um pedido/orçamento salvo (lista de ações),
 * sem abrir o modal de edição e sem sobrescrever o rascunho pelo formulário.
 */
async function generateDocumentoPdfById(tipo, documentoId) {
  const id = Number(documentoId);
  if (!Number.isFinite(id) || id <= 0) {
    showToast("Documento inválido para PDF.", "error");
    return;
  }
  showToast("Preparando PDF...");
  await Promise.all([ensureClientesLoaded(), ensureProdutosLoaded()]);
  await loadDocumentoForEdit(tipo, id);
  await generateDocumentoOrcamentoPdf({ skipFormSync: true });
}

/**
 * Gera PDF real (pdfmake) e abre a tela de exportação (Enviar / Baixar).
 * No celular: Enviar PDF → WhatsApp quando o aparelho permitir.
 */
async function generateDocumentoOrcamentoPdf(options = {}) {
  if (!options.skipFormSync) {
    syncNovoDocumentoDraftFromForm();
  }

  const itens = getDocumentoItensPayload();
  if (!itens.length) {
    showToast("Adicione ao menos um item antes de gerar o PDF.", "error");
    return;
  }

  const btn = els.novoDocumentoPdfBtn;
  const btnLabel = btn?.textContent || "PDF";
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Gerando...";
  }

  let cliente = null;
  let dataEmissaoLabel = "";
  let numeroRef = "";
  let fileTitle = "";
  let fileName = "";
  let shareText = "";
  let subtotal = 0;
  let isPedido = false;
  let bicicleta = null;
  let pdfPayload = null;

  try {
    const [, resolvedCliente] = await Promise.all([
      ensurePdfMakeLoaded(),
      resolveClienteForPdf()
    ]);

    cliente = resolvedCliente;
    if (!cliente || !String(state.novoDocumentoModal.clienteId || "").trim()) {
      showToast("Selecione o cliente antes de gerar o PDF.", "error");
      return;
    }
    if (!String(cliente.nome || "").trim()) {
      showToast("Cliente sem nome cadastrado. Atualize o cadastro e tente de novo.", "error");
      return;
    }

    const dataEmissao = state.novoDocumentoModal.dataEmissao || formatDateInput(new Date());
    const dataEmissaoDate = parseDateInput(dataEmissao) || new Date();
    dataEmissaoLabel = dataEmissaoDate.toLocaleDateString("pt-BR");
    subtotal = itens.reduce(
      (sum, item) => sum + Number(item.quantidade || 0) * Number(item.valorUnitario || 0),
      0
    );
    const docId = state.novoDocumentoModal.documentoId;
    isPedido = state.novoDocumentoModal.tipo === "pedido";
    numeroRef = docId
      ? `${isPedido ? "PED" : "ORC"}-${String(docId).padStart(6, "0")}`
      : `${isPedido ? "PED" : "ORC"}-RASCUNHO-${dataEmissaoDate.toISOString().slice(0, 10).replace(/-/g, "")}`;
    const clienteSlug = String(cliente.nome || "cliente")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "cliente";
    fileTitle = `${isPedido ? "Pedido" : "Orcamento"}-${clienteSlug}-${dataEmissaoLabel.replace(/\//g, "-")}`;
    fileName = `${fileTitle}.pdf`;
    shareText = `${isPedido ? "Pedido" : "Orçamento"} ${numeroRef} — ${cliente.nome || ""}`.trim();
    bicicleta = createDocExtraDraft(state.novoDocumentoModal.bicicleta);
    const empresaCfg = getEmpresaConfig();
    const logoUrl = resolveProdutoImageUrl(empresaCfg.logo_path);
    const empresaLogoDataUrl = logoUrl ? await imageUrlToDataUrl(logoUrl) : "";
    const docExtraCfg = getDocExtraConfig();
    const savedExtra = state.novoDocumentoModal?.rawPayloadBase?.doc_extra;
    const docExtraMeta =
      savedExtra && Array.isArray(savedExtra.campos) && savedExtra.campos.length
        ? {
            titulo: savedExtra.titulo || docExtraCfg.titulo,
            campos: savedExtra.campos.map((c) =>
              createDocExtraCampo({
                ...c,
                tipo: c.tipo || "text",
                ativo: c.ativo !== false
              })
            )
          }
        : {
            titulo: docExtraCfg.titulo,
            campos: getActiveDocExtraCampos(docExtraCfg, "pdf")
          };

    pdfPayload = {
      empresaNome: empresaCfg.nome || state.empresaNome || saasName || "Empresa",
      empresaConfig: empresaCfg,
      empresaLogoDataUrl: empresaLogoDataUrl || "",
      cliente,
      dataEmissaoLabel,
      numeroRef,
      itens,
      subtotal,
      observacoes: String(state.novoDocumentoModal.observacoes || "").trim(),
      pagamentoTexto: getPagamentoResumoTextoParaPdf(),
      bicicleta:
        (docExtraCfg.pdf || docExtraMeta.campos.length) && isDocExtraFilled(bicicleta)
          ? bicicleta
          : null,
      docExtraMeta,
      docLabel: isPedido ? "Pedido" : "Orçamento",
      geradoEm: new Date().toLocaleString("pt-BR"),
      fileTitle,
      autoPrint: false
    };

    if (btn) btn.textContent = "Montando PDF...";
    const definition = buildDocumentoPdfDefinition(pdfPayload);
    const blob = await createPdfBlobFromDefinition(definition);
    const previewHtml = buildOrcamentoPdfHtml(pdfPayload);

    openPdfViewerModal({
      blob,
      fileName,
      title: `${isPedido ? "Pedido" : "Orçamento"} ${numeroRef}`,
      shareText,
      previewHtml
    });
  } catch (error) {
    console.warn("Falha ao gerar PDF, usando prévia HTML", error);
    const fallbackCfg = getEmpresaConfig();
    const fallbackPayload = pdfPayload || {
      empresaNome: fallbackCfg.nome || state.empresaNome || saasName || "Empresa",
      empresaConfig: fallbackCfg,
      empresaLogoDataUrl: "",
      cliente: cliente || { nome: els.novoDocumentoClienteLabel?.textContent || "Cliente" },
      dataEmissaoLabel: dataEmissaoLabel || new Date().toLocaleDateString("pt-BR"),
      numeroRef: numeroRef || "DOC",
      itens,
      subtotal: subtotal || itens.reduce(
        (sum, item) => sum + Number(item.quantidade || 0) * Number(item.valorUnitario || 0),
        0
      ),
      observacoes: String(state.novoDocumentoModal.observacoes || "").trim(),
      pagamentoTexto: getPagamentoResumoTextoParaPdf(),
      bicicleta: bicicleta && isDocExtraFilled(bicicleta) ? bicicleta : null,
      docExtraMeta: {
        titulo: getDocExtraConfig().titulo,
        campos: getActiveDocExtraCampos(getDocExtraConfig(), "pdf")
      },
      docLabel: state.novoDocumentoModal.tipo === "pedido" ? "Pedido" : "Orçamento",
      geradoEm: new Date().toLocaleString("pt-BR"),
      fileTitle: fileTitle || "Documento",
      autoPrint: false
    };
    // Mesmo no fallback, tenta montar o modal se já houver payload; senão abre HTML legado
    if (pdfPayload) {
      try {
        await ensurePdfMakeLoaded();
        const blob = await createPdfBlobFromDefinition(buildDocumentoPdfDefinition(pdfPayload));
        openPdfViewerModal({
          blob,
          fileName: fileName || "documento.pdf",
          title: `${isPedido ? "Pedido" : "Orçamento"} ${numeroRef || ""}`.trim(),
          shareText: shareText || "",
          previewHtml: buildOrcamentoPdfHtml(pdfPayload)
        });
        return;
      } catch (retryErr) {
        console.warn("Retry PDF falhou", retryErr);
      }
    }
    if (openOrcamentoHtmlPreview(buildOrcamentoPdfHtml(fallbackPayload))) {
      showToast("Prévia aberta. Se o PDF falhar, use Imprimir do navegador como última opção.");
    } else {
      showToast(`Não foi possível gerar o PDF: ${error?.message || "erro desconhecido"}`, "error");
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = btnLabel;
    }
  }
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
    const docExtraValores = readDocExtraFromForm();
    draft.bicicleta = docExtraValores;
    const docExtraCfg = getDocExtraConfig();

    const rawPayload = {
      ...rawPayloadBase,
      source: draft.convertidoDeOrcamentoId ? "conversao-orcamento" : "novo-documento-modal",
      itens: itens.length,
      pagamento: pagamentoState
    };
    // Campos extras configuráveis (legado: bicicleta).
    const formWhere = getDocExtraFormWhereForTipo(draft.tipo);
    const hasAnyExtraTarget =
      docExtraCfg.form_pedido ||
      docExtraCfg.form_orcamento ||
      docExtraCfg.pdf ||
      docExtraCfg.resumo;
    if (hasAnyExtraTarget && isDocExtraFilled(docExtraValores)) {
      const snapshotCampos = (docExtraCfg.campos || [])
        .filter((c) => c.ativo && c.id && c.label)
        .map((c) => ({
          id: c.id,
          label: c.label,
          tipo: c.tipo,
          form_pedido: c.form_pedido !== false,
          form_orcamento: c.form_orcamento !== false,
          pdf: c.pdf !== false,
          resumo: c.resumo !== false,
          ativo: true
        }));
      rawPayload.doc_extra = {
        titulo: docExtraCfg.titulo || "Dados adicionais",
        form_pedido: docExtraCfg.form_pedido !== false,
        form_orcamento: docExtraCfg.form_orcamento !== false,
        pdf: docExtraCfg.pdf !== false,
        resumo: docExtraCfg.resumo !== false,
        campos: snapshotCampos,
        valores: docExtraValores,
        preenchido_em: formWhere
      };
      // Espelho legado para documentos antigos / relatórios
      rawPayload.bicicleta = docExtraValores;
    } else {
      delete rawPayload.doc_extra;
      delete rawPayload.bicicleta;
    }
    // Snapshot da calculadora (historico da decisao comercial no pedido/orcamento).
    if (draft.precoFormacaoAplicada) {
      rawPayload.preco_formacao = draft.precoFormacaoAplicada;
    }
    // Foto do pedido (câmera/galeria ou legado)
    if (draft.fotoUrl) {
      rawPayload.foto_url = draft.fotoUrl;
    } else {
      delete rawPayload.foto_url;
    }
    // Rastreio da conversão orçamento → pedido
    if (draft.convertidoDeOrcamentoId && draft.tipo === "pedido") {
      rawPayload.orcamento_origem_id = Number(draft.convertidoDeOrcamentoId);
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

    // Conversão: marca orçamento de origem como aprovado e vincula o pedido.
    let conversaoMsg = "";
    if (!isEdit && draft.tipo === "pedido" && draft.convertidoDeOrcamentoId) {
      try {
        await markOrcamentoAsConverted(draft.convertidoDeOrcamentoId, documentoId);
        conversaoMsg = ` Orçamento #${draft.convertidoDeOrcamentoId} marcado como aprovado.`;
      } catch (convError) {
        console.error("Falha ao atualizar orçamento convertido", convError);
        showToast(
          `Pedido #${documentoId} salvo, mas não foi possível atualizar o orçamento: ${convError.message}`,
          "error"
        );
      }
    }

    closeNovoDocumentoModal();
    state.novoDocumentoModal = createDocumentoDraft("pedido");
    if (els.novoDocumentoClienteSearch) {
      els.novoDocumentoClienteSearch.value = "";
    }
    if (conversaoMsg) {
      showToast(`Pedido #${documentoId} criado a partir do orçamento.${conversaoMsg}`);
    } else {
      showToast(
        draft.tipo === "orcamento"
          ? isEdit
            ? "Orcamento atualizado"
            : "Orcamento salvo"
          : isEdit
            ? "Pedido atualizado"
            : "Pedido salvo"
      );
    }
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
        const id = escapeHtml(pedido.id);
        const actions = renderRowActionsMenu(
          [
            { label: "Editar", attrs: `data-edit-pedido="${id}"` },
            { label: "PDF", attrs: `data-pdf-pedido="${id}"` },
            { label: "Itens", attrs: `data-view-pedido-itens="${id}"` }
          ],
          { label: `Acoes do pedido #${id}` }
        );
        return `
          <tr>
            <td class="pedido-actions-cell">${actions}</td>
            <td class="pedido-cell-id">
              <button type="button" class="pedido-cell-id-btn" data-pedido-operacoes="${id}" title="Ver status das operações do pedido #${id}">
                ${renderPedidoThumbHtml(pedido)}
                <span>#${id}</span>
              </button>
            </td>
            <td>${data}</td>
            <td>${escapeHtml(pedido.status || "-")}</td>
            <td>${moeda.format(pedido.valor_total || 0)}</td>
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
  // Se já está na lista de pedidos do cliente (ou detalhe por produto), "Fechar" deve voltar para lá.
  const modalOpen = isItensDocumentoModalOpen();
  const fromMode = state.itensDocumentoModalMode;
  if (modalOpen && fromMode === "cliente_pedidos" && state.itensDocumentoClienteId) {
    state.itensDocumentoReturnTo = {
      mode: "cliente_pedidos",
      clienteId: Number(state.itensDocumentoClienteId)
    };
  } else if (modalOpen && fromMode === "pedidos_produto" && state.itensDocumentoProdutoGroupKey) {
    state.itensDocumentoReturnTo = {
      mode: "pedidos_produto",
      groupKey: state.itensDocumentoProdutoGroupKey
    };
  } else {
    state.itensDocumentoReturnTo = null;
  }

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
  if (els.itensDocumentoModalSubtitle) {
    const bike = extractDocExtraFromPayload(documentoData?.raw_payload || null);
    const extraPdf = buildDocExtraPdfLines(
      bike,
      documentoData?.raw_payload?.doc_extra || null,
      "resumo"
    );
    if (extraPdf.lines.length) {
      const parts = extraPdf.lines.map((line) => `${line.label}: ${line.value}`);
      els.itensDocumentoModalSubtitle.textContent = parts.join(" · ");
      els.itensDocumentoModalSubtitle.classList.remove("hidden");
    } else if (!state.itensDocumentoReturnTo) {
      els.itensDocumentoModalSubtitle.textContent = "";
      els.itensDocumentoModalSubtitle.classList.add("hidden");
    }
  }
  if (els.closeItensDocumentoModalBtn) {
    els.closeItensDocumentoModalBtn.textContent = state.itensDocumentoReturnTo ? "Voltar" : "Fechar";
  }
  renderItensDocumentoTableHead();
  renderItensDocumentoTable();
  updateItensDocumentoModalChrome();
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
      els.produtoModalSubtitle.textContent = "Cadastre o item e, se quiser, adicione uma foto pela câmera ou galeria.";
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
  if (els.fabNovoPedidoBtn) {
    els.fabNovoPedidoBtn.classList.toggle("hidden", !isLogged);
  }
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

const EMPRESA_CONFIG_DEFAULTS = {
  nome: "GuPedal",
  telefone: "51 99208 7070",
  email: "",
  endereco: "Rua 1 Setor 1 Quadra F Loja 01",
  bairro: "Guajuviras",
  cidade: "Canoas",
  uf: "RS",
  logo_path: "",
  cor_primaria: "#165d59",
  pdf_termos:
    "1 - Condição de Pagamento\n2 - Orçamento válido por 5 dias\n3 - Após finalizado o serviço, o prazo de retirada é de no MÁXIMO 5 DIAS",
  pdf_aviso:
    "Atenção, cliente! Conforme acordo prévio, caso você não retire a bicicleta consertada e efetue o pagamento do orçamento autorizado dentro de 30 dias, a bicicleta será vendida para ressarcimento dos custos à oficina. Por favor, verifique o status do conserto e regularize sua situação conosco",
  doc_extra_config: cloneDocExtraConfig(DOC_EXTRA_BIKE_PRESET)
};

const EMPRESA_CONFIG_SELECT_FULL =
  "empresa_id, role, empresas(id, nome, telefone, email, endereco, bairro, cidade, uf, logo_path, cor_primaria, pdf_termos, pdf_aviso, doc_extra_config)";
const EMPRESA_CONFIG_SELECT_BASIC = "empresa_id, role, empresas(id, nome)";

function createEmptyEmpresaConfig(overrides = {}) {
  return {
    nome: "",
    telefone: "",
    email: "",
    endereco: "",
    bairro: "",
    cidade: "",
    uf: "",
    logo_path: "",
    cor_primaria: "#165d59",
    pdf_termos: "",
    pdf_aviso: "",
    doc_extra_config: cloneDocExtraConfig(DOC_EXTRA_BIKE_PRESET),
    ...overrides
  };
}

function normalizeEmpresaConfig(raw, fallbackNome = "") {
  const src = raw && typeof raw === "object" ? raw : {};
  const cor = String(src.cor_primaria || "").trim();
  return createEmptyEmpresaConfig({
    nome: String(src.nome || fallbackNome || "").trim(),
    telefone: String(src.telefone || "").trim(),
    email: String(src.email || "").trim(),
    endereco: String(src.endereco || "").trim(),
    bairro: String(src.bairro || "").trim(),
    cidade: String(src.cidade || "").trim(),
    uf: String(src.uf || "").trim().toUpperCase().slice(0, 2),
    logo_path: String(src.logo_path || "").trim(),
    cor_primaria: /^#[0-9a-fA-F]{6}$/.test(cor) ? cor : "#165d59",
    pdf_termos: String(src.pdf_termos || "").trim(),
    pdf_aviso: String(src.pdf_aviso || "").trim(),
    doc_extra_config: normalizeDocExtraConfig(
      src.doc_extra_config != null ? src.doc_extra_config : DOC_EXTRA_BIKE_PRESET
    )
  });
}

/** Estado temporário do editor de campos extras na tela de configurações. */
let docExtraEditorState = cloneDocExtraConfig(DOC_EXTRA_BIKE_PRESET);

function readDocExtraEditorFromDom() {
  const titulo = String(els.empresaDocExtraTitulo?.value || "").trim() || "Dados adicionais";
  const hint = String(els.empresaDocExtraHint?.value || "").trim();
  const form_pedido = Boolean(els.empresaDocExtraFormPedido?.checked);
  const form_orcamento = Boolean(els.empresaDocExtraFormOrcamento?.checked);
  const pdf = Boolean(els.empresaDocExtraPdf?.checked);
  const resumo = Boolean(els.empresaDocExtraResumo?.checked);
  const rows = Array.from(els.docExtraCamposEditor?.querySelectorAll("[data-doc-extra-row]") || []);
  const campos = rows.map((row, idx) => {
    const label = String(row.querySelector("[data-field='label']")?.value || "").trim();
    const tipo = row.querySelector("[data-field='tipo']")?.value === "textarea" ? "textarea" : "text";
    const existingId = String(row.getAttribute("data-campo-id") || "").trim();
    const id = existingId || slugifyDocExtraFieldId(label) || `campo_${idx + 1}`;
    const placeholder = String(row.querySelector("[data-field='placeholder']")?.value || "").trim();
    const cFormPedido = Boolean(row.querySelector("[data-field='form_pedido']")?.checked);
    const cFormOrc = Boolean(row.querySelector("[data-field='form_orcamento']")?.checked);
    const cPdf = Boolean(row.querySelector("[data-field='pdf']")?.checked);
    const cResumo = Boolean(row.querySelector("[data-field='resumo']")?.checked);
    return createDocExtraCampo({
      id,
      label: label || id,
      tipo,
      placeholder,
      ativo: cFormPedido || cFormOrc || cPdf || cResumo,
      form_pedido: cFormPedido,
      form_orcamento: cFormOrc,
      pdf: cPdf,
      resumo: cResumo
    });
  }).filter((c) => c.label);
  return normalizeDocExtraConfig({
    titulo,
    hint,
    form_pedido,
    form_orcamento,
    pdf,
    resumo,
    ativo: form_pedido || form_orcamento || pdf || resumo,
    campos
  });
}

function renderDocExtraCamposEditor(config = null) {
  docExtraEditorState = normalizeDocExtraConfig(config || docExtraEditorState);
  if (els.empresaDocExtraFormPedido) {
    els.empresaDocExtraFormPedido.checked = docExtraEditorState.form_pedido !== false;
  }
  if (els.empresaDocExtraFormOrcamento) {
    els.empresaDocExtraFormOrcamento.checked = docExtraEditorState.form_orcamento !== false;
  }
  if (els.empresaDocExtraPdf) {
    els.empresaDocExtraPdf.checked = docExtraEditorState.pdf !== false;
  }
  if (els.empresaDocExtraResumo) {
    els.empresaDocExtraResumo.checked = docExtraEditorState.resumo !== false;
  }
  if (els.empresaDocExtraTitulo) els.empresaDocExtraTitulo.value = docExtraEditorState.titulo || "";
  if (els.empresaDocExtraHint) els.empresaDocExtraHint.value = docExtraEditorState.hint || "";
  if (!els.docExtraCamposEditor) return;

  if (!docExtraEditorState.campos.length) {
    els.docExtraCamposEditor.innerHTML =
      '<p class="doc-extra-campos-empty">Nenhum campo. Use “Adicionar campo” ou “Modelo oficina de bikes”.</p>';
    return;
  }

  els.docExtraCamposEditor.innerHTML = docExtraEditorState.campos
    .map(
      (campo, index) => `
      <div class="doc-extra-campo-row" data-doc-extra-row data-campo-id="${escapeHtml(campo.id)}">
        <label>
          Nome do campo
          <input data-field="label" type="text" value="${escapeHtml(campo.label)}" placeholder="Ex.: Marca, Placa, Modelo" />
        </label>
        <label>
          Tipo
          <select data-field="tipo">
            <option value="text" ${campo.tipo !== "textarea" ? "selected" : ""}>Texto</option>
            <option value="textarea" ${campo.tipo === "textarea" ? "selected" : ""}>Texto longo</option>
          </select>
        </label>
        <button type="button" class="btn btn-ghost documento-foto-btn--danger" data-doc-extra-remove="${index}">Remover</button>
        <label class="produto-form-field-full" style="grid-column: 1 / -1">
          Placeholder (opcional)
          <input data-field="placeholder" type="text" value="${escapeHtml(campo.placeholder || "")}" placeholder="Texto de exemplo no campo" />
        </label>
        <div class="doc-extra-campo-where">
          <span>Onde este campo aparece</span>
          <label><input data-field="form_pedido" type="checkbox" ${campo.form_pedido !== false ? "checked" : ""} /> Formulário pedido</label>
          <label><input data-field="form_orcamento" type="checkbox" ${campo.form_orcamento !== false ? "checked" : ""} /> Formulário orçamento</label>
          <label><input data-field="pdf" type="checkbox" ${campo.pdf !== false ? "checked" : ""} /> PDF</label>
          <label><input data-field="resumo" type="checkbox" ${campo.resumo !== false ? "checked" : ""} /> Resumo de itens</label>
        </div>
      </div>`
    )
    .join("");
}

function addDocExtraCampoEditor() {
  docExtraEditorState = readDocExtraEditorFromDom();
  const n = docExtraEditorState.campos.length + 1;
  docExtraEditorState.campos.push(
    createDocExtraCampo({
      id: `campo_${Date.now().toString(36)}`,
      label: `Campo ${n}`,
      tipo: "text",
      placeholder: "",
      form_pedido: true,
      form_orcamento: true,
      pdf: true,
      resumo: true
    })
  );
  docExtraEditorState.form_pedido = true;
  docExtraEditorState.form_orcamento = true;
  renderDocExtraCamposEditor(docExtraEditorState);
}

function removeDocExtraCampoEditor(index) {
  docExtraEditorState = readDocExtraEditorFromDom();
  docExtraEditorState.campos = docExtraEditorState.campos.filter((_, i) => i !== Number(index));
  renderDocExtraCamposEditor(docExtraEditorState);
}

function applyDocExtraBikePreset() {
  docExtraEditorState = cloneDocExtraConfig(DOC_EXTRA_BIKE_PRESET);
  renderDocExtraCamposEditor(docExtraEditorState);
  showToast("Modelo de oficina de bikes aplicado. Salve para confirmar.");
}

function clearDocExtraEditor() {
  docExtraEditorState = normalizeDocExtraConfig({
    titulo: "Dados adicionais",
    hint: "",
    form_pedido: false,
    form_orcamento: false,
    pdf: false,
    resumo: false,
    campos: []
  });
  renderDocExtraCamposEditor(docExtraEditorState);
  showToast("Campos personalizados desativados. Salve para confirmar.");
}

function getEmpresaConfig() {
  return normalizeEmpresaConfig(state.empresaConfig, state.empresaNome);
}

function formatEmpresaEnderecoLinhas(config) {
  const cfg = config || getEmpresaConfig();
  const linhas = [];
  if (cfg.endereco) linhas.push(cfg.endereco);
  if (cfg.bairro) linhas.push(`Bairro ${cfg.bairro}`);
  const cidadeUf = [cfg.cidade, cfg.uf].filter(Boolean).join("-");
  if (cidadeUf) linhas.push(cidadeUf);
  return linhas;
}

function updateEmpresaLogoPreview() {
  const path = els.empresaLogoPathInput?.value || state.empresaConfig?.logo_path || "";
  const url = resolveProdutoImageUrl(path);
  if (els.empresaLogoPreview) {
    if (url) {
      els.empresaLogoPreview.src = url;
      els.empresaLogoPreview.classList.remove("hidden");
    } else {
      els.empresaLogoPreview.removeAttribute("src");
      els.empresaLogoPreview.classList.add("hidden");
    }
  }
  if (els.empresaLogoEmpty) {
    els.empresaLogoEmpty.classList.toggle("hidden", Boolean(url));
  }
  if (els.empresaLogoRemoverBtn) {
    els.empresaLogoRemoverBtn.classList.toggle("hidden", !path);
  }
}

function fillEmpresaConfigForm(config) {
  const cfg = normalizeEmpresaConfig(config, state.empresaNome);
  if (!els.empresaConfigForm) return;
  const setVal = (name, value) => {
    const field = els.empresaConfigForm.elements.namedItem(name);
    if (field && "value" in field) field.value = value == null ? "" : String(value);
  };
  setVal("nome", cfg.nome);
  setVal("telefone", cfg.telefone);
  setVal("email", cfg.email);
  setVal("endereco", cfg.endereco);
  setVal("bairro", cfg.bairro);
  setVal("cidade", cfg.cidade);
  setVal("uf", cfg.uf);
  setVal("logo_path", cfg.logo_path);
  setVal("cor_primaria", cfg.cor_primaria || "#165d59");
  setVal("pdf_termos", cfg.pdf_termos);
  setVal("pdf_aviso", cfg.pdf_aviso);
  if (els.empresaLogoPathInput) els.empresaLogoPathInput.value = cfg.logo_path || "";
  if (els.empresaCorPrimariaInput) els.empresaCorPrimariaInput.value = cfg.cor_primaria || "#165d59";
  renderDocExtraCamposEditor(cfg.doc_extra_config);
  updateEmpresaLogoPreview();
}

function readEmpresaConfigFromForm() {
  if (!els.empresaConfigForm) return getEmpresaConfig();
  const fd = new FormData(els.empresaConfigForm);
  return normalizeEmpresaConfig({
    nome: fd.get("nome"),
    telefone: fd.get("telefone"),
    email: fd.get("email"),
    endereco: fd.get("endereco"),
    bairro: fd.get("bairro"),
    cidade: fd.get("cidade"),
    uf: fd.get("uf"),
    logo_path: fd.get("logo_path") || els.empresaLogoPathInput?.value || "",
    cor_primaria: fd.get("cor_primaria") || els.empresaCorPrimariaInput?.value || "#165d59",
    pdf_termos: fd.get("pdf_termos"),
    pdf_aviso: fd.get("pdf_aviso"),
    doc_extra_config: readDocExtraEditorFromDom()
  }, state.empresaNome);
}

function applyEmpresaConfigPadraoGuPedal() {
  const current = readEmpresaConfigFromForm();
  fillEmpresaConfigForm({
    ...EMPRESA_CONFIG_DEFAULTS,
    logo_path: current.logo_path || "",
    cor_primaria: current.cor_primaria || EMPRESA_CONFIG_DEFAULTS.cor_primaria,
    doc_extra_config: cloneDocExtraConfig(DOC_EXTRA_BIKE_PRESET)
  });
  showToast("Modelo GuPedal preenchido. Revise e salve.");
}

async function uploadEmpresaLogoFile(file) {
  if (!supabaseClient) throw new Error("Supabase não configurado");
  if (!state.empresaId) throw new Error("Empresa não selecionada");
  if (!(file instanceof File) && !(file instanceof Blob)) {
    throw new Error("Selecione uma imagem válida");
  }
  const compressed = await compressImageFile(file);
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 8);
  const objectPath = `${state.empresaId}/brand/logo-${stamp}-${rand}.jpg`;

  const { error } = await supabaseClient.storage
    .from("produto-images")
    .upload(objectPath, compressed, {
      contentType: "image/jpeg",
      upsert: true,
      cacheControl: "3600"
    });
  if (error) throw new Error(error.message || "Falha ao enviar o logo");
  return `produto-images/${objectPath}`;
}

async function handleEmpresaLogoSelected(fileList) {
  const file = fileList?.[0];
  if (!file) return;
  if (!String(file.type || "").startsWith("image/")) {
    showToast("Selecione um arquivo de imagem.", "error");
    return;
  }
  const cameraBtn = els.empresaLogoCameraBtn;
  const galeriaBtn = els.empresaLogoGaleriaBtn;
  const labels = {
    camera: cameraBtn?.textContent || "Câmera",
    galeria: galeriaBtn?.textContent || "Galeria"
  };
  if (cameraBtn) {
    cameraBtn.disabled = true;
    cameraBtn.textContent = "Enviando...";
  }
  if (galeriaBtn) {
    galeriaBtn.disabled = true;
    galeriaBtn.textContent = "Enviando...";
  }
  try {
    const path = await uploadEmpresaLogoFile(file);
    if (els.empresaLogoPathInput) els.empresaLogoPathInput.value = path;
    const field = els.empresaConfigForm?.elements?.namedItem("logo_path");
    if (field && "value" in field) field.value = path;
    updateEmpresaLogoPreview();
    showToast("Logo pronto. Salve as configurações para confirmar.");
  } catch (error) {
    console.warn("Falha ao enviar logo", error);
    showToast(`Erro ao enviar logo: ${error.message || "falha desconhecida"}`, "error");
  } finally {
    if (cameraBtn) {
      cameraBtn.disabled = false;
      cameraBtn.textContent = labels.camera;
    }
    if (galeriaBtn) {
      galeriaBtn.disabled = false;
      galeriaBtn.textContent = labels.galeria;
    }
    if (els.empresaLogoCameraInput) els.empresaLogoCameraInput.value = "";
    if (els.empresaLogoGaleriaInput) els.empresaLogoGaleriaInput.value = "";
  }
}

function removeEmpresaLogo() {
  const current = String(els.empresaLogoPathInput?.value || "").trim();
  if (!current) return;
  if (!window.confirm("Remover o logo da empresa?")) return;
  if (els.empresaLogoPathInput) els.empresaLogoPathInput.value = "";
  const field = els.empresaConfigForm?.elements?.namedItem("logo_path");
  if (field && "value" in field) field.value = "";
  updateEmpresaLogoPreview();
  showToast("Logo removido. Salve as configurações para confirmar.");
}

async function saveEmpresaConfig(event) {
  event.preventDefault();
  if (!supabaseClient || !state.empresaId) {
    throw new Error("Empresa não selecionada");
  }
  const cfg = readEmpresaConfigFromForm();
  if (!cfg.nome) throw new Error("Informe o nome da empresa");

  const payload = {
    nome: cfg.nome,
    telefone: cfg.telefone || null,
    email: cfg.email || null,
    endereco: cfg.endereco || null,
    bairro: cfg.bairro || null,
    cidade: cfg.cidade || null,
    uf: cfg.uf || null,
    logo_path: cfg.logo_path || null,
    cor_primaria: cfg.cor_primaria || "#165d59",
    pdf_termos: cfg.pdf_termos || null,
    pdf_aviso: cfg.pdf_aviso || null,
    doc_extra_config: cfg.doc_extra_config || cloneDocExtraConfig(DOC_EXTRA_BIKE_PRESET)
  };

  const submitBtn = els.empresaConfigSubmitBtn;
  const label = submitBtn?.textContent || "Salvar configurações";
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Salvando...";
  }

  try {
    const { error } = await supabaseClient
      .from("empresas")
      .update(payload)
      .eq("id", state.empresaId);
    if (error) throw error;

    state.empresaConfig = cfg;
    state.empresaNome = cfg.nome;
    fillEmpresaConfigForm(cfg);
    updateAppBrandChrome();
    showToast("Configurações da empresa salvas");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = label;
    }
  }
}

async function loadEmpresaContext() {
  const userId = state.session?.user?.id;
  if (!userId) {
    state.empresaId = null;
    state.empresaNome = "";
    state.empresaConfig = null;
    return;
  }

  let data = null;
  let error = null;

  ({ data, error } = await supabaseClient
    .from("usuarios_empresas")
    .select(EMPRESA_CONFIG_SELECT_FULL)
    .eq("user_id", userId)
    .eq("ativo", true)
    .limit(1)
    .maybeSingle());

  // Ambiente ainda sem migration de colunas de config
  if (error && (isMissingRelationError(error) || /column|does not exist|schema cache/i.test(String(error.message || "")))) {
    ({ data, error } = await supabaseClient
      .from("usuarios_empresas")
      .select(EMPRESA_CONFIG_SELECT_BASIC)
      .eq("user_id", userId)
      .eq("ativo", true)
      .limit(1)
      .maybeSingle());
  }

  if (error) throw error;
  if (!data) {
    throw new Error("Usuario sem empresa vinculada em usuarios_empresas");
  }

  state.empresaId = data.empresa_id;
  state.currentRole = data.role || "user";
  const empresaRow = data.empresas || {};
  state.empresaNome = empresaRow.nome || "Empresa";
  state.empresaConfig = normalizeEmpresaConfig(empresaRow, state.empresaNome);
  fillEmpresaConfigForm(state.empresaConfig);
  updateAppBrandChrome();
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
  // Card do dashboard: faturamento somente do ano corrente (não o total histórico).
  state.pedidosFaturamentoTotal = getDashboardFaturamentoAnoCorrente();
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
        .select("id, valor_parcela, valor_pago, status, vencimento, conta_pagar:contas_pagar(origem)")
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
      // Gastos pessoais não entram no resultado da empresa
      const origem = row.conta_pagar?.origem || row.conta_pagar?.[0]?.origem || "";
      if (String(origem) === "despesa_pessoal") continue;
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

/**
 * Faturamento de pedidos somente no ano civil corrente
 * (soma dos meses do ano em dashboardMonthlyCash; mês atual usa o máximo
 * entre o snapshot mensal e o gráfico diário para não ficar defasado).
 */
function getDashboardFaturamentoAnoCorrente() {
  const year = new Date().getFullYear();
  const currentKey = formatMonthKey(new Date());
  const dailyMesAtual = getDashboardFaturamentoMesAtual();
  const rows = state.dashboardMonthlyCash || [];
  let total = 0;
  let hasCurrentMonth = false;

  for (const row of rows) {
    const ref = parseMonthDate(row.mes);
    if (!ref || ref.getFullYear() !== year) continue;
    const key = formatMonthKey(ref);
    let fat = Number(row.faturamento || 0);
    if (key === currentKey) {
      fat = Math.max(fat, dailyMesAtual);
      hasCurrentMonth = true;
    }
    total += fat;
  }

  if (!hasCurrentMonth) {
    total += dailyMesAtual;
  }

  return Number(total.toFixed(2));
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
    console.warn("Falha ao obter faturamento do ano corrente", aggregateResp.error.message);
    state.pedidosFaturamentoTotal = 0;
  } else {
    const year = new Date().getFullYear();
    const rows = aggregateResp.data || [];
    state.pedidosFaturamentoTotal = rows.reduce((sum, row) => {
      const ref = parseMonthDate(row.mes);
      if (!ref || ref.getFullYear() !== year) return sum;
      return sum + Number(row.faturamento || 0);
    }, 0);
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
    .map(({ produto, reservado, saldo, disponivel, status, valor }) => {
      const id = escapeHtml(produto.id);
      const actions = renderRowActionsMenu(
        [
          { label: "Entrada", attrs: `data-estoque-mov="entrada" data-produto-id="${id}"`, finance: true },
          { label: "Saida", attrs: `data-estoque-mov="saida" data-produto-id="${id}"` },
          { label: "Ajuste", attrs: `data-estoque-mov="ajuste" data-produto-id="${id}"` }
        ],
        { label: `Movimentos de ${produto.nome || "produto"}` }
      );
      return `
      <tr>
        <td class="pedido-actions-cell">${actions}</td>
        <td class="estoque-saldos-produto">${escapeHtml(produto.nome)}</td>
        <td>${escapeHtml(produto.categoria || "-")}</td>
        <td>${formatAbcBadge(produto.classe_abc)}</td>
        <td class="estoque-num">${escapeHtml(saldo)}</td>
        <td class="estoque-num">${escapeHtml(reservado)}</td>
        <td class="estoque-num">${escapeHtml(Number(disponivel.toFixed(2)))}</td>
        <td class="estoque-num">${escapeHtml(produto.ponto_pedido ?? 0)}</td>
        <td class="estoque-num">${produto.estoque_maximo == null ? "–" : escapeHtml(produto.estoque_maximo)}</td>
        <td>${formatEstoqueStatusBadge(status)}</td>
        <td class="estoque-num">${moeda.format(valor)}</td>
      </tr>
    `;
    })
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
        <th class="pedido-actions-col" aria-label="Acoes"></th>
        <th>Pedido</th>
        <th>Data</th>
        <th>Status</th>
        <th>Total</th>
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
  state.itensDocumentoProdutoGroupKey = groupKey;
  state.itensDocumentoReturnTo = null;
  state.itensDocumento = produto.pedidosDetalhes;
  renderItensDocumentoTableHead();
  renderItensDocumentoTable();
  if (els.itensDocumentoModalTitle) {
    els.itensDocumentoModalTitle.textContent = `Pedidos com ${resolvePedidoProdutoNome(produto)}`;
  }
  if (els.closeItensDocumentoModalBtn) {
    els.closeItensDocumentoModalBtn.textContent = "Fechar";
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
      <th class="pedido-actions-col" scope="col" aria-label="Acoes"></th>
      <th class="sortable" data-table="pedidosSintetico" data-sort="pedido">Pedido</th>
      <th class="sortable" data-table="pedidosSintetico" data-sort="data">Data</th>
      <th class="sortable" data-table="pedidosSintetico" data-sort="cliente">Cliente</th>
      <th class="sortable" data-table="pedidosSintetico" data-sort="pagamento">Pagamento</th>
      <th class="sortable" data-table="pedidosSintetico" data-sort="total">Total</th>
    </tr>
    <tr>
      <th class="pedido-actions-col"></th>
      <th><input data-table-filter="pedidosSintetico" data-field="pedido" value="${getTableFilterValue("pedidosSintetico", "pedido")}" placeholder="Filtrar" /></th>
      <th><input data-table-filter="pedidosSintetico" data-field="data" value="${getTableFilterValue("pedidosSintetico", "data")}" placeholder="Filtrar" /></th>
      <th><input data-table-filter="pedidosSintetico" data-field="cliente" value="${getTableFilterValue("pedidosSintetico", "cliente")}" placeholder="Filtrar" /></th>
      <th><input data-table-filter="pedidosSintetico" data-field="pagamento" value="${getTableFilterValue("pedidosSintetico", "pagamento")}" placeholder="Filtrar" /></th>
      <th><input data-table-filter="pedidosSintetico" data-field="total" value="${getTableFilterValue("pedidosSintetico", "total")}" placeholder="Filtrar" /></th>
    </tr>
  `;
}

function getRowActionsPanel(menu) {
  if (!(menu instanceof HTMLElement)) return null;
  // Painel pode ter sido movido para document.body
  const id = menu.dataset.rowActionsId;
  if (id) {
    const safeId = typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? CSS.escape(id)
      : String(id).replace(/["\\]/g, "\\$&");
    const hosted = document.querySelector(`[data-row-actions-panel="${safeId}"]`);
    if (hosted instanceof HTMLElement) return hosted;
  }
  const local = menu.querySelector(".row-actions-panel");
  return local instanceof HTMLElement ? local : null;
}

function closeAllRowActionMenus(exceptMenu = null) {
  document.querySelectorAll("[data-row-actions].is-open").forEach((menu) => {
    if (exceptMenu && menu === exceptMenu) return;
    menu.classList.remove("is-open");
    const trigger = menu.querySelector("[data-row-actions-toggle]");
    if (trigger) trigger.setAttribute("aria-expanded", "false");
    const panel = getRowActionsPanel(menu);
    if (panel) {
      panel.hidden = true;
      panel.classList.remove("is-open-panel");
      panel.style.top = "";
      panel.style.bottom = "";
      panel.style.left = "";
      panel.style.right = "";
      // Devolve o painel ao menu (evita painéis orfaos no body)
      if (panel.parentElement === document.body) {
        menu.appendChild(panel);
      }
    }
  });
}

/**
 * Posiciona o menu colado ao botao clicado.
 * Move o painel para document.body + position:fixed com coords de getBoundingClientRect,
 * para escapar de overflow e de ancestors com transform (ex.: .card animado).
 */
function positionRowActionsPanel(menu) {
  const trigger = menu?.querySelector?.("[data-row-actions-toggle]");
  let panel = menu?.querySelector?.(".row-actions-panel");
  if (!(trigger instanceof HTMLElement)) return;
  if (!(panel instanceof HTMLElement)) {
    panel = getRowActionsPanel(menu);
  }
  if (!(panel instanceof HTMLElement)) return;

  if (!menu.dataset.rowActionsId) {
    menu.dataset.rowActionsId = `ra-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }
  panel.dataset.rowActionsPanel = menu.dataset.rowActionsId;

  // Portal para o body: fixed passa a ser relativo à viewport de verdade
  if (panel.parentElement !== document.body) {
    document.body.appendChild(panel);
  }

  panel.hidden = false;
  panel.classList.add("is-open-panel");

  // Força layout antes de medir
  const panelWidth = Math.max(panel.offsetWidth || 0, 176);
  const panelHeight = Math.max(panel.offsetHeight || 0, 120);
  const rect = trigger.getBoundingClientRect();
  const margin = 8;
  const gap = 6;

  let left = rect.left;
  if (left + panelWidth > window.innerWidth - margin) {
    left = Math.max(margin, rect.right - panelWidth);
  }
  if (left < margin) left = margin;

  const spaceBelow = window.innerHeight - rect.bottom;
  const openUp = spaceBelow < panelHeight + gap + 4 && rect.top > panelHeight + gap + 4;

  panel.style.position = "fixed";
  panel.style.left = `${Math.round(left)}px`;
  panel.style.right = "auto";
  panel.style.zIndex = "1300";
  if (openUp) {
    panel.style.top = "auto";
    panel.style.bottom = `${Math.round(window.innerHeight - rect.top + gap)}px`;
  } else {
    panel.style.bottom = "auto";
    panel.style.top = `${Math.round(rect.bottom + gap)}px`;
  }
}

/**
 * Menu compacto padrao das listas: um botao "⋯" abre as acoes.
 * items: [{ label, attrs, danger?, finance? }]
 */
function renderRowActionsMenu(items, { label = "Acoes" } = {}) {
  const itemsHtml = (items || [])
    .map((item) => {
      const cls = [
        "row-actions-item",
        item.finance ? "row-actions-item--finance" : "",
        item.danger ? "row-actions-item--danger" : ""
      ]
        .filter(Boolean)
        .join(" ");
      return `<button type="button" role="menuitem" class="${cls}" ${item.attrs || ""}>${escapeHtml(item.label || "")}</button>`;
    })
    .join("");

  return `
    <div class="row-actions-menu" data-row-actions>
      <button
        type="button"
        class="row-actions-trigger"
        data-row-actions-toggle
        aria-expanded="false"
        aria-haspopup="menu"
        title="${escapeHtml(label)}"
        aria-label="${escapeHtml(label)}"
      >
        <span aria-hidden="true">⋯</span>
      </button>
      <div class="row-actions-panel" role="menu" hidden>${itemsHtml}</div>
    </div>
  `;
}

function renderPedidoRowActionsMenu(pedidoId) {
  const id = escapeHtml(pedidoId);
  return renderRowActionsMenu(
    [
      { label: "Editar", attrs: `data-edit-pedido="${id}"` },
      { label: "PDF", attrs: `data-pdf-pedido="${id}"` },
      { label: "Receber", attrs: `data-open-recebimento-pedido="${id}"`, finance: true },
      { label: "Itens", attrs: `data-view-pedido-itens="${id}"` },
      { label: "Excluir", attrs: `data-del-pedido="${id}"`, danger: true }
    ],
    { label: `Acoes do pedido #${id}` }
  );
}

function renderClienteRowActionsMenu(clienteId) {
  const id = escapeHtml(clienteId);
  return renderRowActionsMenu(
    [
      { label: "Novo pedido", attrs: `data-novo-pedido-cliente="${id}"`, finance: true },
      { label: "Pedidos", attrs: `data-view-cliente-pedidos="${id}"` },
      { label: "Editar", attrs: `data-edit-cliente="${id}"` },
      { label: "Excluir", attrs: `data-del-cliente="${id}"`, danger: true }
    ],
    { label: "Acoes do cliente" }
  );
}

function renderProdutoRowActionsMenu(produtoId, { controlaEstoque = true } = {}) {
  const id = escapeHtml(produtoId);
  const items = [
    { label: "Editar", attrs: `data-edit-produto="${id}"` }
  ];
  if (controlaEstoque) {
    items.push({ label: "Estoque", attrs: `data-produto-estoque-mov="${id}"`, finance: true });
  }
  items.push({ label: "Excluir", attrs: `data-del-produto="${id}"`, danger: true });
  return renderRowActionsMenu(items, { label: "Acoes do produto" });
}

function renderOrcamentoRowActionsMenu(orcamentoId) {
  const id = escapeHtml(orcamentoId);
  return renderRowActionsMenu(
    [
      { label: "Editar", attrs: `data-edit-orcamento="${id}"` },
      { label: "Converter em pedido", attrs: `data-convert-orcamento="${id}"`, finance: true },
      { label: "PDF", attrs: `data-pdf-orcamento="${id}"` },
      { label: "Itens", attrs: `data-view-orcamento-itens="${id}"` },
      { label: "Excluir", attrs: `data-del-orcamento="${id}"`, danger: true }
    ],
    { label: "Acoes do orcamento" }
  );
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

  for (const cliente of state.clientes) {
    const optionHtml = `<option value="${cliente.id}">${escapeHtml(cliente.nome)}</option>`;
    if (els.pedidoClienteSelect) {
      els.pedidoClienteSelect.insertAdjacentHTML("beforeend", optionHtml);
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
      <tr class="cliente-row">
        <td class="pedido-actions-cell">${renderClienteRowActionsMenu(cliente.id)}</td>
        <td>
          <button type="button" class="action-link cliente-nome-link" data-view-cliente-pedidos="${cliente.id}" title="Ver pedidos deste cliente">
            ${escapeHtml(cliente.nome)}
          </button>
        </td>
        <td>${escapeHtml(cliente.telefone || "-")}</td>
        <td>${escapeHtml(cliente.email || "-")}</td>
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
  renderClientePedidosSummary();
}

function renderClientePedidosSummary() {
  const wrap = els.itensDocumentoClienteSummary;
  if (!wrap) return;

  const isClientePedidos = state.itensDocumentoModalMode === "cliente_pedidos";
  wrap.classList.toggle("hidden", !isClientePedidos);
  if (!isClientePedidos) return;

  const summary = state.itensDocumentoClienteSummary || {
    count: 0,
    totalPedidos: 0,
    totalAberto: 0,
    titulosAbertos: 0
  };

  if (els.clientePedidosCount) {
    els.clientePedidosCount.textContent = String(summary.count || 0);
  }
  if (els.clientePedidosTotal) {
    els.clientePedidosTotal.textContent = moeda.format(summary.totalPedidos || 0);
  }
  if (els.clientePedidosAberto) {
    els.clientePedidosAberto.textContent = moeda.format(summary.totalAberto || 0);
  }
  if (els.clientePedidosAbertoMeta) {
    const n = Number(summary.titulosAbertos || 0);
    els.clientePedidosAbertoMeta.textContent = n
      ? `${n} título${n === 1 ? "" : "s"} com saldo`
      : "Nenhum título em aberto";
  }
}

async function openClientePedidosModal(clienteId) {
  const cliente = state.clientes.find((item) => Number(item.id) === Number(clienteId));
  if (!cliente) {
    showToast("Cliente nao encontrado", "error");
    return;
  }

  const idNum = Number(clienteId);

  const [pedidosResp, contasResp] = await Promise.all([
    supabaseClient
      .from("documentos_venda")
      .select("id, data_emissao, status, total, raw_payload, cliente_legacy_id, cliente:clientes(id,nome)")
      .eq("empresa_id", state.empresaId)
      .eq("tipo_documento", "pedido")
      .eq("cliente_id", idNum)
      .order("data_emissao", { ascending: false }),
    supabaseClient
      .from("contas_receber")
      .select("id, valor_aberto, status")
      .eq("empresa_id", state.empresaId)
      .eq("cliente_id", idNum)
  ]);

  if (pedidosResp.error) throw pedidosResp.error;
  if (contasResp.error && !isMissingRelationError(contasResp.error)) {
    console.warn("Falha ao carregar titulos em aberto do cliente", contasResp.error.message);
  }

  const pedidos = (pedidosResp.data || []).map((item) => ({
    id: item.id,
    data_pedido: item.data_emissao,
    status: item.status,
    valor_total: item.total,
    raw_payload: item.raw_payload || null,
    cliente: item.cliente || { id: cliente.id, nome: cliente.nome }
  }));

  const totalPedidos = pedidos.reduce((sum, p) => sum + Number(p.valor_total || 0), 0);
  let totalAberto = 0;
  let titulosAbertos = 0;
  for (const conta of contasResp.data || []) {
    const st = String(conta.status || "").toLowerCase();
    if (st === "cancelado" || st === "recebido" || st === "quitado") continue;
    const aberto = Math.max(0, Number(conta.valor_aberto || 0));
    if (aberto > 0.009) {
      totalAberto += aberto;
      titulosAbertos += 1;
    }
  }

  state.itensDocumentoModalMode = "cliente_pedidos";
  state.itensDocumentoReturnTo = null;
  state.itensDocumentoPedidoFoto = "";
  state.itensDocumentoPedidoId = null;
  state.itensDocumentoClienteId = idNum;
  state.itensDocumento = pedidos;
  state.itensDocumentoClienteSummary = {
    count: pedidos.length,
    totalPedidos: Number(totalPedidos.toFixed(2)),
    totalAberto: Number(totalAberto.toFixed(2)),
    titulosAbertos
  };

  if (els.itensDocumentoModalTitle) {
    els.itensDocumentoModalTitle.textContent = `Pedidos de ${cliente.nome}`;
  }
  if (els.closeItensDocumentoModalBtn) {
    els.closeItensDocumentoModalBtn.textContent = "Fechar";
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

  await closeItensDocumentoModal({ force: true });
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
        <td class="pedido-actions-cell">${renderProdutoRowActionsMenu(produto.id, { controlaEstoque: est.controla })}</td>
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
      const id = escapeHtml(pedido.id);
      return `
      <tr>
        <td class="pedido-actions-cell">${renderPedidoRowActionsMenu(pedido.id)}</td>
        <td class="pedido-cell-id">
          <button type="button" class="pedido-cell-id-btn" data-pedido-operacoes="${id}" title="Ver status das operações do pedido #${id}">
            ${renderPedidoThumbHtml(pedido)}
            <span>#${id}</span>
          </button>
        </td>
        <td>${data}</td>
        <td>${clienteNome}</td>
        <td>${escapeHtml(pagamentoLabel)}</td>
        <td>${moeda.format(pedido.valor_total || 0)}</td>
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
      const parcelaId = escapeHtml(conta.parcelaId || "");
      const contaId = escapeHtml(conta.contaId || conta.id || "");
      const actions = renderRowActionsMenu(
        [
          {
            label: "Registrar recebimento",
            attrs: `data-open-recebimento-parcela="${parcelaId}" data-open-recebimento-conta="${contaId}"`,
            finance: true
          }
        ],
        { label: "Acoes do titulo" }
      );
      return `
        <tr>
          <td class="pedido-actions-cell">${actions}</td>
          <td>${emissao}</td>
          <td class="${vencimentoClass}">${vencimento}</td>
          <td>${escapeHtml(clienteNome)}</td>
          <td>${escapeHtml(conta.numero_titulo || `DOC-${conta.documento_id || conta.id}`)}</td>
          <td><span class="status-chip ${statusConta}">${getContaStatusLabel(statusConta)}</span></td>
          <td>${moeda.format(conta.valor_original || 0)}</td>
          <td>${moeda.format(conta.valor_aberto || 0)}</td>
        </tr>
      `;
    })
    .join("");
    updateTableSortHeaders("financeiro");
}

function getOrcamentosListSource() {
  const all = state.orcamentos || [];
  // Padrão: oculta aprovados (já convertidos / fechados comercialmente).
  if (state.orcamentosMostrarAprovados) return all;
  return all.filter((orcamento) => String(orcamento.status || "").toLowerCase() !== "aprovado");
}

function syncOrcamentosAprovadosToggleUi() {
  if (els.orcamentosMostrarAprovados) {
    els.orcamentosMostrarAprovados.checked = Boolean(state.orcamentosMostrarAprovados);
  }
  if (els.orcamentosSectionSubtitle) {
    els.orcamentosSectionSubtitle.textContent = state.orcamentosMostrarAprovados
      ? "Listando todos os orçamentos, inclusive os aprovados."
      : "Por padrão, só aparecem orçamentos que ainda não foram aprovados.";
  }
}

function setOrcamentosMostrarAprovados(mostrar) {
  state.orcamentosMostrarAprovados = Boolean(mostrar);
  syncOrcamentosAprovadosToggleUi();
  renderOrcamentosTable();
}

function renderOrcamentosTable() {
  syncOrcamentosAprovadosToggleUi();
  const source = getOrcamentosListSource();
  const rows = getFilteredAndSortedTableRows(source, "orcamentos", {
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
    const emptyMsg = state.orcamentosMostrarAprovados
      ? "Nenhum orcamento encontrado para os filtros selecionados."
      : "Nenhum orcamento em aberto/reprovado. Marque \"Mostrar aprovados\" para ver os aprovados.";
    els.orcamentosTable.innerHTML = `<tr><td colspan="5">${emptyMsg}</td></tr>`;
    updateTableSortHeaders("orcamentos");
    return;
  }

  els.orcamentosTable.innerHTML = rows
    .map((orcamento) => {
      const data = orcamento.data_orcamento ? new Date(orcamento.data_orcamento).toLocaleDateString("pt-BR") : "-";
      const clienteNome = orcamento.cliente?.nome || (orcamento.cliente_legacy_id ? `Legacy #${escapeHtml(orcamento.cliente_legacy_id)}` : "-");
      return `
      <tr>
        <td class="pedido-actions-cell">${renderOrcamentoRowActionsMenu(orcamento.id)}</td>
        <td>${data}</td>
        <td>${clienteNome}</td>
        <td>${escapeHtml(orcamento.status || "-")}</td>
        <td>${moeda.format(orcamento.valor_total || 0)}</td>
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

  const year = new Date().getFullYear();
  // Preferência: recalcula do snapshot mensal + diário do mês (ano corrente).
  const faturamentoAno = getDashboardFaturamentoAnoCorrente();
  const faturamento =
    faturamentoAno > 0 || (state.dashboardMonthlyCash || []).length
      ? faturamentoAno
      : Number(state.pedidosFaturamentoTotal || 0);
  state.pedidosFaturamentoTotal = faturamento;
  if (els.faturamentoValue) {
    els.faturamentoValue.textContent = moeda.format(faturamento);
    els.faturamentoValue.title = `Total do faturamento somente do ano corrente (${year})`;
  }
  if (els.faturamentoBadge) {
    els.faturamentoBadge.textContent = `Ano ${year}`;
  }
  if (els.faturamentoHint) {
    els.faturamentoHint.textContent = `Total do faturamento somente do ano corrente (${year})`;
  }

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

function openClienteModal(cliente = null) {
  if (!els.clienteModal || !els.clienteForm) return;
  els.clienteForm.reset();
  const isEdit = Boolean(cliente?.id);
  if (els.clienteFormId) els.clienteFormId.value = isEdit ? String(cliente.id) : "";
  if (els.clienteForm.dataset) {
    if (isEdit) els.clienteForm.dataset.editId = String(cliente.id);
    else delete els.clienteForm.dataset.editId;
  }
  if (isEdit) {
    const nome = els.clienteForm.elements.namedItem("nome");
    const telefone = els.clienteForm.elements.namedItem("telefone");
    const email = els.clienteForm.elements.namedItem("email");
    if (nome && "value" in nome) nome.value = cliente.nome || "";
    if (telefone && "value" in telefone) telefone.value = cliente.telefone || "";
    if (email && "value" in email) email.value = cliente.email || "";
  }
  if (els.clienteModalTitle) {
    els.clienteModalTitle.textContent = isEdit ? "Editar Cliente" : "Novo Cliente";
  }
  if (els.clienteModalSubtitle) {
    els.clienteModalSubtitle.textContent = isEdit
      ? "Atualize os dados basicos do cliente."
      : "Preencha os dados basicos do cliente.";
  }
  if (els.clienteSubmitBtn) {
    els.clienteSubmitBtn.textContent = isEdit ? "Salvar alteracoes" : "Salvar Cliente";
  }
  els.clienteModal.classList.remove("hidden");
  window.requestAnimationFrame(() => {
    const nome = els.clienteForm?.elements?.namedItem("nome");
    if (nome && "focus" in nome) nome.focus();
  });
}

function closeClienteModal() {
  if (!els.clienteModal) return;
  els.clienteModal.classList.add("hidden");
  if (els.clienteForm) {
    els.clienteForm.reset();
    delete els.clienteForm.dataset.editId;
  }
  if (els.clienteFormId) els.clienteFormId.value = "";
}

async function saveCliente(event) {
  event.preventDefault();
  if (!els.clienteForm) return;
  const formData = new FormData(els.clienteForm);
  const editId = Number(formData.get("id") || els.clienteForm.dataset.editId || 0) || null;
  const payload = {
    empresa_id: state.empresaId,
    nome: String(formData.get("nome") || "").trim(),
    telefone: String(formData.get("telefone") || "").trim() || null,
    email: String(formData.get("email") || "").trim() || null
  };

  if (!payload.nome) {
    throw new Error("Informe o nome do cliente.");
  }

  if (editId) {
    const { error } = await supabaseClient
      .from("clientes")
      .update({
        nome: payload.nome,
        telefone: payload.telefone,
        email: payload.email
      })
      .eq("empresa_id", state.empresaId)
      .eq("id", editId);
    if (error) throw error;
    showToast("Cliente atualizado");
  } else {
    await createClienteFromPayload(payload);
    showToast("Cliente salvo");
  }

  closeClienteModal();
  state.clientesLoaded = false;
  await ensureClientesLoaded({ force: true });
  renderClientesTable();
  renderSelects();
  await refreshAll();
}

/** @deprecated use saveCliente */
async function createCliente(event) {
  return saveCliente(event);
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
    state.empresaConfig = null;
    state.currentRole = "user";
    state.isPlatformAdmin = false;
    updateAppBrandChrome();
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
      loadFormasPagamento,
      renderRowActionsMenu
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
        } else if (sectionName === "configuracoes") {
          fillEmpresaConfigForm(getEmpresaConfig());
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

  if (els.clienteForm) {
    els.clienteForm.addEventListener("submit", async (event) => {
      try {
        await saveCliente(event);
      } catch (error) {
        showToast(`Erro ao salvar cliente: ${error.message}`, "error");
      }
    });
  }

  if (els.empresaConfigForm) {
    els.empresaConfigForm.addEventListener("submit", async (event) => {
      try {
        await saveEmpresaConfig(event);
      } catch (error) {
        const msg = String(error?.message || "");
        if (/column|schema cache|does not exist/i.test(msg)) {
          showToast(
            "Rode no Supabase o SQL supabase/add-empresa-config.sql e tente novamente.",
            "error"
          );
        } else {
          showToast(`Erro ao salvar configurações: ${msg}`, "error");
        }
      }
    });
  }
  if (els.empresaConfigAplicarPadraoBtn) {
    els.empresaConfigAplicarPadraoBtn.addEventListener("click", () => {
      applyEmpresaConfigPadraoGuPedal();
    });
  }
  if (els.docExtraAddCampoBtn) {
    els.docExtraAddCampoBtn.addEventListener("click", () => addDocExtraCampoEditor());
  }
  if (els.docExtraBikePresetBtn) {
    els.docExtraBikePresetBtn.addEventListener("click", () => applyDocExtraBikePreset());
  }
  if (els.docExtraClearBtn) {
    els.docExtraClearBtn.addEventListener("click", () => clearDocExtraEditor());
  }
  if (els.docExtraCamposEditor) {
    els.docExtraCamposEditor.addEventListener("click", (event) => {
      const btn = event.target?.closest?.("[data-doc-extra-remove]");
      if (!btn) return;
      removeDocExtraCampoEditor(btn.getAttribute("data-doc-extra-remove"));
    });
  }
  if (els.empresaLogoCameraBtn && els.empresaLogoCameraInput) {
    els.empresaLogoCameraBtn.addEventListener("click", () => {
      els.empresaLogoCameraInput.click();
    });
    els.empresaLogoCameraInput.addEventListener("change", () => {
      handleEmpresaLogoSelected(els.empresaLogoCameraInput.files).catch((error) => {
        showToast(`Erro ao enviar logo: ${error.message}`, "error");
      });
    });
  }
  if (els.empresaLogoGaleriaBtn && els.empresaLogoGaleriaInput) {
    els.empresaLogoGaleriaBtn.addEventListener("click", () => {
      els.empresaLogoGaleriaInput.click();
    });
    els.empresaLogoGaleriaInput.addEventListener("change", () => {
      handleEmpresaLogoSelected(els.empresaLogoGaleriaInput.files).catch((error) => {
        showToast(`Erro ao enviar logo: ${error.message}`, "error");
      });
    });
  }
  if (els.empresaLogoRemoverBtn) {
    els.empresaLogoRemoverBtn.addEventListener("click", () => {
      removeEmpresaLogo();
    });
  }

  if (els.openClienteModalBtn) {
    els.openClienteModalBtn.addEventListener("click", () => openClienteModal(null));
  }
  if (els.closeClienteModalBtn) {
    els.closeClienteModalBtn.addEventListener("click", closeClienteModal);
  }
  if (els.clienteModal) {
    els.clienteModal.addEventListener("click", (event) => {
      if (event.target === els.clienteModal) closeClienteModal();
    });
  }

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

  async function openNovoPedidoRapido() {
    try {
      await Promise.all([ensureClientesLoaded(), ensureProdutosLoaded()]);
    } catch (error) {
      showToast(`Erro ao carregar dados para novo pedido: ${error.message}`, "error");
    }
    openNovoDocumentoModal("pedido");
  }

  if (els.openPedidoModalBtn) {
    els.openPedidoModalBtn.addEventListener("click", () => {
      openNovoPedidoRapido().catch((error) => {
        showToast(`Erro ao abrir novo pedido: ${error.message}`, "error");
      });
    });
  }

  if (els.fabNovoPedidoBtn) {
    els.fabNovoPedidoBtn.addEventListener("click", () => {
      openNovoPedidoRapido().catch((error) => {
        showToast(`Erro ao abrir novo pedido: ${error.message}`, "error");
      });
    });
  }

  async function openNovoOrcamentoRapido() {
    try {
      await Promise.all([ensureClientesLoaded(), ensureProdutosLoaded()]);
    } catch (error) {
      showToast(`Erro ao carregar dados para novo orçamento: ${error.message}`, "error");
    }
    openNovoDocumentoModal("orcamento");
  }

  if (els.openOrcamentoModalBtn) {
    els.openOrcamentoModalBtn.addEventListener("click", () => {
      openNovoOrcamentoRapido().catch((error) => {
        showToast(`Erro ao abrir novo orçamento: ${error.message}`, "error");
      });
    });
  }

  // Fecha menu de acoes ao rolar/redimensionar (ele usa position:fixed)
  window.addEventListener(
    "scroll",
    () => {
      closeAllRowActionMenus();
    },
    true
  );
  window.addEventListener("resize", () => {
    closeAllRowActionMenus();
  });

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

  if (els.produtoFotoCameraBtn && els.produtoFotoCameraInput) {
    els.produtoFotoCameraBtn.addEventListener("click", () => {
      els.produtoFotoCameraInput.click();
    });
    els.produtoFotoCameraInput.addEventListener("change", () => {
      handleProdutoFotoSelected(els.produtoFotoCameraInput.files).catch((error) => {
        showToast(`Erro ao enviar foto: ${error.message}`, "error");
      });
    });
  }
  if (els.produtoFotoGaleriaBtn && els.produtoFotoGaleriaInput) {
    els.produtoFotoGaleriaBtn.addEventListener("click", () => {
      els.produtoFotoGaleriaInput.click();
    });
    els.produtoFotoGaleriaInput.addEventListener("change", () => {
      handleProdutoFotoSelected(els.produtoFotoGaleriaInput.files).catch((error) => {
        showToast(`Erro ao enviar foto: ${error.message}`, "error");
      });
    });
  }
  if (els.produtoFotoRemoverBtn) {
    els.produtoFotoRemoverBtn.addEventListener("click", () => {
      removeProdutoFoto();
    });
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
    els.closeItensDocumentoModalBtn.addEventListener("click", () => {
      closeItensDocumentoModal().catch((error) => {
        showToast(`Erro ao fechar: ${error.message}`, "error");
      });
    });
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
        closeItensDocumentoModal().catch((error) => {
          showToast(`Erro ao fechar: ${error.message}`, "error");
        });
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
      generateDocumentoOrcamentoPdf().catch((error) => {
        showToast(`Erro ao gerar PDF: ${error.message}`, "error");
      });
    });
  }
  if (els.novoDocumentoConverterBtn) {
    els.novoDocumentoConverterBtn.addEventListener("click", () => {
      const orcamentoId = state.novoDocumentoModal?.documentoId;
      if (!orcamentoId || state.novoDocumentoModal?.tipo !== "orcamento") {
        showToast("Abra um orçamento salvo para converter.", "error");
        return;
      }
      convertOrcamentoToPedido(Number(orcamentoId)).catch((error) => {
        showToast(`Erro ao converter orçamento: ${error.message}`, "error");
      });
    });
  }

  if (els.novoDocumentoFotoCameraBtn && els.novoDocumentoFotoCameraInput) {
    els.novoDocumentoFotoCameraBtn.addEventListener("click", () => {
      els.novoDocumentoFotoCameraInput.click();
    });
    els.novoDocumentoFotoCameraInput.addEventListener("change", () => {
      handleNovoDocumentoFotoSelected(els.novoDocumentoFotoCameraInput.files).catch((error) => {
        showToast(`Erro ao enviar foto: ${error.message}`, "error");
      });
    });
  }
  if (els.novoDocumentoFotoGaleriaBtn && els.novoDocumentoFotoGaleriaInput) {
    els.novoDocumentoFotoGaleriaBtn.addEventListener("click", () => {
      els.novoDocumentoFotoGaleriaInput.click();
    });
    els.novoDocumentoFotoGaleriaInput.addEventListener("change", () => {
      handleNovoDocumentoFotoSelected(els.novoDocumentoFotoGaleriaInput.files).catch((error) => {
        showToast(`Erro ao enviar foto: ${error.message}`, "error");
      });
    });
  }
  if (els.novoDocumentoFotoRemoverBtn) {
    els.novoDocumentoFotoRemoverBtn.addEventListener("click", () => {
      removeNovoDocumentoFoto().catch((error) => {
        showToast(`Erro ao remover foto: ${error.message}`, "error");
      });
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

      const removeBtn = target.closest("[data-documento-item-remove]");
      if (removeBtn) {
        const rowId = removeBtn.getAttribute("data-documento-item-remove");
        if (rowId) removeNovoDocumentoItem(rowId);
      }
    });
  }

  // Picker de produto em tela cheia vive no body: busca, seleção e fechar
  document.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const search = target.closest("[data-produto-combo-search]");
    if (!(search instanceof HTMLInputElement)) return;
    const rowId = search.getAttribute("data-produto-combo-search") || "";
    if (!rowId) return;
    refreshNovoDocumentoProdutoOptions(rowId, search.value || "");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!document.body.classList.contains("produto-picker-open")) return;
    closeAllNovoDocumentoProdutoPanels();
    event.preventDefault();
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const closeBtn = target.closest("[data-produto-combo-close]");
    if (closeBtn) {
      const rowId = closeBtn.getAttribute("data-produto-combo-close") || "";
      if (rowId) closeNovoDocumentoProdutoPanel(rowId);
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const comboOption = target.closest("[data-produto-id][data-produto-row]");
    if (comboOption && comboOption.closest("[data-produto-combo-panel]")) {
      const rowId = comboOption.getAttribute("data-produto-row") || "";
      const produtoId = comboOption.getAttribute("data-produto-id") || "";
      if (rowId && produtoId) setNovoDocumentoProduto(rowId, produtoId);
      event.preventDefault();
      event.stopPropagation();
    }
  });

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

    // Não fecha o picker fullscreen ao clicar dentro dele (painel no body)
    const inProdutoPicker =
      target.closest("[data-produto-combo]") ||
      target.closest("[data-produto-combo-panel]") ||
      target.closest("[data-produto-combo-trigger]");
    if (!inProdutoPicker) {
      closeAllNovoDocumentoProdutoPanels();
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

  if (els.orcamentosMostrarAprovados) {
    els.orcamentosMostrarAprovados.checked = Boolean(state.orcamentosMostrarAprovados);
    els.orcamentosMostrarAprovados.addEventListener("change", () => {
      setOrcamentosMostrarAprovados(els.orcamentosMostrarAprovados.checked);
    });
  }

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

    // Menu compacto de acoes nas listas
    const actionsToggle = target.closest("[data-row-actions-toggle]");
    if (actionsToggle) {
      event.preventDefault();
      event.stopPropagation();
      const menu = actionsToggle.closest("[data-row-actions]");
      const wasOpen = menu?.classList.contains("is-open");
      closeAllRowActionMenus();
      if (!wasOpen && menu) {
        menu.classList.add("is-open");
        actionsToggle.setAttribute("aria-expanded", "true");
        // fixed + coords: evita o menu sumir dentro de table-wrap com overflow
        positionRowActionsPanel(menu);
      }
      return;
    }

    // Fechou o menu ao clicar fora / ao escolher uma acao
    // (painel pode estar no body, fora de [data-row-actions])
    if (target.closest(".row-actions-item")) {
      closeAllRowActionMenus();
    } else if (!target.closest("[data-row-actions]") && !target.closest(".row-actions-panel")) {
      closeAllRowActionMenus();
    }

    // Pega atributo no elemento ou no ancestral (menu de acoes / botoes)
    const getData = (name) => target.closest(`[${name}]`)?.getAttribute(name) || target.getAttribute(name);

    const clienteId = getData("data-del-cliente");
    const clientePedidosId = target.closest("[data-view-cliente-pedidos]")?.getAttribute("data-view-cliente-pedidos")
      || target.getAttribute("data-view-cliente-pedidos");
    const novoPedidoClienteId = getData("data-novo-pedido-cliente");
    const produtoEditId = getData("data-edit-produto");
    const produtoEstoqueMovId = target.closest("[data-produto-estoque-mov]")?.getAttribute("data-produto-estoque-mov")
      || target.getAttribute("data-produto-estoque-mov");
    const produtoId = getData("data-del-produto");
    const pedidoId = getData("data-del-pedido");
    const orcamentoId = getData("data-del-orcamento");
    const pedidoItensId = getData("data-view-pedido-itens");
    const pedidoProdutoGroupKey = getData("data-open-pedidos-produto");
    const pedidoProdutoItensId = getData("data-open-pedido-produto-itens");
    const orcamentoItensId = getData("data-view-orcamento-itens");
    const openRecebimentoPedidoId = getData("data-open-recebimento-pedido");
    const openRecebimentoContaId = getData("data-open-recebimento-conta");
    const openRecebimentoParcelaId = getData("data-open-recebimento-parcela");
    const despesaId = getData("data-del-despesa");

    try {
      if (novoPedidoClienteId) {
        await openNovoPedidoForCliente(Number(novoPedidoClienteId));
        return;
      }
      const clienteEditId = getData("data-edit-cliente");
      if (clienteEditId) {
        const cliente = state.clientes.find((item) => String(item.id) === String(clienteEditId));
        if (!cliente) {
          showToast("Cliente nao encontrado", "error");
          return;
        }
        openClienteModal(cliente);
        return;
      }
      // Pedidos do cliente (nome ou acao do menu) — nao dispara em Editar/Excluir/Novo
      if (
        clientePedidosId &&
        !target.closest("[data-del-cliente]") &&
        !target.closest("[data-edit-cliente]") &&
        !target.closest("[data-novo-pedido-cliente]")
      ) {
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
      const pedidoEditId = getData("data-edit-pedido");
      const orcamentoEditId = getData("data-edit-orcamento");
      const orcamentoConvertId = getData("data-convert-orcamento");
      const pedidoOperacoesId = getData("data-pedido-operacoes");
      const pedidoPdfId = getData("data-pdf-pedido");
      const orcamentoPdfId = getData("data-pdf-orcamento");
      if (pedidoPdfId) {
        closeAllRowActionMenus();
        await generateDocumentoPdfById("pedido", Number(pedidoPdfId));
        return;
      }
      if (orcamentoPdfId) {
        closeAllRowActionMenus();
        await generateDocumentoPdfById("orcamento", Number(orcamentoPdfId));
        return;
      }
      if (pedidoOperacoesId) {
        closeAllRowActionMenus();
        await openPedidoOperacoesModal(Number(pedidoOperacoesId));
        return;
      }
      if (orcamentoConvertId) {
        closeAllRowActionMenus();
        await convertOrcamentoToPedido(Number(orcamentoConvertId));
        return;
      }
      if (pedidoEditId) {
        // Fecha de verdade (nao volta para a lista) ao editar o pedido.
        await closeItensDocumentoModal({ force: true });
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
