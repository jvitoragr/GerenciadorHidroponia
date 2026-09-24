## Especificação Técnica e Roteiro de Desenvolvimento: Sistema Web de Gestão Hidropônica

Este documento serve como manual de requisitos e arquitetura técnica para orientar a implementação do sistema web, estruturado em arquivos locais (`index.html`, `style.css`, `app.js`) com integração assíncrona ao Google Sheets.

---

### 1. Arquitetura Técnica e Modelo de Dados

#### Estrutura de Arquivos Local

* `index.html`: Casca semântica com contêineres para toolbar superior, canvas de desenho e modais/painéis laterais.
* `style.css`: Estilização responsiva (mobile-first), temas visuais para os status dos blocos e modais de formulário.
* `app.js`: Lógica do estado global da aplicação, renderização no Canvas, controle de eventos (mouse/touch) e chamadas assíncronas via `fetch()`.

#### Estrutura do Banco de Dados (Google Sheets)

A planilha conterá 4 abas dedicadas para separação de responsabilidades:

1. **`Areas`**
* Colunas: `id_area`, `nome`, `tipo` (hidroponia/solo), `comprimento_m`, `largura_m`, `largura_corredor_m`, `criado_em`.


2. **`Blocos`**
* Colunas: `id_bloco`, `id_area`, `tipo_bloco` (definitivo/maternidade), `setor` (esquerdo/direito), `pos_x_m`, `pos_y_m`, `largura_m`, `comprimento_m`, `qtd_perfis`, `total_furos`.


3. **`Ciclos_Cultivo`**
* Colunas: `id_ciclo`, `id_bloco`, `cultura`, `variedade`, `data_plantio`, `data_prevista_colheita`, `lote_nutritivo`, `status` (ativo/finalizado).


4. **`Tratos_Culturais`**
* Colunas: `id_trato`, `id_bloco`, `id_ciclo`, `data_hora`, `tipo_manejo` (pulverização, ajuste de condutividade/pH, limpeza de bancada), `responsavel`, `observacoes`.



---

### 2. Módulo 1: Croqui Interativo e Cadastro Estrutural

#### Etapa 1: Definição do Perímetro e Corredor Central

* **Sistema de Coordenadas e Escala:**
* O canvas deve trabalhar com uma conversão explícita de metros para pixels:

$$\text{pixels} = \text{metros} \times \text{fator\_escala}$$


* Permitir preenchimento inicial via formulário: comprimento total ($C$), largura total ($L$) e largura do corredor central.
* O sistema desenha automaticamente o contorno retangular e as guias pontilhadas do corredor de serviço ao centro (eixo divisor).



#### Etapa 2: Instalação e Posicionamento dos Blocos

* **Templates de Blocos:**
* **Bloco Definitivo Padrão:** Pré-configurado com 10 perfis paralelos e dimensões padrão (ex.: $1{,}5\text{ m} \times 12{,}0\text{ m}$).
* **Bloco Maternidade:** Perfis com menor espaçamento entre centros para alta densidade de mudas.


* **Ferramenta de Inserção:**
* Modo de clique ou seleção: o usuário seleciona o template e clica na área útil (esquerda ou direita do corredor).
* Snap-to-grid (encaixe magnético): o bloco deve se alinhar automaticamente com o bloco vizinho anterior respeitando espaçamento mínimo predefinido (ex.: $0{,}8\text{ m}$ para circulação).


* **Mecanismo de Espelhamento:**
* Botão de replicação rápida que pega a disposição dos blocos da bancada esquerda e replica com coordenadas invertidas no lado direito do corredor central.



#### Controles de Interação no Canvas (Zoom & Pan)

* **Desktop:** Scroll do mouse para zoom in/out; clique com botão do meio ou `Espaço + Botão esquerdo` para arrastar.
* **Mobile:** Eventos de toque `touchstart`, `touchmove` e `touchend`:
* Um dedo: arrastar a visualização (pan).
* Dois dedos (pinch-to-zoom): cálculo da distância euclidiana entre os dois toques para escalonar dinamicamente o canvas.


* As coordenadas de clique na tela devem ser transformadas para as coordenadas lógicas do canvas considerando o deslocamento (`offset`) e a escala atual:

$$X_{\text{mundo}} = \frac{X_{\text{tela}} - \text{offset}_X}{\text{zoom}}$$


$$Y_{\text{mundo}} = \frac{Y_{\text{tela}} - \text{offset}_Y}{\text{zoom}}$$



---

### 3. Módulo 2: Manejo, Monitoramento e Gestão

#### Visualização de Status e Barras de Progresso

* Cada bloco desenhado no Canvas exibe uma barra de progresso visual no topo ou em sua área gráfica:

$$\text{Progresso (\%)} = \min\left(100, \max\left(0, \frac{\text{Data Atual} - \text{Data Plantio}}{\text{Data Colheita} - \text{Data Plantio}} \times 100\right)\right)$$


* **Legenda Cromática Dinâmica:**
* **Verde Claro (0% a 30%):** Fase inicial / Pegamento das mudas.
* **Verde Escuro (31% a 80%):** Desenvolvimento vegetativo pleno.
* **Laranja/Vermelho (81% a 100%+):** Ponto de colheita ou colheita atrasada.
* **Cinza:** Bloco desocupado / Em higienização.



#### Janela Rápida de Interação (Modal Mobile)

* Ao clicar/tocar em um bloco:
* Abre um painel inferior (*bottom sheet* no mobile) com:
* Nome do Bloco e Variedade plantada.
* Dias decorridos desde o plantio / Dias restantes para colheita.
* Botão "Novo Trato Cultural".
* Botão "Finalizar Ciclo / Liberar Bloco".




* **Formulário de Trato Cultural:**
* Seleção direta: Limpeza de canaleta, Adição de nutrientes, Correção de pH, Controle sanitário, Manutenção hidráulica.
* Campo de texto para detalhes.
* Botão de envio rápido com *feedback* de confirmação.



#### Sistema de Filtros

* Barra de controle suspensa que altera a renderização dos blocos:
* **Filtro por Cultura:** Destaca apenas blocos contendo determinada variedade (ex.: Alface Crespa, Rúcula) e diminui a opacidade dos demais para 20%.
* **Filtro por Faixa de Idade:** Oculta ou esmaece blocos fora do intervalo selecionado.
* **Filtro por Setor:** Foca a câmera no Setor Esquerdo ou Direito.



---

### 4. Integração Frontend com Google Apps Script

#### Configuração do Endpoint (Google Apps Script)

* Criar um projeto de Apps Script vinculado à planilha Google.
* Publicar como **Web App** com permissão de acesso: *"Qualquer pessoa"* (Anyone).
* Implementar duas rotas principais via protocolo HTTP:

1. **`doGet(e)` (Leitura):**
* Retorna um payload JSON com as 4 abas consolidadas:


```json
{
  "areas": [...],
  "blocos": [...],
  "ciclos": [...],
  "tratos": [...]
}

```


2. **`doPost(e)` (Escrita):**
* Recebe requisições com a ação desejada no corpo (`action`):
* `salvarLayout`: Sobrescreve/atualiza coordenadas dos blocos na aba `Blocos`.
* `registrarTrato`: Insere uma nova linha na aba `Tratos_Culturais`.
* `iniciarCiclo`: Registra um novo cultivo em `Ciclos_Cultivo`.





#### Padrão de Comunicação no `app.js`

* Utilização de `fetch` assíncrono com cabeçalho `application/json`:

```javascript
async function registrarAcao(acao, payload) {
  const SCRIPT_URL = "SUA_URL_DO_APPS_SCRIPT_AQUI";
  try {
    const resposta = await fetch(SCRIPT_URL, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // Evita preflight CORS no Apps Script
      body: JSON.stringify({ action: acao, data: payload })
    });
    return await resposta.json();
  } catch (erro) {
    console.error("Falha na sincronização:", erro);
  }
}

```

---

### 5. Roteiro Passo a Passo de Implementação Local

1. **Passo 1 (Canvas Base):** Criar `index.html` e implementar no `app.js` a renderização estática do retângulo da área total e da linha central baseado em variáveis manuais.
2. **Passo 2 (Navegação):** Implementar o laço de renderização (`requestAnimationFrame`) acoplado aos ouvintes de evento de zoom (roda do mouse/pinch) e pan (arraste).
3. **Passo 3 (Adição de Blocos):** Desenvolver a lógica que desenha retângulos internos (blocos) em posições relativas fixas a partir de uma lista local de objetos JavaScript.
4. **Passo 4 (Interatividade do Bloco):** Adicionar detecção de clique/colisão (verificar se a coordenada do ponteiro está dentro das bordas de algum bloco) e abrir modal informativo.
5. **Passo 5 (Persistência no Sheets):** Configurar o Google Apps Script, implantar a API e substituir a lista local de objetos pelo `fetch()` no carregamento e no salvamento do layout.
6. **Passo 6 (Módulo de Tratos e Filtros):** Implementar os formulários de registro de campo e as funções de alternância de cores da legenda cromática.
