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

1. No editor, você verá um arquivo chamado `Código.gs`, que devera ter o conteúdo do arquivo https://github.com/jvitoragr/GerenciadorHidroponia/blob/main/Code.gs
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
