/**
 * SISTEMA WEB DE GESTÃO HIDROPÔNICA (NFT)
 * Motor Gráfico Canvas, Gestão de Ciclos, Tratos Culturais e Integração Google Sheets
 * Baseado na Especificação Técnica do Roteiro.md com suporte a:
 * - Tema Claro / Escuro
 * - Toolbar simplificada com Dropdown de Adição
 * - Reposicionamento dinâmico de bancadas (Mover / Drag & Drop)
 * - Badges com fundo sólido para legibilidade perfeita de cultura, %, dias e IDs
 * - Furação triangular (quincôncio) realista
 */

// ==========================================================================
// 1. ESTADO GLOBAL DA APLICAÇÃO
// ==========================================================================
const AppState = {
  // Configuração da Área / Estufa (Metros)
  area: {
    id_area: "AREA-01",
    nome: "Estufa Principal 01",
    tipo: "hidroponia",
    comprimento_m: 30.0,
    largura_m: 16.0,
    largura_corredor_m: 2.0,
    criado_em: new Date().toISOString()
  },

  // Lista de Bancadas / Blocos
  blocos: [],

  // Circuitos Hidráulicos e Reservatórios de Solução Nutritiva
  tanques: [
    { id_tanque: "TANQUE-ESQ", nome: "Tanque Setor Esquerdo", volume_litros: 5000, setor: "esquerdo" },
    { id_tanque: "TANQUE-DIR", nome: "Tanque Setor Direito", volume_litros: 5000, setor: "direito" },
    { id_tanque: "TANQUE-MAT", nome: "Tanque Maternidade", volume_litros: 1000, setor: "maternidade" }
  ],

  // Ciclos de Cultivo (Ativos e Históricos)
  ciclos: [],

  // Histórico de Tratos Culturais
  tratos: [],

  // Configuração de Câmera e Viewport
  camera: {
    zoom: 1.0,
    minZoom: 0.2,
    maxZoom: 5.0,
    offsetX: 0,
    offsetY: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    basePixelsPerMeter: 35
  },

  // Ferramenta Ativa no Croqui
  activeTool: "select", // "select" | "add_definitivo" | "add_maternidade" | "add_bercario"
  currentOrientation: "horizontal", // "horizontal" (transversal) | "vertical" (longitudinal)
  selectedBlockId: null,
  hoveredBlockId: null,
  snapToGrid: true,
  minCirculationSpacing: 0.25, // 25 cm de espaçamento real entre bancadas na estufa

  // Catálogo de Culturas Pré-Cadastradas
  catalogoCulturas: [],

  // Reposicionamento / Movimentação
  isMovingBlock: false,
  movingBlockId: null,
  isDraggingMovingBlock: false,
  dragOffsetM: { x: 0, y: 0 },
  moveOriginal: null,
  isDraggingBlockDirect: false,
  dragBlockOffsetM: { x: 0, y: 0 },

  // Tema Visual ("light" | "dark")
  theme: localStorage.getItem("hidro_theme") || "light",

  // Filtros Atuais
  filters: {
    cultura: "ALL",
    fase: "ALL",
    setor: "ALL"
  },

  // Integração Google Sheets
  googleSheetsUrl: localStorage.getItem("hidro_sheets_url") || "",
  isSyncing: false,

  // Autenticação, Controle de Acesso (RBAC) e Criptografia
  currentUser: null, // null (Visitante / Somente Leitura) | { id_usuario, nome, papel: "gestor" | "operador" }
  gestorConfig: {
    isConfigurado: false,
    nome: "Gestor Principal",
    emailRecuperacao: "",
    chaveCriptografia: "HIDRO-SEC-2026",
    senhaHash: ""
  },
  usuarios: [], // Lista de operadores: [{ id_usuario, nome, senha, ultimo_acesso }]
  lastServerTimestamp: 0
};

// ==========================================================================
// 2. TEMPLATES DE BANCADAS (BLOCOS)
// ==========================================================================
// 2. TEMPLATES DE BANCADAS (BLOCOS) E FORMATAÇÃO DE CULTURAS
// ==========================================================================
function formatarNomeCultura(cultura, variedade) {
  if (!cultura || cultura.trim() === "") return "Desocupado";
  const c = cultura.trim();
  if (!variedade || variedade.trim() === "" || variedade.trim().toLowerCase() === "padrão") {
    return c;
  }
  const v = variedade.trim();
  if (c.toLowerCase().includes(v.toLowerCase())) {
    return c;
  }
  return `${c} (${v})`;
}

// Catálogo Padrão Inicial de Culturas Hidropônicas
const CULTURAS_PADRAO = [
  { id: "cult_1", nome: "Alface Crespa", variedade: "Grand Rapids", ciclo_dias: 30, cor: "#10b981" },
  { id: "cult_2", nome: "Alface Americana", variedade: "Lucy Brown", ciclo_dias: 35, cor: "#059669" },
  { id: "cult_3", nome: "Alface Roxa", variedade: "Salad Bowl Roxa", ciclo_dias: 32, cor: "#8b5cf6" },
  { id: "cult_4", nome: "Rúcula", variedade: "Cultivada", ciclo_dias: 22, cor: "#16a34a" },
  { id: "cult_5", nome: "Agrião da Água", variedade: "Folha Larga", ciclo_dias: 28, cor: "#0d9488" },
  { id: "cult_6", nome: "Couve de Folhas", variedade: "Manteiga da Geórgia", ciclo_dias: 45, cor: "#047857" },
  { id: "cult_7", nome: "Manjericão", variedade: "Genovês", ciclo_dias: 35, cor: "#15803d" },
  { id: "cult_8", nome: "Coentro", variedade: "Verdão", ciclo_dias: 25, cor: "#22c55e" },
  { id: "cult_9", nome: "Cebolinha", variedade: "Todo Ano", ciclo_dias: 40, cor: "#14b8a6" },
  { id: "cult_10", nome: "Salsa", variedade: "Lisa / Crespa", ciclo_dias: 35, cor: "#10b981" }
];

function garantirCatalogoArray() {
  if (!Array.isArray(AppState.catalogoCulturas) || AppState.catalogoCulturas.length === 0) {
    AppState.catalogoCulturas = [...CULTURAS_PADRAO];
    salvarCatalogoCulturasLocal();
  }
}

function carregarCatalogoCulturas() {
  const salvo = localStorage.getItem("hidro_catalogo_culturas");
  if (salvo) {
    try {
      const parsed = JSON.parse(salvo);
      AppState.catalogoCulturas = Array.isArray(parsed) && parsed.length > 0 ? parsed : [...CULTURAS_PADRAO];
    } catch (e) {
      console.warn("Erro ao ler catálogo local:", e);
      AppState.catalogoCulturas = [...CULTURAS_PADRAO];
    }
  } else {
    AppState.catalogoCulturas = [...CULTURAS_PADRAO];
  }
  salvarCatalogoCulturasLocal();
  popularSelectsCulturas();
}

function salvarCatalogoCulturasLocal() {
  localStorage.setItem("hidro_catalogo_culturas", JSON.stringify(AppState.catalogoCulturas));
}

function popularSelectsCulturas() {
  const selectNovo = document.getElementById("ciclo-cultura-select");
  const selectEdit = document.getElementById("edit-ciclo-cultura-select");
  const selects = [selectNovo, selectEdit].filter(Boolean);

  selects.forEach(sel => {
    const valorAtual = sel.value;
    sel.innerHTML = "";

    const optPlaceholder = document.createElement("option");
    optPlaceholder.value = "";
    optPlaceholder.textContent = "-- Escolha uma cultura do catálogo --";
    sel.appendChild(optPlaceholder);

    AppState.catalogoCulturas.forEach(cult => {
      const opt = document.createElement("option");
      opt.value = cult.nome;
      opt.textContent = `${cult.nome}${cult.variedade ? ` (${cult.variedade})` : ""} - ~${cult.ciclo_dias} dias`;
      opt.setAttribute("data-nome", cult.nome);
      opt.setAttribute("data-variedade", cult.variedade || "");
      opt.setAttribute("data-dias", cult.ciclo_dias || 30);
      sel.appendChild(opt);
    });

    // Sem opção "manual" — usuário cadastra culturas no catálogo
    if (valorAtual) sel.value = valorAtual;
  });
}

function renderizarTabelaCatalogoCulturas() {
  const container = document.getElementById("tabela-culturas-container");
  const countEl = document.getElementById("catalogo-count");
  if (!container) return;

  container.innerHTML = "";
  if (countEl) countEl.textContent = `${AppState.catalogoCulturas.length} culturas cadastradas`;

  if (AppState.catalogoCulturas.length === 0) {
    container.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 0.85rem;">
      Nenhuma cultura cadastrada no momento. Cadastre acima!
    </div>`;
    return;
  }

  AppState.catalogoCulturas.forEach(cult => {
    const item = document.createElement("div");
    item.className = "catalogo-cultura-item";

    item.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="width: 10px; height: 10px; border-radius: 50%; background: ${cult.cor || '#10b981'}; display: inline-block; flex-shrink: 0;"></span>
        <div>
          <strong style="color: var(--text-primary); font-size: 0.88rem;">${cult.nome}</strong>
          ${cult.variedade ? `<span style="color: var(--text-secondary); margin-left: 6px; font-size: 0.82rem;">(${cult.variedade})</span>` : ""}
          <span style="display: block; font-size: 0.74rem; color: var(--text-muted); margin-top: 1px;">Ciclo estimado: <strong>${cult.ciclo_dias} dias</strong></span>
        </div>
      </div>
      <button type="button" class="btn-delete-cultura" data-id="${cult.id}" style="background: transparent; border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; border-radius: 6px; padding: 4px 10px; font-size: 0.74rem; cursor: pointer; white-space: nowrap;" title="Excluir do catálogo">
        ✕
      </button>
    `;

    container.appendChild(item);
  });

  // Listener para botões de exclusão de cultura
  container.querySelectorAll(".btn-delete-cultura").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const cultId = btn.getAttribute("data-id");
      excluirCulturaDoCatalogo(cultId);
    });
  });
}

function excluirCulturaDoCatalogo(cultId) {
  if (AppState.catalogoCulturas.length <= 1) {
    mostrarToast("Você deve manter pelo menos uma cultura no catálogo.", "warning");
    return;
  }
  const cult = AppState.catalogoCulturas.find(c => c.id === cultId);
  const nome = cult ? cult.nome : "Cultura";
  AppState.catalogoCulturas = AppState.catalogoCulturas.filter(c => c.id !== cultId);
  salvarCatalogoCulturasLocal();
  popularSelectsCulturas();
  renderizarTabelaCatalogoCulturas();
  mostrarToast(`Cultura "${nome}" removida do catálogo.`, "info");
}

function abrirModalCatalogoCulturas() {
  const modal = document.getElementById("modal-culturas-catalogo");
  if (!modal) {
    console.warn("Modal de catálogo de culturas não encontrado no DOM");
    return;
  }
  garantirCatalogoArray();
  renderizarTabelaCatalogoCulturas();
  modal.classList.add("open");
}
window.abrirModalCatalogoCulturas = abrirModalCatalogoCulturas;

const BLOCK_TEMPLATES = {
  definitivo: {
    tipo_bloco: "definitivo",
    largura_m: 1.5,
    comprimento_m: 6.0,
    orientacao: "horizontal",
    qtd_perfis: 8,
    alinhamento_furos: "triangular",
    espacamento_furos_cm: 25,
    diametro_furo_mm: 50,
    total_furos: 192,
    labelPrefix: "BD"
  },
  maternidade: {
    tipo_bloco: "maternidade",
    largura_m: 1.2,
    comprimento_m: 6.0,
    orientacao: "horizontal",
    qtd_perfis: 12,
    alinhamento_furos: "triangular",
    espacamento_furos_cm: 15,
    diametro_furo_mm: 35,
    total_furos: 480,
    labelPrefix: "BM"
  },
  bercario: {
    tipo_bloco: "bercario",
    largura_m: 1.2,
    comprimento_m: 6.0,
    orientacao: "horizontal",
    qtd_perfis: 10,
    alinhamento_furos: "triangular",
    espacamento_furos_cm: 20,
    diametro_furo_mm: 40,
    total_furos: 300,
    labelPrefix: "BB"
  },
  germinacao: {
    tipo_bloco: "germinacao",
    largura_m: 1.0,
    comprimento_m: 1.0,
    orientacao: "horizontal",
    qtd_placas: 2,
    celulas_por_placa: 196,
    total_furos: 392,
    qtd_perfis: 0,
    alinhamento_furos: "paralelo",
    espacamento_furos_cm: 2.5,
    diametro_furo_mm: 15,
    labelPrefix: "G"
  }
};

// ==========================================================================
// 3. INICIALIZAÇÃO E DADOS DE EXEMPLO (MOCK DATA)
// ==========================================================================
function carregarDadosIniciais() {
  const localData = localStorage.getItem("hidro_dados_v3");
  if (localData) {
    try {
      const parsed = JSON.parse(localData);
      if (parsed.area) AppState.area = parsed.area;
      if (parsed.blocos && parsed.blocos.length > 0) {
        AppState.blocos = parsed.blocos.map(b => ({
          ...b,
          diametro_furo_mm: b.diametro_furo_mm || (b.tipo_bloco === "maternidade" ? 35 : b.tipo_bloco === "bercario" ? 40 : b.tipo_bloco === "germinacao" ? 15 : 50),
          qtd_placas: b.tipo_bloco === "germinacao" ? (b.qtd_placas || 2) : b.qtd_placas,
          celulas_por_placa: b.tipo_bloco === "germinacao" ? (b.celulas_por_placa || 196) : b.celulas_por_placa
        }));
      }
      if (parsed.ciclos) {
        AppState.ciclos = parsed.ciclos.map(c => {
          const bloco = AppState.blocos.find(b => b.id_bloco === c.id_bloco);
          const totalPadrao = bloco ? (bloco.total_furos || 192) : 192;
          const qtdIni = c.qtd_inicial || totalPadrao;
          let dtPlantio = c.data_plantio;
          if (typeof dtPlantio === "string" && dtPlantio.includes("T")) {
            dtPlantio = dtPlantio.split("T")[0];
          }
          let dtColheita = c.data_prevista_colheita;
          if (typeof dtColheita === "string" && dtColheita.includes("T")) {
            dtColheita = dtColheita.split("T")[0];
          }

          return {
            ...c,
            data_plantio: dtPlantio || c.data_plantio,
            data_prevista_colheita: dtColheita || c.data_prevista_colheita,
            qtd_inicial: qtdIni,
            qtd_restante: c.qtd_restante !== undefined ? c.qtd_restante : qtdIni,
            colheitas: c.colheitas || []
          };
        });
      }
      if (parsed.tratos) AppState.tratos = parsed.tratos;
      if (parsed.tanques && Array.isArray(parsed.tanques) && parsed.tanques.length > 0) {
        AppState.tanques = parsed.tanques;
      } else {
        const tLocal = localStorage.getItem("hidro_tanques");
        if (tLocal) {
          try {
            const tParsed = JSON.parse(tLocal);
            if (Array.isArray(tParsed) && tParsed.length > 0) AppState.tanques = tParsed;
          } catch (_) {}
        }
      }
      sincronizarTanquesBancadas();
      return;
    } catch (e) {
      console.warn("Erro ao carregar localStorage v3:", e);
    }
  }

  // Configuração Padrão da Estufa
  AppState.area = {
    id_area: "AREA-01",
    nome: "Estufa Principal NFT 01",
    tipo: "hidroponia",
    comprimento_m: 30.0,
    largura_m: 16.0,
    largura_corredor_m: 2.0,
    criado_em: new Date().toISOString()
  };

  const hoje = new Date();
  const subDias = (d, n) => new Date(d.getTime() - n * 86400000).toISOString().split("T")[0];
  const addDias = (d, n) => new Date(d.getTime() + n * 86400000).toISOString().split("T")[0];

  // Bancadas Iniciais no Setor Esquerdo (Layout Compacto Realista - vão de ~25-30cm)
  AppState.blocos = [
    {
      id_bloco: "B-01",
      id_area: "AREA-01",
      tipo_bloco: "definitivo",
      setor: "esquerdo",
      orientacao: "horizontal",
      pos_x_m: 0.5,
      pos_y_m: 1.5,
      largura_m: 1.5,
      comprimento_m: 6.0,
      qtd_perfis: 8,
      alinhamento_furos: "triangular",
      espacamento_furos_cm: 25,
      diametro_furo_mm: 50,
      total_furos: 192
    },
    {
      id_bloco: "B-02",
      id_area: "AREA-01",
      tipo_bloco: "definitivo",
      setor: "esquerdo",
      orientacao: "horizontal",
      pos_x_m: 0.5,
      pos_y_m: 3.3,
      largura_m: 1.5,
      comprimento_m: 6.0,
      qtd_perfis: 8,
      alinhamento_furos: "triangular",
      espacamento_furos_cm: 25,
      diametro_furo_mm: 50,
      total_furos: 192
    },
    {
      id_bloco: "B-03",
      id_area: "AREA-01",
      tipo_bloco: "definitivo",
      setor: "esquerdo",
      orientacao: "horizontal",
      pos_x_m: 0.5,
      pos_y_m: 5.1,
      largura_m: 1.5,
      comprimento_m: 6.0,
      qtd_perfis: 8,
      alinhamento_furos: "triangular",
      espacamento_furos_cm: 25,
      diametro_furo_mm: 50,
      total_furos: 192
    },
    {
      id_bloco: "B-04",
      id_area: "AREA-01",
      tipo_bloco: "maternidade",
      setor: "esquerdo",
      orientacao: "horizontal",
      pos_x_m: 0.5,
      pos_y_m: 6.9,
      largura_m: 1.2,
      comprimento_m: 6.0,
      qtd_perfis: 12,
      alinhamento_furos: "triangular",
      espacamento_furos_cm: 15,
      diametro_furo_mm: 35,
      total_furos: 480
    },
    {
      id_bloco: "B-05",
      id_area: "AREA-01",
      tipo_bloco: "maternidade",
      setor: "esquerdo",
      orientacao: "horizontal",
      pos_x_m: 0.5,
      pos_y_m: 8.4,
      largura_m: 1.2,
      comprimento_m: 6.0,
      qtd_perfis: 12,
      alinhamento_furos: "triangular",
      espacamento_furos_cm: 15,
      diametro_furo_mm: 35,
      total_furos: 480
    }
  ];

  // Ciclos Iniciais de Cultivo com Controle de Estoque
  AppState.ciclos = [
    {
      id_ciclo: "CICLO-101",
      id_bloco: "B-01",
      cultura: "Alface Crespa",
      variedade: "Grand Rapids",
      data_plantio: subDias(hoje, 18),
      data_prevista_colheita: addDias(hoje, 10),
      lote_nutritivo: "Lote N-08 (EC 1.6 mS)",
      status: "ativo",
      qtd_inicial: 192,
      qtd_restante: 192,
      colheitas: []
    },
    {
      id_ciclo: "CICLO-102",
      id_bloco: "B-02",
      cultura: "Rúcula",
      variedade: "Cultivada Gigante",
      data_plantio: subDias(hoje, 24),
      data_prevista_colheita: addDias(hoje, 2),
      lote_nutritivo: "Lote N-09 (EC 1.8 mS)",
      status: "ativo",
      qtd_inicial: 192,
      qtd_restante: 172,
      colheitas: [
        {
          id_colheita: "COLH-102-1",
          data_hora: subDias(hoje, 1) + " 07:30",
          qtd: 20,
          destino: "Feira Municipal",
          responsavel: "Carlos Silva"
        }
      ]
    },
    {
      id_ciclo: "CICLO-104",
      id_bloco: "B-04",
      cultura: "Alface Americana",
      variedade: "Lucy Brown",
      data_plantio: subDias(hoje, 3),
      data_prevista_colheita: addDias(hoje, 22),
      lote_nutritivo: "Maternidade N-01 (EC 1.2 mS)",
      status: "ativo",
      qtd_inicial: 480,
      qtd_restante: 480,
      colheitas: []
    }
  ];

  // Tratos Culturais Iniciais
  AppState.tratos = [
    {
      id_trato: "TRATO-1",
      id_bloco: "B-01",
      id_ciclo: "CICLO-101",
      data_hora: subDias(hoje, 2) + " 08:30",
      tipo_manejo: "Correção de pH",
      responsavel: "Carlos Silva",
      observacoes: "pH ajustado de 6.6 para 5.8 com ácido fosfórico 10%."
    },
    {
      id_trato: "TRATO-2",
      id_bloco: "B-02",
      id_ciclo: "CICLO-102",
      data_hora: subDias(hoje, 1) + " 07:30",
      tipo_manejo: "🌾 Colheita: 20 plantas",
      responsavel: "Carlos Silva",
      observacoes: "Destino: Feira Municipal. Restam 172 plantas na bancada."
    },
    {
      id_trato: "TRATO-3",
      id_bloco: "B-02",
      id_ciclo: "CICLO-102",
      data_hora: subDias(hoje, 1) + " 10:15",
      tipo_manejo: "Adição de nutrientes",
      responsavel: "Mariana Souza",
      observacoes: "Adicionado 200ml de nitrato de cálcio e quelato de ferro."
    }
  ];

  sincronizarTanquesBancadas();
  salvarDadosLocal();
}

function salvarDadosLocal() {
  const dados = {
    area: AppState.area,
    blocos: AppState.blocos,
    ciclos: AppState.ciclos,
    tratos: AppState.tratos,
    tanques: AppState.tanques
  };
  localStorage.setItem("hidro_dados_v3", JSON.stringify(dados));
  localStorage.setItem("hidro_tanques", JSON.stringify(AppState.tanques));
}

/**
 * Retorna o ID do tanque mais adequado para uma bancada com base no seu tipo e setor.
 */
function obterTanquePadraoParaBloco(bloco) {
  if (!AppState.tanques || AppState.tanques.length === 0) return "TANQUE-ESQ";
  if (bloco.tipo_bloco === "germinacao" || bloco.tipo_bloco === "maternidade") {
    const tGerm = AppState.tanques.find(t => t.setor === "germinacao" || t.id_tanque === "TANQUE-GERM");
    if (tGerm) return tGerm.id_tanque;
    const tMat = AppState.tanques.find(t => t.setor === "maternidade" || t.id_tanque === "TANQUE-MAT");
    if (tMat) return tMat.id_tanque;
  }
  const tSetor = AppState.tanques.find(t => t.setor === bloco.setor);
  if (tSetor) return tSetor.id_tanque;
  return AppState.tanques[0].id_tanque;
}

/**
 * Garante que todas as bancadas do croqui possuam um reservatório/tanque associado válido.
 */
function sincronizarTanquesBancadas() {
  if (!AppState.tanques || !Array.isArray(AppState.tanques) || AppState.tanques.length === 0) {
    AppState.tanques = [
      { id_tanque: "TANQUE-ESQ", nome: "Tanque Setor Esquerdo", volume_litros: 5000, setor: "esquerdo" },
      { id_tanque: "TANQUE-DIR", nome: "Tanque Setor Direito", volume_litros: 5000, setor: "direito" },
      { id_tanque: "TANQUE-MAT", nome: "Tanque Maternidade", volume_litros: 1000, setor: "maternidade" }
    ];
  }
  if (AppState.blocos && Array.isArray(AppState.blocos)) {
    AppState.blocos.forEach(bloco => {
      if (!bloco.id_tanque || !AppState.tanques.some(t => t.id_tanque === bloco.id_tanque)) {
        bloco.id_tanque = obterTanquePadraoParaBloco(bloco);
      }
    });
  }
}

// ==========================================================================
// 3.1. SEGURANÇA, CRIPTOGRAFIA E CONTROLE DE ACESSO (GESTOR E OPERADORES)
// ==========================================================================

/**
 * Validação de senha: Mínimo 4 caracteres (letras, números e símbolos comuns, sem espaços)
 */
function validarSenhaAlfanumerica(senha) {
  if (!senha || typeof senha !== "string") return false;
  return /^[a-zA-Z0-9!@#$%&*_\-.]{4,}$/.test(senha.trim());
}

/**
 * Codificação simétrica XOR com chave do Gestor e Base64 compatível com UTF-8
 */
function codificarComChave(texto, chave) {
  if (!texto || !chave) return "";
  try {
    const utf8 = encodeURIComponent(String(texto));
    const arr = [];
    for (let i = 0; i < utf8.length; i++) {
      arr.push(utf8.charCodeAt(i) ^ chave.charCodeAt(i % chave.length));
    }
    return btoa(JSON.stringify(arr));
  } catch (e) {
    console.error("Erro ao codificar com chave:", e);
    return "";
  }
}

/**
 * Decodificação simétrica XOR com chave do Gestor
 */
function decodificarComChave(b64, chave) {
  if (!b64 || !chave) return null;
  try {
    const arr = JSON.parse(atob(b64));
    let utf8 = "";
    for (let i = 0; i < arr.length; i++) {
      utf8 += String.fromCharCode(arr[i] ^ chave.charCodeAt(i % chave.length));
    }
    return decodeURIComponent(utf8);
  } catch (e) {
    console.warn("Falha ao decodificar com chave (chave incorreta ou dado corrompido):", e);
    return null;
  }
}

// Persistência local do Gestor
function carregarGestorConfigLocal() {
  const salvo = localStorage.getItem("hidro_gestor_config_v1");
  if (salvo) {
    try {
      const parsed = JSON.parse(salvo);
      AppState.gestorConfig = {
        isConfigurado: Boolean(parsed.isConfigurado),
        nome: parsed.nome || "Gestor",
        emailRecuperacao: parsed.emailRecuperacao || "",
        chaveCriptografia: parsed.chaveCriptografia || "HIDRO-SEC-2026",
        senhaHash: parsed.senhaHash || "admin123"
      };
      return;
    } catch (e) {
      console.warn("Erro ao ler gestorConfig do localStorage:", e);
    }
  }

  // Se não houver configuração salva, inicializa com valores padrão
  AppState.gestorConfig = {
    isConfigurado: false,
    nome: "Gestor Principal",
    emailRecuperacao: "gestor@estufa.com",
    chaveCriptografia: "HIDRO-SEC-2026",
    senhaHash: "admin123"
  };
}

function salvarGestorConfigLocal() {
  localStorage.setItem("hidro_gestor_config_v1", JSON.stringify(AppState.gestorConfig));
}

// Persistência local de Operadores
function carregarUsuariosLocal() {
  const salvo = localStorage.getItem("hidro_usuarios_v1");
  if (salvo) {
    try {
      const parsed = JSON.parse(salvo);
      if (Array.isArray(parsed) && parsed.length > 0) {
        AppState.usuarios = parsed;
        return;
      }
    } catch (e) {
      console.warn("Erro ao ler operadores do localStorage:", e);
    }
  }

  // Exemplos iniciais para agilizar o primeiro uso
  AppState.usuarios = [
    { id_usuario: "OP-01", nome: "Carlos Silva", senha: "op1234", ultimo_acesso: new Date().toISOString() },
    { id_usuario: "OP-02", nome: "Mariana Costa", senha: "op5678", ultimo_acesso: new Date().toISOString() }
  ];
  salvarUsuariosLocal();
}

function salvarUsuariosLocal() {
  localStorage.setItem("hidro_usuarios_v1", JSON.stringify(AppState.usuarios));
}

// Persistência de Sessão Ativa
function carregarSessaoUsuario() {
  const sessao = sessionStorage.getItem("hidro_active_session");
  if (sessao) {
    try {
      AppState.currentUser = JSON.parse(sessao);
    } catch (e) {
      AppState.currentUser = null;
    }
  } else {
    AppState.currentUser = null; // Inicia sempre como Visitante / Leitura
  }
  atualizarWidgetUsuario();
}

function salvarSessaoUsuario(user) {
  if (user) {
    sessionStorage.setItem("hidro_active_session", JSON.stringify(user));
  } else {
    sessionStorage.removeItem("hidro_active_session");
  }
}

function definirUsuarioLogado(usuario) {
  AppState.currentUser = usuario;
  salvarSessaoUsuario(usuario);
  atualizarWidgetUsuario();
}

function atualizarWidgetUsuario() {
  const btnAuth = document.getElementById("btn-user-auth");
  const iconEl = document.getElementById("user-badge-icon");
  const nameEl = document.getElementById("user-display-name");
  const chevron = document.getElementById("user-pill-chevron");
  const dropName = document.getElementById("dropdown-user-name");
  const dropRole = document.getElementById("dropdown-user-role");

  const btnLogin = document.getElementById("btn-menu-open-login");
  const btnGestorPanel = document.getElementById("btn-menu-gestor-panel");
  const btnLogout = document.getElementById("btn-menu-logout");

  if (!btnAuth || !nameEl) return;

  btnAuth.classList.remove("visitor", "operator", "manager");

  if (!AppState.currentUser) {
    // Visitante (Somente Leitura) -> Botão discreto "🔑 Entrar"
    btnAuth.classList.add("visitor");
    btnAuth.title = "Fazer login no sistema (Operador ou Gestor)";
    if (iconEl) iconEl.textContent = "🔑";
    nameEl.textContent = "Entrar";
    if (chevron) chevron.style.display = "none";
    if (dropName) dropName.textContent = "Visitante";
    if (dropRole) dropRole.textContent = "Acesso Somente Leitura";

    if (btnLogin) btnLogin.style.display = "flex";
    if (btnGestorPanel) btnGestorPanel.style.display = "none";
    if (btnLogout) btnLogout.style.display = "none";
  } else if (AppState.currentUser.papel === "operador") {
    // Operador -> Pílula compacta "👨‍🌾 Carlos ▼"
    btnAuth.classList.add("operator");
    btnAuth.title = `Sessão ativa: ${AppState.currentUser.nome} (Operador)`;
    if (iconEl) iconEl.textContent = "👨‍🌾";
    nameEl.textContent = AppState.currentUser.nome;
    if (chevron) chevron.style.display = "inline";
    if (dropName) dropName.textContent = AppState.currentUser.nome;
    if (dropRole) dropRole.textContent = "Operador Autorizado";

    if (btnLogin) btnLogin.style.display = "none";
    if (btnGestorPanel) btnGestorPanel.style.display = "none";
    if (btnLogout) btnLogout.style.display = "flex";
  } else if (AppState.currentUser.papel === "gestor") {
    // Gestor -> Pílula compacta "👑 Gestor ▼"
    btnAuth.classList.add("manager");
    btnAuth.title = `Sessão ativa: ${AppState.currentUser.nome || "Gestor"} (Gestor)`;
    if (iconEl) iconEl.textContent = "👑";
    nameEl.textContent = AppState.currentUser.nome || "Gestor";
    if (chevron) chevron.style.display = "inline";
    if (dropName) dropName.textContent = AppState.currentUser.nome || "Gestor";
    if (dropRole) dropRole.textContent = "Administrador / Gestor";

    if (btnLogin) btnLogin.style.display = "none";
    if (btnGestorPanel) btnGestorPanel.style.display = "flex";
    if (btnLogout) btnLogout.style.display = "flex";
  }
}

/**
 * Validação central de permissão para modificações no croqui/sistema
 */
function verificarPermissaoEdicao(exigirGestor = false) {
  if (!AppState.currentUser) {
    mostrarToast("🔒 Acesso restrito: Faça login como Operador ou Gestor para realizar alterações no sistema.", "warning");
    abrirModalLogin("operador");
    return false;
  }
  if (exigirGestor && AppState.currentUser.papel !== "gestor") {
    mostrarToast("⚠️ Esta configuração é restrita ao Gestor Principal.", "warning");
    return false;
  }
  return true;
}

// Popula o select de operadores no modal de login
function popularSelectLoginOperadores() {
  const select = document.getElementById("login-operador-select");
  const aviso = document.getElementById("login-sem-operadores-aviso");
  if (!select) return;

  const valorAtual = select.value;
  select.innerHTML = '<option value="">-- Escolha seu nome --</option>';

  if (!AppState.usuarios || AppState.usuarios.length === 0) {
    if (aviso) aviso.style.display = "block";
    return;
  }

  if (aviso) aviso.style.display = "none";

  AppState.usuarios.forEach(op => {
    const opt = document.createElement("option");
    opt.value = op.id_usuario;
    opt.textContent = `👨‍🌾 ${op.nome}`;
    select.appendChild(opt);
  });

  if (valorAtual) select.value = valorAtual;
}

// Renderiza os cards de operadores no painel do Gestor
function renderizarListaOperadoresGestor() {
  const container = document.getElementById("lista-operadores-container");
  const countEl = document.getElementById("operadores-count");
  if (!container) return;

  if (countEl) {
    countEl.textContent = `${AppState.usuarios.length} cadastrado(s)`;
  }

  if (!AppState.usuarios || AppState.usuarios.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 0.85rem; border: 1px dashed var(--border-subtle); border-radius: 8px;">
        Nenhum operador cadastrado até o momento.<br>Cadastre seu primeiro operador no formulário acima.
      </div>
    `;
    return;
  }

  let html = "";
  AppState.usuarios.forEach(op => {
    const ultimoAcessoStr = op.ultimo_acesso
      ? new Date(op.ultimo_acesso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
      : "Nunca acessou";

    html += `
      <div class="operador-card-item" style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 10px 14px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 1.2rem;">👨‍🌾</span>
          <div>
            <div style="font-weight: 700; color: var(--text-primary); font-size: 0.88rem;">${op.nome}</div>
            <div style="display: flex; gap: 12px; font-size: 0.73rem; color: var(--text-muted);">
              <span>🔑 Senha: <code style="background: rgba(0,0,0,0.15); padding: 1px 4px; border-radius: 4px;">${op.senha}</code></span>
              <span>🕒 Último acesso: ${ultimoAcessoStr}</span>
            </div>
          </div>
        </div>
        <button type="button" class="btn-delete-operador" data-id="${op.id_usuario}" title="Excluir Operador" style="background: transparent; border: 1px solid rgba(239,68,68,0.3); color: #ef4444; border-radius: 6px; padding: 4px 8px; font-size: 0.78rem; cursor: pointer;">
          ✕ Excluir
        </button>
      </div>
    `;
  });

  container.innerHTML = html;

  // Listeners de exclusão
  container.querySelectorAll(".btn-delete-operador").forEach(btn => {
    btn.addEventListener("click", async e => {
      e.stopPropagation();
      const idOp = btn.getAttribute("data-id");
      const op = AppState.usuarios.find(u => u.id_usuario === idOp);
      if (!op) return;

      if (confirm(`Deseja realmente remover o operador "${op.nome}"? Ele não conseguirá mais efetuar login.`)) {
        AppState.usuarios = AppState.usuarios.filter(u => u.id_usuario !== idOp);
        salvarUsuariosLocal();
        popularSelectLoginOperadores();
        renderizarListaOperadoresGestor();
        mostrarToast(`Operador "${op.nome}" removido com sucesso.`, "info");
        await sincronizarUsuariosComPlanilha();
      }
    });
  });
}

function abrirModalLogin(aba = "operador") {
  popularSelectLoginOperadores();
  const modal = document.getElementById("modal-login");
  const tabOp = document.getElementById("tab-login-operador");
  const tabGestor = document.getElementById("tab-login-gestor");
  const groupOp = document.getElementById("group-login-operador");
  const boxRecup = document.getElementById("box-recuperar-senha");
  const boxRecupOp = document.getElementById("box-recuperar-operador");
  const infoRecup = document.getElementById("info-recuperacao-msg");
  const infoRecupOp = document.getElementById("info-operador-msg");
  const senhaInput = document.getElementById("login-senha");

  if (senhaInput) senhaInput.value = "";
  if (infoRecup) {
    infoRecup.style.display = "none";
    infoRecup.innerHTML = "";
  }
  if (infoRecupOp) {
    infoRecupOp.style.display = "none";
    infoRecupOp.innerHTML = "";
  }

  if (aba === "gestor") {
    tabOp?.classList.remove("btn-primary");
    tabOp?.classList.add("btn-secondary");
    tabGestor?.classList.remove("btn-secondary");
    tabGestor?.classList.add("btn-primary");
    if (groupOp) groupOp.style.display = "none";
    if (boxRecup) boxRecup.style.display = "block";
    if (boxRecupOp) boxRecupOp.style.display = "none";
    const btnConfirm = document.getElementById("btn-confirm-login");
    if (btnConfirm) btnConfirm.textContent = "Entrar como Gestor";
  } else {
    tabGestor?.classList.remove("btn-primary");
    tabGestor?.classList.add("btn-secondary");
    tabOp?.classList.remove("btn-secondary");
    tabOp?.classList.add("btn-primary");
    if (groupOp) groupOp.style.display = "block";
    if (boxRecup) boxRecup.style.display = "none";
    if (boxRecupOp) boxRecupOp.style.display = "block";
    const btnConfirm = document.getElementById("btn-confirm-login");
    if (btnConfirm) btnConfirm.textContent = "Entrar como Operador";
  }

  modal?.classList.add("open");
}

function atualizarDisplaySegurancaGestor() {
  const emailInput = document.getElementById("gestor-email-recup");
  const chaveInput = document.getElementById("gestor-chave-cripto");
  const statusDot = document.getElementById("gestor-sheets-status-dot");
  const statusText = document.getElementById("gestor-sheets-status-text");
  const senhaDisplay = document.getElementById("gestor-senha-atual-display");
  const btnToggleSenha = document.getElementById("btn-toggle-ver-senha-gestor");

  if (emailInput) emailInput.value = AppState.gestorConfig.emailRecuperacao || "";
  if (chaveInput) chaveInput.value = AppState.gestorConfig.chaveCriptografia || "HIDRO-SEC-2026";

  if (statusDot && statusText) {
    if (AppState.googleSheetsUrl) {
      statusDot.className = "status-dot";
      statusText.innerHTML = "<strong>Google Sheets:</strong> Conectado (sincronização ativa)";
    } else {
      statusDot.className = "status-dot offline";
      statusText.innerHTML = "<strong>Modo Local:</strong> Conecte a URL em Opções para sincronizar com a planilha";
    }
  }

  if (senhaDisplay) {
    senhaDisplay.textContent = "••••••••";
    senhaDisplay.setAttribute("data-revealed", "false");
  }
  if (btnToggleSenha) {
    btnToggleSenha.textContent = "👁️ Revelar";
  }
}

function abrirModalPainelGestor() {
  if (!AppState.currentUser || AppState.currentUser.papel !== "gestor") {
    mostrarToast("Apenas o Gestor Principal tem acesso a este painel.", "warning");
    abrirModalLogin("gestor");
    return;
  }

  atualizarDisplaySegurancaGestor();

  const novaSenhaInput = document.getElementById("gestor-nova-senha");
  const confSenhaInput = document.getElementById("gestor-confirm-senha");
  if (novaSenhaInput) novaSenhaInput.value = "";
  if (confSenhaInput) confSenhaInput.value = "";

  // Exibe aba de operadores por padrão
  document.getElementById("tab-nav-operadores")?.click();
  renderizarListaOperadoresGestor();

  document.getElementById("modal-usuarios-gestor")?.classList.add("open");
}

function abrirModalSetupGestor() {
  const nomeInput = document.getElementById("setup-gestor-nome");
  const senhaInput = document.getElementById("setup-gestor-senha");
  const confInput = document.getElementById("setup-gestor-confirm-senha");
  const emailInput = document.getElementById("setup-gestor-email");
  const chaveInput = document.getElementById("setup-gestor-chave");

  if (nomeInput) nomeInput.value = AppState.gestorConfig.nome || "Gestor";
  if (senhaInput) senhaInput.value = "";
  if (confInput) confInput.value = "";
  if (emailInput) emailInput.value = AppState.gestorConfig.emailRecuperacao || "";
  if (chaveInput) chaveInput.value = AppState.gestorConfig.chaveCriptografia || "HIDRO-SEC-2026";

  document.getElementById("modal-setup-gestor")?.classList.add("open");
}

/**
 * Envia a lista de usuários e credenciais criptografadas para a planilha Google
 */
async function sincronizarUsuariosComPlanilha(feedbackVisual = false) {
  if (!AppState.googleSheetsUrl) {
    if (feedbackVisual) {
      mostrarToast("Configurações salvas localmente no navegador! (Para sincronizar com a planilha Google, conecte a URL em Opções)", "info");
    }
    return;
  }

  const chave = AppState.gestorConfig.chaveCriptografia || "HIDRO-SEC-2026";

  const listaParaPlanilha = [
    {
      id_usuario: "USER-GESTOR",
      nome_exibicao: AppState.gestorConfig.nome || "Gestor Principal",
      papel: "gestor",
      dados_codificados: codificarComChave(AppState.gestorConfig.senhaHash, chave),
      email_recuperacao: AppState.gestorConfig.emailRecuperacao || "",
      ultimo_acesso: new Date().toISOString()
    },
    ...AppState.usuarios.map(op => ({
      id_usuario: op.id_usuario,
      nome_exibicao: op.nome,
      papel: "operador",
      dados_codificados: codificarComChave(JSON.stringify({ nome: op.nome, senha: op.senha }), chave),
      email_recuperacao: "",
      ultimo_acesso: op.ultimo_acesso || ""
    }))
  ];

  try {
    const res = await registrarAcaoRemota("salvarUsuarios", listaParaPlanilha);
    if (feedbackVisual) {
      if (res && res.status === "success") {
        mostrarToast("☁️ Dados de usuários e segurança sincronizados na planilha Google!", "success");
      } else if (res && res.status === "error") {
        mostrarToast(`⚠️ Salvo localmente, mas a planilha retornou: ${res.message}. Verifique a implantação do Apps Script.`, "warning");
      } else {
        mostrarToast("☁️ Credenciais enviadas para a planilha Google!", "success");
      }
    }
  } catch (e) {
    console.warn("Erro ao salvar usuários na planilha Google:", e);
    if (feedbackVisual) {
      mostrarToast("Aviso: Salvo localmente, mas não foi possível enviar para a planilha.", "warning");
    }
  }
}

/**
 * Processa a lista de usuários retornada pela planilha Google, decodificando com a chave
 */
function processarUsuariosRemotos(usuariosRemotos) {
  if (!Array.isArray(usuariosRemotos) || usuariosRemotos.length === 0) return;
  AppState.ultimosUsuariosRemotos = usuariosRemotos;

  const chave = AppState.gestorConfig.chaveCriptografia || "HIDRO-SEC-2026";
  const operadoresCarregados = [];
  let totalComCodificacao = 0;
  let sucessoDecodificacao = 0;

  usuariosRemotos.forEach(u => {
    if (u.papel === "gestor") {
      if (u.email_recuperacao && !AppState.gestorConfig.emailRecuperacao) {
        AppState.gestorConfig.emailRecuperacao = u.email_recuperacao;
      }
      if (u.nome_exibicao && (!AppState.gestorConfig.nome || AppState.gestorConfig.nome === "Gestor")) {
        AppState.gestorConfig.nome = u.nome_exibicao;
      }
      if (u.dados_codificados) {
        totalComCodificacao++;
        const decSenha = decodificarComChave(u.dados_codificados, chave);
        if (decSenha) {
          sucessoDecodificacao++;
          if (!AppState.gestorConfig.senhaHash) AppState.gestorConfig.senhaHash = decSenha;
        }
      }
    } else if (u.papel === "operador" && u.dados_codificados) {
      totalComCodificacao++;
      const decPayload = decodificarComChave(u.dados_codificados, chave);
      if (decPayload) {
        sucessoDecodificacao++;
        try {
          const parsed = JSON.parse(decPayload);
          operadoresCarregados.push({
            id_usuario: u.id_usuario,
            nome: parsed.nome || u.nome_exibicao,
            senha: parsed.senha,
            ultimo_acesso: u.ultimo_acesso || ""
          });
        } catch (e) {
          console.warn("Falha ao analisar payload de operador decodificado:", e);
        }
      }
    }
  });

  if (operadoresCarregados.length > 0) {
    AppState.usuarios = operadoresCarregados;
    salvarUsuariosLocal();
    popularSelectLoginOperadores();
    renderizarListaOperadoresGestor();
  } else if (totalComCodificacao > 0 && sucessoDecodificacao === 0) {
    console.warn("A chave atual não coincide com a chave usada para criptografar os usuários na planilha.");
  }
}

/**
 * Registra o timestamp do último acesso na planilha Google
 */
async function registrarAcessoRemoto(idUsuario) {
  if (!AppState.googleSheetsUrl || !idUsuario) return;
  try {
    await registrarAcaoRemota("registrarAcesso", { id_usuario: idUsuario });
  } catch (e) {}
}

/**
 * Verificação inteligente de timestamp sem LockService:
 * Realiza uma consulta leve (?check=timestamp) para verificar se outro usuário alterou a planilha.
 */
let isCheckingTimestamp = false;
async function verificarAtualizacaoTimestamp(forcar = false) {
  if (!AppState.googleSheetsUrl || isCheckingTimestamp || AppState.isSyncing) return;

  try {
    isCheckingTimestamp = true;
    const urlCheck = AppState.googleSheetsUrl + (AppState.googleSheetsUrl.includes("?") ? "&" : "?") + "check=timestamp";
    const resp = await fetch(urlCheck, { method: "GET", mode: "cors" });
    if (!resp.ok) return;

    const resJson = await resp.json();
    const serverTs = resJson.timestamp ? Number(resJson.timestamp) : 0;

    if (serverTs && AppState.lastServerTimestamp && serverTs > AppState.lastServerTimestamp) {
      console.log(`[Sync] Timestamp remoto mais recente detectado (${serverTs} > ${AppState.lastServerTimestamp}). Atualizando croqui...`);
      await sincronizarComSheets(false);
      mostrarToast("🔄 Dados sincronizados automaticamente com alterações da planilha!", "info");
    } else if (serverTs && !AppState.lastServerTimestamp) {
      AppState.lastServerTimestamp = serverTs;
    }
  } catch (e) {
    // Falha silenciosa para não incomodar o usuário se a conexão estiver instável
  } finally {
    isCheckingTimestamp = false;
  }
}

// ==========================================================================
// 4. CÁLCULO DE CICLO E STATUS CROMÁTICO (ROTEIRO.MD)
// ==========================================================================
function calcularProgressoCiclo(ciclo) {
  if (!ciclo || ciclo.status !== "ativo") return null;

  const pStr = ciclo.data_plantio ? (String(ciclo.data_plantio).includes("T") ? ciclo.data_plantio : ciclo.data_plantio + "T12:00:00") : "";
  const cStr = ciclo.data_prevista_colheita ? (String(ciclo.data_prevista_colheita).includes("T") ? ciclo.data_prevista_colheita : ciclo.data_prevista_colheita + "T12:00:00") : "";

  const plantio = new Date(pStr).getTime();
  const colheita = new Date(cStr).getTime();
  const agora = new Date().getTime();

  if (isNaN(plantio) || isNaN(colheita)) {
    return { pct: 0, diasDecorridos: 0, diasRestantes: 0, statusCor: "initial" };
  }

  const totalTempo = colheita - plantio;
  if (totalTempo <= 0) return { pct: 100, diasDecorridos: 0, diasRestantes: 0, statusCor: "late" };

  const decorrido = agora - plantio;
  const pct = Math.min(100, Math.max(0, (decorrido / totalTempo) * 100));

  const diasDecorridos = Math.max(0, Math.floor(decorrido / (1000 * 60 * 60 * 24)));
  const diasRestantes = Math.ceil((colheita - agora) / (1000 * 60 * 60 * 24));

  let statusCor = "initial";
  if (pct > 80) {
    statusCor = diasRestantes < 0 ? "late" : "harvest";
  } else if (pct > 30) {
    statusCor = "growth";
  }

  return {
    pct: Math.round(pct),
    diasDecorridos,
    diasRestantes,
    statusCor
  };
}

function obterCorPorStatus(statusCor) {
  switch (statusCor) {
    case "initial": return "#10b981"; // Verde Claro
    case "growth": return "#047857";  // Verde Escuro Vibrante
    case "harvest": return "#d97706"; // Laranja Colheita
    case "late": return "#dc2626";    // Vermelho Atrasado
    case "empty":
    default: return "#94a3b8";        // Cinza
  }
}

function calcularTotalFuros(bloco) {
  if (bloco.tipo_bloco === "germinacao") {
    const placas = bloco.qtd_placas || 2;
    const celulas = bloco.celulas_por_placa || 196;
    return placas * celulas;
  }
  const furosPorPerfil = Math.max(1, Math.floor((bloco.comprimento_m - 0.2) / ((bloco.espacamento_furos_cm || 25) / 100)));
  return (bloco.qtd_perfis || 8) * furosPorPerfil;
}

// ==========================================================================
// 5. MOTOR DO CANVAS (COORDENADAS, CÂMERA, ZOOM & PAN)
// ==========================================================================
const canvas = document.getElementById("cropCanvas");
const ctx = canvas.getContext("2d");
const viewport = document.getElementById("canvas-viewport");
let lastTooltipBlockId = null;

function redimensionarCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = viewport.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
}

function metrosParaPixels(metros) {
  return metros * AppState.camera.basePixelsPerMeter;
}

function pixelsParaMetros(pixels) {
  return pixels / AppState.camera.basePixelsPerMeter;
}

function mundoParaTela(xM, yM) {
  const xPx = metrosParaPixels(xM);
  const yPx = metrosParaPixels(yM);
  return {
    x: xPx * AppState.camera.zoom + AppState.camera.offsetX,
    y: yPx * AppState.camera.zoom + AppState.camera.offsetY
  };
}

function telaParaMundo(xTela, yTela) {
  const xPx = (xTela - AppState.camera.offsetX) / AppState.camera.zoom;
  const yPx = (yTela - AppState.camera.offsetY) / AppState.camera.zoom;
  return {
    x: pixelsParaMetros(xPx),
    y: pixelsParaMetros(yPx)
  };
}

function ajustarVisualizacaoGeral() {
  const rect = viewport.getBoundingClientRect();
  const areaLarguraPx = metrosParaPixels(AppState.area.largura_m);
  const areaComprimentoPx = metrosParaPixels(AppState.area.comprimento_m);

  const padding = 60;
  const escalaX = (rect.width - padding * 2) / areaLarguraPx;
  const escalaY = (rect.height - padding * 2) / areaComprimentoPx;

  const novoZoom = Math.min(escalaX, escalaY, 2.5);
  AppState.camera.zoom = Math.max(AppState.camera.minZoom, novoZoom);

  AppState.camera.offsetX = (rect.width - areaLarguraPx * AppState.camera.zoom) / 2;
  AppState.camera.offsetY = (rect.height - areaComprimentoPx * AppState.camera.zoom) / 2;

  solicitarRedesenho();
}

// ==========================================================================
// 6. RENDERIZAÇÃO DO CROQUI
// ==========================================================================
let animFrameId = null;

function solicitarRedesenho() {
  if (!animFrameId) {
    animFrameId = requestAnimationFrame(() => {
      desenharCena();
      animFrameId = null;
    });
  }
}

function desenharCena() {
  const rect = viewport.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);

  ctx.save();
  ctx.translate(AppState.camera.offsetX, AppState.camera.offsetY);
  ctx.scale(AppState.camera.zoom, AppState.camera.zoom);

  // 1. Grade de Fundo Técnica
  desenharGrade();

  // 2. Perímetro da Estufa e Corredor Central
  desenharEstruturaEstufa();

  // 3. Bancadas / Blocos Hidropônicos com Furos Triangulares e Badges de Alta Legibilidade
  desenharBlocos();

  ctx.restore();

  // 4. Preview de Inserção ou Movimentação
  if (AppState.activeTool.startsWith("add_") && AppState.cursorMundo) {
    desenharPreviewBloco();
  }
}

function desenharGrade() {
  const isDark = document.body.classList.contains("dark-theme");
  const stepM = 1.0;
  const stepPx = metrosParaPixels(stepM);
  const totalLarguraPx = metrosParaPixels(AppState.area.largura_m);
  const totalComprimentoPx = metrosParaPixels(AppState.area.comprimento_m);

  ctx.save();
  ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(100, 116, 139, 0.12)";
  ctx.lineWidth = 1 / AppState.camera.zoom;

  for (let x = 0; x <= totalLarguraPx; x += stepPx) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, totalComprimentoPx);
    ctx.stroke();
  }

  for (let y = 0; y <= totalComprimentoPx; y += stepPx) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(totalLarguraPx, y);
    ctx.stroke();
  }

  ctx.restore();
}

function desenharEstruturaEstufa() {
  const isDark = document.body.classList.contains("dark-theme");
  const largPx = metrosParaPixels(AppState.area.largura_m);
  const compPx = metrosParaPixels(AppState.area.comprimento_m);
  const corredorLargPx = metrosParaPixels(AppState.area.largura_corredor_m);

  ctx.save();

  // Fundo sutil da área da estufa
  ctx.fillStyle = isDark ? "rgba(17, 24, 39, 0.65)" : "rgba(255, 255, 255, 0.9)";
  ctx.fillRect(0, 0, largPx, compPx);

  // Contorno Externo da Estufa
  ctx.strokeStyle = isDark ? "#38bdf8" : "#0284c7";
  ctx.lineWidth = 2.5 / AppState.camera.zoom;
  ctx.strokeRect(0, 0, largPx, compPx);

  // Corredor Central de Serviço
  const corredorX1 = (largPx - corredorLargPx) / 2;
  const corredorX2 = corredorX1 + corredorLargPx;

  ctx.fillStyle = isDark ? "rgba(245, 158, 11, 0.06)" : "rgba(217, 119, 6, 0.08)";
  ctx.fillRect(corredorX1, 0, corredorLargPx, compPx);

  ctx.strokeStyle = isDark ? "rgba(245, 158, 11, 0.6)" : "rgba(217, 119, 6, 0.75)";
  ctx.lineWidth = 1.5 / AppState.camera.zoom;
  ctx.setLineDash([8 / AppState.camera.zoom, 6 / AppState.camera.zoom]);

  ctx.beginPath();
  ctx.moveTo(corredorX1, 0);
  ctx.lineTo(corredorX1, compPx);
  ctx.moveTo(corredorX2, 0);
  ctx.lineTo(corredorX2, compPx);
  ctx.stroke();

  // Eixo divisor
  ctx.strokeStyle = isDark ? "rgba(245, 158, 11, 0.25)" : "rgba(217, 119, 6, 0.3)";
  ctx.setLineDash([4 / AppState.camera.zoom, 4 / AppState.camera.zoom]);
  ctx.beginPath();
  ctx.moveTo(largPx / 2, 0);
  ctx.lineTo(largPx / 2, compPx);
  ctx.stroke();
  ctx.setLineDash([]);

  // Rótulos e Medidas
  ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.6)" : "rgba(51, 65, 85, 0.75)";
  ctx.font = `bold ${Math.max(10, 12 / AppState.camera.zoom)}px 'Outfit', sans-serif`;
  ctx.textAlign = "center";

  ctx.fillText(`Largura Total: ${AppState.area.largura_m}m`, largPx / 2, -8 / AppState.camera.zoom);
  ctx.fillText(`Corredor Central (${AppState.area.largura_corredor_m}m)`, largPx / 2, 25 / AppState.camera.zoom);

  const centroEsquerdo = corredorX1 / 2;
  const centroDireito = corredorX2 + (largPx - corredorX2) / 2;
  ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(51, 65, 85, 0.18)";
  ctx.font = `700 ${Math.max(14, 20 / AppState.camera.zoom)}px 'Outfit', sans-serif`;
  ctx.fillText("SETOR ESQUERDO", centroEsquerdo, 45 / AppState.camera.zoom);
  ctx.fillText("SETOR DIREITO", centroDireito, 45 / AppState.camera.zoom);

  ctx.restore();
}

function desenharBlocos() {
  AppState.blocos.forEach(bloco => {
    const cicloAtivo = AppState.ciclos.find(c => c.id_bloco === bloco.id_bloco && c.status === "ativo");
    const progresso = calcularProgressoCiclo(cicloAtivo);

    let opacidade = 1.0;
    if (AppState.filters.cultura !== "ALL") {
      if (!cicloAtivo || cicloAtivo.cultura !== AppState.filters.cultura) {
        opacidade = 0.18;
      }
    }

    if (AppState.filters.fase !== "ALL") {
      if (AppState.filters.fase === "EMPTY") {
        if (cicloAtivo) opacidade = 0.18;
      } else {
        const faseCor = progresso ? progresso.statusCor.toUpperCase() : "EMPTY";
        if (faseCor !== AppState.filters.fase) opacidade = 0.18;
      }
    }

    if (AppState.filters.setor !== "ALL") {
      if (bloco.setor.toUpperCase() !== AppState.filters.setor) {
        opacidade = 0.18;
      }
    }

    desenharBlocoIndividual(bloco, cicloAtivo, progresso, opacidade);
  });
}

function desenharBlocoIndividual(bloco, ciclo, progresso, opacidade) {
  const isDark = document.body.classList.contains("dark-theme");
  const isHoriz = bloco.orientacao !== "vertical";

  const dimXM = isHoriz ? bloco.comprimento_m : bloco.largura_m;
  const dimYM = isHoriz ? bloco.largura_m : bloco.comprimento_m;

  const x = metrosParaPixels(bloco.pos_x_m);
  const y = metrosParaPixels(bloco.pos_y_m);
  const largPx = metrosParaPixels(dimXM);
  const compPx = metrosParaPixels(dimYM);

  const isSelected = AppState.selectedBlockId === bloco.id_bloco;
  const isHovered = AppState.hoveredBlockId === bloco.id_bloco;
  const isMoving = AppState.isMovingBlock && AppState.movingBlockId === bloco.id_bloco;

  const statusCor = progresso ? progresso.statusCor : "empty";
  const corPrimaria = obterCorPorStatus(statusCor);

  ctx.save();
  ctx.globalAlpha = opacidade;

  // 1. Corpo da Bancada (Fundo nítido no tema claro ou escuro)
  if (isMoving) {
    ctx.fillStyle = "rgba(59, 130, 246, 0.25)";
  } else if (isSelected) {
    ctx.fillStyle = isDark ? "rgba(16, 185, 129, 0.28)" : "rgba(5, 150, 105, 0.18)";
  } else if (isHovered) {
    ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(241, 245, 249, 0.95)";
  } else {
    ctx.fillStyle = isDark ? "rgba(30, 41, 59, 0.95)" : "#ffffff";
  }

  ctx.beginPath();
  const raioBorda = 4 / AppState.camera.zoom;
  ctx.roundRect(x, y, largPx, compPx, [raioBorda]);
  ctx.fill();

  // Borda da Bancada
  ctx.lineWidth = (isSelected || isMoving ? 2.5 : 1.2) / AppState.camera.zoom;
  ctx.strokeStyle = isMoving
    ? "#3b82f6"
    : isSelected
      ? "#059669"
      : isDark
        ? "rgba(255, 255, 255, 0.22)"
        : "#cbd5e1";
  ctx.stroke();

  // 2. Perfis Hidropônicos ou Placas de Espuma Fenólica
  if (bloco.tipo_bloco === "germinacao") {
    // --- GERMINAÇÃO: PLACAS DE ESPUMA FENÓLICA & MICRO-CÉLULAS ---
    const numPlacas = bloco.qtd_placas || 2;
    const pad = 4 / AppState.camera.zoom;
    const innerW = largPx - (pad * 2);
    const innerH = compPx - (pad * 2);

    const placaW = isHoriz ? innerW / numPlacas : innerW;
    const placaH = isHoriz ? innerH : innerH / numPlacas;

    for (let p = 0; p < numPlacas; p++) {
      const px = isHoriz ? x + pad + (p * placaW) : x + pad;
      const py = isHoriz ? y + pad : y + pad + (p * placaH);
      const m = 2.5 / AppState.camera.zoom;
      const pw = placaW - (m * 2);
      const ph = placaH - (m * 2);

      if (pw <= 2 || ph <= 2) continue;

      // Fundo de cada placa de espuma
      ctx.fillStyle = isDark
        ? (ciclo ? "rgba(16, 185, 129, 0.12)" : "rgba(30, 41, 59, 0.75)")
        : (ciclo ? "rgba(209, 250, 229, 0.88)" : "rgba(241, 245, 249, 0.9)");
      ctx.beginPath();
      ctx.roundRect(px + m, py + m, pw, ph, [3 / AppState.camera.zoom]);
      ctx.fill();

      ctx.strokeStyle = isDark
        ? (ciclo ? "rgba(52, 211, 153, 0.35)" : "rgba(255, 255, 255, 0.12)")
        : (ciclo ? "rgba(16, 185, 129, 0.45)" : "#cbd5e1");
      ctx.lineWidth = 0.8 / AppState.camera.zoom;
      ctx.stroke();

      // Células da espuma (grid de microcélulas pontilhadas)
      const cols = Math.max(3, Math.min(8, Math.floor(pw / (6 / AppState.camera.zoom))));
      const rows = Math.max(3, Math.min(8, Math.floor(ph / (6 / AppState.camera.zoom))));
      const cellW = pw / (cols + 1);
      const cellH = ph / (rows + 1);

      for (let c = 1; c <= cols; c++) {
        for (let r = 1; r <= rows; r++) {
          const cx = px + m + c * cellW;
          const cy = py + m + r * cellH;
          ctx.beginPath();
          ctx.arc(cx, cy, 1.2 / AppState.camera.zoom, 0, Math.PI * 2);
          if (ciclo) {
            ctx.fillStyle = corPrimaria;
          } else {
            ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.22)" : "#94a3b8";
          }
          ctx.fill();
        }
      }
    }
  } else if (isHoriz) {
    // --- HORIZONTAL (TRANSVERSAL) ---
    const numPerfis = bloco.qtd_perfis || 8;
    const isTriangular = bloco.alinhamento_furos !== "paralelo";
    const espacoFuroM = (bloco.espacamento_furos_cm || 25) / 100;
    const stepFuroPx = metrosParaPixels(espacoFuroM);
    const diamMm = bloco.diametro_furo_mm || 50;
    const raioFuroM = (diamMm / 1000) / 2;
    const raioFuroCalculado = metrosParaPixels(raioFuroM);
    const raioFuro = Math.max(1.6, Math.min(8, raioFuroCalculado));
    const stepPerfilY = compPx / (numPerfis + 1);

    for (let i = 0; i < numPerfis; i++) {
      const py = y + (i + 1) * stepPerfilY;

      // Linha do perfil (canaleta)
      ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(148, 163, 184, 0.35)";
      ctx.lineWidth = 1 / AppState.camera.zoom;
      ctx.beginPath();
      ctx.moveTo(x + 4 / AppState.camera.zoom, py);
      ctx.lineTo(x + largPx - 4 / AppState.camera.zoom, py);
      ctx.stroke();

      // Furos do perfil com zigue-zague triangular
      const offsetHoleX = (isTriangular && i % 2 === 1) ? stepFuroPx / 2 : 0;
      let hx = x + 10 / AppState.camera.zoom + offsetHoleX;

      while (hx <= x + largPx - 8 / AppState.camera.zoom) {
        ctx.beginPath();
        ctx.arc(hx, py, raioFuro, 0, Math.PI * 2);

        if (ciclo) {
          ctx.fillStyle = corPrimaria;
          ctx.fill();
        } else {
          ctx.fillStyle = isDark ? "rgba(15, 23, 42, 0.85)" : "#e2e8f0";
          ctx.fill();
          ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.2)" : "#94a3b8";
          ctx.lineWidth = 0.6 / AppState.camera.zoom;
          ctx.stroke();
        }

        hx += stepFuroPx;
      }
    }
  } else {
    // --- VERTICAL (LONGITUDINAL) ---
    const numPerfis = bloco.qtd_perfis || 8;
    const isTriangular = bloco.alinhamento_furos !== "paralelo";
    const espacoFuroM = (bloco.espacamento_furos_cm || 25) / 100;
    const stepFuroPx = metrosParaPixels(espacoFuroM);
    const diamMm = bloco.diametro_furo_mm || 50;
    const raioFuroM = (diamMm / 1000) / 2;
    const raioFuroCalculado = metrosParaPixels(raioFuroM);
    const raioFuro = Math.max(1.6, Math.min(8, raioFuroCalculado));
    const stepPerfilX = largPx / (numPerfis + 1);

    for (let i = 0; i < numPerfis; i++) {
      const px = x + (i + 1) * stepPerfilX;

      ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(148, 163, 184, 0.35)";
      ctx.lineWidth = 1 / AppState.camera.zoom;
      ctx.beginPath();
      ctx.moveTo(px, y + 4 / AppState.camera.zoom);
      ctx.lineTo(px, y + compPx - 4 / AppState.camera.zoom);
      ctx.stroke();

      const offsetHoleY = (isTriangular && i % 2 === 1) ? stepFuroPx / 2 : 0;
      let hy = y + 10 / AppState.camera.zoom + offsetHoleY;

      while (hy <= y + compPx - 8 / AppState.camera.zoom) {
        ctx.beginPath();
        ctx.arc(px, hy, raioFuro, 0, Math.PI * 2);

        if (ciclo) {
          ctx.fillStyle = corPrimaria;
          ctx.fill();
        } else {
          ctx.fillStyle = isDark ? "rgba(15, 23, 42, 0.85)" : "#e2e8f0";
          ctx.fill();
          ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.2)" : "#94a3b8";
          ctx.lineWidth = 0.6 / AppState.camera.zoom;
          ctx.stroke();
        }

        hy += stepFuroPx;
      }
    }
  }

  // 3. Barra de Progresso no Topo
  const barHeight = Math.min(5, Math.max(2.5, compPx * 0.08));
  const barY = y + 2;
  const barWidthTotal = largPx - 6;
  const barX = x + 3;

  ctx.fillStyle = isDark ? "rgba(0, 0, 0, 0.55)" : "rgba(226, 232, 240, 0.9)";
  ctx.fillRect(barX, barY, barWidthTotal, barHeight);

  if (progresso) {
    const fillWidth = (barWidthTotal * progresso.pct) / 100;
    ctx.fillStyle = corPrimaria;
    ctx.fillRect(barX, barY, fillWidth, barHeight);
  }

  // 4. IDENTIFICAÇÃO COM PILL BADGES DE ALTO CONTRASTE (SUPORTE COMPACTO PARA MÓDULOS PEQUENOS)
  const isCompact = largPx < 115 || compPx < 65;

  if (isCompact) {
    // --- MODO COMPACTO UNIFICADO (CENTRALIZADO, SEM COLISÃO DE TEXTO) ---
    const badgeH = Math.min(compPx - 10, 24);
    const badgeW = Math.min(largPx - 8, 58);
    const badgeX = x + (largPx - badgeW) / 2;
    const badgeY = y + (compPx - badgeH) / 2;

    ctx.fillStyle = isDark ? "rgba(15, 23, 42, 0.95)" : "rgba(15, 23, 42, 0.92)";
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, [badgeH / 2]);
    ctx.fill();
    ctx.strokeStyle = ciclo ? corPrimaria : (isDark ? "rgba(255, 255, 255, 0.2)" : "#475569");
    ctx.lineWidth = ciclo ? 1.4 : 0.9;
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (badgeH >= 20) {
      // 2 Linhas: ID em cima, Status/Cultura resumida embaixo
      ctx.font = `700 8.5px 'Outfit', sans-serif`;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(bloco.id_bloco, badgeX + badgeW / 2, badgeY + badgeH * 0.33);

      ctx.font = `600 7px 'Plus Jakarta Sans', sans-serif`;
      ctx.fillStyle = ciclo ? (statusCor === "initial" ? "#34d399" : corPrimaria) : "#94a3b8";
      const shortTxt = ciclo ? (ciclo.cultura ? ciclo.cultura.slice(0, 6) : "Ativo") : "Vaga";
      ctx.fillText(shortTxt, badgeX + badgeW / 2, badgeY + badgeH * 0.72);
    } else {
      ctx.font = `700 8.5px 'Outfit', sans-serif`;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(bloco.id_bloco, badgeX + badgeW / 2, badgeY + badgeH / 2);
    }
  } else if (isHoriz) {
    // --- HORIZONTAL LARGO (BADGES SEPARADOS) ---
    const fontSizeTitulo = 10.5;
    const fontSizeInfo = 8.8;

    ctx.font = `700 ${fontSizeTitulo}px 'Outfit', sans-serif`;
    const idMetrics = ctx.measureText(bloco.id_bloco);
    const padXId = fontSizeTitulo * 0.65;
    const idBadgeW = idMetrics.width + (padXId * 2);
    const idBadgeH = fontSizeTitulo * 1.65;
    const idBadgeX = x + 5;
    const idBadgeY = y + compPx - idBadgeH - 4;

    ctx.font = `600 ${fontSizeInfo}px 'Plus Jakarta Sans', sans-serif`;
    const nomeCultura = formatarNomeCultura(ciclo ? ciclo.cultura : "", ciclo ? ciclo.variedade : "");
    const infoText = ciclo ? nomeCultura : "Vaga";
    const infoMetrics = ctx.measureText(infoText);
    const padXInfo = fontSizeInfo * 0.7;
    const infoBadgeW = infoMetrics.width + (padXInfo * 2);
    const infoBadgeH = fontSizeInfo * 1.65;
    const infoBadgeX = x + largPx - infoBadgeW - 5;
    const infoBadgeY = y + compPx - infoBadgeH - 4;

    // Se houver risco de colisão entre os dois crachás, desenha no centro
    if (idBadgeX + idBadgeW + 4 >= infoBadgeX) {
      const comboW = Math.min(largPx - 10, idBadgeW + infoBadgeW + 10);
      const comboX = x + (largPx - comboW) / 2;
      const comboY = y + (compPx - idBadgeH) / 2;

      ctx.fillStyle = isDark ? "rgba(15, 23, 42, 0.94)" : "rgba(15, 23, 42, 0.90)";
      ctx.beginPath();
      ctx.roundRect(comboX, comboY, comboW, idBadgeH, [idBadgeH / 2]);
      ctx.fill();
      ctx.strokeStyle = ciclo ? corPrimaria : "#475569";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${bloco.id_bloco} • ${infoText}`, comboX + comboW / 2, comboY + idBadgeH / 2);
    } else {
      // Badge ID à esquerda
      ctx.fillStyle = isDark ? "rgba(15, 23, 42, 0.94)" : "rgba(15, 23, 42, 0.90)";
      ctx.beginPath();
      ctx.roundRect(idBadgeX, idBadgeY, idBadgeW, idBadgeH, [fontSizeTitulo * 0.35]);
      ctx.fill();
      ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.18)" : "#334155";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = `700 ${fontSizeTitulo}px 'Outfit', sans-serif`;
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(bloco.id_bloco, idBadgeX + idBadgeW / 2, idBadgeY + idBadgeH / 2);

      // Badge Cultura à direita
      ctx.fillStyle = isDark ? "rgba(15, 23, 42, 0.90)" : "rgba(15, 23, 42, 0.85)";
      ctx.beginPath();
      ctx.roundRect(infoBadgeX, infoBadgeY, infoBadgeW, infoBadgeH, [fontSizeInfo * 0.35]);
      ctx.fill();
      ctx.strokeStyle = ciclo ? corPrimaria : (isDark ? "rgba(255, 255, 255, 0.12)" : "#475569");
      ctx.lineWidth = 0.8;
      ctx.stroke();

      ctx.font = `600 ${fontSizeInfo}px 'Plus Jakarta Sans', sans-serif`;
      ctx.fillStyle = ciclo ? (statusCor === "initial" ? "#34d399" : statusCor === "growth" ? "#10b981" : corPrimaria) : "#64748b";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(infoText, infoBadgeX + infoBadgeW / 2, infoBadgeY + infoBadgeH / 2);
    }
  } else {
    // --- VERTICAL (LONGITUDINAL) ---
    const fontSizeTitulo = 9.5;
    const fontSizeInfo = 8.0;

    ctx.font = `700 ${fontSizeTitulo}px 'Outfit', sans-serif`;
    const idMetrics = ctx.measureText(bloco.id_bloco);
    const padXId = fontSizeTitulo * 0.65;
    const idBadgeW = Math.min(largPx - 6, idMetrics.width + (padXId * 2));
    const idBadgeH = fontSizeTitulo * 1.65;
    const idBadgeX = x + (largPx - idBadgeW) / 2;
    const idBadgeY = y + 8;

    ctx.fillStyle = isDark ? "rgba(15, 23, 42, 0.94)" : "rgba(15, 23, 42, 0.90)";
    ctx.beginPath();
    ctx.roundRect(idBadgeX, idBadgeY, idBadgeW, idBadgeH, [fontSizeTitulo * 0.35]);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(bloco.id_bloco, idBadgeX + idBadgeW / 2, idBadgeY + idBadgeH / 2);

    if (ciclo) {
      const nomeCultura = formatarNomeCultura(ciclo.cultura, ciclo.variedade);
      ctx.font = `600 ${fontSizeInfo}px 'Plus Jakarta Sans', sans-serif`;
      const cultMetrics = ctx.measureText(nomeCultura);
      const padXCult = fontSizeInfo * 0.7;
      const cultBadgeW = Math.min(largPx - 6, cultMetrics.width + (padXCult * 2));
      const cultBadgeH = fontSizeInfo * 1.65;
      const cultBadgeX = x + (largPx - cultBadgeW) / 2;
      const cultBadgeY = y + idBadgeH + 14;

      ctx.fillStyle = isDark ? "rgba(15, 23, 42, 0.94)" : "rgba(15, 23, 42, 0.90)";
      ctx.beginPath();
      ctx.roundRect(cultBadgeX, cultBadgeY, cultBadgeW, cultBadgeH, [fontSizeInfo * 0.35]);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(nomeCultura, cultBadgeX + cultBadgeW / 2, cultBadgeY + cultBadgeH / 2);
    }
  }
  ctx.restore();
}

function desenharPreviewBloco() {
  let templateKey = "definitivo";
  if (AppState.activeTool === "add_maternidade") templateKey = "maternidade";
  if (AppState.activeTool === "add_bercario") templateKey = "bercario";
  if (AppState.activeTool === "add_germinacao") templateKey = "germinacao";

  const tpl = BLOCK_TEMPLATES[templateKey];
  const orientacao = AppState.currentOrientation;
  const isHoriz = orientacao !== "vertical";

  const dimXM = isHoriz ? tpl.comprimento_m : tpl.largura_m;
  const dimYM = isHoriz ? tpl.largura_m : tpl.comprimento_m;

  let posX = AppState.cursorMundo.x;
  let posY = AppState.cursorMundo.y;

  if (AppState.snapToGrid) {
    const snap = calcularSnap(posX, posY, tpl.largura_m, tpl.comprimento_m, orientacao);
    posX = snap.x;
    posY = snap.y;
  }

  const screenPos = mundoParaTela(posX, posY);
  const largPx = metrosParaPixels(dimXM) * AppState.camera.zoom;
  const compPx = metrosParaPixels(dimYM) * AppState.camera.zoom;

  ctx.save();
  ctx.strokeStyle = "#059669";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.fillStyle = "rgba(5, 150, 105, 0.15)";

  ctx.fillRect(screenPos.x, screenPos.y, largPx, compPx);
  ctx.strokeRect(screenPos.x, screenPos.y, largPx, compPx);

  ctx.fillStyle = "#047857";
  ctx.font = "bold 12px 'Outfit', sans-serif";
  ctx.textAlign = "center";
  const orientLabel = isHoriz ? "↔ Transversal" : "↕ Longitudinal";
  ctx.fillText(`+ ${tpl.labelPrefix} (${dimXM}m x ${dimYM}m) ${orientLabel}`, screenPos.x + largPx / 2, screenPos.y + compPx / 2);

  ctx.restore();
}

// ==========================================================================
// 7. SNAP-TO-GRID E ALINHAMENTO MAGNÉTICO
// ==========================================================================
function calcularSnap(x, y, largM, compM, orientacao = "horizontal", ignoreId = null) {
  const isHoriz = orientacao !== "vertical";
  const dimX = isHoriz ? compM : largM;
  const dimY = isHoriz ? largM : compM;

  // Grid fino de 10cm (0.1m) permitindo aproximação precisa entre bancadas
  let bestX = Math.round(x * 10) / 10;
  let bestY = Math.round(y * 10) / 10;

  const thresholdM = 0.45;
  const spacing = AppState.minCirculationSpacing || 0.25; // 25cm entre bancadas

  for (const b of AppState.blocos) {
    if (ignoreId && b.id_bloco === ignoreId) continue;

    const bIsHoriz = b.orientacao !== "vertical";
    const bDimX = bIsHoriz ? b.comprimento_m : b.largura_m;
    const bDimY = bIsHoriz ? b.largura_m : b.comprimento_m;

    if (isHoriz) {
      // Bancadas horizontais se empilham ao longo de Y bem coladinhas
      const yAbaixo = b.pos_y_m + bDimY + spacing;
      if (Math.abs(y - yAbaixo) < thresholdM) {
        bestY = yAbaixo;
        if (Math.abs(x - b.pos_x_m) < 0.6) {
          bestX = b.pos_x_m;
        }
      }

      const yAcima = b.pos_y_m - dimY - spacing;
      if (Math.abs(y - yAcima) < thresholdM) {
        bestY = yAcima;
        if (Math.abs(x - b.pos_x_m) < 0.6) {
          bestX = b.pos_x_m;
        }
      }
    } else {
      // Bancadas verticais se alinham lado a lado ao longo de X
      const xDepois = b.pos_x_m + bDimX + spacing;
      if (Math.abs(x - xDepois) < thresholdM) {
        bestX = xDepois;
        if (Math.abs(y - b.pos_y_m) < 0.6) {
          bestY = b.pos_y_m;
        }
      }

      const xAntes = b.pos_x_m - dimX - spacing;
      if (Math.abs(x - xAntes) < thresholdM) {
        bestX = xAntes;
        if (Math.abs(y - b.pos_y_m) < 0.6) {
          bestY = b.pos_y_m;
        }
      }
    }
  }

  const maxX = AppState.area.largura_m - dimX;
  const maxY = AppState.area.comprimento_m - dimY;
  bestX = Math.max(0.2, Math.min(maxX - 0.2, bestX));
  bestY = Math.max(0.5, Math.min(maxY - 0.5, bestY));

  return { x: Number(bestX.toFixed(2)), y: Number(bestY.toFixed(2)) };
}

// ==========================================================================
// 8. DETECÇÃO DE COLISÃO E CLIQUE NOS BLOCOS
// ==========================================================================
function obterBlocoNasCoordenadas(xM, yM) {
  for (let i = AppState.blocos.length - 1; i >= 0; i--) {
    const b = AppState.blocos[i];
    const isHoriz = b.orientacao !== "vertical";
    const dimX = isHoriz ? b.comprimento_m : b.largura_m;
    const dimY = isHoriz ? b.largura_m : b.comprimento_m;

    if (
      xM >= b.pos_x_m &&
      xM <= b.pos_x_m + dimX &&
      yM >= b.pos_y_m &&
      yM <= b.pos_y_m + dimY
    ) {
      return b;
    }
  }
  return null;
}

// ==========================================================================
// 9. MECANISMO DE ESPELHAMENTO (SETOR ESQUERDO -> DIREITO)
// ==========================================================================
function espelharBancadasEsquerdaParaDireita() {
  const meioX = AppState.area.largura_m / 2;
  const corredorMetade = AppState.area.largura_corredor_m / 2;

  const blocosEsquerda = AppState.blocos.filter(b => {
    const isHoriz = b.orientacao !== "vertical";
    const dimX = isHoriz ? b.comprimento_m : b.largura_m;
    return (b.pos_x_m + dimX <= meioX - corredorMetade) || b.setor === "esquerdo";
  });

  if (blocosEsquerda.length === 0) {
    mostrarToast("Nenhuma bancada no setor esquerdo para espelhar.", "warning");
    return;
  }

  AppState.blocos = AppState.blocos.filter(b => b.setor !== "direito");

  blocosEsquerda.forEach((b, idx) => {
    const isHoriz = b.orientacao !== "vertical";
    const dimX = isHoriz ? b.comprimento_m : b.largura_m;
    const novoX = AppState.area.largura_m - b.pos_x_m - dimX;
    
    let novoId = "";
    if (b.tipo_bloco === "germinacao") {
      const countGerm = AppState.blocos.filter(item => item.tipo_bloco === "germinacao").length + 1;
      novoId = `G-${String(countGerm).padStart(2, "0")}`;
    } else {
      const countBD = AppState.blocos.filter(item => item.setor === "direito" && item.tipo_bloco !== "germinacao").length + 1;
      novoId = `BD-${String(countBD).padStart(2, "0")}`;
    }

    const novoBloco = {
      ...b,
      id_bloco: novoId,
      setor: "direito",
      pos_x_m: Number(novoX.toFixed(2)),
      pos_y_m: b.pos_y_m,
      id_tanque: (b.tipo_bloco === "germinacao" || b.tipo_bloco === "maternidade")
        ? (AppState.tanques.find(t => t.id_tanque === "TANQUE-GERM" || t.id_tanque === "TANQUE-MAT")?.id_tanque || "TANQUE-MAT")
        : (AppState.tanques.find(t => t.setor === "direito")?.id_tanque || "TANQUE-DIR")
    };

    AppState.blocos.push(novoBloco);
  });

  salvarDadosLocal();
  atualizarFiltros();
  atualizarBadgeInfo();
  solicitarRedesenho();
  mostrarToast(`${blocosEsquerda.length} bancadas espelhadas para o Setor Direito!`, "success");
}

// ==========================================================================
// 10. INTERAÇÃO E GESTOS (MOUSE, TOUCH & DRAG/MOVE DE BANCADAS)
// ==========================================================================
let touchStartDist = 0;
let touchStartCenter = { x: 0, y: 0 };
let isTouchPanning = false;

function registrarEventosCanvas() {
  viewport.addEventListener("mousedown", e => {
    // 1. Início do Arrasto da Bancada no Modo Mover
    if (e.button === 0 && AppState.isMovingBlock) {
      const bloco = AppState.blocos.find(b => b.id_bloco === AppState.movingBlockId);
      if (bloco) {
        const isHoriz = bloco.orientacao !== "vertical";
        const dimX = isHoriz ? bloco.comprimento_m : bloco.largura_m;
        const dimY = isHoriz ? bloco.largura_m : bloco.comprimento_m;

        const sobreBloco = (
          AppState.cursorMundo.x >= bloco.pos_x_m - 0.4 &&
          AppState.cursorMundo.x <= bloco.pos_x_m + dimX + 0.4 &&
          AppState.cursorMundo.y >= bloco.pos_y_m - 0.4 &&
          AppState.cursorMundo.y <= bloco.pos_y_m + dimY + 0.4
        );

        if (sobreBloco) {
          AppState.isDraggingMovingBlock = true;
          AppState.dragOffsetM = {
            x: AppState.cursorMundo.x - bloco.pos_x_m,
            y: AppState.cursorMundo.y - bloco.pos_y_m
          };
          canvas.style.cursor = "grabbing";
          return;
        }
      }
    }

    // 2. Pan padrão da Câmera (Arrasto do mouse no canvas move apenas a visualização)
    if (e.button === 1 || (e.button === 0 && (e.spaceKey || (!AppState.isMovingBlock && AppState.activeTool === "select")))) {
      AppState.camera.isDragging = true;
      AppState.camera.dragStartX = e.clientX - AppState.camera.offsetX;
      AppState.camera.dragStartY = e.clientY - AppState.camera.offsetY;
      canvas.classList.add("grabbing");
    }
  });

  window.addEventListener("mousemove", e => {
    const rect = viewport.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    AppState.cursorMundo = telaParaMundo(mouseX, mouseY);
    atualizarCoordenadasInfo(AppState.cursorMundo.x, AppState.cursorMundo.y);

    // Movimentação da bancada: APENAS quando o usuário clicou e está arrastando
    if (AppState.isMovingBlock) {
      const bloco = AppState.blocos.find(b => b.id_bloco === AppState.movingBlockId);
      if (bloco) {
        const isHoriz = bloco.orientacao !== "vertical";
        const dimX = isHoriz ? bloco.comprimento_m : bloco.largura_m;
        const dimY = isHoriz ? bloco.largura_m : bloco.comprimento_m;

        if (AppState.isDraggingMovingBlock) {
          let rawX = AppState.cursorMundo.x - AppState.dragOffsetM.x;
          let rawY = AppState.cursorMundo.y - AppState.dragOffsetM.y;

          if (AppState.snapToGrid) {
            const snap = calcularSnap(rawX, rawY, bloco.largura_m, bloco.comprimento_m, bloco.orientacao, bloco.id_bloco);
            rawX = snap.x;
            rawY = snap.y;
          }

          // Limita as coordenadas dentro dos limites da estufa
          bloco.pos_x_m = Math.max(0.2, Math.min(AppState.area.largura_m - dimX - 0.2, Number(rawX.toFixed(2))));
          bloco.pos_y_m = Math.max(0.5, Math.min(AppState.area.comprimento_m - dimY - 0.5, Number(rawY.toFixed(2))));
          bloco.setor = bloco.pos_x_m < (AppState.area.largura_m / 2) ? "esquerdo" : "direito";

          const coordsEl = document.getElementById("move-banner-coords");
          if (coordsEl) {
            coordsEl.textContent = `Posição: ${bloco.pos_x_m.toFixed(1)}m, ${bloco.pos_y_m.toFixed(1)}m (${bloco.setor})`;
          }

          solicitarRedesenho();
          return;
        } else {
          // Não está arrastando: cursor indica se está sobre a bancada (grab) ou fora (default)
          const sobreBloco = (
            AppState.cursorMundo.x >= bloco.pos_x_m &&
            AppState.cursorMundo.x <= bloco.pos_x_m + dimX &&
            AppState.cursorMundo.y >= bloco.pos_y_m &&
            AppState.cursorMundo.y <= bloco.pos_y_m + dimY
          );
          canvas.style.cursor = sobreBloco ? "grab" : "default";
        }
      }
    }

    if (AppState.camera.isDragging) {
      AppState.camera.offsetX = e.clientX - AppState.camera.dragStartX;
      AppState.camera.offsetY = e.clientY - AppState.camera.dragStartY;
      solicitarRedesenho();
      return;
    }

    if (AppState.activeTool.startsWith("add_")) {
      solicitarRedesenho();
    } else if (!AppState.isMovingBlock) {
      const hovered = obterBlocoNasCoordenadas(AppState.cursorMundo.x, AppState.cursorMundo.y);
      const novoHoverId = hovered ? hovered.id_bloco : null;
      if (novoHoverId !== AppState.hoveredBlockId) {
        AppState.hoveredBlockId = novoHoverId;
        canvas.style.cursor = hovered ? "pointer" : "default";
        solicitarRedesenho();
      }

      // Atualizar tooltip flutuante
      const tooltip = document.getElementById("canvas-block-tooltip");
      if (tooltip) {
        if (hovered) {
          const rect = viewport.getBoundingClientRect();
          const mouseRelX = e.clientX - rect.left;
          const mouseRelY = e.clientY - rect.top;

          // Posição segura (não sai pelas bordas)
          let tipX = mouseRelX + 16;
          let tipY = mouseRelY - 16;
          if (tipX + 270 > rect.width) tipX = mouseRelX - 270;
          if (tipY < 8) tipY = mouseRelY + 24;
          tooltip.style.left = tipX + "px";
          tooltip.style.top = tipY + "px";

          // Reconstrói HTML sempre que o bloco inspecionado mudar ou tooltip abrir
          if (hovered.id_bloco !== lastTooltipBlockId || !tooltip.classList.contains("visible")) {
            lastTooltipBlockId = hovered.id_bloco;
            const cicloAtivo = AppState.ciclos.find(c => c.id_bloco === hovered.id_bloco && c.status === "ativo");
            const prog = cicloAtivo ? calcularProgressoCiclo(cicloAtivo) : null;

            const isGerm = hovered.tipo_bloco === "germinacao";
            const iconTipo = isGerm ? "🧫" : "🌿";
            const tipoRotulo = isGerm ? "germinação (espuma fenólica)" : (hovered.tipo_bloco || "bancada");

            let tipHTML = `<div class="tip-id">${iconTipo} ${hovered.id_bloco} <span style="font-weight:400;color:#64748b;font-size:0.7rem;">${tipoRotulo}</span></div>`;

            if (cicloAtivo && prog) {
              const nomeCompleto = formatarNomeCultura(cicloAtivo.cultura, cicloAtivo.variedade);
              const corProg = prog.pct >= 80 ? "#f59e0b" : "#10b981";
              const totalCap = hovered.total_furos || (isGerm ? (hovered.qtd_placas || 2) * (hovered.celulas_por_placa || 196) : 192);
              const qtdRestante = cicloAtivo.qtd_restante !== undefined ? cicloAtivo.qtd_restante : (cicloAtivo.qtd_inicial || totalCap);
              const unidadeNome = isGerm ? "mudas" : "plantas";
              const colheitaTxt = isGerm 
                ? (prog.diasRestantes > 0 ? `${prog.diasRestantes}d (p/ berçário)` : "✅ Pronta p/ berçário")
                : (prog.diasRestantes > 0 ? `${prog.diasRestantes}d` : "✅ Pronto p/ colheita");

              tipHTML += `<div class="tip-cultura">${nomeCompleto}</div>`;
              tipHTML += `<div class="tip-row"><span class="tip-label">Progresso</span><span class="tip-value" style="color:${corProg}">${prog.pct}%</span></div>`;
              tipHTML += `<div class="tip-row"><span class="tip-label">${isGerm ? "Transplante" : "Colheita"}</span><span class="tip-value">${colheitaTxt}</span></div>`;
              tipHTML += `<div class="tip-row"><span class="tip-label">Estoque</span><span class="tip-value">${qtdRestante} ${unidadeNome} ${isGerm ? `(${hovered.qtd_placas || 2} placas)` : ''}</span></div>`;
              tipHTML += `<div class="tip-progress-bar"><div class="tip-progress-fill" style="width:${prog.pct}%;background:${corProg}"></div></div>`;
            } else {
              tipHTML += `<div class="tip-vaga">${isGerm ? "Módulo vago — pronto para semeadura" : "Bancada vaga — sem cultivo ativo"}</div>`;
              const totalCap = hovered.total_furos || (isGerm ? (hovered.qtd_placas || 2) * (hovered.celulas_por_placa || 196) : 192);
              tipHTML += `<div class="tip-row"><span class="tip-label">Capacidade</span><span class="tip-value">${totalCap} ${isGerm ? `mudas (${hovered.qtd_placas || 2} placas)` : 'plantas'}</span></div>`;
            }
            tooltip.innerHTML = tipHTML;
          }
          tooltip.classList.add("visible");
        } else {
          lastTooltipBlockId = null;
          tooltip.classList.remove("visible");
        }
      }
    }
  });

  window.addEventListener("mouseup", () => {
    if (AppState.isMovingBlock && AppState.isDraggingMovingBlock) {
      AppState.isDraggingMovingBlock = false;
      canvas.style.cursor = "grab";
      const bloco = AppState.blocos.find(b => b.id_bloco === AppState.movingBlockId);
      const coordsEl = document.getElementById("move-banner-coords");
      if (bloco && coordsEl) {
        coordsEl.textContent = `Posição fixada: ${bloco.pos_x_m.toFixed(1)}m, ${bloco.pos_y_m.toFixed(1)}m (Clique em 'Salvar Localização' para confirmar)`;
      }
      solicitarRedesenho();
    }

    if (AppState.camera.isDragging) {
      AppState.camera.isDragging = false;
      canvas.classList.remove("grabbing");
    }
  });

  viewport.addEventListener("wheel", e => {
    e.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    aplicarZoomCentrado(zoomFactor, mouseX, mouseY);
  }, { passive: false });

  viewport.addEventListener("click", e => {
    // Se estiver no modo mover, o clique posiciona no local e aguarda confirmação do botão Salvar
    if (AppState.isMovingBlock) {
      const coordsEl = document.getElementById("move-banner-coords");
      const bloco = AppState.blocos.find(b => b.id_bloco === AppState.movingBlockId);
      if (bloco && coordsEl) {
        coordsEl.textContent = `Posição fixada: ${bloco.pos_x_m.toFixed(1)}m, ${bloco.pos_y_m.toFixed(1)}m (Clique em Salvar para confirmar)`;
      }
      return;
    }

    const rect = viewport.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const mundoCoords = telaParaMundo(mouseX, mouseY);

    if (AppState.activeTool === "select") {
      const bloco = obterBlocoNasCoordenadas(mundoCoords.x, mundoCoords.y);
      if (bloco) {
        abrirPainelInspecao(bloco.id_bloco);
      } else {
        fecharPainelInspecao();
      }
    } else if (AppState.activeTool.startsWith("add_")) {
      inserirNovoBloco(mundoCoords.x, mundoCoords.y);
    }
  });

  // Touch Mobile
  viewport.addEventListener("touchstart", e => {
    if (e.touches.length === 1) {
      isTouchPanning = true;
      const t = e.touches[0];
      AppState.camera.dragStartX = t.clientX - AppState.camera.offsetX;
      AppState.camera.dragStartY = t.clientY - AppState.camera.offsetY;
    } else if (e.touches.length === 2) {
      isTouchPanning = false;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      touchStartDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      touchStartCenter = {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2
      };
    }
  }, { passive: true });

  viewport.addEventListener("touchmove", e => {
    if (e.touches.length === 1 && isTouchPanning) {
      const t = e.touches[0];
      AppState.camera.offsetX = t.clientX - AppState.camera.dragStartX;
      AppState.camera.offsetY = t.clientY - AppState.camera.dragStartY;
      solicitarRedesenho();
    } else if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

      if (touchStartDist > 0) {
        const factor = currentDist / touchStartDist;
        const rect = viewport.getBoundingClientRect();
        aplicarZoomCentrado(factor, touchStartCenter.x - rect.left, touchStartCenter.y - rect.top);
        touchStartDist = currentDist;
      }
    }
  }, { passive: true });

  viewport.addEventListener("touchend", e => {
    if (e.touches.length === 0) {
      isTouchPanning = false;
      touchStartDist = 0;
    }
  });

  // Atalho de Teclado R para rotação
  window.addEventListener("keydown", e => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;

    if (e.key === "r" || e.key === "R") {
      alternarOrientacao();
    }
  });
}

function finalizarReposicionamento() {
  const b = AppState.blocos.find(item => item.id_bloco === AppState.movingBlockId);
  AppState.isMovingBlock = false;
  AppState.movingBlockId = null;

  document.getElementById("canvas-insert-banner").classList.add("hidden");
  canvas.style.cursor = "default";
  salvarDadosLocal();

  if (b) {
    abrirPainelInspecao(b.id_bloco);
    mostrarToast(`Bancada ${b.id_bloco} fixada na posição (${b.pos_x_m}m, ${b.pos_y_m}m)!`, "success");
  }
}

function aplicarZoomCentrado(factor, centerX, centerY) {
  const antigoZoom = AppState.camera.zoom;
  let novoZoom = antigoZoom * factor;
  novoZoom = Math.max(AppState.camera.minZoom, Math.min(AppState.camera.maxZoom, novoZoom));

  if (novoZoom === antigoZoom) return;

  AppState.camera.offsetX = centerX - (centerX - AppState.camera.offsetX) * (novoZoom / antigoZoom);
  AppState.camera.offsetY = centerY - (centerY - AppState.camera.offsetY) * (novoZoom / antigoZoom);
  AppState.camera.zoom = novoZoom;

  solicitarRedesenho();
}

function alternarOrientacao() {
  AppState.currentOrientation = AppState.currentOrientation === "horizontal" ? "vertical" : "horizontal";

  const isHoriz = AppState.currentOrientation === "horizontal";
  const label = isHoriz ? "↔ Transversal" : "↕ Longitudinal";

  const bannerOrientacao = document.getElementById("banner-orientacao");
  if (bannerOrientacao) bannerOrientacao.textContent = label;

  solicitarRedesenho();
  mostrarToast(`Orientação da bancada: ${label}`, "info");
}

function inserirNovoBloco(xM, yM) {
  if (!verificarPermissaoEdicao()) {
    definirFerramentaAtiva("select");
    return;
  }
  let templateKey = "definitivo";
  if (AppState.activeTool === "add_maternidade") templateKey = "maternidade";
  if (AppState.activeTool === "add_bercario") templateKey = "bercario";
  if (AppState.activeTool === "add_germinacao") templateKey = "germinacao";

  const tpl = BLOCK_TEMPLATES[templateKey];
  const orientacao = AppState.currentOrientation;

  let finalPos = { x: xM, y: yM };
  if (AppState.snapToGrid) {
    finalPos = calcularSnap(xM, yM, tpl.largura_m, tpl.comprimento_m, orientacao);
  }

  const meioEstufa = AppState.area.largura_m / 2;
  const setor = finalPos.x < meioEstufa ? "esquerdo" : "direito";

  let idBloco = "";
  if (tpl.tipo_bloco === "germinacao") {
    const countGerm = AppState.blocos.filter(b => b.tipo_bloco === "germinacao").length + 1;
    idBloco = `G-${String(countGerm).padStart(2, "0")}`;
  } else {
    const countSetor = AppState.blocos.filter(b => b.setor === setor && b.tipo_bloco !== "germinacao").length + 1;
    const idPrefixo = setor === "esquerdo" ? "BE" : "BD";
    idBloco = `${idPrefixo}-${String(countSetor).padStart(2, "0")}`;
  }

  const novoBloco = {
    id_bloco: idBloco,
    id_area: AppState.area.id_area,
    tipo_bloco: tpl.tipo_bloco,
    setor: setor,
    orientacao: orientacao,
    pos_x_m: finalPos.x,
    pos_y_m: finalPos.y,
    largura_m: tpl.largura_m,
    comprimento_m: tpl.comprimento_m,
    qtd_placas: tpl.qtd_placas || (tpl.tipo_bloco === "germinacao" ? 2 : undefined),
    celulas_por_placa: tpl.celulas_por_placa || (tpl.tipo_bloco === "germinacao" ? 196 : undefined),
    qtd_perfis: tpl.qtd_perfis || 0,
    alinhamento_furos: tpl.alinhamento_furos || "triangular",
    espacamento_furos_cm: tpl.espacamento_furos_cm || 25,
    diametro_furo_mm: tpl.diametro_furo_mm || (tpl.tipo_bloco === "germinacao" ? 15 : 50),
    total_furos: tpl.total_furos || (tpl.tipo_bloco === "germinacao" ? (tpl.qtd_placas || 2) * (tpl.celulas_por_placa || 196) : calcularTotalFuros(tpl)),
    id_tanque: obterTanquePadraoParaBloco({ tipo_bloco: tpl.tipo_bloco, setor: setor })
  };

  AppState.blocos.push(novoBloco);
  salvarDadosLocal();
  atualizarFiltros();
  atualizarBadgeInfo();
  solicitarRedesenho();

  const rotuloTipo = tpl.tipo_bloco === "germinacao" ? "Módulo de Germinação" : "Bancada";
  mostrarToast(`${rotuloTipo} ${idBloco} inserido com sucesso!`, "success");
  definirFerramentaAtiva("select");
}

// ==========================================================================
// 11. PAINEL DE INSPEÇÃO DO BLOCO
// ==========================================================================
const inspectorPanel = document.getElementById("block-inspector");

function abrirPainelInspecao(idBloco) {
  AppState.selectedBlockId = idBloco;
  solicitarRedesenho();

  const bloco = AppState.blocos.find(b => b.id_bloco === idBloco);
  if (!bloco) return;

  const cicloAtivo = AppState.ciclos.find(c => c.id_bloco === idBloco && c.status === "ativo");
  const progresso = calcularProgressoCiclo(cicloAtivo);

  const isGerminacao = bloco.tipo_bloco === "germinacao";
  document.getElementById("inspector-bloco-id").textContent = isGerminacao
    ? `Módulo Germinação ${bloco.id_bloco}`
    : `Bancada ${bloco.id_bloco}`;

  const isHoriz = bloco.orientacao !== "vertical";
  const orientStr = isHoriz ? "↔ Transversal" : "↕ Longitudinal";
  const furosStr = bloco.alinhamento_furos === "paralelo" ? "Furação Paralela" : "Furação Triangular (Quincôncio)";
  const totalPlantas = bloco.total_furos || calcularTotalFuros(bloco);

  if (isGerminacao) {
    document.getElementById("inspector-tipo-tag").textContent =
      `GERMINAÇÃO • Espuma Fenólica • ${bloco.qtd_placas || 2} placas (${totalPlantas} mudas)`;
    document.getElementById("inspector-setor-tag").textContent =
      `Setor ${bloco.setor.charAt(0).toUpperCase() + bloco.setor.slice(1)} • Células: ${bloco.celulas_por_placa || 196}/placa`;
  } else {
    document.getElementById("inspector-tipo-tag").textContent =
      `${bloco.tipo_bloco.toUpperCase()} • ${orientStr} • ${bloco.qtd_perfis} perfis (${totalPlantas} plantas)`;
    document.getElementById("inspector-setor-tag").textContent =
      `Setor ${bloco.setor.charAt(0).toUpperCase() + bloco.setor.slice(1)} • Posição (${bloco.pos_x_m}m, ${bloco.pos_y_m}m) • ${furosStr}`;
  }

  const furosTag = document.getElementById("inspector-furos-tag");
  if (furosTag) {
    if (isGerminacao) {
      furosTag.textContent = `Espuma Fenólica (${totalPlantas} células)`;
    } else {
      furosTag.textContent = `Furo: ${bloco.diametro_furo_mm || 50}mm (${bloco.espacamento_furos_cm || 25}cm)`;
    }
  }

  const tanqueLabel = document.getElementById("inspector-tanque-label");
  if (tanqueLabel) {
    const tanque = AppState.tanques ? AppState.tanques.find(t => t.id_tanque === bloco.id_tanque) : null;
    if (tanque) {
      tanqueLabel.textContent = `${tanque.nome} (${Number(tanque.volume_litros).toLocaleString("pt-BR")} L)`;
    } else {
      tanqueLabel.textContent = "Não vinculado";
    }
  }

  const btnToggleCiclo = document.getElementById("label-toggle-ciclo");
  const stockBox = document.getElementById("inspector-stock-box");
  const btnColheita = document.getElementById("btn-open-colheita-modal");
  const btnEditarCultivo = document.getElementById("btn-editar-cultivo");

  if (cicloAtivo) {
    const nomeFormatado = formatarNomeCultura(cicloAtivo.cultura, cicloAtivo.variedade);
    document.getElementById("inspector-cultura").textContent = nomeFormatado;

    const varEl = document.getElementById("inspector-variedade");
    if (cicloAtivo.variedade && cicloAtivo.variedade.trim() !== "" && !cicloAtivo.cultura.toLowerCase().includes(cicloAtivo.variedade.toLowerCase())) {
      varEl.textContent = `Variedade: ${cicloAtivo.variedade}`;
      varEl.style.display = "block";
    } else {
      varEl.style.display = "none";
    }

    document.getElementById("inspector-progress-pct").textContent = `${progresso.pct}%`;

    const barFill = document.getElementById("inspector-progress-bar");
    barFill.style.width = `${progresso.pct}%`;
    barFill.style.backgroundColor = obterCorPorStatus(progresso.statusCor);

    document.getElementById("inspector-data-plantio").textContent = formatarDataSimples(cicloAtivo.data_plantio);
    document.getElementById("inspector-dias-decorridos").textContent = `${progresso.diasDecorridos} dias`;
    document.getElementById("inspector-dias-restantes").textContent = `${progresso.diasRestantes} dias`;

    // Informações de Estoque e Plantas Colhidas
    const totalQtd = cicloAtivo.qtd_inicial || bloco.total_furos || totalPlantas;
    const restanteQtd = cicloAtivo.qtd_restante !== undefined ? cicloAtivo.qtd_restante : totalQtd;
    const colhidasQtd = Math.max(0, totalQtd - restanteQtd);
    const pctDisponivel = totalQtd > 0 ? Math.round((restanteQtd / totalQtd) * 100) : 0;

    const unidadeNome = isGerminacao ? "mudas" : "plantas";
    document.getElementById("inspector-stock-count").textContent = `${restanteQtd} / ${totalQtd} ${unidadeNome}`;
    document.getElementById("inspector-stock-bar").style.width = `${pctDisponivel}%`;
    document.getElementById("inspector-stock-subinfo").textContent = isGerminacao 
      ? `${colhidasQtd} mudas transplantadas / retiradas` 
      : `${colhidasQtd} plantas colhidas`;
    document.getElementById("inspector-stock-pct").textContent = `${pctDisponivel}% disponível`;

    if (stockBox) stockBox.style.display = "block";
    if (btnColheita) {
      btnColheita.style.display = "inline-flex";
      btnColheita.innerHTML = isGerminacao 
        ? "<span>🌿 Transplantar Mudas</span>" 
        : "<span>🌾 Colheita / Retirada</span>";
    }
    if (btnEditarCultivo) {
      btnEditarCultivo.style.display = "inline-flex";
      btnEditarCultivo.innerHTML = isGerminacao
        ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg><span>Editar Semeadura</span>'
        : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg><span>Editar Cultivo</span>';
    }

    btnToggleCiclo.textContent = isGerminacao ? "Finalizar / Liberar Mesa" : "Finalizar Ciclo / Liberar";
  } else {
    document.getElementById("inspector-cultura").textContent = isGerminacao ? "Módulo Vazio (Semeadura)" : "Bancada Vazia";
    const varEl = document.getElementById("inspector-variedade");
    if (varEl) {
      varEl.textContent = isGerminacao ? "Nenhuma germinação em andamento" : "Nenhum cultivo em andamento";
      varEl.style.display = "block";
    }
    document.getElementById("inspector-progress-pct").textContent = "0%";

    const barFill = document.getElementById("inspector-progress-bar");
    barFill.style.width = "0%";
    barFill.style.backgroundColor = "#94a3b8";

    document.getElementById("inspector-data-plantio").textContent = "-";
    document.getElementById("inspector-dias-decorridos").textContent = "0 dias";
    document.getElementById("inspector-dias-restantes").textContent = "-";

    if (stockBox) stockBox.style.display = "none";
    if (btnColheita) btnColheita.style.display = "none";
    if (btnEditarCultivo) btnEditarCultivo.style.display = "none";

    btnToggleCiclo.textContent = isGerminacao ? "🌱 Iniciar Germinação" : "Iniciar Plantio";
  }

  atualizarContadorHistoricoInspector(idBloco);

  inspectorPanel.classList.add("open");
  inspectorPanel.setAttribute("aria-hidden", "false");
}

function fecharPainelInspecao() {
  AppState.selectedBlockId = null;
  inspectorPanel.classList.remove("open");
  inspectorPanel.setAttribute("aria-hidden", "true");
  solicitarRedesenho();
}

function atualizarContadorHistoricoInspector(idBloco) {
  const tratosBloco = AppState.tratos.filter(t => t.id_bloco === idBloco);
  const countEl = document.getElementById("inspector-history-count");
  if (countEl) {
    countEl.textContent = `${tratosBloco.length} ${tratosBloco.length === 1 ? "registro" : "registros"}`;
  }
}

let filtroHistoricoAtual = "ALL";

function abrirModalHistoricoEGraficos(idBloco) {
  const bloco = AppState.blocos.find(b => b.id_bloco === idBloco);
  if (!bloco) return;

  const cicloAtivo = AppState.ciclos.find(c => c.id_bloco === idBloco && c.status === "ativo") ||
                     AppState.ciclos.filter(c => c.id_bloco === idBloco).pop();

  document.getElementById("history-modal-bloco-id").textContent = `Bancada ${bloco.id_bloco}`;
  document.getElementById("history-modal-cultura").textContent = cicloAtivo 
    ? formatarNomeCultura(cicloAtivo.cultura, cicloAtivo.variedade)
    : "Bancada Desocupada";

  const chipStatus = document.getElementById("history-modal-ciclo-status");
  if (chipStatus) {
    chipStatus.textContent = cicloAtivo ? (cicloAtivo.status === "ativo" ? "Ciclo em Andamento" : "Ciclo Finalizado") : "Sem Ciclo";
    chipStatus.style.background = cicloAtivo && cicloAtivo.status === "ativo" ? "rgba(16, 185, 129, 0.15)" : "rgba(148, 163, 184, 0.15)";
    chipStatus.style.color = cicloAtivo && cicloAtivo.status === "ativo" ? "#10b981" : "#94a3b8";
  }

  // 1. Métricas
  const totalPlantas = cicloAtivo ? (cicloAtivo.qtd_inicial || bloco.total_furos || 192) : (bloco.total_furos || 192);
  const restante = cicloAtivo ? (cicloAtivo.qtd_restante !== undefined ? cicloAtivo.qtd_restante : totalPlantas) : 0;
  const colhidas = Math.max(0, totalPlantas - restante);
  const pctRestante = totalPlantas > 0 ? ((restante / totalPlantas) * 100).toFixed(1) : 0;
  const pctColhido = totalPlantas > 0 ? ((colhidas / totalPlantas) * 100).toFixed(1) : 0;

  const tratosBloco = AppState.tratos.filter(t => t.id_bloco === idBloco);

  document.getElementById("history-metric-inicial").textContent = cicloAtivo ? totalPlantas : "-";
  document.getElementById("history-metric-data-plantio").textContent = cicloAtivo ? `Plantado em ${formatarDataSimples(cicloAtivo.data_plantio)}` : "Sem plantio";

  document.getElementById("history-metric-colhido").textContent = cicloAtivo ? colhidas : "0";
  document.getElementById("history-metric-taxa-colheita").textContent = cicloAtivo ? `${pctColhido}% do lote` : "0%";

  document.getElementById("history-metric-restante").textContent = cicloAtivo ? restante : "0";
  document.getElementById("history-metric-pct-restante").textContent = cicloAtivo ? `${pctRestante}% na bancada` : "Bancada vaga";

  document.getElementById("history-metric-total-tratos").textContent = tratosBloco.length;

  // 2. Renderizar Linha do Tempo e Gráfico
  renderizarTimelineHistorico(idBloco, filtroHistoricoAtual);

  const modalHist = document.getElementById("modal-historico-graficos");
  modalHist.classList.add("open");

  setTimeout(() => {
    desenharGraficoHistoricoRetirada(idBloco);
  }, 50);
}

function renderizarTimelineHistorico(idBloco, filtro = "ALL") {
  const container = document.getElementById("history-timeline-container");
  if (!container) return;
  container.innerHTML = "";

  let tratosBloco = AppState.tratos
    .filter(t => t.id_bloco === idBloco)
    .sort((a, b) => new Date(b.data_hora) - new Date(a.data_hora));

  if (filtro === "COLHEITA") {
    tratosBloco = tratosBloco.filter(t => t.tipo_manejo.toLowerCase().includes("colheita"));
  } else if (filtro === "MANEJO") {
    tratosBloco = tratosBloco.filter(t => !t.tipo_manejo.toLowerCase().includes("colheita"));
  }

  if (tratosBloco.length === 0) {
    container.innerHTML = `<div style="text-align: center; padding: 24px 10px; color: var(--text-muted); font-size: 0.85rem;">
      Nenhum registro encontrado para este filtro.
    </div>`;
    return;
  }

  tratosBloco.forEach(t => {
    const isColheita = t.tipo_manejo.toLowerCase().includes("colheita");
    const item = document.createElement("div");
    item.className = `history-timeline-item ${isColheita ? "colheita-item" : ""}`;
    item.innerHTML = `
      <div class="history-item-top">
        <span style="font-weight: 600; color: ${isColheita ? "#f59e0b" : "#3b82f6"};">${t.data_hora}</span>
        <span style="background: rgba(255,255,255,0.06); padding: 2px 8px; border-radius: 10px;">${t.responsavel || "Operador"}</span>
      </div>
      <div class="history-item-action">${t.tipo_manejo}</div>
      <div class="history-item-obs">${t.observacoes || "Sem observações adicionais."}</div>
    `;
    container.appendChild(item);
  });
}

function desenharGraficoHistoricoRetirada(idBloco) {
  const chartCanvas = document.getElementById("canvas-history-chart");
  if (!chartCanvas) return;

  const rect = chartCanvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = rect.width || 760;
  const h = rect.height || 210;

  chartCanvas.width = w * dpr;
  chartCanvas.height = h * dpr;

  const c = chartCanvas.getContext("2d");
  c.scale(dpr, dpr);
  c.clearRect(0, 0, w, h);

  const isDark = document.body.classList.contains("dark-theme");
  const bloco = AppState.blocos.find(b => b.id_bloco === idBloco);
  const cicloAtivo = AppState.ciclos.find(c => c.id_bloco === idBloco && c.status === "ativo") ||
                     AppState.ciclos.filter(c => c.id_bloco === idBloco).pop();

  const totalInicial = cicloAtivo ? (cicloAtivo.qtd_inicial || bloco.total_furos || 192) : (bloco ? bloco.total_furos : 192);
  const colheitas = (cicloAtivo && cicloAtivo.colheitas) ? cicloAtivo.colheitas : [];

  // Margens internas do gráfico
  const padLeft = 50;
  const padRight = 30;
  const padTop = 25;
  const padBottom = 35;
  const chartW = w - padLeft - padRight;
  const chartH = h - padTop - padBottom;

  // Grade e Eixo Y
  c.strokeStyle = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(100, 116, 139, 0.15)";
  c.lineWidth = 1;
  c.font = "11px 'Plus Jakarta Sans', sans-serif";
  c.fillStyle = isDark ? "rgba(255, 255, 255, 0.5)" : "rgba(100, 116, 139, 0.8)";
  c.textAlign = "right";
  c.textBaseline = "middle";

  const numGridLines = 4;
  for (let i = 0; i <= numGridLines; i++) {
    const frac = i / numGridLines;
    const yVal = padTop + chartH * (1 - frac);
    const valQtd = Math.round(totalInicial * frac);

    c.beginPath();
    c.moveTo(padLeft, yVal);
    c.lineTo(w - padRight, yVal);
    c.stroke();

    c.fillText(`${valQtd} un`, padLeft - 8, yVal);
  }

  // Montagem da série temporal de dados
  const pontos = [];
  const plantioDataStr = cicloAtivo ? cicloAtivo.data_plantio : "Início";
  pontos.push({
    label: formatarDataSimples(plantioDataStr),
    qtdRestante: totalInicial,
    colheitaQtd: 0,
    destino: "Plantio Inicial"
  });

  let saldo = totalInicial;
  colheitas.forEach((colh, idx) => {
    saldo = Math.max(0, saldo - colh.qtd);
    const dataHoraStr = colh.data_hora ? colh.data_hora.slice(5, 10).replace("-", "/") : `Colh ${idx + 1}`;
    pontos.push({
      label: dataHoraStr,
      qtdRestante: saldo,
      colheitaQtd: colh.qtd,
      destino: colh.destino || "Retirada"
    });
  });

  if (colheitas.length === 0) {
    pontos.push({
      label: "Hoje",
      qtdRestante: totalInicial,
      colheitaQtd: 0,
      destino: "Estoque 100%"
    });
  }

  const stepX = chartW / (pontos.length > 1 ? pontos.length - 1 : 1);

  // 1. Barras de Colheita / Retirada (em Dourado/Laranja)
  pontos.forEach((p, i) => {
    if (p.colheitaQtd > 0) {
      const px = padLeft + i * stepX;
      const barH = (p.colheitaQtd / totalInicial) * chartH;
      const barY = padTop + chartH - barH;
      const barW = Math.min(36, stepX * 0.45);

      c.fillStyle = "rgba(245, 158, 11, 0.85)";
      c.beginPath();
      c.roundRect(px - barW / 2, barY, barW, barH, [4, 4, 0, 0]);
      c.fill();

      c.fillStyle = "#f59e0b";
      c.font = "bold 11px 'Outfit', sans-serif";
      c.textAlign = "center";
      c.textBaseline = "bottom";
      c.fillText(`-${p.colheitaQtd}`, px, barY - 3);
    }
  });

  // 2. Linha e Área de Estoque Restante (em Verde)
  c.beginPath();
  pontos.forEach((p, i) => {
    const px = padLeft + i * stepX;
    const py = padTop + chartH * (1 - (p.qtdRestante / totalInicial));
    if (i === 0) c.moveTo(px, py);
    else c.lineTo(px, py);
  });

  const gradiente = c.createLinearGradient(0, padTop, 0, padTop + chartH);
  gradiente.addColorStop(0, "rgba(16, 185, 129, 0.35)");
  gradiente.addColorStop(1, "rgba(16, 185, 129, 0.02)");

  c.lineTo(padLeft + (pontos.length - 1) * stepX, padTop + chartH);
  c.lineTo(padLeft, padTop + chartH);
  c.closePath();
  c.fillStyle = gradiente;
  c.fill();

  c.beginPath();
  pontos.forEach((p, i) => {
    const px = padLeft + i * stepX;
    const py = padTop + chartH * (1 - (p.qtdRestante / totalInicial));
    if (i === 0) c.moveTo(px, py);
    else c.lineTo(px, py);
  });
  c.strokeStyle = "#10b981";
  c.lineWidth = 2.5;
  c.stroke();

  pontos.forEach((p, i) => {
    const px = padLeft + i * stepX;
    const py = padTop + chartH * (1 - (p.qtdRestante / totalInicial));

    c.beginPath();
    c.arc(px, py, 4.5, 0, Math.PI * 2);
    c.fillStyle = "#ffffff";
    c.fill();
    c.strokeStyle = "#10b981";
    c.lineWidth = 2.5;
    c.stroke();

    c.fillStyle = isDark ? "#f1f5f9" : "#0f172a";
    c.font = "bold 10.5px 'Plus Jakarta Sans', sans-serif";
    c.textAlign = "center";
    c.textBaseline = "bottom";
    c.fillText(`${p.qtdRestante}`, px, py - 6);

    c.fillStyle = isDark ? "rgba(255, 255, 255, 0.6)" : "rgba(100, 116, 139, 0.9)";
    c.font = "11px 'Plus Jakarta Sans', sans-serif";
    c.textBaseline = "top";
    c.fillText(p.label, px, padTop + chartH + 8);
  });
}

function formatarDataSimples(dataStr) {
  if (!dataStr) return "-";
  const parts = dataStr.split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : dataStr;
}

// ==========================================================================
// 12. GESTÃO DE MODAIS E FORMULÁRIOS
// ==========================================================================
function setupModaisEFormularios() {
  const modalTrato = document.getElementById("modal-trato");
  const modalCiclo = document.getElementById("modal-novo-ciclo");
  const modalArea = document.getElementById("modal-config-area");
  const modalSheets = document.getElementById("modal-sheets");
  const modalConfigBloco = document.getElementById("modal-config-bloco");
  const modalConfirmDelete = document.getElementById("modal-confirm-delete");
  const modalColheita = document.getElementById("modal-colheita");
  const modalLogin = document.getElementById("modal-login");
  const modalUsuariosGestor = document.getElementById("modal-usuarios-gestor");
  const modalSetupGestor = document.getElementById("modal-setup-gestor");

  // Fechamento genérico
  document.querySelectorAll("[data-close]").forEach(btn => {
    btn.addEventListener("click", () => {
      const modalId = btn.getAttribute("data-close");
      document.getElementById(modalId)?.classList.remove("open");
    });
  });

  // --- BOTÃO REPOSICIONAR NO CROQUI (SEGURO COM CONFIRMAÇÃO) ---
  document.getElementById("btn-reposition-bloco").addEventListener("click", () => {
    if (!verificarPermissaoEdicao()) return;
    if (!AppState.selectedBlockId) return;
    const bloco = AppState.blocos.find(b => b.id_bloco === AppState.selectedBlockId);
    if (!bloco) return;

    // Guarda a posição de backup caso o usuário queira cancelar
    AppState.moveOriginal = {
      id: bloco.id_bloco,
      x: bloco.pos_x_m,
      y: bloco.pos_y_m,
      setor: bloco.setor
    };
    AppState.isMovingBlock = true;
    AppState.movingBlockId = bloco.id_bloco;

    fecharPainelInspecao();

    const banner = document.getElementById("canvas-move-banner");
    if (banner) {
      banner.classList.remove("hidden");
      document.getElementById("move-banner-bloco-id").textContent = `Bancada ${bloco.id_bloco}`;
      document.getElementById("move-banner-coords").textContent = `Posição: ${bloco.pos_x_m.toFixed(1)}m, ${bloco.pos_y_m.toFixed(1)}m`;
    }

    canvas.style.cursor = "move";
    solicitarRedesenho();
    mostrarToast(`Mova o mouse sobre a estufa para posicionar a bancada ${bloco.id_bloco}. Clique em "Salvar Localização" para confirmar!`, "info");
  });

  // Confirmação de salvamento da nova localização da bancada
  document.getElementById("btn-save-block-pos")?.addEventListener("click", () => {
    if (!AppState.isMovingBlock) return;
    const bloco = AppState.blocos.find(b => b.id_bloco === AppState.movingBlockId);
    if (bloco) {
      const meioEstufa = AppState.area.largura_m / 2;
      const novoSetor = bloco.pos_x_m < meioEstufa ? "esquerdo" : "direito";
      const setorAntigo = bloco.setor;
      bloco.setor = novoSetor;

      // Se mudou de setor e possui prefixo BE- ou BD-, atualiza automaticamente a identificação
      const idAtual = bloco.id_bloco;
      let novoId = idAtual;

      if (novoSetor === "direito" && idAtual.startsWith("BE-")) {
        const num = idAtual.replace("BE-", "");
        let candidate = `BD-${num}`;
        if (AppState.blocos.some(b => b.id_bloco === candidate && b !== bloco)) {
          const maxBd = AppState.blocos.filter(b => b.id_bloco.startsWith("BD-")).length + 1;
          candidate = `BD-${String(maxBd).padStart(2, "0")}`;
        }
        novoId = candidate;
      } else if (novoSetor === "esquerdo" && idAtual.startsWith("BD-")) {
        const num = idAtual.replace("BD-", "");
        let candidate = `BE-${num}`;
        if (AppState.blocos.some(b => b.id_bloco === candidate && b !== bloco)) {
          const maxBe = AppState.blocos.filter(b => b.id_bloco.startsWith("BE-")).length + 1;
          candidate = `BE-${String(maxBe).padStart(2, "0")}`;
        }
        novoId = candidate;
      }

      if (novoId !== idAtual) {
        bloco.id_bloco = novoId;
        AppState.ciclos.forEach(c => { if (c.id_bloco === idAtual) c.id_bloco = novoId; });
        AppState.tratos.forEach(t => { if (t.id_bloco === idAtual) t.id_bloco = novoId; });
        if (AppState.selectedBlockId === idAtual) AppState.selectedBlockId = novoId;
        mostrarToast(`Bancada movida para o Setor ${novoSetor.toUpperCase()} e identificada como ${novoId}!`, "success");
      } else {
        mostrarToast(`Localização da bancada ${bloco.id_bloco} salva com sucesso!`, "success");
      }

      salvarDadosLocal();
      abrirPainelInspecao(bloco.id_bloco);
    }
    AppState.isMovingBlock = false;
    AppState.movingBlockId = null;
    AppState.isDraggingMovingBlock = false;
    AppState.moveOriginal = null;
    document.getElementById("canvas-move-banner")?.classList.add("hidden");
    canvas.style.cursor = "default";
    solicitarRedesenho();
  });

  // Cancelamento da movimentação e reversão à posição original
  document.getElementById("btn-cancel-block-pos")?.addEventListener("click", () => {
    if (!AppState.isMovingBlock) return;
    if (AppState.moveOriginal) {
      const bloco = AppState.blocos.find(b => b.id_bloco === AppState.moveOriginal.id);
      if (bloco) {
        bloco.pos_x_m = AppState.moveOriginal.x;
        bloco.pos_y_m = AppState.moveOriginal.y;
        bloco.setor = AppState.moveOriginal.setor;
        abrirPainelInspecao(bloco.id_bloco);
      }
    }
    AppState.isMovingBlock = false;
    AppState.movingBlockId = null;
    AppState.moveOriginal = null;
    document.getElementById("canvas-move-banner")?.classList.add("hidden");
    canvas.style.cursor = "default";
    solicitarRedesenho();
    mostrarToast("Movimentação cancelada. Posição original restaurada.", "info");
  });

  // Tecla Escape para cancelar movimentação
  window.addEventListener("keydown", e => {
    if (e.key === "Escape" && AppState.isMovingBlock) {
      document.getElementById("btn-cancel-block-pos")?.click();
    }
  });

  // --- EXCLUSÃO DE BANCADA COM MODAL IN-APP ---
  document.getElementById("btn-delete-bloco").addEventListener("click", () => {
    if (!verificarPermissaoEdicao()) return;
    const id = AppState.selectedBlockId;
    if (!id) return;
    document.getElementById("delete-prompt-msg").textContent = `Deseja realmente excluir a Bancada ${id}?`;
    modalConfirmDelete.classList.add("open");
  });

  document.getElementById("btn-confirm-delete-action").addEventListener("click", () => {
    const id = AppState.selectedBlockId;
    if (!id) return;

    AppState.blocos = AppState.blocos.filter(b => b.id_bloco !== id);
    AppState.ciclos = AppState.ciclos.filter(c => c.id_bloco !== id);
    AppState.tratos = AppState.tratos.filter(t => t.id_bloco !== id);

    salvarDadosLocal();
    fecharPainelInspecao();
    modalConfirmDelete.classList.remove("open");

    atualizarFiltros();
    atualizarBadgeInfo();
    solicitarRedesenho();

    mostrarToast(`Bancada ${id} excluída com sucesso!`, "info");

    if (AppState.googleSheetsUrl) {
      registrarAcaoRemota("salvarLayout", {
        area: AppState.area,
        blocos: AppState.blocos
      });
    }
  });

  function abrirConfiguracaoBloco(blocoOuTemplate, isEdicao = false) {
    const inputId = document.getElementById("config-bloco-id");
    const groupId = document.getElementById("group-config-bloco-id");

    if (isEdicao) {
      inputId.value = blocoOuTemplate.id_bloco;
      inputId.setAttribute("data-original-id", blocoOuTemplate.id_bloco);
      if (groupId) groupId.style.display = "block";
    } else {
      inputId.value = "";
      inputId.removeAttribute("data-original-id");
      if (groupId) groupId.style.display = "none";
    }

    const isGerm = (blocoOuTemplate.tipo_bloco === "germinacao");

    document.getElementById("title-config-bloco").textContent = isEdicao
      ? (isGerm ? `Editar Módulo Germinação ${blocoOuTemplate.id_bloco}` : `Editar Bancada ${blocoOuTemplate.id_bloco}`)
      : "Configurar Template Padrão de Bancada";

    document.getElementById("config-tipo-bloco").value = blocoOuTemplate.tipo_bloco || "definitivo";
    document.getElementById("config-orientacao").value = blocoOuTemplate.orientacao || AppState.currentOrientation;
    document.getElementById("config-comprimento").value = blocoOuTemplate.comprimento_m || (isGerm ? 1.0 : 6.0);
    document.getElementById("config-largura").value = blocoOuTemplate.largura_m || (isGerm ? 1.0 : 1.5);
    document.getElementById("config-qtd-perfis").value = blocoOuTemplate.qtd_perfis || 8;
    document.getElementById("config-alinhamento-furos").value = blocoOuTemplate.alinhamento_furos || "triangular";
    document.getElementById("config-espaco-furos").value = blocoOuTemplate.espacamento_furos_cm || 25;
    document.getElementById("config-diametro-furo").value = blocoOuTemplate.diametro_furo_mm || 50;

    // Campos de germinação
    const inputQtdPlacas = document.getElementById("config-qtd-placas");
    if (inputQtdPlacas) inputQtdPlacas.value = blocoOuTemplate.qtd_placas || 2;

    const selectCelulas = document.getElementById("config-celulas-placa");
    const customCelulas = document.getElementById("config-custom-celulas");
    const groupCustom = document.getElementById("group-custom-celulas");
    const celVal = blocoOuTemplate.celulas_por_placa || 196;

    if (selectCelulas) {
      if ([100, 196, 300].includes(celVal)) {
        selectCelulas.value = String(celVal);
        if (groupCustom) groupCustom.style.display = "none";
      } else {
        selectCelulas.value = "custom";
        if (customCelulas) customCelulas.value = celVal;
        if (groupCustom) groupCustom.style.display = "block";
      }
    }

    const tanqueSelect = document.getElementById("config-tanque-select");
    if (tanqueSelect) {
      tanqueSelect.innerHTML = (AppState.tanques || []).map(t =>
        `<option value="${t.id_tanque}">${t.nome} (${Number(t.volume_litros).toLocaleString("pt-BR")} L)</option>`
      ).join("");
      if (isEdicao && blocoOuTemplate.id_tanque) {
        tanqueSelect.value = blocoOuTemplate.id_tanque;
      } else if (tanqueSelect.options.length > 0) {
        const padraoId = obterTanquePadraoParaBloco(blocoOuTemplate);
        if (padraoId) tanqueSelect.value = padraoId;
      }
    }

    atualizarCalculosPreviewModalBloco();
    modalConfigBloco.classList.add("open");
  }

  function atualizarCalculosPreviewModalBloco() {
    const tipo = document.getElementById("config-tipo-bloco")?.value || "definitivo";
    const larg = parseFloat(document.getElementById("config-largura").value) || 1.5;
    const comp = parseFloat(document.getElementById("config-comprimento").value) || 6.0;

    const secaoGerm = document.getElementById("secao-germinacao-espuma");
    const secaoPerfis = document.getElementById("secao-perfis-canaletas");
    const labelComp = document.getElementById("label-config-comprimento");

    if (tipo === "germinacao") {
      if (secaoGerm) secaoGerm.style.display = "block";
      if (secaoPerfis) secaoPerfis.style.display = "none";
      if (labelComp) labelComp.textContent = "Comprimento da Mesa (m):";

      const qtdPlacas = parseInt(document.getElementById("config-qtd-placas")?.value, 10) || 2;
      const selCel = document.getElementById("config-celulas-placa")?.value || "196";
      const groupCustom = document.getElementById("group-custom-celulas");
      if (groupCustom) groupCustom.style.display = selCel === "custom" ? "block" : "none";

      const celulas = selCel === "custom" 
        ? (parseInt(document.getElementById("config-custom-celulas")?.value, 10) || 196) 
        : (parseInt(selCel, 10) || 196);

      const totalMudas = qtdPlacas * celulas;
      document.getElementById("config-total-furos-preview").textContent = 
        `${totalMudas.toLocaleString("pt-BR")} mudas • ${qtdPlacas} placa(s) de ${celulas} células de espuma fenólica`;
    } else {
      if (secaoGerm) secaoGerm.style.display = "none";
      if (secaoPerfis) secaoPerfis.style.display = "block";
      if (labelComp) labelComp.textContent = "Comprimento dos Perfis (m):";

      const qtdPerfis = parseInt(document.getElementById("config-qtd-perfis").value, 10) || 8;
      const espacoFuroCm = parseFloat(document.getElementById("config-espaco-furos").value) || 25;
      const diamFuro = document.getElementById("config-diametro-furo")?.value || 50;

      const espacoPerfisCm = ((larg / (qtdPerfis + 1)) * 100).toFixed(1);
      document.getElementById("config-espaco-perfis").value = `${espacoPerfisCm} cm`;

      const furosPorPerfil = Math.max(1, Math.floor((comp - 0.2) / (espacoFuroCm / 100)));
      const totalPlantas = qtdPerfis * furosPorPerfil;
      document.getElementById("config-total-furos-preview").textContent = `${totalPlantas} plantas • Furos de ${diamFuro}mm`;
    }
  }

  ["config-largura", "config-comprimento", "config-qtd-perfis", "config-espaco-furos", "config-diametro-furo", "config-tipo-bloco", "config-qtd-placas", "config-celulas-placa", "config-custom-celulas"].forEach(id => {
    document.getElementById(id)?.addEventListener("input", atualizarCalculosPreviewModalBloco);
    document.getElementById(id)?.addEventListener("change", atualizarCalculosPreviewModalBloco);
  });

  document.getElementById("btn-edit-bloco").addEventListener("click", () => {
    if (!verificarPermissaoEdicao()) return;
    if (!AppState.selectedBlockId) return;
    const bloco = AppState.blocos.find(b => b.id_bloco === AppState.selectedBlockId);
    if (bloco) abrirConfiguracaoBloco(bloco, true);
  });

  document.getElementById("opt-config-templates")?.addEventListener("click", () => {
    fecharTodosDropdowns();
    if (!verificarPermissaoEdicao(true)) return;
    abrirConfiguracaoBloco(BLOCK_TEMPLATES["definitivo"], false);
  });

  document.getElementById("banner-btn-config")?.addEventListener("click", () => {
    if (!verificarPermissaoEdicao(true)) return;
    let key = "definitivo";
    if (AppState.activeTool === "add_maternidade") key = "maternidade";
    if (AppState.activeTool === "add_bercario") key = "bercario";
    if (AppState.activeTool === "add_germinacao") key = "germinacao";
    abrirConfiguracaoBloco(BLOCK_TEMPLATES[key], false);
  });

  document.getElementById("form-config-bloco").addEventListener("submit", e => {
    e.preventDefault();
    const idOriginal = document.getElementById("config-bloco-id").getAttribute("data-original-id");
    let novoId = document.getElementById("config-bloco-id").value.trim();
    const orientacao = document.getElementById("config-orientacao").value;
    const comprimento = parseFloat(document.getElementById("config-comprimento").value);
    const largura = parseFloat(document.getElementById("config-largura").value);
    const qtdPerfis = parseInt(document.getElementById("config-qtd-perfis").value, 10);
    const alinhamento = document.getElementById("config-alinhamento-furos").value;
    const espacoFuros = parseFloat(document.getElementById("config-espaco-furos").value);
    const diametroFuro = parseInt(document.getElementById("config-diametro-furo").value, 10) || 50;
    const tipo = document.getElementById("config-tipo-bloco").value;

    const isGerm = (tipo === "germinacao");
    let qtdPlacas = 2;
    let celulasPlaca = 196;
    let totalFuros = 0;

    if (isGerm) {
      qtdPlacas = parseInt(document.getElementById("config-qtd-placas")?.value, 10) || 2;
      const selCel = document.getElementById("config-celulas-placa")?.value || "196";
      celulasPlaca = selCel === "custom"
        ? (parseInt(document.getElementById("config-custom-celulas")?.value, 10) || 196)
        : (parseInt(selCel, 10) || 196);
      totalFuros = qtdPlacas * celulasPlaca;
    } else {
      const furosPorPerfil = Math.max(1, Math.floor((comprimento - 0.2) / (espacoFuros / 100)));
      totalFuros = qtdPerfis * furosPorPerfil;
    }

    if (idOriginal) {
      const bloco = AppState.blocos.find(b => b.id_bloco === idOriginal);
      if (bloco) {
        // Se o usuário renomeou o bloco:
        if (novoId && novoId !== idOriginal) {
          if (AppState.blocos.some(b => b.id_bloco === novoId && b !== bloco)) {
            mostrarToast(`Já existe uma bancada com o nome "${novoId}". Escolha outro nome.`, "warning");
            return;
          }
          bloco.id_bloco = novoId;
          AppState.ciclos.forEach(c => { if (c.id_bloco === idOriginal) c.id_bloco = novoId; });
          AppState.tratos.forEach(t => { if (t.id_bloco === idOriginal) t.id_bloco = novoId; });
          if (AppState.selectedBlockId === idOriginal) AppState.selectedBlockId = novoId;
        } else {
          novoId = idOriginal;
        }

        bloco.tipo_bloco = tipo;
        bloco.orientacao = orientacao;
        bloco.comprimento_m = comprimento;
        bloco.largura_m = largura;
        bloco.qtd_placas = isGerm ? qtdPlacas : undefined;
        bloco.celulas_por_placa = isGerm ? celulasPlaca : undefined;
        bloco.qtd_perfis = isGerm ? 0 : qtdPerfis;
        bloco.alinhamento_furos = alinhamento;
        bloco.espacamento_furos_cm = isGerm ? 2.5 : espacoFuros;
        bloco.diametro_furo_mm = isGerm ? 15 : diametroFuro;
        bloco.total_furos = totalFuros;

        const selTanqueId = document.getElementById("config-tanque-select")?.value;
        if (selTanqueId) bloco.id_tanque = selTanqueId;

        salvarDadosLocal();
        abrirPainelInspecao(novoId);
        solicitarRedesenho();
        mostrarToast(`${isGerm ? "Módulo" : "Bancada"} ${novoId} atualizado com sucesso!`, "success");
      }
    } else {
      let key = "definitivo";
      if (tipo === "maternidade") key = "maternidade";
      if (tipo === "bercario") key = "bercario";
      if (tipo === "germinacao") key = "germinacao";

      BLOCK_TEMPLATES[key] = {
        ...BLOCK_TEMPLATES[key],
        tipo_bloco: tipo,
        orientacao: orientacao,
        comprimento_m: comprimento,
        largura_m: largura,
        qtd_placas: isGerm ? qtdPlacas : undefined,
        celulas_por_placa: isGerm ? celulasPlaca : undefined,
        qtd_perfis: isGerm ? 0 : qtdPerfis,
        alinhamento_furos: alinhamento,
        espacamento_furos_cm: isGerm ? 2.5 : espacoFuros,
        diametro_furo_mm: isGerm ? 15 : diametroFuro,
        total_furos: totalFuros
      };
      AppState.currentOrientation = orientacao;
      mostrarToast(`Template ${tipo.toUpperCase()} configurado com sucesso!`, "success");
    }

    modalConfigBloco.classList.remove("open");
  });

  // --- TRATOS CULTURAIS (POR BANCADA: MATERNIDADE VS DEFINITIVA) ---
  function configurarTagsModalTrato(bloco) {
    const container = document.getElementById("trato-tags-container");
    const avisoBox = document.getElementById("trato-contexto-aviso");
    const avisoBadge = document.getElementById("trato-bloco-id-badge");
    const avisoMsg = document.getElementById("trato-contexto-msg");
    const inputTipo = document.getElementById("trato-tipo-input");
    if (!container || !inputTipo) return;

    const isGerminacao = bloco && bloco.tipo_bloco === "germinacao";
    const isMaternidade = bloco && bloco.tipo_bloco === "maternidade";

    if (avisoBadge) avisoBadge.textContent = isGerminacao ? `Módulo ${bloco.id_bloco}` : `Bancada ${bloco ? bloco.id_bloco : ""}`;

    let tags = [];
    if (isGerminacao) {
      if (avisoBox) {
        avisoBox.style.background = "rgba(16, 185, 129, 0.12)";
        avisoBox.style.borderColor = "rgba(16, 185, 129, 0.35)";
      }
      if (avisoBadge) avisoBadge.style.color = "#10b981";
      if (avisoMsg) {
        avisoMsg.innerHTML = "<strong>Módulo de Germinação (Espuma Fenólica)</strong>: Manejos de semeadura, controle de umidade das placas, quebra de dormência e raleio de mudas.";
      }
      tags = [
        "Umedecimento / Irrigação das Placas",
        "Retirada do Escuro (Emergência)",
        "Desbaste / Raleio de Plântulas",
        "Pulverização / Hidratação Foliar",
        "Ajuste de Condutividade Suave",
        "Sanitização e Limpeza da Mesa"
      ];
    } else if (isMaternidade) {
      if (avisoBox) {
        avisoBox.style.background = "rgba(16, 185, 129, 0.09)";
        avisoBox.style.borderColor = "rgba(16, 185, 129, 0.3)";
      }
      if (avisoBadge) avisoBadge.style.color = "#10b981";
      if (avisoMsg) {
        avisoMsg.innerHTML = "<strong>Maternidade de Mudas</strong>: Possui reservatório próprio dedicado. Adições de nutrientes e correção de pH afetam apenas esta bancada.";
      }
      tags = [
        "Adição de Nutrientes (Maternidade)",
        "Correção de pH (Maternidade)",
        "Semeadura / Germinação",
        "Limpeza e sanitização de canaletas",
        "Controle sanitário preventivo",
        "Desobstrução de microaspersores"
      ];
    } else {
      const tipoNome = bloco && bloco.tipo_bloco === "bercario" ? "Berçário" : "Definitiva (Engorda)";
      if (avisoBox) {
        avisoBox.style.background = "rgba(59, 130, 246, 0.08)";
        avisoBox.style.borderColor = "rgba(59, 130, 246, 0.25)";
      }
      if (avisoBadge) avisoBadge.style.color = "#3b82f6";
      if (avisoMsg) {
        avisoMsg.innerHTML = `<strong>${tipoNome}</strong>: Recebe solução do tanque central da estufa. Para nutrição e pH geral, utilize o botão <strong>🏠 Estufa</strong> no topo. Registre aqui tratos individuais do leito.`;
      }
      tags = [
        "Limpeza e sanitização de canaletas",
        "Desobstrução de injetores/microtubos",
        "Raleio / Desbaste de mudas",
        "Tratamento fitossanitário localizado",
        "Manutenção de cavalete e perfil",
        "Inspeção de fluxo e raízes"
      ];
    }

    container.innerHTML = "";
    tags.forEach((tag, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `trato-tag-btn ${idx === 0 ? "active" : ""}`;
      btn.setAttribute("data-value", tag);
      btn.textContent = tag;
      btn.addEventListener("click", () => {
        container.querySelectorAll(".trato-tag-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        inputTipo.value = tag;
      });
      container.appendChild(btn);
    });

    inputTipo.value = tags[0];
  }

  document.getElementById("btn-open-trato-modal").addEventListener("click", () => {
    if (!verificarPermissaoEdicao()) return;
    if (!AppState.selectedBlockId) return;
    const bloco = AppState.blocos.find(b => b.id_bloco === AppState.selectedBlockId);
    configurarTagsModalTrato(bloco);

    const now = new Date();
    const dataLocal = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    document.getElementById("trato-data-hora").value = dataLocal;
    if (AppState.currentUser) {
      document.getElementById("trato-responsavel").value = AppState.currentUser.nome;
    }
    modalTrato.classList.add("open");
  });

  const tratoInput = document.getElementById("trato-tipo-input");

  document.getElementById("form-trato").addEventListener("submit", async e => {
    e.preventDefault();
    if (!AppState.selectedBlockId) return;

    const idBloco = AppState.selectedBlockId;
    const cicloAtivo = AppState.ciclos.find(c => c.id_bloco === idBloco && c.status === "ativo");

    const novoTrato = {
      id_trato: `TRATO-${Date.now()}`,
      id_bloco: idBloco,
      id_ciclo: cicloAtivo ? cicloAtivo.id_ciclo : "SEM_CICLO",
      data_hora: document.getElementById("trato-data-hora").value.replace("T", " "),
      tipo_manejo: tratoInput.value,
      responsavel: document.getElementById("trato-responsavel").value,
      observacoes: document.getElementById("trato-obs").value
    };

    AppState.tratos.push(novoTrato);
    salvarDadosLocal();
    atualizarContadorHistoricoInspector(idBloco);
    if (document.getElementById("modal-historico-graficos")?.classList.contains("open")) {
      renderizarTimelineHistorico(idBloco, filtroHistoricoAtual);
      desenharGraficoHistoricoRetirada(idBloco);
    }
    modalTrato.classList.remove("open");
    document.getElementById("trato-obs").value = "";

    mostrarToast(`Trato Cultural "${novoTrato.tipo_manejo}" registrado!`, "success");

    if (AppState.googleSheetsUrl) {
      await registrarAcaoRemota("registrarTrato", novoTrato);
    }
  });

  // --- MANEJOS DA ESTUFA & TANQUES DE SOLUÇÃO (MODAL 14) ---
  const modalManejosEstufa = document.getElementById("modal-manejos-estufa");
  const btnManejosEstufa = document.getElementById("btn-manejos-estufa");

  function atualizarOpcoesAlvoEstufa() {
    const alvoSelect = document.getElementById("estufa-alvo-select");
    if (!alvoSelect) return;
    const valorAtual = alvoSelect.value;
    let html = `<option value="ESTRUTURA-GERAL">🏠 Estrutura Geral da Estufa (Teto, Telas, Corredores)</option>`;
    (AppState.tanques || []).forEach(t => {
      const volFmt = Number(t.volume_litros).toLocaleString("pt-BR");
      html += `<option value="${t.id_tanque}">🚰 ${t.nome} (${volFmt} L)</option>`;
    });
    alvoSelect.innerHTML = html;
    if (valorAtual && Array.from(alvoSelect.options).some(o => o.value === valorAtual)) {
      alvoSelect.value = valorAtual;
    }
  }

  function atualizarVisibilidadeCamposEstufa(tipoTrato, tagBtn) {
    const camposQuimicos = document.getElementById("estufa-campos-quimicos");
    const alvoSelect = document.getElementById("estufa-alvo-select");
    const isQuimico = tagBtn
      ? tagBtn.getAttribute("data-tipo") === "quimico"
      : (tipoTrato && (tipoTrato.includes("pH") || tipoTrato.includes("Nutrientes") || tipoTrato.includes("Solução")));

    if (camposQuimicos) {
      camposQuimicos.style.display = isQuimico ? "block" : "none";
    }

    if (alvoSelect) {
      if (isQuimico) {
        // Se estiver em Estrutura Geral para manejo químico de fertirrigação, direciona ao primeiro tanque
        if (alvoSelect.value === "ESTRUTURA-GERAL" && AppState.tanques && AppState.tanques.length > 0) {
          alvoSelect.value = AppState.tanques[0].id_tanque;
        }
      } else {
        // Manejo estrutural (limpeza de teto, tela, corredores) aplica à estrutura geral
        alvoSelect.value = "ESTRUTURA-GERAL";
      }
    }
  }

  function renderizarHistoricoEstufaModal() {
    const lista = document.getElementById("estufa-historico-lista");
    const countEl = document.getElementById("estufa-historico-count");
    if (!lista) return;

    const tratosEstufa = AppState.tratos
      .filter(t => t.id_bloco === "ESTUFA-GERAL" || (t.id_bloco && t.id_bloco.startsWith("TANQUE-")) || t.id_ciclo === "ESTUFA")
      .sort((a, b) => new Date(b.data_hora) - new Date(a.data_hora));

    if (countEl) {
      countEl.textContent = `${tratosEstufa.length} ${tratosEstufa.length === 1 ? "registro" : "registros"}`;
    }

    if (tratosEstufa.length === 0) {
      lista.innerHTML = `<span style="color: var(--text-muted); font-style: italic;">Nenhum manejo geral da estufa registrado até o momento.</span>`;
      return;
    }

    lista.innerHTML = "";
    tratosEstufa.slice(0, 6).forEach(t => {
      let alvoNome = "Estrutura Geral";
      if (t.alvo_nome) {
        alvoNome = t.alvo_nome;
      } else if (t.id_bloco && t.id_bloco.startsWith("TANQUE-")) {
        const tq = (AppState.tanques || []).find(tk => tk.id_tanque === t.id_bloco);
        alvoNome = tq ? tq.nome : t.id_bloco;
      }

      const item = document.createElement("div");
      item.className = "estufa-historico-item";
      item.innerHTML = `
        <div class="estufa-historico-top">
          <div>
            <strong>${t.tipo_manejo}</strong>
            <span style="font-size: 0.7rem; color: #10b981; font-weight: 600; margin-left: 6px;">[${alvoNome}]</span>
          </div>
          <span>${t.data_hora} (${t.responsavel || "Técnico"})</span>
        </div>
        <div class="estufa-historico-obs">${t.observacoes || "Sem observações adicionais."}</div>
      `;
      lista.appendChild(item);
    });
  }

  btnManejosEstufa?.addEventListener("click", () => {
    const now = new Date();
    const dataLocal = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const dtEl = document.getElementById("estufa-data-hora");
    if (dtEl) dtEl.value = dataLocal;
    const respEl = document.getElementById("estufa-responsavel");
    if (respEl) {
      respEl.value = AppState.currentUser ? AppState.currentUser.nome : "Operador Geral";
    }

    atualizarOpcoesAlvoEstufa();

    const activeTag = document.querySelector("#estufa-tags-container .trato-tag-btn.active");
    const activeVal = activeTag ? activeTag.getAttribute("data-value") : "Correção de pH / CE";
    atualizarVisibilidadeCamposEstufa(activeVal, activeTag);

    renderizarHistoricoEstufaModal();
    modalManejosEstufa?.classList.add("open");
  });

  const estufaTagBtns = document.querySelectorAll("#estufa-tags-container .trato-tag-btn");
  const estufaTipoInput = document.getElementById("estufa-tipo-input");
  estufaTagBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      estufaTagBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const val = btn.getAttribute("data-value");
      if (estufaTipoInput) estufaTipoInput.value = val;
      atualizarVisibilidadeCamposEstufa(val, btn);
    });
  });

  document.getElementById("form-manejos-estufa")?.addEventListener("submit", async e => {
    e.preventDefault();
    if (!verificarPermissaoEdicao()) return;

    const tipoManejo = estufaTipoInput ? estufaTipoInput.value : "Manejo Geral da Estufa";
    const responsavel = document.getElementById("estufa-responsavel")?.value.trim() || "Operador Geral";
    const dataHora = (document.getElementById("estufa-data-hora")?.value || new Date().toISOString()).replace("T", " ");
    const ph = document.getElementById("estufa-ph")?.value.trim();
    const ec = document.getElementById("estufa-ec")?.value.trim();
    const dosagem = document.getElementById("estufa-dosagem")?.value.trim();
    const obs = document.getElementById("estufa-obs")?.value.trim();

    const idAlvo = document.getElementById("estufa-alvo-select")?.value || "ESTRUTURA-GERAL";
    let alvoNome = "Estrutura Geral da Estufa";
    if (idAlvo !== "ESTRUTURA-GERAL") {
      const tq = (AppState.tanques || []).find(tk => tk.id_tanque === idAlvo);
      alvoNome = tq ? tq.nome : idAlvo;
    }

    let detalhes = [];
    detalhes.push(`🎯 Alvo: ${alvoNome}`);
    if (dosagem) detalhes.push(`Dose/Vol: ${dosagem}`);
    if (ph) detalhes.push(`pH: ${ph}`);
    if (ec) detalhes.push(`CE: ${ec} mS/cm`);
    if (obs) detalhes.push(obs);

    const observacoesFinais = detalhes.join(" | ");

    const novoTratoEstufa = {
      id_trato: `TRATO-ESTUFA-${Date.now()}`,
      id_bloco: idAlvo,
      id_ciclo: "ESTUFA",
      id_tanque: idAlvo !== "ESTRUTURA-GERAL" ? idAlvo : null,
      alvo_nome: alvoNome,
      data_hora: dataHora,
      tipo_manejo: tipoManejo,
      responsavel: responsavel,
      observacoes: observacoesFinais
    };

    AppState.tratos.push(novoTratoEstufa);
    salvarDadosLocal();
    modalManejosEstufa?.classList.remove("open");

    // Limpar campos opcionais
    if (document.getElementById("estufa-ph")) document.getElementById("estufa-ph").value = "";
    if (document.getElementById("estufa-ec")) document.getElementById("estufa-ec").value = "";
    if (document.getElementById("estufa-dosagem")) document.getElementById("estufa-dosagem").value = "";
    if (document.getElementById("estufa-obs")) document.getElementById("estufa-obs").value = "";

    mostrarToast(`Manejo de Estufa "${tipoManejo}" salvo no alvo [${alvoNome}]!`, "success");

    if (AppState.googleSheetsUrl) {
      await registrarAcaoRemota("registrarTrato", novoTratoEstufa);
    }
  });

  // --- MODAL 15: GERENCIADOR DE TANQUES & RESERVATÓRIOS ---
  function setupTanquesModal() {
    const modalTanques = document.getElementById("modal-tanques-config");
    const btnSalvar = document.getElementById("btn-salvar-tanque");
    const btnCancelar = document.getElementById("btn-cancelar-edicao-tanque");
    const inputEditId = document.getElementById("tanque-id-edit");
    const inputNome = document.getElementById("tanque-nome");
    const inputVolume = document.getElementById("tanque-volume");
    const selectSetor = document.getElementById("tanque-setor");
    const formTitle = document.getElementById("form-tanque-title");
    const containerLista = document.getElementById("tanques-lista-container");
    const countEl = document.getElementById("tanques-lista-count");

    function resetarFormTanque() {
      if (inputEditId) inputEditId.value = "";
      if (inputNome) inputNome.value = "";
      if (inputVolume) inputVolume.value = "";
      if (selectSetor) selectSetor.value = "esquerdo";
      if (formTitle) formTitle.textContent = "+ Cadastrar Novo Tanque";
      if (btnCancelar) btnCancelar.style.display = "none";
      if (btnSalvar) btnSalvar.textContent = "✓ Salvar Tanque";
    }

    function renderizarListaTanques() {
      if (!containerLista) return;
      const tanques = AppState.tanques || [];
      if (countEl) {
        countEl.textContent = `${tanques.length} ${tanques.length === 1 ? "tanque" : "tanques"}`;
      }

      if (tanques.length === 0) {
        containerLista.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 12px;">Nenhum tanque cadastrado.</div>`;
        return;
      }

      containerLista.innerHTML = "";
      tanques.forEach(t => {
        const bancadas = AppState.blocos.filter(b => b.id_tanque === t.id_tanque);
        const bancadasIds = bancadas.map(b => b.id_bloco);
        let bancadasTxt = "";
        if (bancadas.length === 0) {
          bancadasTxt = "Nenhuma";
        } else if (bancadas.length <= 4) {
          bancadasTxt = bancadasIds.join(", ");
        } else {
          bancadasTxt = `${bancadasIds.slice(0, 3).join(", ")} +${bancadas.length - 3}`;
        }

        const volFmt = Number(t.volume_litros).toLocaleString("pt-BR");
        const setorLabel = t.setor === "esquerdo" ? "Setor Esquerdo"
          : t.setor === "direito" ? "Setor Direito"
          : t.setor === "maternidade" ? "Maternidade"
          : "Geral";

        const card = document.createElement("div");
        card.className = "tanque-card-item";
        card.innerHTML = `
          <div class="tanque-card-main">
            <div class="tanque-card-header">
              <span class="tanque-card-icon">🚰</span>
              <strong class="tanque-card-title">${t.nome}</strong>
              <span class="tanque-card-badge">${bancadas.length} bancada(s)</span>
            </div>
            <div class="tanque-card-details">
              <div class="tanque-detail-col">
                <span class="tanque-detail-label">Capacidade:</span>
                <strong class="tanque-detail-value">${volFmt} L</strong>
              </div>
              <div class="tanque-detail-divider"></div>
              <div class="tanque-detail-col">
                <span class="tanque-detail-label">Setor:</span>
                <strong class="tanque-detail-value">${setorLabel}</strong>
              </div>
              <div class="tanque-detail-divider"></div>
              <div class="tanque-detail-col" title="${bancadasIds.length > 0 ? bancadasIds.join(', ') : 'Nenhuma bancada vinculada'}">
                <span class="tanque-detail-label">Bancadas:</span>
                <span class="tanque-detail-value bancadas-tag">${bancadasTxt}</span>
              </div>
            </div>
          </div>
          <div class="tanque-card-actions">
            <button type="button" class="btn-tanque-action btn-tanque-edit" data-id="${t.id_tanque}" title="Editar dados do tanque">✏️ Editar</button>
            <button type="button" class="btn-tanque-action btn-tanque-delete" data-id="${t.id_tanque}" title="Excluir tanque">🗑️ Excluir</button>
          </div>
        `;
        containerLista.appendChild(card);
      });

      containerLista.querySelectorAll(".btn-tanque-edit").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-id");
          const t = (AppState.tanques || []).find(item => item.id_tanque === id);
          if (!t) return;
          if (inputEditId) inputEditId.value = t.id_tanque;
          if (inputNome) inputNome.value = t.nome;
          if (inputVolume) inputVolume.value = t.volume_litros;
          if (selectSetor) selectSetor.value = t.setor || "esquerdo";
          if (formTitle) formTitle.textContent = `✏️ Editar Tanque: ${t.nome}`;
          if (btnCancelar) btnCancelar.style.display = "inline-block";
          if (btnSalvar) btnSalvar.textContent = "✓ Atualizar Tanque";
          inputNome?.focus();
        });
      });

      containerLista.querySelectorAll(".btn-tanque-delete").forEach(btn => {
        btn.addEventListener("click", () => {
          if (!verificarPermissaoEdicao(true)) return;
          const id = btn.getAttribute("data-id");
          if (AppState.tanques.length <= 1) {
            mostrarToast("É necessário manter ao menos 1 tanque cadastrado no sistema.", "warning");
            return;
          }
          const t = AppState.tanques.find(item => item.id_tanque === id);
          if (!t) return;

          const bancadasVinculadas = AppState.blocos.filter(b => b.id_tanque === id).length;
          const msgAviso = `Deseja realmente excluir o reservatório "${t.nome}"?` +
            (bancadasVinculadas > 0 ? `\n\nAtenção: ${bancadasVinculadas} bancada(s) vinculadas serão migradas automaticamente para outro tanque ativo.` : "");

          if (!confirm(msgAviso)) return;

          AppState.tanques = AppState.tanques.filter(item => item.id_tanque !== id);
          const outroTanque = AppState.tanques[0];
          if (bancadasVinculadas > 0 && outroTanque) {
            AppState.blocos.forEach(b => {
              if (b.id_tanque === id) b.id_tanque = outroTanque.id_tanque;
            });
          }

          salvarDadosLocal();
          resetarFormTanque();
          renderizarListaTanques();
          if (AppState.selectedBlockId) abrirPainelInspecao(AppState.selectedBlockId);
          mostrarToast(`Tanque "${t.nome}" excluído com sucesso!`, "success");
        });
      });
    }

    btnCancelar?.addEventListener("click", resetarFormTanque);

    btnSalvar?.addEventListener("click", () => {
      if (!verificarPermissaoEdicao(true)) return;
      const nome = inputNome?.value.trim();
      const volume = parseFloat(inputVolume?.value);
      const setor = selectSetor?.value || "esquerdo";
      const editId = inputEditId?.value.trim();

      if (!nome) {
        mostrarToast("Informe o nome ou identificação do tanque.", "warning");
        inputNome?.focus();
        return;
      }
      if (isNaN(volume) || volume <= 0) {
        mostrarToast("Informe um volume válido em litros (ex: 5000).", "warning");
        inputVolume?.focus();
        return;
      }

      if (editId) {
        const t = AppState.tanques.find(item => item.id_tanque === editId);
        if (t) {
          t.nome = nome;
          t.volume_litros = volume;
          t.setor = setor;
          mostrarToast(`Tanque "${nome}" atualizado!`, "success");
        }
      } else {
        const novoId = `TANQUE-${Date.now().toString(36).toUpperCase()}`;
        AppState.tanques.push({
          id_tanque: novoId,
          nome: nome,
          volume_litros: volume,
          setor: setor
        });
        mostrarToast(`Tanque "${nome}" cadastrado com sucesso!`, "success");
      }

      salvarDadosLocal();
      resetarFormTanque();
      renderizarListaTanques();
      if (AppState.selectedBlockId) abrirPainelInspecao(AppState.selectedBlockId);
    });

    document.getElementById("opt-tanques-config")?.addEventListener("click", () => {
      fecharTodosDropdowns();
      resetarFormTanque();
      renderizarListaTanques();
      modalTanques?.classList.add("open");
    });
  }

  setupTanquesModal();

  // --- MODAL DE HISTÓRICO COMPLETO & GRÁFICOS ---
  document.getElementById("btn-open-history-modal")?.addEventListener("click", () => {
    if (!AppState.selectedBlockId) return;
    abrirModalHistoricoEGraficos(AppState.selectedBlockId);
  });

  document.querySelectorAll(".history-filter-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".history-filter-pill").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      filtroHistoricoAtual = btn.getAttribute("data-filter");
      if (AppState.selectedBlockId) {
        renderizarTimelineHistorico(AppState.selectedBlockId, filtroHistoricoAtual);
      }
    });
  });

  // --- CICLOS DE CULTIVO (VARIEDADE OPCIONAL & INICIALIZAÇÃO DE ESTOQUE) ---
  document.getElementById("btn-toggle-ciclo").addEventListener("click", () => {
    if (!verificarPermissaoEdicao()) return;
    if (!AppState.selectedBlockId) return;
    const idBloco = AppState.selectedBlockId;
    const cicloAtivo = AppState.ciclos.find(c => c.id_bloco === idBloco && c.status === "ativo");

    if (cicloAtivo) {
      cicloAtivo.status = "finalizado";
      cicloAtivo.editado_localmente = true;
      cicloAtivo._ultima_modificacao = Date.now();
      salvarDadosLocal();
      abrirPainelInspecao(idBloco);
      atualizarFiltros();
      solicitarRedesenho();
      mostrarToast(`Ciclo da bancada ${idBloco} finalizado! Bancada liberada.`, "info");

      if (AppState.googleSheetsUrl) {
        registrarAcaoRemota("finalizarCiclo", { id_ciclo: cicloAtivo.id_ciclo, id_bloco: idBloco });
      }
    } else {
      popularSelectsCulturas();

      const bloco = AppState.blocos.find(b => b.id_bloco === idBloco);
      const isGerm = bloco && bloco.tipo_bloco === "germinacao";

      const titleCiclo = document.getElementById("title-modal-ciclo");
      if (titleCiclo) {
        titleCiclo.textContent = isGerm 
          ? `🌱 Iniciar Germinação (Semeadura) - ${idBloco}` 
          : `Iniciar Ciclo de Cultivo - ${idBloco}`;
      }
      const labelPlantio = document.getElementById("label-ciclo-data-plantio");
      if (labelPlantio) labelPlantio.textContent = isGerm ? "Data da Semeadura:" : "Data do Plantio:";

      const labelColheita = document.getElementById("label-ciclo-data-colheita");
      if (labelColheita) labelColheita.textContent = isGerm ? "Previsão de Transplante / Emergência:" : "Previsão de Colheita:";

      const btnSubmit = document.getElementById("btn-submit-novo-ciclo");
      if (btnSubmit) btnSubmit.textContent = isGerm ? "🌱 Iniciar Germinação" : "Iniciar Plantio";

      const hoje = new Date().toISOString().split("T")[0];
      document.getElementById("ciclo-data-plantio").value = hoje;

      // Se houver cultura no catálogo, auto-seleciona a primeira
      const selectNovo = document.getElementById("ciclo-cultura-select");
      if (selectNovo && selectNovo.options.length > 1) {
        selectNovo.selectedIndex = 1;
        const opt = selectNovo.options[1];
        const nome = opt.getAttribute("data-nome") || opt.value;
        const variedade = opt.getAttribute("data-variedade") || "";
        const dias = isGerm ? 5 : (parseInt(opt.getAttribute("data-dias"), 10) || 30);

        document.getElementById("ciclo-cultura").value = nome;
        document.getElementById("ciclo-variedade").value = variedade;

        const colheitaDefault = new Date(Date.now() + dias * 86400000).toISOString().split("T")[0];
        document.getElementById("ciclo-data-colheita").value = colheitaDefault;
      } else {
        const dias = isGerm ? 5 : 30;
        const colheitaDefault = new Date(Date.now() + dias * 86400000).toISOString().split("T")[0];
        document.getElementById("ciclo-data-colheita").value = colheitaDefault;
      }

      modalCiclo.classList.add("open");
    }
  });

  // Atualização automática ao escolher cultura do catálogo no plantio
  document.getElementById("ciclo-cultura-select")?.addEventListener("change", e => {
    const sel = e.target;
    const opt = sel.selectedOptions[0];
    if (!opt || !sel.value) return;

    const idBloco = AppState.selectedBlockId;
    const bloco = AppState.blocos.find(b => b.id_bloco === idBloco);
    const isGerm = bloco && bloco.tipo_bloco === "germinacao";

    if (sel.value === "__MANUAL__") {
      document.getElementById("ciclo-cultura").value = "";
      document.getElementById("ciclo-variedade").value = "";
      document.getElementById("ciclo-cultura").focus();
    } else {
      const nome = opt.getAttribute("data-nome") || sel.value;
      const variedade = opt.getAttribute("data-variedade") || "";
      const dias = isGerm ? 5 : (parseInt(opt.getAttribute("data-dias"), 10) || 30);

      document.getElementById("ciclo-cultura").value = nome;
      document.getElementById("ciclo-variedade").value = variedade;

      const dataPlantioStr = document.getElementById("ciclo-data-plantio").value || new Date().toISOString().split("T")[0];
      const dataPlantio = new Date(dataPlantioStr + "T12:00:00");
      const dataPrevista = new Date(dataPlantio.getTime() + dias * 86400000);
      document.getElementById("ciclo-data-colheita").value = dataPrevista.toISOString().split("T")[0];
    }
  });

  document.getElementById("form-novo-ciclo").addEventListener("submit", async e => {
    e.preventDefault();
    if (!AppState.selectedBlockId) return;

    const idBloco = AppState.selectedBlockId;
    const bloco = AppState.blocos.find(b => b.id_bloco === idBloco);
    const isGerm = bloco && bloco.tipo_bloco === "germinacao";
    const totalPlantas = bloco ? (bloco.total_furos || (isGerm ? (bloco.qtd_placas || 2) * (bloco.celulas_por_placa || 196) : 192)) : 192;

    const novoCiclo = {
      id_ciclo: `CICLO-${Date.now()}`,
      id_bloco: idBloco,
      cultura: document.getElementById("ciclo-cultura").value.trim(),
      variedade: document.getElementById("ciclo-variedade").value.trim(),
      data_plantio: document.getElementById("ciclo-data-plantio").value,
      data_prevista_colheita: document.getElementById("ciclo-data-colheita").value,
      lote_nutritivo: document.getElementById("ciclo-lote-nutritivo").value,
      status: "ativo",
      qtd_inicial: totalPlantas,
      qtd_restante: totalPlantas,
      colheitas: []
    };

    AppState.ciclos.push(novoCiclo);
    salvarDadosLocal();
    abrirPainelInspecao(idBloco);
    atualizarFiltros();
    solicitarRedesenho();
    modalCiclo.classList.remove("open");

    const rotuloAcao = isGerm ? "Germinação" : "Novo ciclo";
    const rotuloBloco = isGerm ? "no módulo" : "na bancada";
    mostrarToast(`${rotuloAcao} de ${novoCiclo.cultura} iniciado ${rotuloBloco} ${idBloco}!`, "success");

    if (AppState.googleSheetsUrl) {
      await registrarAcaoRemota("iniciarCiclo", novoCiclo);
    }
  });

  // --- EDIÇÃO DE CULTIVO ATIVO (OU INÍCIO DE CULTIVO SE DESOCUPADO) ---
  const modalEditarCiclo = document.getElementById("modal-editar-ciclo");

  function abrirModalEditarCultivo() {
    if (!verificarPermissaoEdicao()) return;
    if (!AppState.selectedBlockId) {
      mostrarToast("Selecione uma bancada no croqui primeiro.", "info");
      return;
    }
    const idBloco = AppState.selectedBlockId;
    const cicloAtivo = AppState.ciclos.find(c => c.id_bloco === idBloco && c.status === "ativo");

    popularSelectsCulturas();

    if (cicloAtivo) {
      document.getElementById("edit-ciclo-id").value = cicloAtivo.id_ciclo;
      document.getElementById("edit-ciclo-bloco-id").value = idBloco;
      document.getElementById("edit-ciclo-bloco-label").textContent = idBloco;
      document.getElementById("edit-ciclo-cultura").value = cicloAtivo.cultura;
      document.getElementById("edit-ciclo-variedade").value = cicloAtivo.variedade || "";

      let dtPlantio = cicloAtivo.data_plantio || "";
      if (typeof dtPlantio === "string" && dtPlantio.includes("T")) {
        dtPlantio = dtPlantio.split("T")[0];
      }
      let dtColheita = cicloAtivo.data_prevista_colheita || "";
      if (typeof dtColheita === "string" && dtColheita.includes("T")) {
        dtColheita = dtColheita.split("T")[0];
      }

      document.getElementById("edit-ciclo-data-plantio").value = dtPlantio;
      document.getElementById("edit-ciclo-data-colheita").value = dtColheita;
      document.getElementById("edit-ciclo-qtd-inicial").value = cicloAtivo.qtd_inicial || 192;
      document.getElementById("edit-ciclo-lote-nutritivo").value = cicloAtivo.lote_nutritivo || "";

      // Seleciona a opção do catálogo correspondente se existir
      const selectEdit = document.getElementById("edit-ciclo-cultura-select");
      if (selectEdit) {
        let matched = false;
        for (let opt of selectEdit.options) {
          if (opt.value && opt.value.toLowerCase() === cicloAtivo.cultura.toLowerCase()) {
            selectEdit.value = opt.value;
            matched = true;
            break;
          }
        }
        if (!matched) selectEdit.value = "__MANUAL__";
      }

      modalEditarCiclo.classList.add("open");
    } else {
      // Se a bancada estiver vazia, abre Iniciar Plantio / Germinação diretamente para aquela bancada
      const bloco = AppState.blocos.find(b => b.id_bloco === idBloco);
      const isGerm = bloco && bloco.tipo_bloco === "germinacao";

      const titleCiclo = document.getElementById("title-modal-ciclo");
      if (titleCiclo) {
        titleCiclo.textContent = isGerm 
          ? `🌱 Iniciar Germinação (Semeadura) - ${idBloco}` 
          : `Iniciar Ciclo de Cultivo - ${idBloco}`;
      }
      const labelPlantio = document.getElementById("label-ciclo-data-plantio");
      if (labelPlantio) labelPlantio.textContent = isGerm ? "Data da Semeadura:" : "Data do Plantio:";

      const labelColheita = document.getElementById("label-ciclo-data-colheita");
      if (labelColheita) labelColheita.textContent = isGerm ? "Previsão de Transplante / Emergência:" : "Previsão de Colheita:";

      const btnSubmit = document.getElementById("btn-submit-novo-ciclo");
      if (btnSubmit) btnSubmit.textContent = isGerm ? "🌱 Iniciar Germinação" : "Iniciar Plantio";

      const hoje = new Date().toISOString().split("T")[0];
      document.getElementById("ciclo-data-plantio").value = hoje;
      const selectNovo = document.getElementById("ciclo-cultura-select");
      if (selectNovo && selectNovo.options.length > 1) {
        selectNovo.selectedIndex = 1;
        const opt = selectNovo.options[1];
        document.getElementById("ciclo-cultura").value = opt.getAttribute("data-nome") || opt.value;
        document.getElementById("ciclo-variedade").value = opt.getAttribute("data-variedade") || "";
        const dias = isGerm ? 5 : (parseInt(opt.getAttribute("data-dias"), 10) || 30);
        document.getElementById("ciclo-data-colheita").value = new Date(Date.now() + dias * 86400000).toISOString().split("T")[0];
      } else {
        const dias = isGerm ? 5 : 30;
        document.getElementById("ciclo-data-colheita").value = new Date(Date.now() + dias * 86400000).toISOString().split("T")[0];
      }
      modalCiclo.classList.add("open");
    }
  }
  window.abrirModalEditarCultivo = abrirModalEditarCultivo;

  document.getElementById("btn-editar-cultivo")?.addEventListener("click", abrirModalEditarCultivo);

  // Atualização automática ao trocar cultura no modal de edição
  document.getElementById("edit-ciclo-cultura-select")?.addEventListener("change", e => {
    const sel = e.target;
    const opt = sel.selectedOptions[0];
    if (!opt || !sel.value) return;

    if (sel.value === "__MANUAL__") {
      document.getElementById("edit-ciclo-cultura").focus();
    } else {
      const nome = opt.getAttribute("data-nome") || sel.value;
      const variedade = opt.getAttribute("data-variedade") || "";
      const dias = parseInt(opt.getAttribute("data-dias"), 10) || 30;

      document.getElementById("edit-ciclo-cultura").value = nome;
      document.getElementById("edit-ciclo-variedade").value = variedade;

      const dataPlantioStr = document.getElementById("edit-ciclo-data-plantio").value || new Date().toISOString().split("T")[0];
      const dataPlantio = new Date(dataPlantioStr + "T12:00:00");
      const dataPrevista = new Date(dataPlantio.getTime() + dias * 86400000);
      document.getElementById("edit-ciclo-data-colheita").value = dataPrevista.toISOString().split("T")[0];
    }
  });

  // Salvar alterações da edição do cultivo
  document.getElementById("form-editar-ciclo")?.addEventListener("submit", async e => {
    e.preventDefault();
    const idCiclo = document.getElementById("edit-ciclo-id").value;
    let ciclo = AppState.ciclos.find(c => c.id_ciclo === idCiclo);
    if (!ciclo && AppState.selectedBlockId) {
      ciclo = AppState.ciclos.find(c => c.id_bloco === AppState.selectedBlockId && c.status === "ativo");
    }
    if (!ciclo) {
      mostrarToast("Erro: Ciclo não localizado para salvar.", "error");
      return;
    }

    const novaCultura = document.getElementById("edit-ciclo-cultura").value.trim();
    const novaVariedade = document.getElementById("edit-ciclo-variedade").value.trim();
    const novaDataPlantio = document.getElementById("edit-ciclo-data-plantio").value;
    const novaDataColheita = document.getElementById("edit-ciclo-data-colheita").value;
    const novaQtdInicial = parseInt(document.getElementById("edit-ciclo-qtd-inicial").value, 10) || ciclo.qtd_inicial;
    const novoLote = document.getElementById("edit-ciclo-lote-nutritivo").value.trim();

    // Ajuste de saldo caso a quantidade total tenha sido modificada
    const diferenca = novaQtdInicial - (ciclo.qtd_inicial || novaQtdInicial);
    ciclo.qtd_inicial = novaQtdInicial;
    ciclo.qtd_restante = Math.max(0, (ciclo.qtd_restante !== undefined ? ciclo.qtd_restante : novaQtdInicial) + diferenca);

    ciclo.cultura = novaCultura;
    ciclo.variedade = novaVariedade;
    ciclo.data_plantio = novaDataPlantio;
    ciclo.data_prevista_colheita = novaDataColheita;
    ciclo.lote_nutritivo = novoLote;
    ciclo.editado_localmente = true;
    ciclo._ultima_modificacao = Date.now();

    salvarDadosLocal();
    abrirPainelInspecao(ciclo.id_bloco);
    atualizarFiltros();
    solicitarRedesenho();
    modalEditarCiclo.classList.remove("open");

    mostrarToast(`Cultivo da bancada ${ciclo.id_bloco} atualizado para ${formatarNomeCultura(novaCultura, novaVariedade)}!`, "success");

    if (AppState.googleSheetsUrl) {
      await registrarAcaoRemota("atualizarCiclo", ciclo);
    }
  });

  // --- CATÁLOGO DE CULTURAS (PRÉ-CADASTRO E GESTÃO) ---
  const modalCulturas = document.getElementById("modal-culturas-catalogo");

  document.getElementById("btn-catalogo-culturas")?.addEventListener("click", abrirModalCatalogoCulturas);
  document.getElementById("btn-quick-novo-catalogo")?.addEventListener("click", abrirModalCatalogoCulturas);

  function cadastrarNovaCulturaDoForm() {
    if (!verificarPermissaoEdicao()) return;
    const nomeInput = document.getElementById("cad-cultura-nome");
    const variedadeInput = document.getElementById("cad-cultura-variedade");
    const diasInput = document.getElementById("cad-cultura-dias");

    const nome = (nomeInput?.value || "").trim();
    const variedade = (variedadeInput?.value || "").trim();
    const dias = parseInt(diasInput?.value || "35", 10) || 35;

    if (!nome) {
      mostrarToast("Informe o nome da cultura.", "warning");
      nomeInput?.focus();
      return;
    }

    garantirCatalogoArray();

    const novaCultura = {
      id: `cult_${Date.now()}`,
      nome: nome,
      variedade: variedade,
      ciclo_dias: dias,
      cor: "#10b981"
    };

    AppState.catalogoCulturas.unshift(novaCultura);
    salvarCatalogoCulturasLocal();
    popularSelectsCulturas();
    renderizarTabelaCatalogoCulturas();

    if (nomeInput) nomeInput.value = "";
    if (variedadeInput) variedadeInput.value = "";
    if (diasInput) diasInput.value = "35";

    mostrarToast(`✅ Cultura "${nome}" adicionada ao catálogo!`, "success");
  }

  document.getElementById("btn-cadastrar-cultura")?.addEventListener("click", cadastrarNovaCulturaDoForm);

  ["cad-cultura-nome", "cad-cultura-variedade", "cad-cultura-dias"].forEach(id => {
    document.getElementById(id)?.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        cadastrarNovaCulturaDoForm();
      }
    });
  });

  // Atualização automática da data prevista de colheita ao mudar a data de plantio
  document.getElementById("ciclo-data-plantio")?.addEventListener("change", () => {
    const sel = document.getElementById("ciclo-cultura-select");
    const opt = sel?.selectedOptions?.[0];
    const dias = opt && opt.value ? (parseInt(opt.getAttribute("data-dias"), 10) || 30) : 30;
    const dataPlantioStr = document.getElementById("ciclo-data-plantio")?.value;
    if (dataPlantioStr) {
      const dataPlantio = new Date(dataPlantioStr + "T12:00:00");
      const dataPrevista = new Date(dataPlantio.getTime() + dias * 86400000);
      document.getElementById("ciclo-data-colheita").value = dataPrevista.toISOString().split("T")[0];
    }
  });

  document.getElementById("edit-ciclo-data-plantio")?.addEventListener("change", () => {
    const sel = document.getElementById("edit-ciclo-cultura-select");
    const opt = sel?.selectedOptions?.[0];
    const dias = opt && opt.value ? (parseInt(opt.getAttribute("data-dias"), 10) || 30) : 30;
    const dataPlantioStr = document.getElementById("edit-ciclo-data-plantio")?.value;
    if (dataPlantioStr) {
      const dataPlantio = new Date(dataPlantioStr + "T12:00:00");
      const dataPrevista = new Date(dataPlantio.getTime() + dias * 86400000);
      document.getElementById("edit-ciclo-data-colheita").value = dataPrevista.toISOString().split("T")[0];
    }
  });

  // NOTA: Modais NÃO fecham ao clicar fora (overlay) para evitar perda de dados acidental.
  // Fechar apenas via botão X, botão Cancelar ou tecla ESC.

  // Fechar modais ao pressionar ESC
  window.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal-overlay.open").forEach(m => m.classList.remove("open"));
    }
  });

  // --- COLHEITA / RETIRADA COM CONTROLE DE ESTOQUE ---
  function popularDestinosTransplante(idBlocoOrigem) {
    const sel = document.getElementById("transplante-destino-bancada");
    if (!sel) return;
    sel.innerHTML = "";

    const cardAuto = document.getElementById("card-auto-iniciar-cultivo");
    const checkAuto = document.getElementById("check-auto-iniciar-ciclo");
    const labelTitulo = document.getElementById("label-auto-iniciar-titulo");
    const labelSub = document.getElementById("label-auto-iniciar-sub");
    const inputDestino = document.getElementById("colheita-destino");

    const cicloOrigem = AppState.ciclos.find(c => c.id_bloco === idBlocoOrigem && c.status === "ativo");
    const culturaOrigem = cicloOrigem ? cicloOrigem.cultura : "Mudas";
    const variedadeOrigem = cicloOrigem && cicloOrigem.variedade ? ` (${cicloOrigem.variedade})` : "";

    // 1. Berçários e Maternidades (Prioridade máxima de transplante)
    const bancadasBercario = AppState.blocos.filter(b => 
      b.id_bloco !== idBlocoOrigem && (b.tipo_bloco === "bercario" || b.tipo_bloco === "maternidade")
    );

    // 2. Bancadas Definitivas (Transplante direto para engorda)
    const bancadasDefinitivas = AppState.blocos.filter(b => 
      b.id_bloco !== idBlocoOrigem && b.tipo_bloco === "definitivo"
    );

    let primeiroVagoId = null;

    if (bancadasBercario.length > 0) {
      const groupBercario = document.createElement("optgroup");
      groupBercario.label = "☘️ Berçários & Maternidades (Recomendado)";

      bancadasBercario.forEach(b => {
        const cicloAtivo = AppState.ciclos.find(c => c.id_bloco === b.id_bloco && c.status === "ativo");
        const totalFuros = calcularTotalFuros(b);
        const tipoLabel = b.tipo_bloco === "maternidade" ? "Maternidade" : "Berçário";
        const opt = document.createElement("option");
        opt.value = b.id_bloco;

        if (!cicloAtivo) {
          opt.textContent = `🟢 ${b.id_bloco} (${tipoLabel}) — VAGA [Capacidade: ${totalFuros} mudas]`;
          opt.setAttribute("data-status", "vaga");
          if (!primeiroVagoId) primeiroVagoId = b.id_bloco;
        } else {
          opt.textContent = `🟡 ${b.id_bloco} (${tipoLabel}) — EM CULTIVO (${cicloAtivo.cultura} • Restam ${cicloAtivo.qtd_restante} plantas)`;
          opt.setAttribute("data-status", "ocupada");
        }
        groupBercario.appendChild(opt);
      });
      sel.appendChild(groupBercario);
    }

    if (bancadasDefinitivas.length > 0) {
      const groupDefinitivo = document.createElement("optgroup");
      groupDefinitivo.label = "🌱 Bancadas Definitivas (Transplante Direto)";

      bancadasDefinitivas.forEach(b => {
        const cicloAtivo = AppState.ciclos.find(c => c.id_bloco === b.id_bloco && c.status === "ativo");
        const totalFuros = calcularTotalFuros(b);
        const opt = document.createElement("option");
        opt.value = b.id_bloco;

        if (!cicloAtivo) {
          opt.textContent = `🟢 ${b.id_bloco} (Definitiva) — VAGA [Capacidade: ${totalFuros} plantas]`;
          opt.setAttribute("data-status", "vaga");
          if (!primeiroVagoId) primeiroVagoId = b.id_bloco;
        } else {
          opt.textContent = `🟡 ${b.id_bloco} (Definitiva) — EM CULTIVO (${cicloAtivo.cultura} • Restam ${cicloAtivo.qtd_restante} plantas)`;
          opt.setAttribute("data-status", "ocupada");
        }
        groupDefinitivo.appendChild(opt);
      });
      sel.appendChild(groupDefinitivo);
    }

    // Grupo Outro / Externo
    const groupOutro = document.createElement("optgroup");
    groupOutro.label = "📦 Outras Opções de Destino";
    const optManual = document.createElement("option");
    optManual.value = "manual";
    optManual.textContent = "📦 Outro destino externo (Venda de mudas, descarte ou leito externo)";
    groupOutro.appendChild(optManual);
    sel.appendChild(groupOutro);

    // Seleciona preferencialmente a primeira bancada vaga de berçário, ou o primeiro item
    if (primeiroVagoId) {
      sel.value = primeiroVagoId;
    } else if (sel.options.length > 0) {
      sel.selectedIndex = 0;
    }

    function atualizarEstadoDestino() {
      const val = sel.value;
      if (val === "manual") {
        if (cardAuto) cardAuto.style.display = "none";
        if (inputDestino) {
          inputDestino.placeholder = "Ex: Venda de mudas para terceiros, Descarte, etc.";
          if (inputDestino.value.startsWith("Transplante ➔")) {
            inputDestino.value = "";
          }
        }
        return;
      }

      const blocoDest = AppState.blocos.find(b => b.id_bloco === val);
      if (!blocoDest) return;

      const cicloDest = AppState.ciclos.find(c => c.id_bloco === val && c.status === "ativo");
      const tipoLabel = blocoDest.tipo_bloco === "maternidade" 
        ? "Maternidade" 
        : blocoDest.tipo_bloco === "bercario" 
          ? "Berçário" 
          : "Bancada Definitiva";

      if (!cicloDest) {
        // Bancada VAGA: Exibe card para auto-iniciar ciclo
        if (cardAuto) cardAuto.style.display = "block";
        if (checkAuto) checkAuto.checked = true;
        if (labelTitulo) {
          labelTitulo.textContent = `🌱 Iniciar cultivo automaticamente em ${blocoDest.id_bloco} (${tipoLabel})`;
        }
        if (labelSub) {
          labelSub.textContent = `Ativa a bancada ${blocoDest.id_bloco} com ${culturaOrigem}${variedadeOrigem}, alocando o lote imediatamente no croqui.`;
        }
        if (inputDestino) {
          inputDestino.value = `Transplante ➔ ${blocoDest.id_bloco} (${tipoLabel})`;
        }
      } else {
        // Bancada OCUPADA: apenas registra no histórico
        if (cardAuto) cardAuto.style.display = "none";
        if (checkAuto) checkAuto.checked = false;
        if (inputDestino) {
          inputDestino.value = `Transplante ➔ ${blocoDest.id_bloco} (Ocupada com ${cicloDest.cultura})`;
        }
      }
    }

    sel.onchange = atualizarEstadoDestino;
    atualizarEstadoDestino();
  }

  document.getElementById("btn-open-colheita-modal")?.addEventListener("click", () => {
    if (!verificarPermissaoEdicao()) return;
    if (!AppState.selectedBlockId) return;
    const idBloco = AppState.selectedBlockId;
    const bloco = AppState.blocos.find(b => b.id_bloco === idBloco);
    const cicloAtivo = AppState.ciclos.find(c => c.id_bloco === idBloco && c.status === "ativo");
    if (!cicloAtivo || !bloco) return;

    const total = cicloAtivo.qtd_inicial || bloco.total_furos || 192;
    const restante = cicloAtivo.qtd_restante !== undefined ? cicloAtivo.qtd_restante : total;
    const isGerm = bloco.tipo_bloco === "germinacao";

    document.getElementById("colheita-modal-bloco-id").textContent = isGerm 
      ? `Módulo Germinação ${idBloco}` 
      : `Bancada ${idBloco}`;
    document.getElementById("colheita-modal-cultura").textContent = formatarNomeCultura(cicloAtivo.cultura, cicloAtivo.variedade);
    document.getElementById("colheita-modal-disponivel").textContent = `${restante} ${isGerm ? "mudas disponíveis" : "plantas"}`;

    const titleColheita = document.getElementById("title-modal-colheita");
    if (titleColheita) {
      titleColheita.innerHTML = isGerm 
        ? "<span>🌿</span><span>Registrar Transplante de Mudas</span>" 
        : "<span>🌾</span><span>Registrar Colheita / Retirada</span>";
    }

    const labelQtd = document.querySelector('label[for="colheita-qtd"]');
    if (labelQtd) {
      labelQtd.textContent = isGerm 
        ? "Quantidade de mudas a transplantar para o berçário:" 
        : "Quantidade a Colher / Retirar (plantas):";
    }

    const inputQtd = document.getElementById("colheita-qtd");
    inputQtd.max = restante;
    inputQtd.value = isGerm ? restante : Math.min(50, restante);

    const now = new Date();
    const dataLocal = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    document.getElementById("colheita-data-hora").value = dataLocal;
    document.getElementById("colheita-check-finalizar").checked = restante <= 50 || isGerm;

    const secaoTransplante = document.getElementById("secao-destino-transplante");
    const labelDestino = document.getElementById("label-colheita-destino");
    const inputDestino = document.getElementById("colheita-destino");
    const btnSubmitColheita = document.getElementById("btn-confirmar-colheita");
    const labelFinalizar = document.getElementById("label-check-finalizar");

    if (isGerm) {
      if (secaoTransplante) secaoTransplante.style.display = "block";
      if (labelDestino) labelDestino.textContent = "Observações Adicionais do Transplante:";
      if (inputDestino) {
        inputDestino.placeholder = "Ex: Mudas com 5 dias, raízes vigorosas, leito A";
        inputDestino.required = false;
      }
      if (btnSubmitColheita) btnSubmitColheita.textContent = "🌿 Confirmar Transplante de Mudas";
      if (labelFinalizar) labelFinalizar.textContent = "Liberar mesa de germinação após este transplante (Mesa Vaga)";
      popularDestinosTransplante(idBloco);
    } else {
      if (secaoTransplante) secaoTransplante.style.display = "none";
      if (labelDestino) labelDestino.textContent = "Destino / Cliente / Observação:";
      if (inputDestino) {
        inputDestino.placeholder = "Ex: Feira de Domingo, Mercado Central, Venda Direta";
        inputDestino.required = true;
        if (!inputDestino.value || inputDestino.value.startsWith("Transplante ➔")) {
          inputDestino.value = "Feira de Domingo";
        }
      }
      if (btnSubmitColheita) btnSubmitColheita.textContent = "Confirmar Colheita";
      if (labelFinalizar) labelFinalizar.textContent = "Finalizar ciclo e liberar bancada após esta colheita (Bancada Vaga)";
    }

    if (AppState.currentUser) {
      document.getElementById("colheita-responsavel").value = AppState.currentUser.nome;
    }

    modalColheita.classList.add("open");
  });

  // Botões de porcentagem rápida de colheita (10%, 25%, 50%, 100%)
  document.querySelectorAll(".btn-quick-qtd").forEach(btn => {
    btn.addEventListener("click", () => {
      const pct = parseFloat(btn.getAttribute("data-pct"));
      const idBloco = AppState.selectedBlockId;
      const cicloAtivo = AppState.ciclos.find(c => c.id_bloco === idBloco && c.status === "ativo");
      const bloco = AppState.blocos.find(b => b.id_bloco === idBloco);
      if (!cicloAtivo || !bloco) return;

      const total = cicloAtivo.qtd_inicial || bloco.total_furos || 192;
      const restante = cicloAtivo.qtd_restante !== undefined ? cicloAtivo.qtd_restante : total;
      const calculada = Math.max(1, Math.round(restante * pct));
      document.getElementById("colheita-qtd").value = calculada;

      if (pct >= 0.99 || calculada >= restante) {
        document.getElementById("colheita-check-finalizar").checked = true;
      }
    });
  });

  // Confirmação de colheita
  document.getElementById("form-colheita")?.addEventListener("submit", async e => {
    e.preventDefault();
    if (!AppState.selectedBlockId) return;

    const idBloco = AppState.selectedBlockId;
    const bloco = AppState.blocos.find(b => b.id_bloco === idBloco);
    const cicloAtivo = AppState.ciclos.find(c => c.id_bloco === idBloco && c.status === "ativo");
    if (!cicloAtivo || !bloco) return;

    const isGerm = bloco.tipo_bloco === "germinacao";
    const qtd = parseInt(document.getElementById("colheita-qtd").value, 10) || 0;
    if (qtd <= 0) {
      mostrarToast(`Informe uma quantidade válida de ${isGerm ? "mudas para transplantar" : "plantas para colher"}.`, "warning");
      return;
    }

    // Segunda verificação de confirmação solicitada pelo usuário
    const acaoNome = isGerm ? "o transplante" : "a colheita";
    const unidadeNome = isGerm ? "muda(s)" : "planta(s)";
    const blocoNome = isGerm ? `Módulo ${idBloco}` : `Bancada ${idBloco}`;
    const confirmar = confirm(`Deseja realmente confirmar ${acaoNome} de ${qtd} ${unidadeNome} no ${blocoNome}?`);
    if (!confirmar) return;

    const dataHora = document.getElementById("colheita-data-hora").value.replace("T", " ");
    const responsavel = document.getElementById("colheita-responsavel").value;
    let destino = document.getElementById("colheita-destino").value;
    const finalizar = document.getElementById("colheita-check-finalizar").checked;

    let autoIniciadoMsg = "";

    // Se for transplante de germinação e houver bancada destino selecionada com auto-início
    if (isGerm) {
      const selDestino = document.getElementById("transplante-destino-bancada")?.value;
      const checkAuto = document.getElementById("check-auto-iniciar-ciclo")?.checked;

      if (selDestino && selDestino !== "manual") {
        const blocoDest = AppState.blocos.find(b => b.id_bloco === selDestino);
        const cicloDestExistente = AppState.ciclos.find(c => c.id_bloco === selDestino && c.status === "ativo");
        const tipoLabel = blocoDest ? (blocoDest.tipo_bloco === "maternidade" ? "Maternidade" : blocoDest.tipo_bloco === "bercario" ? "Berçário" : "Definitiva") : "";

        if (!destino || destino.trim() === "") {
          destino = `Transplante ➔ ${selDestino} (${tipoLabel})`;
        }

        if (blocoDest && !cicloDestExistente && checkAuto) {
          const cultNome = cicloAtivo.cultura;
          const varNome = cicloAtivo.variedade || "";
          const itemCat = (AppState.catalogoCulturas || []).find(c => c.nome.toLowerCase() === cultNome.toLowerCase());
          const diasTotal = itemCat ? (itemCat.ciclo_dias || 30) : 30;
          const isBerc = (blocoDest.tipo_bloco === "bercario" || blocoDest.tipo_bloco === "maternidade");
          const diasFase = isBerc ? Math.min(15, Math.max(7, Math.round(diasTotal * 0.4))) : diasTotal;

          const dataPlantioDest = dataHora.slice(0, 10);
          const dataColhDest = new Date(Date.now() + diasFase * 86400000).toISOString().split("T")[0];

          const novoCicloDest = {
            id_ciclo: `CICLO-${Date.now()}-TRANS`,
            id_bloco: blocoDest.id_bloco,
            cultura: cultNome,
            variedade: varNome,
            data_plantio: dataPlantioDest,
            data_prevista_colheita: dataColhDest,
            lote_nutritivo: isBerc
              ? "Solução Berçário / Maternidade (EC 1.2 - 1.4 mS)"
              : "Solução Definitiva (EC 1.6 - 1.8 mS)",
            status: "ativo",
            qtd_inicial: qtd,
            qtd_restante: qtd,
            colheitas: []
          };
          AppState.ciclos.push(novoCicloDest);

          const novoTratoDest = {
            id_trato: `TRATO-${Date.now()}-IN`,
            id_bloco: blocoDest.id_bloco,
            id_ciclo: novoCicloDest.id_ciclo,
            data_hora: dataHora,
            tipo_manejo: `🌱 Transplante Recebido de ${idBloco}`,
            responsavel: responsavel,
            observacoes: `Recebidas ${qtd} mudas de ${cultNome}${varNome ? ` (${varNome})` : ""} germinadas em espuma fenólica no módulo ${idBloco}.`
          };
          AppState.tratos.push(novoTratoDest);

          autoIniciadoMsg = ` e iniciado cultivo ativo em ${blocoDest.id_bloco} (${tipoLabel})`;

          if (AppState.googleSheetsUrl) {
            await registrarAcaoRemota("iniciarCiclo", novoCicloDest);
            await registrarAcaoRemota("registrarTrato", novoTratoDest);
          }
        }
      }
    }

    cicloAtivo.colheitas = cicloAtivo.colheitas || [];
    cicloAtivo.colheitas.push({
      id_colheita: `COLH-${Date.now()}`,
      data_hora: dataHora,
      qtd: qtd,
      destino: destino,
      responsavel: responsavel
    });

    const total = cicloAtivo.qtd_inicial || bloco.total_furos || 192;
    cicloAtivo.qtd_restante = Math.max(0, (cicloAtivo.qtd_restante !== undefined ? cicloAtivo.qtd_restante : total) - qtd);
    cicloAtivo.editado_localmente = true;
    cicloAtivo._ultima_modificacao = Date.now();

    const novoTratoColheita = {
      id_trato: `TRATO-COLH-${Date.now()}`,
      id_bloco: idBloco,
      id_ciclo: cicloAtivo.id_ciclo,
      data_hora: dataHora,
      tipo_manejo: isGerm ? `🌿 Transplante: ${qtd} mudas` : `🌾 Colheita: ${qtd} plantas`,
      responsavel: responsavel,
      observacoes: `Destino: ${destino}. Restam ${cicloAtivo.qtd_restante} ${isGerm ? "mudas" : "plantas"} no leito.`
    };
    AppState.tratos.push(novoTratoColheita);

    if (finalizar || cicloAtivo.qtd_restante === 0) {
      cicloAtivo.status = "finalizado";
      cicloAtivo.data_colheita_real = dataHora.slice(0, 10);
      mostrarToast(`${isGerm ? "Transplante" : "Colheita"} de ${qtd} ${unidadeNome} registrado${autoIniciadoMsg}! ${blocoNome} desocupado e liberado.`, "success");
    } else {
      mostrarToast(`${isGerm ? "Transplante" : "Colheita"} de ${qtd} ${unidadeNome} registrado${autoIniciadoMsg}! Restam ${cicloAtivo.qtd_restante} ${unidadeNome} no ${blocoNome}.`, "success");
    }

    salvarDadosLocal();
    modalColheita?.classList.remove("open");
    abrirPainelInspecao(idBloco);
    if (document.getElementById("modal-historico-graficos")?.classList.contains("open")) {
      abrirModalHistoricoEGraficos(idBloco);
    }
    atualizarFiltros();
    solicitarRedesenho();

    if (AppState.googleSheetsUrl) {
      await registrarAcaoRemota("registrarTrato", novoTratoColheita);
      if (finalizar || cicloAtivo.qtd_restante === 0) {
        await registrarAcaoRemota("finalizarCiclo", { id_ciclo: cicloAtivo.id_ciclo, id_bloco: idBloco });
      } else {
        await registrarAcaoRemota("atualizarCiclo", cicloAtivo);
      }
    }
  });

  // --- CONFIGURAÇÃO DA ÁREA ---
  function abrirModalConfigArea() {
    if (!verificarPermissaoEdicao(true)) return;
    document.getElementById("area-nome").value = AppState.area.nome;
    document.getElementById("area-comprimento").value = AppState.area.comprimento_m;
    document.getElementById("area-largura").value = AppState.area.largura_m;
    document.getElementById("area-corredor").value = AppState.area.largura_corredor_m;
    modalArea.classList.add("open");
  }
  document.getElementById("btn-config-area")?.addEventListener("click", abrirModalConfigArea);
  document.getElementById("opt-config-area")?.addEventListener("click", () => {
    fecharTodosDropdowns();
    abrirModalConfigArea();
  });

  document.getElementById("form-config-area").addEventListener("submit", e => {
    e.preventDefault();
    AppState.area.nome = document.getElementById("area-nome").value;
    AppState.area.comprimento_m = parseFloat(document.getElementById("area-comprimento").value);
    AppState.area.largura_m = parseFloat(document.getElementById("area-largura").value);
    AppState.area.largura_corredor_m = parseFloat(document.getElementById("area-corredor").value);

    salvarDadosLocal();
    ajustarVisualizacaoGeral();
    modalArea.classList.remove("open");
    mostrarToast("Dimensões da estufa atualizadas com sucesso!", "success");
  });

  // --- GOOGLE SHEETS ---
  function abrirModalSheetsConfig() {
    document.getElementById("sheets-url").value = AppState.googleSheetsUrl;
    modalSheets.classList.add("open");
  }
  document.getElementById("btn-sheets-sync")?.addEventListener("click", abrirModalSheetsConfig);
  document.getElementById("opt-open-sheets-config")?.addEventListener("click", () => {
    fecharTodosDropdowns();
    abrirModalSheetsConfig();
  });

  document.getElementById("form-sheets").addEventListener("submit", e => {
    e.preventDefault();
    const url = document.getElementById("sheets-url").value.trim();
    AppState.googleSheetsUrl = url;
    localStorage.setItem("hidro_sheets_url", url);
    atualizarStatusConexao();
    modalSheets.classList.remove("open");
    mostrarToast("Configuração do Google Sheets salva!", "success");
  });

  document.getElementById("btn-sync-now").addEventListener("click", async () => {
    const url = document.getElementById("sheets-url").value.trim();
    if (!url) {
      mostrarToast("Informe a URL do Web App Apps Script primeiro.", "warning");
      return;
    }
    AppState.googleSheetsUrl = url;
    localStorage.setItem("hidro_sheets_url", url);
    await sincronizarComSheets(true);
  });

  // --- MODAL 11: LOGIN / AUTENTICAÇÃO ---
  let abaLoginAtiva = "operador";

  document.getElementById("tab-login-operador")?.addEventListener("click", () => {
    abaLoginAtiva = "operador";
    abrirModalLogin("operador");
  });

  document.getElementById("tab-login-gestor")?.addEventListener("click", () => {
    abaLoginAtiva = "gestor";
    abrirModalLogin("gestor");
  });

  document.getElementById("btn-toggle-login-pass")?.addEventListener("click", () => {
    const input = document.getElementById("login-senha");
    const btn = document.getElementById("btn-toggle-login-pass");
    if (!input || !btn) return;
    if (input.type === "password") {
      input.type = "text";
      btn.textContent = "🙈 Ocultar";
    } else {
      input.type = "password";
      btn.textContent = "👁️ Mostrar";
    }
  });

  document.getElementById("btn-esqueci-senha")?.addEventListener("click", () => {
    const infoBox = document.getElementById("info-recuperacao-msg");
    if (!infoBox) return;
    const email = (AppState.gestorConfig.emailRecuperacao || "").trim();

    if (!email) {
      infoBox.innerHTML = `⚠️ <strong>Nenhum e-mail de recuperação cadastrado.</strong><br><small style="color:var(--text-muted)">Configure seu e-mail de recuperação no Painel do Gestor ou faça login com a senha padrão.</small>`;
      infoBox.style.display = "block";
      return;
    }

    let html = `
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div>
          📧 <strong>E-mail de recuperação do Gestor:</strong><br>
          <span style="color: #10b981; font-weight: 700; text-decoration: underline;">${email}</span>
        </div>
    `;

    if (AppState.googleSheetsUrl) {
      html += `
        <button type="button" id="btn-disparar-email-gestor" class="btn-primary" style="font-size: 0.75rem; padding: 7px 12px; justify-content: center; margin-top: 4px;">
          ✉️ Enviar Senha para este E-mail Agora
        </button>
        <div id="status-envio-email-gestor" style="font-size: 0.72rem; margin-top: 2px;"></div>
      `;
    } else {
      html += `
        <small style="color: var(--text-muted); line-height: 1.4;">
          💡 <em>O envio automático de e-mail requer a planilha Google conectada.</em> Como o sistema está local, sua chave de criptografia padrão é: <code>${AppState.gestorConfig.chaveCriptografia || "HIDRO-SEC-2026"}</code>
        </small>
      `;
    }

    html += `</div>`;
    infoBox.innerHTML = html;
    infoBox.style.display = "block";

    document.getElementById("btn-disparar-email-gestor")?.addEventListener("click", async () => {
      const btn = document.getElementById("btn-disparar-email-gestor");
      const statusDiv = document.getElementById("status-envio-email-gestor");
      if (btn) {
        btn.disabled = true;
        btn.textContent = "⏳ Enviando pelo Google...";
      }
      try {
        const res = await registrarAcaoRemota("enviarEmailRecuperacao", {
          email: email,
          senha: AppState.gestorConfig.senhaHash || "admin123",
          chave: AppState.gestorConfig.chaveCriptografia || "HIDRO-SEC-2026"
        });
        if (res && res.status === "success") {
          mostrarToast(`✉️ E-mail enviado com sucesso para ${email}!`, "success");
          if (statusDiv) statusDiv.innerHTML = `<span style="color: #10b981; font-weight: 600;">✓ E-mail com a senha enviado para <strong>${email}</strong>! Verifique sua caixa de entrada.</span>`;
        } else {
          const msg = res?.message || "Erro ao disparar e-mail.";
          mostrarToast(`Aviso: ${msg}`, "warning");
          if (statusDiv) statusDiv.innerHTML = `<span style="color: #ef4444;">⚠️ ${msg}</span>`;
        }
      } catch (e) {
        mostrarToast("Não foi possível conectar ao Google Sheets para enviar o e-mail.", "error");
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = "✉️ Reenviar E-mail";
        }
      }
    });
  });

  document.getElementById("btn-esqueci-operador")?.addEventListener("click", () => {
    const infoBoxOp = document.getElementById("info-operador-msg");
    if (!infoBoxOp) return;

    const select = document.getElementById("login-operador-select");
    const idOp = select?.value;
    const op = AppState.usuarios.find(u => u.id_usuario === idOp);
    const emailGestor = (AppState.gestorConfig.emailRecuperacao || "").trim();

    if (!idOp || !op) {
      infoBoxOp.innerHTML = `
        <div style="line-height: 1.4;">
          ⚠️ <strong>Por favor, selecione seu nome na lista acima primeiro.</strong><br>
          <small style="color: var(--text-muted);">Depois de escolher quem é você, clique aqui para solicitar auxílio ao Gestor.</small>
        </div>
      `;
      infoBoxOp.style.display = "block";
      select?.focus();
      return;
    }

    let html = `
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div>
          👨‍🌾 <strong>Olá, ${op.nome}!</strong>
        </div>
        <div style="font-size: 0.76rem; color: var(--text-secondary); line-height: 1.4;">
          As senhas dos operadores são criadas e controladas pelo <strong>Gestor Principal</strong>.<br>
          • Solicite presencialmente ao Gestor para consultar ou alterar sua senha no <strong>Painel de Usuários</strong>.<br>
          ${emailGestor ? `• E-mail do Gestor: <strong style="color: #2563eb;">${emailGestor}</strong>` : ""}
        </div>
    `;

    if (AppState.googleSheetsUrl && emailGestor) {
      html += `
        <button type="button" id="btn-solicitar-senha-gestor" class="btn-primary" style="font-size: 0.75rem; padding: 7px 12px; justify-content: center; background: #2563eb; border-color: #2563eb; margin-top: 4px;">
          📲 Notificar Gestor por E-mail (${emailGestor})
        </button>
        <div id="status-envio-solic-op" style="font-size: 0.72rem; margin-top: 2px;"></div>
      `;
    }

    html += `</div>`;
    infoBoxOp.innerHTML = html;
    infoBoxOp.style.display = "block";

    document.getElementById("btn-solicitar-senha-gestor")?.addEventListener("click", async () => {
      const btn = document.getElementById("btn-solicitar-senha-gestor");
      const statusDiv = document.getElementById("status-envio-solic-op");
      if (btn) {
        btn.disabled = true;
        btn.textContent = "⏳ Enviando solicitação ao Gestor...";
      }
      try {
        const res = await registrarAcaoRemota("solicitarSenhaOperador", {
          nome_operador: op.nome,
          email_gestor: emailGestor
        });
        if (res && res.status === "success") {
          mostrarToast(`📲 Solicitação enviada com sucesso para o Gestor (${emailGestor})!`, "success");
          if (statusDiv) statusDiv.innerHTML = `<span style="color: #10b981; font-weight: 600;">✓ Notificação enviada ao Gestor! Ele receberá um e-mail solicitando sua senha.</span>`;
        } else {
          const msg = res?.message || "Não foi possível enviar a solicitação.";
          mostrarToast(`Aviso: ${msg}`, "warning");
          if (statusDiv) statusDiv.innerHTML = `<span style="color: #ef4444;">⚠️ ${msg}</span>`;
        }
      } catch (err) {
        mostrarToast("Erro ao conectar com a planilha para notificar o Gestor.", "error");
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = "📲 Notificar Gestor Novamente";
        }
      }
    });
  });

  document.getElementById("form-login")?.addEventListener("submit", async e => {
    e.preventDefault();
    const senha = (document.getElementById("login-senha")?.value || "").trim();

    if (!validarSenhaAlfanumerica(senha)) {
      mostrarToast("A senha deve ter no mínimo 4 caracteres alfanuméricos (letras e números).", "warning");
      return;
    }

    if (abaLoginAtiva === "operador") {
      const select = document.getElementById("login-operador-select");
      const idOp = select?.value;
      if (!idOp) {
        mostrarToast("Selecione seu nome de operador na lista.", "warning");
        return;
      }

      const op = AppState.usuarios.find(u => u.id_usuario === idOp);
      if (!op) {
        mostrarToast("Operador não encontrado.", "error");
        return;
      }

      if (op.senha !== senha) {
        mostrarToast("Senha incorreta para o operador selecionado.", "error");
        return;
      }

      op.ultimo_acesso = new Date().toISOString();
      salvarUsuariosLocal();
      definirUsuarioLogado({ id_usuario: op.id_usuario, nome: op.nome, papel: "operador" });
      modalLogin?.classList.remove("open");
      mostrarToast(`Bem-vindo, ${op.nome}! Você está logado como Operador.`, "success");
      await registrarAcessoRemoto(op.id_usuario);

    } else {
      // Login do Gestor
      if (!AppState.gestorConfig.isConfigurado && !AppState.gestorConfig.senhaHash) {
        modalLogin?.classList.remove("open");
        abrirModalSetupGestor();
        return;
      }

      const senhaCorreta = AppState.gestorConfig.senhaHash || "admin123";
      if (senha !== senhaCorreta) {
        mostrarToast("Senha de Gestor incorreta.", "error");
        return;
      }

      definirUsuarioLogado({ id_usuario: "USER-GESTOR", nome: AppState.gestorConfig.nome || "Gestor", papel: "gestor" });
      modalLogin?.classList.remove("open");
      mostrarToast(`Bem-vindo, Gestor ${AppState.gestorConfig.nome}! Acesso administrativo liberado.`, "success");
      await registrarAcessoRemoto("USER-GESTOR");
    }
  });

  // --- MODAL 12: PAINEL DO GESTOR (OPERADORES & SEGURANÇA) ---
  const tabNavOperadores = document.getElementById("tab-nav-operadores");
  const tabNavSeguranca = document.getElementById("tab-nav-seguranca");
  const secOperadores = document.getElementById("sec-gestor-operadores");
  const secSeguranca = document.getElementById("sec-gestor-seguranca");

  tabNavOperadores?.addEventListener("click", () => {
    tabNavOperadores.classList.remove("btn-secondary");
    tabNavOperadores.classList.add("btn-primary");
    tabNavSeguranca?.classList.remove("btn-primary");
    tabNavSeguranca?.classList.add("btn-secondary");
    if (secOperadores) secOperadores.style.display = "block";
    if (secSeguranca) secSeguranca.style.display = "none";
  });

  tabNavSeguranca?.addEventListener("click", () => {
    tabNavSeguranca?.classList.remove("btn-secondary");
    tabNavSeguranca?.classList.add("btn-primary");
    tabNavOperadores?.classList.remove("btn-primary");
    tabNavOperadores?.classList.add("btn-secondary");
    if (secSeguranca) secSeguranca.style.display = "block";
    if (secOperadores) secOperadores.style.display = "none";
    atualizarDisplaySegurancaGestor();
  });

  document.getElementById("btn-salvar-operador")?.addEventListener("click", async () => {
    const nomeInput = document.getElementById("cad-operador-nome");
    const senhaInput = document.getElementById("cad-operador-senha");
    const nome = (nomeInput?.value || "").trim();
    const senha = (senhaInput?.value || "").trim();

    if (!nome) {
      mostrarToast("Informe o nome do operador.", "warning");
      nomeInput?.focus();
      return;
    }

    if (!validarSenhaAlfanumerica(senha)) {
      mostrarToast("A senha do operador deve ter no mínimo 4 caracteres alfanuméricos (letras e números).", "warning");
      senhaInput?.focus();
      return;
    }

    if (AppState.usuarios.some(u => u.nome.toLowerCase() === nome.toLowerCase())) {
      mostrarToast(`Já existe um operador com o nome "${nome}".`, "warning");
      return;
    }

    const novoOp = {
      id_usuario: `OP-${Date.now().toString().slice(-5)}`,
      nome: nome,
      senha: senha,
      ultimo_acesso: ""
    };

    AppState.usuarios.push(novoOp);
    salvarUsuariosLocal();
    popularSelectLoginOperadores();
    renderizarListaOperadoresGestor();

    if (nomeInput) nomeInput.value = "";
    if (senhaInput) senhaInput.value = "";

    mostrarToast(`Operador "${nome}" cadastrado com sucesso!`, "success");
    await sincronizarUsuariosComPlanilha();
  });

  document.getElementById("btn-salvar-seguranca-gestor")?.addEventListener("click", async () => {
    const email = document.getElementById("gestor-email-recup")?.value.trim() || "";
    const chave = document.getElementById("gestor-chave-cripto")?.value.trim() || "";
    const novaSenha = document.getElementById("gestor-nova-senha")?.value.trim() || "";
    const confSenha = document.getElementById("gestor-confirm-senha")?.value.trim() || "";

    if (!chave) {
      mostrarToast("O código de criptografia da planilha não pode ser vazio.", "warning");
      return;
    }

    const chaveAntiga = AppState.gestorConfig.chaveCriptografia || "HIDRO-SEC-2026";
    const chaveMudou = chave !== chaveAntiga;

    let senhaAlterada = false;
    if (novaSenha) {
      if (!validarSenhaAlfanumerica(novaSenha)) {
        mostrarToast("A nova senha deve ter no mínimo 4 caracteres (sem espaços).", "warning");
        return;
      }
      if (novaSenha !== confSenha) {
        mostrarToast("A confirmação da nova senha não confere com a nova senha digitada.", "warning");
        return;
      }
      AppState.gestorConfig.senhaHash = novaSenha;
      senhaAlterada = true;
    }

    AppState.gestorConfig.emailRecuperacao = email;
    AppState.gestorConfig.chaveCriptografia = chave;
    AppState.gestorConfig.isConfigurado = true;
    salvarGestorConfigLocal();

    const elNova = document.getElementById("gestor-nova-senha");
    const elConf = document.getElementById("gestor-confirm-senha");
    if (elNova) elNova.value = "";
    if (elConf) elConf.value = "";

    atualizarDisplaySegurancaGestor();

    if (senhaAlterada && chaveMudou) {
      mostrarToast("🔑 Nova senha e código de criptografia salvos com sucesso!", "success");
    } else if (senhaAlterada) {
      mostrarToast("🔑 Nova senha do Gestor salva com sucesso!", "success");
    } else if (chaveMudou) {
      mostrarToast("🔑 Código de criptografia alterado! Senhas recodificadas com a nova chave.", "success");
    } else {
      mostrarToast("Configurações de segurança salvas!", "success");
    }

    if (AppState.ultimosUsuariosRemotos && AppState.ultimosUsuariosRemotos.length > 0) {
      processarUsuariosRemotos(AppState.ultimosUsuariosRemotos);
    }

    await sincronizarUsuariosComPlanilha(true);
  });

  // Alternância de visualização da senha atual do Gestor
  document.getElementById("btn-toggle-ver-senha-gestor")?.addEventListener("click", () => {
    const display = document.getElementById("gestor-senha-atual-display");
    const btn = document.getElementById("btn-toggle-ver-senha-gestor");
    if (!display || !btn) return;
    const isRevealed = display.getAttribute("data-revealed") === "true";
    if (isRevealed) {
      display.textContent = "••••••••";
      display.setAttribute("data-revealed", "false");
      btn.textContent = "👁️ Revelar";
    } else {
      display.textContent = AppState.gestorConfig.senhaHash || "admin123";
      display.setAttribute("data-revealed", "true");
      btn.textContent = "🙈 Ocultar";
    }
  });

  // Toggles de visualização dos campos de nova senha
  document.getElementById("btn-toggle-nova-senha-gestor")?.addEventListener("click", () => {
    const input = document.getElementById("gestor-nova-senha");
    if (!input) return;
    input.type = input.type === "password" ? "text" : "password";
  });

  document.getElementById("btn-toggle-conf-senha-gestor")?.addEventListener("click", () => {
    const input = document.getElementById("gestor-confirm-senha");
    if (!input) return;
    input.type = input.type === "password" ? "text" : "password";
  });

  // Botão direto de sincronização de usuários com o Google Sheets
  document.getElementById("btn-sync-usuarios-sheets")?.addEventListener("click", async () => {
    await sincronizarUsuariosComPlanilha(true);
  });

  // --- MODAL 13: SETUP INICIAL DO GESTOR ---
  document.getElementById("form-setup-gestor")?.addEventListener("submit", async e => {
    e.preventDefault();
    const nome = document.getElementById("setup-gestor-nome")?.value.trim() || "Gestor";
    const senha = document.getElementById("setup-gestor-senha")?.value.trim() || "";
    const conf = document.getElementById("setup-gestor-confirm-senha")?.value.trim() || "";
    const email = document.getElementById("setup-gestor-email")?.value.trim() || "";
    const chave = document.getElementById("setup-gestor-chave")?.value.trim() || "HIDRO-SEC-2026";

    if (!validarSenhaAlfanumerica(senha)) {
      mostrarToast("A senha deve ter no mínimo 4 caracteres alfanuméricos (letras e números).", "warning");
      return;
    }

    if (senha !== conf) {
      mostrarToast("A senha e a confirmação de senha não coincidem.", "warning");
      return;
    }

    AppState.gestorConfig = {
      isConfigurado: true,
      nome: nome,
      senhaHash: senha,
      emailRecuperacao: email,
      chaveCriptografia: chave
    };

    salvarGestorConfigLocal();
    definirUsuarioLogado({ id_usuario: "USER-GESTOR", nome: nome, papel: "gestor" });
    modalSetupGestor?.classList.remove("open");
    mostrarToast(`Conta de Gestor configurada! Bem-vindo, ${nome}!`, "success");

    await sincronizarUsuariosComPlanilha();
  });
}

// ==========================================================================
// 13. INTEGRAÇÃO ASSÍNCRONA COM GOOGLE APPS SCRIPT (SHEETS)
// ==========================================================================
async function registrarAcaoRemota(acao, payload) {
  if (!AppState.googleSheetsUrl) return null;

  try {
    const resposta = await fetch(AppState.googleSheetsUrl, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: acao, data: payload })
    });
    const resJson = await resposta.json();
    if (resJson && resJson.timestamp) {
      AppState.lastServerTimestamp = Number(resJson.timestamp);
    }
    return resJson;
  } catch (erro) {
    console.error("Falha na sincronização com Google Sheets:", erro);
    return null;
  }
}

async function sincronizarComSheets(feedbackVisual = false) {
  if (!AppState.googleSheetsUrl) return;

  const dot = document.getElementById("sync-dot");
  const label = document.getElementById("sync-label");

  dot.className = "status-dot offline";
  label.textContent = "Sincronizando...";
  AppState.isSyncing = true;

  try {
    await registrarAcaoRemota("salvarLayout", {
      area: AppState.area,
      blocos: AppState.blocos
    });

    const resp = await fetch(AppState.googleSheetsUrl, { method: "GET", mode: "cors" });
    if (resp.ok) {
      const respJson = await resp.json();
      const payload = respJson.data || respJson;

      if (payload.blocos && Array.isArray(payload.blocos) && payload.blocos.length > 0) {
        AppState.blocos = payload.blocos;
      }
      if (payload.ciclos && Array.isArray(payload.ciclos)) {
        const ciclosMesclados = payload.ciclos.map(remoto => {
          const local = AppState.ciclos.find(c =>
            c.id_ciclo === remoto.id_ciclo ||
            (c.id_bloco === remoto.id_bloco && c.status === "ativo") ||
            (c.id_bloco === remoto.id_bloco && c.status === "finalizado" && c.colheitas && c.colheitas.length > 0)
          );

          const bloco = AppState.blocos.find(b => b.id_bloco === remoto.id_bloco);
          const totalPadrao = bloco ? (bloco.total_furos || 192) : 192;
          const qtdIni = (local && local.qtd_inicial) || remoto.qtd_inicial || totalPadrao;

          // Preserva colheitas e saldo restante localmente
          const colheitas = (local && Array.isArray(local.colheitas)) ? local.colheitas : (remoto.colheitas || []);
          const qtdRestante = (local && local.qtd_restante !== undefined)
            ? local.qtd_restante
            : (remoto.qtd_restante !== undefined ? remoto.qtd_restante : qtdIni);

          // Normaliza datas para YYYY-MM-DD
          let dataPlantio = remoto.data_plantio;
          if (typeof dataPlantio === "string" && dataPlantio.includes("T")) {
            dataPlantio = dataPlantio.split("T")[0];
          }
          let dataColheita = remoto.data_prevista_colheita;
          if (typeof dataColheita === "string" && dataColheita.includes("T")) {
            dataColheita = dataColheita.split("T")[0];
          }

          // Se o ciclo local foi editado e tem data válida, prioriza a edição local
          if (local && local.editado_localmente && local.data_plantio) {
            dataPlantio = local.data_plantio;
          }
          if (local && local.editado_localmente && local.data_prevista_colheita) {
            dataColheita = local.data_prevista_colheita;
          }

          // Se a colheita finalizou o ciclo localmente, preserva status finalizado
          let statusFinal = remoto.status || "ativo";
          if (local && local.status === "finalizado" && (qtdRestante === 0 || colheitas.length > 0)) {
            statusFinal = "finalizado";
          }

          return {
            ...remoto,
            cultura: (local && local.editado_localmente && local.cultura) ? local.cultura : (remoto.cultura || ""),
            variedade: (local && local.editado_localmente && local.variedade !== undefined) ? local.variedade : (remoto.variedade || ""),
            data_plantio: dataPlantio || (local ? local.data_plantio : ""),
            data_prevista_colheita: dataColheita || (local ? local.data_prevista_colheita : ""),
            lote_nutritivo: (local && local.editado_localmente && local.lote_nutritivo) ? local.lote_nutritivo : (remoto.lote_nutritivo || ""),
            qtd_inicial: qtdIni,
            qtd_restante: qtdRestante,
            colheitas: colheitas,
            status: statusFinal,
            editado_localmente: local ? local.editado_localmente : false
          };
        });

        // Inclui ciclos que foram criados localmente e ainda não constam na planilha
        AppState.ciclos.forEach(local => {
          if (!ciclosMesclados.some(m => m.id_ciclo === local.id_ciclo)) {
            ciclosMesclados.push(local);
          }
        });

        AppState.ciclos = ciclosMesclados;
      }

      if (payload.tratos && Array.isArray(payload.tratos)) {
        const idsRemotos = new Set(payload.tratos.map(t => t.id_trato));
        AppState.tratos.forEach(localTrato => {
          if (!idsRemotos.has(localTrato.id_trato)) {
            payload.tratos.push(localTrato);
          }
        });
        AppState.tratos = payload.tratos;
      }
      if (payload.usuarios && Array.isArray(payload.usuarios)) {
        processarUsuariosRemotos(payload.usuarios);
      }

      if (respJson.timestamp) {
        AppState.lastServerTimestamp = Number(respJson.timestamp);
      }

      salvarDadosLocal();
      atualizarFiltros();
      solicitarRedesenho();

      dot.className = "status-dot";
      label.textContent = "Sheets Conectado";
      if (feedbackVisual) mostrarToast("Sincronização com Google Sheets concluída!", "success");
    }
  } catch (erro) {
    console.warn("Sheets offline ou erro de sincronização:", erro);
    dot.className = "status-dot offline";
    label.textContent = "Sheets Offline (Local OK)";
    if (feedbackVisual) mostrarToast("Não foi possível conectar ao Google Sheets. Operando localmente.", "warning");
  } finally {
    AppState.isSyncing = false;
  }
}

function atualizarStatusConexao() {
  const dot = document.getElementById("sync-dot");
  const label = document.getElementById("sync-label");
  if (AppState.googleSheetsUrl) {
    dot.className = "status-dot";
    label.textContent = "Sheets Configurado";
  } else {
    dot.className = "status-dot offline";
    label.textContent = "Modo Local";
  }
}

// ==========================================================================
// 14. FILTROS E CONTROLES DE INTERFACE
// ==========================================================================
function fecharTodosDropdowns() {
  document.querySelectorAll(".dropdown-container").forEach(el => el.classList.remove("open"));
}
const fecharDropdownAdd = fecharTodosDropdowns;

function exportarBackupJSON() {
  const backup = {
    versao: "3.1",
    exportado_em: new Date().toISOString(),
    area: AppState.area,
    blocos: AppState.blocos,
    ciclos: AppState.ciclos,
    tratos: AppState.tratos,
    tanques: AppState.tanques
  };
  const jsonStr = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const hojeStr = new Date().toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = `croqui-estufa-${hojeStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  mostrarToast("Arquivo JSON gerado e baixado com sucesso!", "success");
}

function importarBackupJSON(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const conteudo = JSON.parse(e.target.result);
      const blocos = conteudo.blocos || conteudo.bancadas;
      if (!blocos || !Array.isArray(blocos)) {
        throw new Error("O arquivo não contém uma lista válida de bancadas ('blocos').");
      }

      if (conteudo.area || conteudo.estufa) {
        AppState.area = conteudo.area || conteudo.estufa;
      }
      AppState.blocos = blocos;
      if (conteudo.ciclos && Array.isArray(conteudo.ciclos)) {
        AppState.ciclos = conteudo.ciclos;
      }
      if (conteudo.tratos && Array.isArray(conteudo.tratos)) {
        AppState.tratos = conteudo.tratos;
      }
      if (conteudo.tanques && Array.isArray(conteudo.tanques)) {
        AppState.tanques = conteudo.tanques;
      }
      sincronizarTanquesBancadas();

      salvarDadosLocal();
      atualizarFiltros();
      atualizarBadgeInfo();
      ajustarVisualizacaoGeral();
      solicitarRedesenho();

      mostrarToast(`Sucesso! ${AppState.blocos.length} bancadas restauradas do arquivo JSON.`, "success");
    } catch (erro) {
      console.error("Erro ao importar JSON:", erro);
      mostrarToast(`Falha ao ler arquivo JSON: ${erro.message}`, "error");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function setupFiltrosEControles() {
  const filterCultura = document.getElementById("filter-cultura");
  const filterFase = document.getElementById("filter-fase");
  const filterSetor = document.getElementById("filter-setor");

  filterCultura.addEventListener("change", e => {
    AppState.filters.cultura = e.target.value;
    solicitarRedesenho();
  });

  filterFase.addEventListener("change", e => {
    AppState.filters.fase = e.target.value;
    solicitarRedesenho();
  });

  filterSetor.addEventListener("change", e => {
    AppState.filters.setor = e.target.value;
    solicitarRedesenho();

    if (e.target.value === "ESQUERDO") {
      focarNoSetor("esquerdo");
    } else if (e.target.value === "DIREITO") {
      focarNoSetor("direito");
    } else {
      ajustarVisualizacaoGeral();
    }
  });

  // Botão Inspecionar Padrão (legado/fallback)
  document.getElementById("tool-select")?.addEventListener("click", () => {
    fecharTodosDropdowns();
    definirFerramentaAtiva("select");
  });

  // Dropdown Menu: Bancadas (Criação, Espelhar e Templates)
  const dropdownBancadas = document.getElementById("dropdown-bancadas");
  const btnMenuBancadas = document.getElementById("btn-menu-bancadas");
  if (btnMenuBancadas && dropdownBancadas) {
    btnMenuBancadas.addEventListener("click", e => {
      e.stopPropagation();
      const jaAberto = dropdownBancadas.classList.contains("open");
      fecharTodosDropdowns();
      if (!jaAberto) dropdownBancadas.classList.add("open");
    });
  }

  // Dropdown Menu: Projeto (Salvar, Backup, Importar, Sheets, Dimensões e Tema)
  const dropdownProjeto = document.getElementById("dropdown-projeto");
  const btnMenuProjeto = document.getElementById("btn-menu-projeto");
  if (btnMenuProjeto && dropdownProjeto) {
    btnMenuProjeto.addEventListener("click", e => {
      e.stopPropagation();
      const jaAberto = dropdownProjeto.classList.contains("open");
      fecharTodosDropdowns();
      if (!jaAberto) dropdownProjeto.classList.add("open");
    });
  }

  // Compatibilidade legada com dropdown-salvar
  const dropdownSalvar = document.getElementById("dropdown-salvar");
  const btnSaveMenu = document.getElementById("btn-save-menu");
  if (btnSaveMenu && dropdownSalvar) {
    btnSaveMenu.addEventListener("click", e => {
      e.stopPropagation();
      const jaAberto = dropdownSalvar.classList.contains("open");
      fecharTodosDropdowns();
      if (!jaAberto) dropdownSalvar.classList.add("open");
    });
  }

  // Fechar dropdowns ao clicar fora
  document.addEventListener("click", e => {
    if (!e.target.closest(".dropdown-container")) {
      fecharTodosDropdowns();
    }
  });

  // User Session Widget Dropdown (Discreto)
  const userWidget = document.getElementById("user-session-widget");
  const btnUserAuth = document.getElementById("btn-user-auth");
  if (btnUserAuth && userWidget) {
    btnUserAuth.addEventListener("click", e => {
      e.stopPropagation();
      if (!AppState.currentUser) {
        fecharTodosDropdowns();
        abrirModalLogin("operador");
      } else {
        const jaAberto = userWidget.classList.contains("open");
        fecharTodosDropdowns();
        if (!jaAberto) userWidget.classList.add("open");
      }
    });
  }

  document.getElementById("btn-menu-open-login")?.addEventListener("click", () => {
    fecharTodosDropdowns();
    abrirModalLogin("operador");
  });

  document.getElementById("btn-menu-gestor-panel")?.addEventListener("click", () => {
    fecharTodosDropdowns();
    abrirModalPainelGestor();
  });

  document.getElementById("btn-menu-logout")?.addEventListener("click", () => {
    fecharTodosDropdowns();
    definirUsuarioLogado(null);
    mostrarToast("Você saiu da conta. Modo somente leitura ativado.", "info");
  });

  // Itens do menu Bancadas
  document.getElementById("opt-add-definitivo")?.addEventListener("click", () => {
    fecharTodosDropdowns();
    if (!verificarPermissaoEdicao()) return;
    definirFerramentaAtiva("add_definitivo");
  });

  document.getElementById("opt-add-maternidade")?.addEventListener("click", () => {
    fecharTodosDropdowns();
    if (!verificarPermissaoEdicao()) return;
    definirFerramentaAtiva("add_maternidade");
  });

  document.getElementById("opt-add-bercario")?.addEventListener("click", () => {
    fecharTodosDropdowns();
    if (!verificarPermissaoEdicao()) return;
    definirFerramentaAtiva("add_bercario");
  });

  document.getElementById("opt-add-germinacao")?.addEventListener("click", () => {
    fecharTodosDropdowns();
    if (!verificarPermissaoEdicao()) return;
    definirFerramentaAtiva("add_germinacao");
  });

  document.getElementById("opt-espelhar-lado")?.addEventListener("click", () => {
    fecharTodosDropdowns();
    if (!verificarPermissaoEdicao()) return;
    espelharBancadasEsquerdaParaDireita();
  });

  document.getElementById("btn-mirror")?.addEventListener("click", () => {
    fecharTodosDropdowns();
    if (!verificarPermissaoEdicao()) return;
    espelharBancadasEsquerdaParaDireita();
  });

  // Botões do menu Projeto / Backup
  document.getElementById("btn-save-project")?.addEventListener("click", () => {
    salvarDadosLocal();
    exportarBackupJSON();
  });

  document.getElementById("btn-open-project")?.addEventListener("click", () => {
    document.getElementById("input-file-json")?.click();
  });

  document.getElementById("opt-save-local")?.addEventListener("click", async () => {
    fecharTodosDropdowns();
    salvarDadosLocal();
    mostrarToast("Layout e dados salvos no navegador (LocalStorage)!", "success");
    if (AppState.googleSheetsUrl) {
      await sincronizarComSheets(true);
    }
  });

  document.getElementById("opt-export-json")?.addEventListener("click", () => {
    fecharTodosDropdowns();
    exportarBackupJSON();
  });

  document.getElementById("opt-import-json")?.addEventListener("click", () => {
    fecharTodosDropdowns();
    document.getElementById("input-file-json")?.click();
  });

  document.getElementById("input-file-json")?.addEventListener("change", importarBackupJSON);

  document.getElementById("opt-open-sheets-config")?.addEventListener("click", () => {
    fecharTodosDropdowns();
    document.getElementById("sheets-url").value = AppState.googleSheetsUrl;
    modalSheets.classList.add("open");
  });

  // Alternância de Tema Claro / Escuro (Menu Projeto e Legado)
  function alternarTemaVisual() {
    fecharTodosDropdowns();
    const novoTema = AppState.theme === "dark" ? "light" : "dark";
    aplicarTema(novoTema);
  }
  document.getElementById("opt-theme-toggle")?.addEventListener("click", alternarTemaVisual);
  document.getElementById("btn-theme-toggle")?.addEventListener("click", alternarTemaVisual);

  // Banner Flutuante: Botão Girar
  document.getElementById("banner-btn-rotate")?.addEventListener("click", alternarOrientacao);

  // Controles de Câmera
  document.getElementById("btn-zoom-in").addEventListener("click", () => {
    const rect = viewport.getBoundingClientRect();
    aplicarZoomCentrado(1.2, rect.width / 2, rect.height / 2);
  });

  document.getElementById("btn-zoom-out").addEventListener("click", () => {
    const rect = viewport.getBoundingClientRect();
    aplicarZoomCentrado(0.83, rect.width / 2, rect.height / 2);
  });

  document.getElementById("btn-zoom-reset").addEventListener("click", ajustarVisualizacaoGeral);

  const btnSnap = document.getElementById("btn-snap-toggle");
  btnSnap.addEventListener("click", () => {
    AppState.snapToGrid = !AppState.snapToGrid;
    btnSnap.classList.toggle("active", AppState.snapToGrid);
    mostrarToast(`Encaixe magnético: ${AppState.snapToGrid ? "Ativado" : "Desativado"}`, "info");
  });

  document.getElementById("btn-close-inspector").addEventListener("click", fecharPainelInspecao);
}

function aplicarTema(tema) {
  AppState.theme = tema;
  localStorage.setItem("hidro_theme", tema);

  const icon = document.getElementById("theme-icon");
  const label = document.getElementById("theme-label");

  if (tema === "dark") {
    document.body.classList.add("dark-theme");
    if (icon) icon.textContent = "☀️";
    if (label) label.textContent = "Claro";
  } else {
    document.body.classList.remove("dark-theme");
    if (icon) icon.textContent = "🌙";
    if (label) label.textContent = "Escuro";
  }

  solicitarRedesenho();
}

function focarNoSetor(setor) {
  const rect = viewport.getBoundingClientRect();
  const meioX = AppState.area.largura_m / 2;

  const setorX = setor === "esquerdo" ? 0 : meioX;
  const setorLarguraM = meioX;

  const setorLarguraPx = metrosParaPixels(setorLarguraM);
  const setorCompPx = metrosParaPixels(AppState.area.comprimento_m);

  const escalaX = (rect.width - 60) / setorLarguraPx;
  const escalaY = (rect.height - 60) / setorCompPx;
  const novoZoom = Math.min(escalaX, escalaY, 2.2);

  AppState.camera.zoom = novoZoom;
  const setorXOffsetPx = metrosParaPixels(setorX) * novoZoom;
  AppState.camera.offsetX = (rect.width - setorLarguraPx * novoZoom) / 2 - setorXOffsetPx + (setor === "esquerdo" ? 0 : rect.width / 4);
  AppState.camera.offsetY = (rect.height - setorCompPx * novoZoom) / 2;

  solicitarRedesenho();
}

function definirFerramentaAtiva(tool) {
  AppState.activeTool = tool;

  document.getElementById("tool-select").classList.toggle("active", tool === "select");

  const modeLabel = tool === "select"
    ? "Inspecionar"
    : tool === "add_definitivo"
      ? "+ Definitivo"
      : tool === "add_maternidade"
        ? "+ Maternidade"
        : tool === "add_bercario"
          ? "+ Berçário"
          : tool === "add_germinacao"
            ? "+ Germinação"
            : tool;

  document.getElementById("info-mode").textContent = modeLabel;

  const banner = document.getElementById("canvas-insert-banner");
  if (tool.startsWith("add_")) {
    banner.classList.remove("hidden");
    document.getElementById("banner-tool-name").textContent = modeLabel;
    document.getElementById("banner-orientacao").textContent = AppState.currentOrientation === "horizontal" ? "↔ Transversal" : "↕ Longitudinal";
    canvas.style.cursor = "crosshair";
  } else {
    banner.classList.add("hidden");
    canvas.style.cursor = "default";
  }

  solicitarRedesenho();
}

function atualizarFiltros() {
  const select = document.getElementById("filter-cultura");
  const culturas = new Set();
  AppState.ciclos.forEach(c => {
    if (c.cultura && c.status === "ativo") culturas.add(c.cultura);
  });

  const valorAtual = select.value;
  select.innerHTML = '<option value="ALL">Todas as Culturas</option>';
  culturas.forEach(cult => {
    const opt = document.createElement("option");
    opt.value = cult;
    opt.textContent = cult;
    select.appendChild(opt);
  });

  if (culturas.has(valorAtual)) {
    select.value = valorAtual;
  }
}

function atualizarBadgeInfo() {
  document.getElementById("info-block-count").textContent = AppState.blocos.length;
}

function atualizarCoordenadasInfo(xM, yM) {
  const el = document.getElementById("info-coords");
  if (el) {
    el.textContent = `${Math.max(0, xM).toFixed(1)}m, ${Math.max(0, yM).toFixed(1)}m`;
  }
}

// ==========================================================================
// 15. NOTIFICAÇÕES TOAST
// ==========================================================================
function mostrarToast(mensagem, tipo = "info") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${tipo}`;
  toast.textContent = mensagem;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ==========================================================================
// 16. INICIALIZAÇÃO DA APLICAÇÃO
// ==========================================================================
window.addEventListener("DOMContentLoaded", () => {
  redimensionarCanvas();
  carregarDadosIniciais();
  carregarCatalogoCulturas();
  carregarGestorConfigLocal();
  carregarUsuariosLocal();
  carregarSessaoUsuario();
  sincronizarTanquesBancadas();
  setupFiltrosEControles();
  setupModaisEFormularios();
  registrarEventosCanvas();
  atualizarFiltros();
  atualizarBadgeInfo();
  atualizarStatusConexao();
  aplicarTema(AppState.theme);

  // Sincronização inicial com o Google Sheets se URL estiver configurada
  if (AppState.googleSheetsUrl) {
    sincronizarComSheets(false);
  }

  // Monitoramento inteligente de alterações remotas via verificação periódica de timestamp (sem LockService)
  window.addEventListener("focus", () => {
    verificarAtualizacaoTimestamp();
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      verificarAtualizacaoTimestamp();
    }
  });

  // Polling leve com intervalo moderado (40s) ativo apenas quando a janela está aberta
  setInterval(() => {
    if (!document.hidden) {
      verificarAtualizacaoTimestamp();
    }
  }, 40000);

  setTimeout(() => {
    redimensionarCanvas();
    ajustarVisualizacaoGeral();
  }, 100);

  window.addEventListener("resize", () => {
    redimensionarCanvas();
    solicitarRedesenho();
  });
});
