/**
 * GOOGLE APPS SCRIPT: BACKEND PARA SISTEMA WEB DE GESTÃO HIDROPÔNICA
 * Baseado no Roteiro.md e CriarPlanilha.md
 * 
 * Instruções de Instalação:
 * 1. Crie uma nova Planilha no Google Sheets (https://sheets.new).
 * 2. Acesse o menu: Extensões > Apps Script.
 * 3. Cole todo o conteúdo deste arquivo no editor (substituindo qualquer código existente).
 * 4. Salve o projeto (Ctrl + S ou ícone de disquete).
 * 5. Selecione a função "setupPlanilha" e clique em "Executar" para criar as 5 abas automaticamente.
 * 6. Clique no botão "Implantar" (Deploy) > "Nova implantação" (New deployment).
 * 7. Selecione o tipo: "App da Web" (Web app).
 * 8. Configure:
 *    - Executar como: "Eu" (Me)
 *    - Quem pode acessar: "Qualquer pessoa" (Anyone)
 * 9. Clique em "Implantar" e copie a URL gerada (terminada em /exec).
 * 10. Cole essa URL nas configurações do sistema web (ícone do Google Sheets no cabeçalho).
 */

// Nomes das 7 abas dedicadas
const SHEET_NAMES = {
  AREAS: "Areas",
  BLOCOS: "Blocos",
  CICLOS: "Ciclos_Cultivo",
  TRATOS: "Tratos_Culturais",
  USUARIOS: "Usuarios",
  TAREFAS: "Tarefas",
  ALERTAS: "Alertas"
};

// Cabeçalhos padrão para cada aba
const SCHEMAS = {
  [SHEET_NAMES.AREAS]: ["id_area", "nome", "tipo", "comprimento_m", "largura_m", "largura_corredor_m", "criado_em", "ultima_atualizacao"],
  [SHEET_NAMES.BLOCOS]: ["id_bloco", "id_area", "tipo_bloco", "setor", "pos_x_m", "pos_y_m", "largura_m", "comprimento_m", "qtd_perfis", "total_furos"],
  [SHEET_NAMES.CICLOS]: ["id_ciclo", "id_bloco", "cultura", "variedade", "data_plantio", "data_prevista_colheita", "lote_nutritivo", "status", "fase_atual", "lote_rastreabilidade"],
  [SHEET_NAMES.TRATOS]: ["id_trato", "id_bloco", "id_ciclo", "data_hora", "tipo_manejo", "responsavel", "observacoes"],
  [SHEET_NAMES.USUARIOS]: ["id_usuario", "nome_exibicao", "papel", "dados_codificados", "email_recuperacao", "ultimo_acesso"],
  [SHEET_NAMES.TAREFAS]: ["id_tarefa", "tipo", "titulo", "cultura", "quantidade", "destino", "bancada_sugerida", "prazo_data", "prioridade", "status", "criado_por", "atribuido_para", "executado_por", "data_criacao", "data_conclusao", "id_bloco_executado", "observacoes", "bancada_origem", "lote_rastreabilidade"],
  [SHEET_NAMES.ALERTAS]: ["id_alerta", "categoria", "descricao", "local", "status", "criado_por", "data_criacao", "resolvido_por", "data_resolucao", "observacao_resolucao"]
};

/**
 * Rota HTTP GET: Retorna um payload JSON consolidando os dados das abas
 * Suporta também checagem leve de timestamp: ?check=timestamp
 */
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    garantirEstruturaAbas(ss);

    // Consulta rápida leve de timestamp (polling inteligente por demanda)
    if (e && e.parameter && e.parameter.check === "timestamp") {
      return criarRespostaJSON({
        status: "success",
        timestamp: obterUltimoTimestamp(ss)
      });
    }

    const resultado = {
      areas: lerDadosAba(ss.getSheetByName(SHEET_NAMES.AREAS), SCHEMAS[SHEET_NAMES.AREAS]),
      blocos: lerDadosAba(ss.getSheetByName(SHEET_NAMES.BLOCOS), SCHEMAS[SHEET_NAMES.BLOCOS]),
      ciclos: lerDadosAba(ss.getSheetByName(SHEET_NAMES.CICLOS), SCHEMAS[SHEET_NAMES.CICLOS]),
      tratos: lerDadosAba(ss.getSheetByName(SHEET_NAMES.TRATOS), SCHEMAS[SHEET_NAMES.TRATOS]),
      usuarios: lerDadosAba(ss.getSheetByName(SHEET_NAMES.USUARIOS), SCHEMAS[SHEET_NAMES.USUARIOS]),
      tarefas: lerDadosAba(ss.getSheetByName(SHEET_NAMES.TAREFAS), SCHEMAS[SHEET_NAMES.TAREFAS]),
      alertas: lerDadosAba(ss.getSheetByName(SHEET_NAMES.ALERTAS), SCHEMAS[SHEET_NAMES.ALERTAS])
    };

    return criarRespostaJSON({
      status: "success",
      data: resultado,
      timestamp: obterUltimoTimestamp(ss)
    });
  } catch (erro) {
    return criarRespostaJSON({ status: "error", message: erro.toString() });
  }
}

/**
 * Rota HTTP POST: Recebe ações do frontend e executa as escritas correspondentes
 */
function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    garantirEstruturaAbas(ss);

    let requisicao = {};
    if (e.postData && e.postData.contents) {
      requisicao = JSON.parse(e.postData.contents);
    }

    const acao = requisicao.action;
    const dados = requisicao.data;

    let retorno = { status: "success", action: acao };

    switch (acao) {
      case "salvarLayout":
        salvarLayout(ss, dados);
        break;

      case "registrarTrato":
        registrarTrato(ss, dados);
        break;

      case "iniciarCiclo":
        iniciarCiclo(ss, dados);
        break;

      case "finalizarCiclo":
        finalizarCiclo(ss, dados);
        break;

      case "atualizarCiclo":
        atualizarCiclo(ss, dados);
        break;

      case "salvarUsuarios":
        salvarUsuarios(ss, dados);
        break;

      case "registrarAcesso":
        registrarAcessoUsuario(ss, dados);
        break;

      case "enviarEmailRecuperacao":
        retorno = enviarEmailRecuperacao(ss, dados);
        break;

      case "solicitarSenhaOperador":
        retorno = solicitarSenhaOperador(ss, dados);
        break;

      case "criarTarefa":
        criarTarefaRemota(ss, dados);
        break;

      case "concluirTarefa":
        concluirTarefaRemota(ss, dados);
        break;

      case "cancelarTarefa":
        cancelarTarefaRemota(ss, dados);
        break;

      case "criarAlerta":
        criarAlertaRemoto(ss, dados);
        break;

      case "resolverAlerta":
        resolverAlertaRemoto(ss, dados);
        break;

      default:
        retorno = { status: "error", message: "Ação desconhecida: " + acao };
        break;
    }

    // Atualiza o carimbo de tempo geral a cada gravação
    const novoTs = atualizarUltimoTimestamp(ss);
    retorno.timestamp = novoTs;

    return criarRespostaJSON(retorno);
  } catch (erro) {
    return criarRespostaJSON({ status: "error", message: erro.toString() });
  }
}

/**
 * Salva a área e a lista completa de blocos do croqui
 */
function salvarLayout(ss, dados) {
  if (dados.area) {
    const sheetArea = ss.getSheetByName(SHEET_NAMES.AREAS);
    const cabecalho = SCHEMAS[SHEET_NAMES.AREAS];
    sheetArea.clearContents();
    sheetArea.appendRow(cabecalho);
    sheetArea.getRange(1, 1, 1, cabecalho.length).setFontWeight("bold").setBackground("#e2e8f0");
    const a = dados.area;
    sheetArea.appendRow([a.id_area, a.nome, a.tipo, a.comprimento_m, a.largura_m, a.largura_corredor_m, a.criado_em, new Date().toISOString()]);
  }

  if (dados.blocos && Array.isArray(dados.blocos)) {
    const sheetBlocos = ss.getSheetByName(SHEET_NAMES.BLOCOS);
    const cabecalho = SCHEMAS[SHEET_NAMES.BLOCOS];
    sheetBlocos.clearContents();
    sheetBlocos.appendRow(cabecalho);
    sheetBlocos.getRange(1, 1, 1, cabecalho.length).setFontWeight("bold").setBackground("#e2e8f0");

    const linhas = dados.blocos.map(b => [
      b.id_bloco,
      b.id_area,
      b.tipo_bloco,
      b.setor,
      b.pos_x_m,
      b.pos_y_m,
      b.largura_m,
      b.comprimento_m,
      b.qtd_perfis,
      b.total_furos
    ]);

    if (linhas.length > 0) {
      sheetBlocos.getRange(2, 1, linhas.length, cabecalho.length).setValues(linhas);
    }
  }
}

/**
 * Insere uma nova linha na aba Tratos_Culturais
 */
function registrarTrato(ss, t) {
  const sheet = ss.getSheetByName(SHEET_NAMES.TRATOS);
  sheet.appendRow([
    t.id_trato,
    t.id_bloco,
    t.id_ciclo,
    t.data_hora,
    t.tipo_manejo,
    t.responsavel,
    t.observacoes
  ]);
}

/**
 * Registra um novo ciclo de plantio
 */
function iniciarCiclo(ss, c) {
  const sheet = ss.getSheetByName(SHEET_NAMES.CICLOS);
  sheet.appendRow([
    c.id_ciclo,
    c.id_bloco,
    c.cultura,
    c.variedade || "",
    c.data_plantio,
    c.data_prevista_colheita,
    c.lote_nutritivo || "",
    c.status || "ativo",
    c.fase_atual || "crescimento",
    c.lote_rastreabilidade || ""
  ]);
}

/**
 * Atualiza o status de um ciclo para finalizado
 */
function finalizarCiclo(ss, dados) {
  const sheet = ss.getSheetByName(SHEET_NAMES.CICLOS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === dados.id_ciclo || (data[i][1] === dados.id_bloco && data[i][7] === "ativo")) {
      sheet.getRange(i + 1, 8).setValue("finalizado");
      break;
    }
  }
}

/**
 * Atualiza os dados de um ciclo existente na aba Ciclos_Cultivo
 */
function atualizarCiclo(ss, c) {
  const sheet = ss.getSheetByName(SHEET_NAMES.CICLOS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === c.id_ciclo || (data[i][1] === c.id_bloco && data[i][7] === "ativo")) {
      sheet.getRange(i + 1, 1, 1, 8).setValues([[
        c.id_ciclo,
        c.id_bloco,
        c.cultura,
        c.variedade || "",
        c.data_plantio,
        c.data_prevista_colheita,
        c.lote_nutritivo || "",
        c.status || "ativo"
      ]]);
      break;
    }
  }
}

/**
 * Salva a lista de usuários com senhas e dados codificados com a chave do Gestor
 */
function salvarUsuarios(ss, listaUsuarios) {
  if (!Array.isArray(listaUsuarios)) return;
  const sheet = ss.getSheetByName(SHEET_NAMES.USUARIOS);
  const cabecalho = SCHEMAS[SHEET_NAMES.USUARIOS];
  sheet.clearContents();
  sheet.appendRow(cabecalho);
  sheet.getRange(1, 1, 1, cabecalho.length).setFontWeight("bold").setBackground("#e2e8f0");

  const linhas = listaUsuarios.map(u => [
    u.id_usuario,
    u.nome_exibicao || "",
    u.papel || "operador",
    u.dados_codificados || "",
    u.email_recuperacao || "",
    u.ultimo_acesso || new Date().toISOString()
  ]);

  if (linhas.length > 0) {
    sheet.getRange(2, 1, linhas.length, cabecalho.length).setValues(linhas);
  }
}

/**
 * Registra o timestamp do último acesso do usuário
 */
function registrarAcessoUsuario(ss, dados) {
  const sheet = ss.getSheetByName(SHEET_NAMES.USUARIOS);
  const data = sheet.getDataRange().getValues();
  const idUser = dados.id_usuario;
  const agoraStr = new Date().toISOString();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === idUser) {
      sheet.getRange(i + 1, 6).setValue(agoraStr);
      break;
    }
  }
}

/**
 * Retorna o timestamp numérico da última alteração
 */
function obterUltimoTimestamp(ss) {
  try {
    const prop = PropertiesService.getScriptProperties().getProperty("LAST_UPDATE");
    if (prop) return parseInt(prop, 10);
  } catch (e) {}
  return Date.now();
}

/**
 * Atualiza o timestamp da última alteração no script e na aba Areas
 */
function atualizarUltimoTimestamp(ss) {
  const ts = Date.now();
  try {
    PropertiesService.getScriptProperties().setProperty("LAST_UPDATE", String(ts));
    const sheetArea = ss.getSheetByName(SHEET_NAMES.AREAS);
    if (sheetArea && sheetArea.getLastRow() >= 2) {
      sheetArea.getRange(2, 8).setValue(new Date(ts).toISOString());
    }
  } catch (e) {}
  return ts;
}

/**
 * Função utilitária para inicializar a planilha manualmente
 * Pode ser executada diretamente no editor do Apps Script (botão Executar)
 */
function setupPlanilha() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  garantirEstruturaAbas(ss);
  
  // Remove aba padrão inicial 'Página1' ou 'Sheet1' se vazia
  ["Página1", "Sheet1"].forEach(nomePadrao => {
    const s = ss.getSheetByName(nomePadrao);
    if (s && s.getLastRow() === 0 && ss.getSheets().length > 1) {
      try { ss.deleteSheet(s); } catch (e) {}
    }
  });

  Logger.log("✅ Planilha configurada com sucesso com as 5 abas padrão (incluindo Usuarios)!");
}

/**
 * Lê uma aba e converte para array de objetos conforme o cabeçalho
 */
function lerDadosAba(sheet, colunasEsperadas) {
  const range = sheet.getDataRange();
  const valores = range.getValues();
  if (valores.length <= 1) return [];

  const cabecalho = valores[0];
  const resultado = [];

  for (let i = 1; i < valores.length; i++) {
    const linha = valores[i];
    const obj = {};
    cabecalho.forEach((col, idx) => {
      obj[col] = linha[idx];
    });
    resultado.push(obj);
  }

  return resultado;
}

/**
 * Cria as 5 abas e adiciona seus cabeçalhos se ainda não existirem
 */
function garantirEstruturaAbas(ss) {
  Object.keys(SCHEMAS).forEach(nomeAba => {
    let sheet = ss.getSheetByName(nomeAba);
    if (!sheet) {
      sheet = ss.insertSheet(nomeAba);
      sheet.appendRow(SCHEMAS[nomeAba]);
      sheet.getRange(1, 1, 1, SCHEMAS[nomeAba].length).setFontWeight("bold").setBackground("#e2e8f0");
    }
  });
}

/**
 * Formata e retorna resposta JSON
 */
function criarRespostaJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Envia e-mail de recuperação de senha para o Gestor usando o serviço nativo do Google (MailApp)
 */
function enviarEmailRecuperacao(ss, dados) {
  if (!dados || !dados.email) {
    return { status: "error", message: "E-mail de destino não fornecido." };
  }
  try {
    MailApp.sendEmail({
      to: dados.email,
      subject: "🔒 HidroManager - Recuperação de Senha do Gestor",
      htmlBody: '<div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b; max-width: 520px; border: 1px solid #e2e8f0; border-radius: 8px;">' +
        '<h2 style="color: #059669; margin-top: 0;">🌱 HidroManager - Gestão Hidropônica</h2>' +
        '<p>Olá, <strong>Gestor</strong>!</p>' +
        '<p>Você solicitou a recuperação dos seus dados de acesso ao sistema.</p>' +
        '<div style="background: #f1f5f9; padding: 15px; border-radius: 8px; margin: 15px 0;">' +
        '<p style="margin: 6px 0;"><strong>Sua Senha de Gestor:</strong> <span style="font-size: 1.15rem; color: #059669; font-weight: bold;">' + (dados.senha || "admin123") + '</span></p>' +
        (dados.chave ? '<p style="margin: 6px 0;"><strong>Código Secreto de Criptografia:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-weight: bold;">' + dados.chave + '</code></p>' : '') +
        '</div>' +
        '<p style="font-size: 0.85rem; color: #64748b;">Acesse o sistema e efetue o login. Por segurança, você pode alterar sua senha a qualquer momento nas configurações do painel do Gestor.</p>' +
        '</div>'
    });
    return { status: "success", message: "E-mail de recuperação enviado para " + dados.email };
  } catch (erro) {
    return { status: "error", message: "Erro ao enviar e-mail pelo Google: " + erro.toString() };
  }
}

/**
 * Envia notificação ao Gestor avisando que um Operador solicitou redefinição ou envio de senha
 */
function solicitarSenhaOperador(ss, dados) {
  if (!dados || !dados.email_gestor) {
    return { status: "error", message: "E-mail do Gestor não localizado para envio." };
  }
  try {
    MailApp.sendEmail({
      to: dados.email_gestor,
      subject: "👨‍🌾 HidroManager - Solicitação de Acesso: Operador " + (dados.nome_operador || "Equipe"),
      htmlBody: '<div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b; max-width: 520px; border: 1px solid #e2e8f0; border-radius: 8px;">' +
        '<h2 style="color: #059669; margin-top: 0;">🌱 HidroManager - Gestão Hidropônica</h2>' +
        '<p>Olá, <strong>Gestor</strong>!</p>' +
        '<p>O operador <strong>' + (dados.nome_operador || "da equipe") + '</strong> informou que esqueceu a senha ou precisa de cadastro de acesso ao sistema.</p>' +
        '<div style="background: #f1f5f9; padding: 15px; border-radius: 8px; margin: 15px 0;">' +
        '<p style="margin: 4px 0;"><strong>Operador solicitante:</strong> <span style="font-weight: bold; color: #2563eb;">' + (dados.nome_operador || "-") + '</span></p>' +
        '<p style="margin: 4px 0;"><strong>Data da solicitação:</strong> ' + new Date().toLocaleString("pt-BR") + '</p>' +
        '</div>' +
        '<p style="font-size: 0.85rem; color: #64748b;">Acesse o <strong>Painel do Gestor ➔ Usuários</strong> no sistema para consultar a senha deste operador ou definir uma nova senha para ele.</p>' +
        '</div>'
    });
    return { status: "success", message: "Notificação enviada com sucesso para o e-mail do Gestor (" + dados.email_gestor + ")!" };
  } catch (erro) {
    return { status: "error", message: "Erro ao enviar e-mail: " + erro.toString() };
  }
}

/**
 * Insere uma nova tarefa na aba Tarefas
 */
function criarTarefaRemota(ss, t) {
  const sheet = ss.getSheetByName(SHEET_NAMES.TAREFAS);
  sheet.appendRow([
    t.id_tarefa,
    t.tipo || "geral",
    t.titulo || "",
    t.cultura || "",
    t.quantidade || 0,
    t.destino || "",
    t.bancada_sugerida || "",
    t.prazo_data || "",
    t.prioridade || "normal",
    t.status || "pendente",
    t.criado_por || "",
    t.atribuido_para || "",
    t.executado_por || "",
    t.data_criacao || new Date().toISOString(),
    t.data_conclusao || "",
    t.id_bloco_executado || "",
    t.observacoes || "",
    t.bancada_origem || "",
    t.lote_rastreabilidade || ""
  ]);
}

/**
 * Atualiza o status de uma tarefa para concluída
 */
function concluirTarefaRemota(ss, t) {
  const sheet = ss.getSheetByName(SHEET_NAMES.TAREFAS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === t.id_tarefa) {
      sheet.getRange(i + 1, 10).setValue("concluida"); // status
      sheet.getRange(i + 1, 13).setValue(t.executado_por || ""); // executado_por
      sheet.getRange(i + 1, 15).setValue(t.data_conclusao || new Date().toISOString()); // data_conclusao
      if (t.id_bloco_executado) {
        sheet.getRange(i + 1, 16).setValue(t.id_bloco_executado);
      }
      break;
    }
  }
}

/**
 * Atualiza o status de uma tarefa para cancelada
 */
function cancelarTarefaRemota(ss, t) {
  const sheet = ss.getSheetByName(SHEET_NAMES.TAREFAS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === t.id_tarefa) {
      sheet.getRange(i + 1, 10).setValue("cancelada");
      sheet.getRange(i + 1, 15).setValue(t.data_conclusao || new Date().toISOString());
      break;
    }
  }
}

/**
 * Insere um novo alerta na aba Alertas
 */
function criarAlertaRemoto(ss, a) {
  const sheet = ss.getSheetByName(SHEET_NAMES.ALERTAS);
  sheet.appendRow([
    a.id_alerta,
    a.categoria || "outro",
    a.descricao || "",
    a.local || "",
    a.status || "aberto",
    a.criado_por || "",
    a.data_criacao || new Date().toISOString(),
    a.resolvido_por || "",
    a.data_resolucao || "",
    a.observacao_resolucao || ""
  ]);
}

/**
 * Atualiza o status de um alerta para resolvido
 */
function resolverAlertaRemoto(ss, a) {
  const sheet = ss.getSheetByName(SHEET_NAMES.ALERTAS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === a.id_alerta) {
      sheet.getRange(i + 1, 5).setValue("resolvido");
      sheet.getRange(i + 1, 8).setValue(a.resolvido_por || "");
      sheet.getRange(i + 1, 9).setValue(a.data_resolucao || new Date().toISOString());
      sheet.getRange(i + 1, 10).setValue(a.observacao_resolucao || "");
      break;
    }
  }
}

