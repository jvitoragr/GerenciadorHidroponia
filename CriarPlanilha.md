# 📊 Guia Completo: Criação da Planilha Google & Configuração do Apps Script
## Sistema de Gestão Hidropônica (HidroManager)

Este tutorial orienta, passo a passo, como criar e configurar a planilha no **Google Sheets** com o **Google Apps Script** para funcionar como banco de dados em nuvem do **HidroManager**, com controle de acesso para **Gestor** e **Operadores**, criptografia de credenciais e sincronização inteligente.

---

### 🌐 Como Funciona a Integração

* **Armazenamento Híbrido**: O HidroManager opera perfeitamente mesmo **sem internet** (armazenando os dados localmente no navegador via `LocalStorage`).
* **Segurança e Criptografia**: As senhas e dados dos operadores são criptografados com uma **chave secreta do Gestor** antes de irem para a planilha, ficando ilegíveis para quem acessar o Google Sheets diretamente.
* **Sincronização Sob Demanda**: Utiliza um carimbo de data/hora (*timestamp*) inteligente para verificar modificações sem consumir desnecessariamente as cotas da sua conta Google.

```
┌─────────────────────────────────┐           HTTP POST/GET           ┌───────────────────────────────┐
│     HidroManager (Web App)      │  ───────────────────────────────► │   Google Apps Script (Web)    │
│  (Navegador Local ou Hospedado) │  ◄─────────────────────────────── │ (Backend Serverless /exec)    │
└─────────────────────────────────┘           Retorno JSON            └───────────────┬───────────────┘
                                                                                      │ Grava/Lê
                                                                                      ▼
                                                                      ┌───────────────────────────────┐
                                                                      │   Planilha Google (Sheets)    │
                                                                      │ 5 Abas: Areas, Blocos,        │
                                                                      │ Ciclos_Cultivo, Tratos,       │
                                                                      │ Usuarios (Criptografada)      │
                                                                      └───────────────────────────────┘
```

---

## 🚀 Passo a Passo de Configuração

### Passo 1: Criar uma Nova Planilha no Google Sheets

1. Acesse o Google Drive ou abra diretamente no navegador: **[https://sheets.new](https://sheets.new)**.
2. Dê um nome para a planilha no canto superior esquerdo (exemplo: `HidroManager - Dados de Cultivo`).
3. Não precisa criar as abas manualmente: **o script possui um instalador automático que criará todas as 5 abas e cabeçalhos formatados para você!**

---

### Passo 2: Acessar o Editor do Apps Script

1. No menu superior da planilha recém-criada, clique em:
   **Extensões** > **Apps Script**
2. Uma nova aba do navegador será aberta com o editor de código do Google Apps Script.
3. No canto superior esquerdo do editor, clique sobre **"Projeto sem título"** e renomeie para `HidroManager-Backend`.

---

### Passo 3: Inserir o Código do Script

1. No editor, você verá um arquivo chamado `Código.gs` contendo:
   ```javascript
   function myFunction() {
   }
   ```
2. **Apague todo esse conteúdo** existente no editor.
3. **Copie e cole todo o código abaixo** dentro do editor:

```javascript
/**
 * GOOGLE APPS SCRIPT: BACKEND PARA SISTEMA WEB DE GESTÃO HIDROPÔNICA
 * Integração REST Serverless com o HidroManager
 */

// Nomes das 5 abas dedicadas
const SHEET_NAMES = {
  AREAS: "Areas",
  BLOCOS: "Blocos",
  CICLOS: "Ciclos_Cultivo",
  TRATOS: "Tratos_Culturais",
  USUARIOS: "Usuarios"
};

// Cabeçalhos padrão para cada aba
const SCHEMAS = {
  [SHEET_NAMES.AREAS]: ["id_area", "nome", "tipo", "comprimento_m", "largura_m", "largura_corredor_m", "criado_em", "ultima_atualizacao"],
  [SHEET_NAMES.BLOCOS]: ["id_bloco", "id_area", "tipo_bloco", "setor", "pos_x_m", "pos_y_m", "largura_m", "comprimento_m", "qtd_perfis", "total_furos"],
  [SHEET_NAMES.CICLOS]: ["id_ciclo", "id_bloco", "cultura", "variedade", "data_plantio", "data_prevista_colheita", "lote_nutritivo", "status"],
  [SHEET_NAMES.TRATOS]: ["id_trato", "id_bloco", "id_ciclo", "data_hora", "tipo_manejo", "responsavel", "observacoes"],
  [SHEET_NAMES.USUARIOS]: ["id_usuario", "nome_exibicao", "papel", "dados_codificados", "email_recuperacao", "ultimo_acesso"]
};

/**
 * Rota HTTP GET: Retorna payload JSON consolidando os dados das abas
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
      usuarios: lerDadosAba(ss.getSheetByName(SHEET_NAMES.USUARIOS), SCHEMAS[SHEET_NAMES.USUARIOS])
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
    c.status || "ativo"
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
 * Formata e retorna resposta HTTP JSON
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
```

4. Pressione **Ctrl + S** (ou clique no ícone de disquete 💾) para salvar o projeto.

---

### Passo 4: Executar a Instalação Inicial (Criar as 5 Abas com 1 Clique)

1. Na barra de ferramentas do Apps Script, selecione no menu suspenso de funções a função **`setupPlanilha`**.
2. Clique no botão **▶ Executar** (Run).
3. O Google exibirá a janela **"Autorização necessária"**:
   - Clique em **Revisar permissões**.
   - Escolha a sua conta Google.
   - Aparecerá a mensagem *"O Google não verificou este app"*. Clique no link menor **"Avançado"** (Advanced) no canto inferior esquerdo.
   - Clique em **"Acessar HidroManager-Backend (não seguro)"**.
   - Na tela seguinte, clique em **Permitir**.
4. No log de execução aparecerá:  
   `✅ Planilha configurada com sucesso com as 5 abas padrão (incluindo Usuarios)!`
5. Volte para a aba da planilha no navegador e note que foram criadas as 5 abas:
   - 📑 **`Areas`**
   - 📑 **`Blocos`**
   - 📑 **`Ciclos_Cultivo`**
   - 📑 **`Tratos_Culturais`**
   - 📑 **`Usuarios`**

---

### Passo 5: Implantar como Aplicativo da Web (Deploy do Web App)

1. No canto superior direito do editor do Apps Script, clique no botão azul **Implantar** (Deploy) > **Nova implantação** (New deployment).
2. Na janela que abrir, clique no ícone de **engrenagem ⚙️** (ao lado de "Selecionar tipo") e escolha **App da Web** (Web app).
3. Preencha as opções exatamente assim:
   - **Descrição**: `Produção v1.0 com Usuários`
   - **Executar como**: **Eu (seu-email@gmail.com)**
   - **Quem pode acessar**: **Qualquer pessoa** *(Anyone)*  
     *(Importante: "Qualquer pessoa" permite que o aplicativo web local envie dados sem travar com telas de login do Google).*
4. Clique no botão **Implantar**.
5. Uma janela exibirá a URL do App da Web (terminada em `/exec`). Clique em **Copiar**.

> [!IMPORTANT]
> A URL deve terminar obrigatoriamente com **/exec**. Nunca copie a URL que termina em `/edit` ou `/dev`.

---

### Passo 6: Conectar no HidroManager

1. Abra o **HidroManager** no navegador (arquivo `index.html`).
2. No menu superior ou através do menu **Salvar & Backup** (ou ícone do Sheets na barra), clique em **Configurar Google Sheets**.
3. No campo **URL do Web App (Google Apps Script)**, cole a URL copiada no Passo 5.
4. Clique em **Salvar Conexão** e depois em **Sincronizar Agora**.
5. O status ficará verde com **"Sheets Conectado"**.

---

## 📋 Dicionário de Dados das Abas

### 1. Aba `Areas` (Configuração Geral da Estufa & Sincronização)
| Coluna | Tipo | Descrição | Exemplo |
| :--- | :--- | :--- | :--- |
| `id_area` | Texto | Identificador da estufa | `AREA-01` |
| `nome` | Texto | Nome de exibição | `Estufa Principal NFT 01` |
| `tipo` | Texto | Tipo de cultivo | `hidroponia` |
| `comprimento_m` | Número | Comprimento da estufa em metros | `30` |
| `largura_m` | Número | Largura total em metros | `16` |
| `largura_corredor_m` | Número | Largura do corredor central em metros | `2.0` |
| `criado_em` | Data/Hora | Timestamp de criação | `2026-09-24T12:00:00.000Z` |
| `ultima_atualizacao`| Data/Hora | Timestamp de qualquer alteração na estufa | `2026-09-24T14:15:30.000Z` |

---

### 2. Aba `Blocos` (Bancadas Hidropônicas)
| Coluna | Tipo | Descrição | Exemplo |
| :--- | :--- | :--- | :--- |
| `id_bloco` | Texto | Nome ou ID da bancada | `BE-01`, `BD-02` |
| `id_area` | Texto | ID da estufa associada | `AREA-01` |
| `tipo_bloco` | Texto | Categoria da bancada | `definitivo`, `maternidade`, `bercario` |
| `setor` | Texto | Lado da estufa | `esquerdo`, `direito` |
| `pos_x_m` | Número | Posição horizontal no croqui (m) | `0.5` |
| `pos_y_m` | Número | Posição vertical no croqui (m) | `1.5` |
| `largura_m` | Número | Largura da bancada (m) | `1.5` |
| `comprimento_m` | Número | Comprimento dos perfis (m) | `6.0` |
| `qtd_perfis` | Número | Quantidade de canais hidropônicos | `8` |
| `total_furos` | Número | Capacidade máxima de plantas | `192` |

---

### 3. Aba `Ciclos_Cultivo` (Plantios e Colheitas)
| Coluna | Tipo | Descrição | Exemplo |
| :--- | :--- | :--- | :--- |
| `id_ciclo` | Texto | Identificador único do lote | `CICLO-101` |
| `id_bloco` | Texto | Bancada em que foi plantado | `BE-01` |
| `cultura` | Texto | Nome da cultura agrícola | `Alface Crespa` |
| `variedade` | Texto | Variedade ou cultivar | `Grand Rapids` |
| `data_plantio` | Data | Data em que as mudas entraram | `2026-09-01` |
| `data_prevista_colheita` | Data | Data estimada de colheita | `2026-10-01` |
| `lote_nutritivo` | Texto | Fórmula/EC da solução nutritiva | `Lote N-08 (EC 1.6 mS)` |
| `status` | Texto | Situação do ciclo | `ativo` ou `finalizado` |

---

### 4. Aba `Tratos_Culturais` (Manejos, Medições e Colheitas)
| Coluna | Tipo | Descrição | Exemplo |
| :--- | :--- | :--- | :--- |
| `id_trato` | Texto | Identificador único do manejo | `TRATO-1` |
| `id_bloco` | Texto | Bancada atendida | `BE-01` |
| `id_ciclo` | Texto | Lote associado | `CICLO-101` |
| `data_hora` | Data/Hora | Data e hora do registro | `2026-09-24 08:30` |
| `tipo_manejo` | Texto | Categoria do manejo ou colheita | `Correção de pH`, `🌾 Colheita: 50 plantas` |
| `responsavel` | Texto | Nome do operador ou gestor que executou | `Carlos Silva` |
| `observacoes` | Texto | Detalhes técnicos, destino ou insumos | `pH ajustado para 5.8 com ácido fosfórico` |

---

### 5. Aba `Usuarios` (Controle de Acesso & Criptografia)
| Coluna | Tipo | Descrição | Exemplo |
| :--- | :--- | :--- | :--- |
| `id_usuario` | Texto | ID único do usuário | `GESTOR`, `OP-1727195000` |
| `nome_exibicao` | Texto | Nome visual do colaborador | `Carlos Silva`, `Mariana (Gestora)` |
| `papel` | Texto | Nível de acesso | `gestor` ou `operador` |
| `dados_codificados` | Texto Cifrado | Senha e credenciais criptografadas com a chave do Gestor | `WzI1LDEwLDEzMiwyOS...` |
| `email_recuperacao` | Texto | E-mail do Gestor para recuperação | `gestor@hidroponia.com` |
| `ultimo_acesso` | Data/Hora | Timestamp da última ação realizada pelo usuário | `2026-09-24T14:10:00.000Z` |

> [!NOTE]
> A coluna **`dados_codificados`** garante que ninguém que tenha acesso direto à planilha do Google consiga ler as senhas dos operadores ou do gestor. Os dados são decifrados unicamente no navegador HidroManager através do **Código Secreto de Criptografia** que o Gestor definiu.
