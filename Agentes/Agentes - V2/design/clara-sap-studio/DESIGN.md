---
name: CLARA · SAP Analytics Studio
description: Ambiente analítico empresarial com identidade CLARA e inspiração SAP Analytics Cloud/Fiori.
colors:
  navy: "#142c47"
  ink: "#20334a"
  muted: "#607086"
  blue: "#1268c4"
  blue-hover: "#0755aa"
  blue-soft: "#eaf2fc"
  canvas: "#f5f7fa"
  surface: "#fff"
  line: "#e0e6ee"
  success: "#217453"
  danger: "#b13f34"
  warning: "#8a5800"
  field-border: "#c7d1de"
  chart-actual: "#1672d9"
  chart-budget: "#b8c9de"
  chart-budget-line: "#8c9fb7"
  chart-projection: "#167d7d"
  chart-over-budget: "#bd4b38"
typography:
  headline:
    fontFamily: "Figtree, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Figtree, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Figtree, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Figtree, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.5
  conversation:
    fontFamily: "Figtree, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.75
  metric:
    fontFamily: "Figtree, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.035em"
  wordmark:
    fontFamily: "Figtree, sans-serif"
    fontSize: "25px"
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "0.015em"
rounded:
  miniature: "3px"
  badge: "4px"
  control: "5px"
  navigation: "6px"
  compact-container: "7px"
  surface: "8px"
  dialog: "12px"
spacing:
  gap-xs: "4px"
  gap-sm: "8px"
  gap-control: "10px"
  inset-sm: "12px"
  gap-grid: "16px"
  gap-card: "18px"
  inset-panel: "20px"
  inset-dialog: "24px"
  inset-main: "28px"
  inset-feature: "32px"
components:
  button-primary:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "7px 12px"
  button-primary-hover:
    backgroundColor: "{colors.blue-hover}"
    textColor: "{colors.surface}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "7px 12px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "7px 8px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "38px"
  navigation-active:
    backgroundColor: "{colors.blue-soft}"
    textColor: "#105caa"
    rounded: "{rounded.navigation}"
    padding: "9px 12px"
  badge:
    backgroundColor: "#f0f3f7"
    textColor: "#53647a"
    rounded: "{rounded.badge}"
    padding: "3px 7px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
  metric-strip:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.surface}"
    padding: "19px 0"
  composer:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
---

# Design System: CLARA · SAP Analytics Studio

## Overview

**Creative North Star: "SAP Analytics Cloud/Fiori com identidade CLARA"**

A direção escolhida pelo usuário combina a organização de um ambiente analítico empresarial SAP com a marca CLARA e Figtree. O cabeçalho navy ancora o ambiente; superfícies frias e claras sustentam filtros, indicadores, gráficos e tabelas. A densidade é profissional, com hierarquia compacta e números destacados. O nome acima registra a referência escolhida, sem inventar um conceito de marca aprovado.

O caminho foi code-led: não houve concept seed nem composição em imagem aprovada. Este documento registra o que está implementado em `styles.css` e nos componentes React do protótipo. A referência BTG da aplicação principal não define esta direção. A extração não substitui o veredito final de revisão, ainda pendente no momento do registro.

**Key Characteristics:**
- Cabeçalho navy e superfícies frias de baixo relevo.
- Figtree em toda a interface, com números tabulares nas métricas e tabelas.
- Azul para ação, seleção e realizado; orçamento em azul acinzentado.
- Conteúdo analítico central e painel contextual à direita.
- Bordas discretas e raios compactos; sombras concentradas em sobreposições.

## Colors

A paleta mantém uma base azul fria, com sinais semânticos verdes, vermelhos e âmbar.

As rampas tonais do sidecar são amostras geradas em OKLCH para o painel de documentação; não são tokens implementados nem substituem as cores normativas deste frontmatter.

### Primary

`blue` é o azul de ação: botões primários, links, foco e controles do assistente. `blue-hover` aprofunda a ação no hover; `blue-soft` marca seleção e apoio contextual. `navy` ancora o cabeçalho e as notificações transitórias.

### Secondary

`chart-actual` identifica realizado; `chart-budget` identifica orçamento nas barras e `chart-budget-line` nas linhas tracejadas. `chart-projection` distingue projeção ilustrativa. `success`, `danger` e `warning` expressam saldo favorável, ultrapassagem e atenção; `chart-over-budget` é a cor observada para desvios nos gráficos. A biblioteca de gráficos também usa variações tonais específicas nas fatias da rosca, sem criar outra marca.

### Neutral

`canvas` é o fundo de trabalho. `surface` suporta navegação, cartões, tabelas e chat. `ink` é o texto principal; `muted` é o texto de apoio. `line` separa superfícies e linhas; `field-border` delimita campos editáveis.

**The Evidence Rule.** Preserve os rótulos de realizado, orçamento, projeção e simulação junto às cores. Cor sozinha não comunica a natureza do número.

## Typography

**Display Font:** Figtree, sans-serif. **Body Font:** Figtree, sans-serif. Não há família mono separada. As fontes são incorporadas ao artefato pelo build.

A mesma família liga marca, títulos, dados e conversa. A escala privilegia leitura de painel: o título da página e os indicadores organizam a varredura; títulos menores, rótulos e metadados mantêm a interface compacta.

- **Headline:** título de página conforme o token; páginas independentes usam 29px. No mobile, título do dashboard passa a 25px e páginas independentes a 26px.
- **Title:** títulos de painéis conforme o token; subtítulos simples usam 14px/600. Diálogos usam 18px, passando a 16px no mobile.
- **Body:** base global conforme o token; parágrafos comuns têm entrelinha 1,6. Conteúdo de interface frequentemente usa 11–12px.
- **Conversation:** mensagem do assistente conforme o token; passa a 13px no mobile e em telas largas. A mensagem do usuário usa fundo tonal e texto de 11px, aumentando para 12px nesses contextos.
- **Label:** botões e controles compactos conforme o token. Campos de formulário usam 12px. Legendas e metadados auxiliares existentes usam 9–11px; esses tamanhos não constituem uma autorização genérica para reduzir textos importantes.
- **Metric:** usa números tabulares e o token de métrica. A folha ajusta o valor principal para 24px no desktop estreito, 25px no tablet, 26px no mobile e 34px em telas largas. O valor de cenário usa 38px/500 no desktop.

**The Numeric Alignment Rule.** Preserve números tabulares nas métricas e tabelas e alinhe valores comparáveis em colunas.

## Layout

O shell ocupa `100dvh`, com cabeçalho de 60px e área interna com rolagem própria. A navegação padrão mede 216px; recolhida, mede 72px. O painel direito padrão mede 354px. O conteúdo usa margens internas de 24px verticalmente, 28px horizontalmente e 18px na base. Chat e editor compartilham a posição lateral; somente um fica visível.

O dashboard usa quatro métricas em uma faixa única, dois gráficos em colunas de proporção 1,04:1 e tabela com rolagem horizontal quando necessária. Os gráficos usuais medem 230px de altura. A biblioteca usa três colunas, enquanto planejamento, cenários e modelos reutilizam painéis e tabelas. O ritmo combina intervalos de 8–12px nos controles e 16–24px entre blocos; não existe uma escala espacial única declarada no CSS.

| Condição observada | Mudança implementada |
| --- | --- |
| A partir de 1700px | Navegação 232px, assistente 390px, conteúdo com 36px laterais; gráficos do dashboard com 270px de altura. |
| 1100–1430px | Navegação 192px, assistente 320px, conteúdo com 20px laterais; cabeçalho de página pode quebrar e biblioteca usa duas colunas. |
| Até 1099px | Navegação 200px; painel direito fixo sobre o conteúdo, limitado a 390px ou à largura da tela, com backdrop. Botão flutuante reabre o assistente. |
| Até 767px | Cabeçalho 56px; navegação em painel móvel de 232px. Conteúdo com 16px laterais; métricas em duas colunas, gráficos e biblioteca em uma. Filtros em duas colunas com o terceiro em largura total. Chat/editor sobreposto abaixo do cabeçalho. |

Chat inicia aberto apenas com largura de pelo menos 1100px. Ocultá-lo no desktop permite ao conteúdo flexível ocupar a largura disponível. Escape e o backdrop fecham o painel nas telas menores. As definições de breakpoint e extensões ficam no sidecar.

## Elevation & Depth

Painéis, métricas e cartões são planos: superfície branca, borda leve e separadores definem a estrutura. A profundidade é reservada ao diálogo nativo, ao painel lateral sobreposto, ao botão flutuante e ao toast. Os valores completos estão em `extensions.shadows` do sidecar.

**The Overlay Depth Rule.** Use relevo para indicar conteúdo sobreposto; mantenha os painéis analíticos apoiados em bordas e variação tonal.

Botões transitam cor e borda em 150ms; toast e navegação móvel transitam em 180ms. A preparação usa uma linha animada de 1,3s. Gráficos desativam animações de séries. `prefers-reduced-motion: reduce` remove animações e transições.

## Shapes

Os raios do frontmatter refletem a hierarquia observada: controles compactos, seleção de navegação intermediária, painéis e composer arredondados discretamente, diálogo mais amplo. Avatares e pontos de status são circulares. Barras de gráfico têm cantos superiores de 3px. A mensagem do usuário usa raio assimétrico `8px 8px 2px 8px`. Bordas usuais são de 1px; foco visível usa contorno de 2px com afastamento de 3px.

## Components

### Buttons

Ações compactas com ícone SVG e texto. A altura mínima é 34px, com os preenchimentos do frontmatter. Primário usa azul; secundário usa branco e borda; quieto mantém fundo transparente. Hover altera fundo/borda; `:focus-visible` recebe contorno azul. Desabilitado usa opacidade 0,5 e cursor indisponível. Botões apenas com ícone têm 32px e nome acessível; envio do chat tem 28px.

### Chips

Badges são metadados estáticos, com raio próprio e tipografia de 10px/500. Tons neutro, azul, verde e âmbar distinguem contexto e status. Filtros segmentados são botões separados: seleção tem fundo azul claro e peso 600. Não transformar todos os badges em ações.

### Cards / Containers

Painéis e cartões usam superfície branca, borda `line` e raio de superfície, sem sombra padrão. Cabeçalhos de painéis têm 18px acima, 20px nas laterais e 10px abaixo. A faixa de métricas usa divisórias internas e 20px laterais por métrica. Cartões da biblioteca adicionam miniatura tonal e abertura explícita pelo título/preview.

### Inputs / Fields

Campos têm altura padrão de 38px, fundo branco e borda de campo. Filtros compactos têm 33px, aumentando para 36px no mobile. Labels permanecem visíveis; placeholder é apoio. Foco usa contorno global, e o composer usa mudança da borda no `:focus-within`. Campos de orçamento exibem números tabulares. Restrições são demonstradas por campos e ações desabilitados, além de aviso de Leitor; não há contrato de validação visual de erro por campo.

### Navigation

Navegação vertical com ícones SVG de 18px, texto de 12px e itens de pelo menos 41px. Estado ativo usa fundo azul suave, texto azul e peso 600, com `aria-current="page"`; hover clareia o fundo. No dashboard, o destino Dashboards permanece ativo. O menu recolhido preserva os ícones; no mobile, abre sobre backdrop abaixo do cabeçalho.

### Contextual assistant and editor

Painel branco com cabeçalho, contexto, área rolável e composer fixado ao rodapé. Mensagens do assistente ficam sobre a superfície; mensagens do usuário recebem fundo tonal. Propostas agrupam critérios e uma ação explícita de geração/aplicação. Há preparação, sugestão, pedido não suportado e fonte pausada. O editor reutiliza o mesmo shell com campos, seleção de visualização e rodapé de ações. A interface identifica a IA demonstrativa.

### Tables, dialogs and feedback

Tabelas usam cabeçalho tonal, linhas separadas e valores tabulares; a tabela detalhada alinha números à direita. Desvios recebem texto de status além de cor. A região de registros rolável é focalizável. Diálogo usa `<dialog>`, backdrop, título acessível, fechamento por Escape/clique externo e devolução de foco ao controle anterior. Toast usa `role="status"` e desaparece após 4,5s. Avisos de Leitor e indisponibilidade usam superfície âmbar; estados vazios mantêm título e explicação centralizados.

## Do's and Don'ts

### Do:
- **Do** manter a identidade CLARA/Figtree dentro da organização empresarial inspirada em SAP Analytics Cloud/Fiori.
- **Do** preservar a distinção visual e textual entre realizado, orçamento, simulação e projeção.
- **Do** usar bordas e superfícies tonais para estruturar os painéis e reservar sombras às sobreposições.
- **Do** preservar foco visível, nomes de controles, números tabulares e a alternativa de tabela existente.
- **Do** manter o contexto do assistente e o conteúdo analítico legíveis ao mudar o tamanho da tela.

### Don't:
- **Don't** importar a referência BTG da aplicação principal como regra visual deste protótipo.
- **Don't** apresentar a referência SAP como adoção de biblioteca oficial ou vínculo de marca.
- **Don't** comunicar disponibilidade, desvio ou natureza de uma medida somente por cor.
- **Don't** tratar esta extração de código como aprovação final de legibilidade, acessibilidade ou comportamento.
- **Don't** promover o pequeno rótulo em caixa alta das sugestões a um padrão de títulos ou identidade.
