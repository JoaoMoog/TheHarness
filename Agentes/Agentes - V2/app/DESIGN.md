---
name: CLARA
description: Central de Leitura, Análise e Relatórios Assistidos
colors:
  navy: "#0b2348"
  primary: "#2166d1"
  primary-strong: "#1853ae"
  primary-soft: "#eaf1fc"
  comparison: "#087f8c"
  ink: "#102846"
  canvas: "#f3f6fa"
  surface: "#fff"
  text-secondary: "#53657b"
  line: "#dce4ee"
  accent: "#a7bfdf"
  on-navy: "#c4d4ed"
  success: "#176847"
  success-soft: "#e6f2ec"
  warning: "#895100"
  danger: "#b42328"
  danger-soft: "#fff1f1"
typography:
  display:
    fontFamily: "Figtree, sans-serif"
    fontSize: "clamp(44px, 5vw, 76px)"
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Figtree, sans-serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Figtree, sans-serif"
    fontSize: "21px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  section:
    fontFamily: "Figtree, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Figtree, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Figtree, sans-serif"
    fontSize: "13px"
    fontWeight: 500
  metric:
    fontFamily: "Figtree, sans-serif"
    fontSize: "clamp(28px, 3.1cqi, 44px)"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-0.035em"
rounded:
  control: "8px"
  panel: "16px"
spacing:
  micro: "4px"
  compact: "8px"
  small: "12px"
  regular: "16px"
  comfortable: "20px"
  section: "24px"
  large: "32px"
  page: "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-strong}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-secondary-hover:
    backgroundColor: "{colors.primary-soft}"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-text:
    textColor: "{colors.primary-strong}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "11px 12px"
  navigation-active:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary-strong}"
    rounded: "{rounded.control}"
    padding: "11px 14px"
  filter-chip:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.navy}"
    rounded: "{rounded.control}"
    padding: "6px 8px"
  report-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "24px"
  metric-primary:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.surface}"
    typography: "{typography.metric}"
    rounded: "{rounded.panel}"
    padding: "26px"
  assistant-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    width: "360px"
---

# Design System: CLARA

## Overview

**Creative North Star: "Clareza para decidir"**

CLARA transforma perguntas de negócio em análises que a pessoa pode conferir. A identidade é sóbria e próxima: azul profundo estabelece contexto, azul de ação orienta o próximo passo e superfícies claras deixam os números respirar. A densidade é confortável, com origem e cálculo disponíveis junto do resultado.

O mundo visual interpreta referências públicas do aplicativo BTG Pactual Investimentos para uma aplicação web de análise executiva. Não utiliza um pacote oficial do design system BTG nem representa vínculo de marca. A identidade anterior foi substituída; os briefs anteriores permanecem históricos.

**Key Characteristics:**

- Hierarquia executiva, valores tabulares e linguagem de negócio.
- Superfícies brancas, contornos discretos e destaques navy.
- Assistente recolhível que preserva o trabalho em andamento.
- Estados descritos por palavras, foco visível e movimento breve.

Extraído em 10/10/2026 de `src/app/globals.css`, `src/app/workspace.css`, `src/ui/` e `src/core/brand.ts`. O frontmatter é normativo; [design.json](.impeccable/design.json) contém extensões e amostras.

## Colors

A paleta combina azul institucional, superfícies frias e ciano de comparação. Os valores canônicos estão no frontmatter.

### Primary

`navy` sustenta marca, login, introdução e indicador principal. `primary` orienta ações, foco e série principal. `primary-strong` aparece em hover, links e navegação ativa; `primary-soft` apoia seleção, interpretação, mensagens e filtros.

### Secondary

`comparison` identifica orçamento e sinais discretos de atividade. O alias CSS `--slate-blue` usa o mesmo valor; essa série não representa sucesso.

### Neutral

`ink` e `text-secondary` separam leitura e contexto. `canvas` e `surface` distinguem página e áreas de trabalho; `line` e `accent` definem contornos. `on-navy` mantém contexto legível nas superfícies escuras. Sucesso, atenção e erro usam seus tokens semânticos e mensagens explícitas.

**The Meaningful Color Rule.** Cor reforça rótulos, estados e séries; nunca comunica sozinha um erro, uma diferença de orçamento ou a origem demonstrativa dos dados.

## Typography

Figtree, com fallback sans-serif e pesos locais 400, 500, 600 e 700. Display serve ao login; headline aos títulos de página; title/section às seções; body/label à leitura e aos formulários. Os valores do frontmatter refletem o desktop. A prévia usa título de 24px e metadados usam 11–12px. Textos explicativos têm limites locais de 60–70ch.

Abaixo de 768px, o título de página passa a 27px, o display do login a 46px e campos de texto a 16px. Métricas usam números tabulares: até 850px de contêiner, 27px; até 600px, 32px com cartões empilhados.

**The Readable Number Rule.** Manter unidade, precisão e contexto do indicador; alinhar valores de tabela à direita e usar algarismos tabulares.

## Layout

Cabeçalho sticky de 72px, navegação horizontal no desktop e conteúdo em toda a largura disponível. A página usa padding de 32px 24px 48px; abaixo de 768px, 24px 16px 32px. Cartões de relatórios formam grade fluida com base mínima de 330px e intervalo de 20px.

Na criação, a análise ocupa a coluna principal e o assistente aberto usa 360px à direita, com intervalo de 24px. Recolher devolve essa largura à análise. O painel desktop é um `dialog` nativo não modal, sticky em 88px. Abaixo de 1024px, vira modal com margens de 16px e largura máxima de 440px. Navegação horizontal e conta também cedem lugar ao menu responsivo.

Gráficos passam a uma coluna até 850px de contêiner; os três indicadores de orçamento empilham até 600px. Abaixo de 768px, entrada, fontes e integrações usam uma coluna. Tabelas rolam dentro da própria área sem alargar o documento. O ritmo principal usa múltiplos de quatro, com ajustes locais observados no código.

## Elevation & Depth

As áreas de trabalho são planas: fundo, borda e contraste tonal definem a hierarquia. Seletores e menu da conta usam a sombra `0 12px 36px rgba(11,35,72,.14)`. Modais escurecem o fundo com `rgba(11,35,72,.42)`.

**The Quiet Surface Rule.** Cartões e painéis permanecem sem sombra; reservar elevação para conteúdo temporário sobreposto.

## Shapes

Controles usam `rounded.control`; painéis usam `rounded.panel`, com borda de 1px. O menu da conta mantém raio local de 12px; avatar e sinais de estado são circulares. O wordmark CLARA é tipográfico, com ponto azul. Ícones Lucide de 14–22px acompanham ações e contexto; tamanhos maiores ficam nas entradas e estados vazios.

## Components

- **Buttons:** primário azul, secundário branco com borda, perigo vermelho e ação textual. Primários e ícones de ação têm alvo de 44px; ações locais menores seguem o código. Hover escurece o primário ou colore suavemente o secundário. Desabilitado usa opacidade 0,55. Foco: contorno azul de 2px, afastado 3px. Transições de cor: 180ms.
- **Chips:** filtros ativos em azul suave, texto navy e remoção nomeada por campo/valor. Tags de estado incluem texto; disponibilidade pode usar superfície suave de sucesso.
- **Cards / Containers:** branco, borda fria e raio de painel; padding comum de 24px. Indicadores revelam cálculo e origem: primeiro navy, demais branco e, no desvio, ciano suave. Valores usam números tabulares.
- **Inputs / Fields:** rótulos visíveis, borda fria e hover azul de apoio. Seletor Radix com alvo padrão de 44px; filtros compactos usam 40px. Opção destacada em azul suave. Dentro de modal, o portal permanece no diálogo.
- **Navigation:** ícone e texto; ativo com azul suave, texto azul forte, peso 600 e `aria-current`. Menu responsivo e conta aceitam Escape e retorno de foco.
- **Assistant and Preview:** recolher preserva texto, histórico, erro, filtros e pedido em andamento. “Ver dashboard” leva foco ao título. “Prévia para conferir” fica junto de “Salvar dashboard”. Interpretação precede filtros e resultados; salvar é explícito. A revelação dura 180ms com `cubic-bezier(.16,1,.3,1)`, sem esconder o conteúdo inicial.
- **Charts and Tables:** gráficos de 300px, azul/ciano, legenda e traçado alternativo na comparação temporal. Títulos em forma de pergunta e descrição acessível remetem à tabela de valores exatos. Tabela com cabeçalhos semânticos, ordenação e detalhes por grupo. Gráficos não animam; `prefers-reduced-motion: reduce` desativa animações e transições da interface.

### Continuidade e conferência — 11/10/2026

“Análise em andamento” é uma faixa responsiva antes da entrada de perguntas, com fonte e ação “Retomar análise”; no celular, a ação ocupa a largura disponível. O resumo do cálculo usa superfície azul suave antes da confirmação de importação. Recuperação de conversas aparece junto ao compositor, inclusive no modal móvel. Estado do recorte e restauração ficam junto aos filtros. Cada gráfico mantém um disclosure “Ver valores”, com tabela semântica própria e rolagem local; a evolução inclui o intervalo e o ano quando necessário. Esses componentes usam os tokens existentes. Capturas atuais: `.local/daily-review/`.

## Do's and Don'ts

### Evolução de análises e equipe — 11/10/2026

Configurações de indicadores, fórmulas, comparação e seleções ficam em disclosure. Mudanças e exceções aparecem próximas dos resultados, com acesso ao recorte e ao cálculo. Qualidade e versões pertencem ao contexto da fonte; editar e restaurar dashboards exigem confirmação explícita. Rascunhos exibem seu estado de sincronização e recuperação. O espaço e papel ficam junto da navegação, e a administração usa os mesmos controles e tokens. Relatórios têm prévia isolada antes do download. Tabelas mantêm rolagem local no celular. Capturas atuais: `.local/evolution-review/`.

### Do:

- **Do** usar CLARA e sua assinatura tipográfica nas superfícies atuais.
- **Do** manter fonte, filtros, interpretação e caminho do número próximos da análise.
- **Do** preservar texto e estado ao recolher o assistente e mudar de breakpoint.
- **Do** usar foco visível, rótulos explícitos e respeitar redução de movimento.
- **Do** distinguir demonstração, prévia e dashboard salvo por palavras.

### Don't:

- **Don't** apresentar a referência pública BTG como design system oficial ou vínculo de marca.
- **Don't** adicionar gradientes, vidro, sombras em cartões ou ícones decorativos de IA.
- **Don't** depender apenas de cor para explicar estado ou comparação.
- **Don't** expandir tabelas além do documento nem desperdiçar a largura do dashboard.
- **Don't** inventar dados, cálculos ou conexões reais para preencher a interface.
