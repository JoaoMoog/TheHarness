# Aval: resumo para continuar em outra sessão

Atualizado em 04/10/2026.

## Objetivo
Redesenhar a UI/UX do protótipo Aval (custódia, crédito e antecipação por marcos, operado por banco parceiro) com cara de BTG Pactual. São menos fluxos e cliques e menos texto, mantendo toda a lógica e todas as funções do escopo. O protótipo será mostrado ao BTG.

## Regras combinadas com o João
- Responder em português.
- Não editar o Figma original (`pk4sefUmHixSyrtb8ikLIm`, "Aval, Protótipo para BTG"). Só leitura com get_metadata e get_screenshot. Ele recusou até `use_figma` de leitura nesse arquivo.
- Quando for para o Figma, construir num arquivo NOVO. Ele escolheu "Arquivo novo" e ainda não aprovou começar.
- Só alta fidelidade. Wireframes lo-fi foram rejeitados.
- Visual BTG: usar as skills web-design-guidelines (vercel-labs), awesome-design-md (VoltAgent), taste (Leonxlnx) e impeccable (pbakaus). Clonar do GitHub, porque não estão no catálogo.
- O escopo precisa estar 100% coberto. Nada parcial, nada faltando.
- Logo do BTG obrigatório nas telas.

## Design system aplicado (Orquestra v7, do BTG)
- Ação `#195AB4` (pressionado `#134489`). Navy de marca `#0B2859` e `#05132A`, só em blocos de marca.
- Fundo `#F5F5F6`, cards brancos, texto preto a 96%, 80% e 64%.
- Indicadores: positivo `#128850`, negativo `#CE363F`, destaque `#174E9F`.
- Fonte: Figtree em peso 400 e 500, substituindo a BTG Pactual Sans, que é proprietária. Hierarquia pelo tamanho.
- Raios: 8 em cards e folhas, pílula em botões e chips, 50% em avatares. Sombras mínimas.
- Logo: `#001E61` no original, versão branca sobre navy.
- Ícones Phosphor regular.
- Sem travessão, sem eyebrow e sem emoji.

## Estrutura proposta
- App com 3 abas: Início, Serviços e Financeiro.
- A página do serviço é o centro de cada contrato.
- Confirmações acontecem em folhas, e estados são variantes da mesma tela.
- O Aval IA fica num botão flutuante.
- O website do banco tem 4 áreas: Visão geral, Operações, Fila de trabalho e Clientes e limites. Decisões acontecem num painel lateral.

## Telas prontas (HTML hi-fi, 390×844 no app e 1280×800 no web)
- **App base:** Entrada, Início do contratante, Página do serviço, Aprovar etapa, Pagar, Novo serviço (etapas) e Início do prestador.
- **App, completando o escopo:**
  - Financeiro, com limite e parcela atrasada
  - Pagar sem limite (só à vista)
  - Decidir a entrada
  - Conta em análise (antifraude)
  - Contrato coletivo, com rateio e origem ELO
  - Aceitar convite, com pedido de entrada e cláusula de arbitragem
  - Enviar entrega, com foto, vídeo, documento e local
  - Antecipação indisponível, com os requisitos
  - Abrir disputa
  - Acompanhar disputa
  - Resultado e arbitragem
  - Link da maquininha
- **Website do banco:** Visão geral, Operações (com cobrança), Conciliação e histórico, Fila de trabalho (disputa, risco, KYC e reputação) e Clientes e limites.
- **Caso de demonstração:** AV-2026-001, Marina Costa e Horizonte Reformas. R$ 12.000 em 3 etapas (3.600, 4.800 e 3.600), 6x de R$ 2.153,02, CET 29,05%.

## Escopo
O documento de escopo veio em 22 fotos, que estão em `escopo/`. Elas cobrem as seções 00 a 08 e 11 a 13. As seções 09, 10, 14 e 15 não vieram.

A tabela "Escopo contra o plano" fica no fim da página publicada. Ela lista 39 de 39 funções cobertas, com link para cada tela. Quatro funções não existiam nem no Figma original: confirmação tácita, cláusula de arbitragem, pedido de perícia e contrato coletivo.

## Onde estão as coisas
- **Página publicada (sem logo):** https://claude.ai/artifact/J4sRNnpe4Gp2bZyuxDJ5cL, versão 5. Ela leva só "Aval" em texto, porque o logo do BTG é marca de terceiros.
- **Versão com logo do BTG:** `/mnt/project-files/aval/aval-telas-btg.html`, com as imagens em `aval/img/`.
- **Mesma página sem logo, em arquivo:** `/mnt/project-files/aval/aval-fluxos-v2.html`.
- **Fontes para editar:** `/mnt/project-files/aval/fonte/`
  - `src/telas.html` é a página principal, já com as telas novas inseridas. `src/escopo-app.html` e `src/escopo-web.html` são cópias dos blocos novos.
  - `extra.css` são os estilos dos blocos novos, que já estão dentro de `telas.html`.
  - `sprite.html` traz os ícones Phosphor como `i-<nome>`.
  - `img/` traz as ilustrações tiradas do Figma.
  - `btg-logo/btg-logo-white.svg` é o logo.
  - Rodar `python3 build.py` dentro de `fonte/` gera `aval-fluxos-v2.html` (sem logo) e `aval-telas-btg.html` (com logo).

## Limitações do ambiente
- O proxy bloqueia btgpactual.com, as imagens das lojas de apps (mzstatic e play-lh) e o api.github.com. WebFetch e git clone funcionam.
- Por isso não deu para ver o app BTG Banking.
- Assets do Figma só chegam com `get_screenshot` usando `enableBase64Response:true`.

## Pendências
1. **Prints do app BTG Banking** (Início, Pix, Cartões, extrato, menu e uma confirmação), para alinhar abas, cabeçalho e atalhos. Pedidos ao João, ainda sem resposta.
2. **Seções 09, 10, 14 e 15 do escopo**, se tiverem funções.
3. **Skill `/typesafe:typesafe-ai`**: o João pediu para usar, mas ela não existe nesta conta nem no catálogo. Foi pedido o link do GitHub ou o SKILL.md.
4. **Figma:** depois que o João aprovar a direção visual, montar as telas no arquivo NOVO.
5. **Logo:** validar com o time de marca do BTG as regras de uso (área de proteção e tamanho mínimo, que estão no Brand Center).
